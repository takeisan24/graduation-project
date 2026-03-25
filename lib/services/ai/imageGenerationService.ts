/**
 * Service: Image Generation
 *
 * Handles image generation business logic including:
 * - Credit checking and deduction
 * - Usage tracking
 * - Automatic provider fallback (Gemini → DALL-E → Fal.ai)
 * - Error handling and rollback
 * - Response formatting
 */

import { NextRequest } from "next/server";
import { aiManager } from "@/lib/ai/providers/manager";
import { getBestModel } from "@/lib/ai/config";
import { MEDIA_ERRORS } from "@/lib/messages/errors";
import { trackUsage, deductCredits, rollbackCredits, CREDIT_COSTS } from "@/lib/usage";
import { withApiProtection } from "@/lib/middleware/api-protected";

export interface ImageGenerationRequest {
  prompt: string;
  platform?: string;
  size?: string;
  modelId?: string;
  n?: number;
  aspectRatio?: string;
  useSearch?: boolean;
  imageSize?: "1K" | "2K" | "4K";
}

export interface ImageGenerationResult {
  images?: Array<{ base64: string; mimeType: string }>;
  imageUrl?: string;
  jobId?: string;
  status?: 'processing';
  prompt: string;
  platform: string;
  model: string;
  creditsRemaining: number;
  message: string;
}

/**
 * Lightweight Prompt Parsing (regex-based, no AI call)
 * Splits prompt into multiple parts if it clearly contains numbered image descriptions.
 * Avoids extra API call to reduce latency and potential failures.
 */
function parsePrompts(originalPrompt: string): string[] {
  // Only attempt split for longer prompts with clear multi-image patterns
  if (originalPrompt.length < 50) {
    return [originalPrompt];
  }

  // Match patterns like "Image 1:", "Ảnh 1:", "Hình 1:" — requires label + number + colon/period
  // Avoids false positives like "Image 1980x1024" or "1. Xin chào" (generic numbered lists)
  const splitPattern = /(?:^|\n)\s*(?:Image|Picture|Ảnh|Hình)\s*\d+\s*[:.]\s*/gi;
  const matches = [...originalPrompt.matchAll(splitPattern)];

  if (matches.length >= 2) {
    const prompts: string[] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index! + matches[i][0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index! : originalPrompt.length;
      const segment = originalPrompt.slice(start, end).trim();
      if (segment) prompts.push(segment);
    }
    if (prompts.length >= 2) {
      return prompts;
    }
  }

  return [originalPrompt];
}

/**
 * Generate image with credit management, provider fallback, and error handling.
 *
 * Flow:
 * 1. Auth + paywall check (no credit deduction yet)
 * 2. Parse prompts (regex, sync)
 * 3. Generate images with automatic provider fallback (Gemini → DALL-E → Fal.ai)
 * 4. Deduct credits ONLY after successful generation
 * 5. Return images + updated credit balance
 */
export async function generateImageWithCredits(
  req: NextRequest,
  request: ImageGenerationRequest
): Promise<ImageGenerationResult | { error: string; status: number }> {
  const {
    prompt,
    platform = 'general',
    size = '1024x1024',
    modelId,
    n = 1,
    aspectRatio = '1:1',
    useSearch = false,
    imageSize = '1K'
  } = request;

  if (!prompt) {
    return { error: "Prompt is required", status: 400 };
  }

  // Default to Gemini if no modelId provided
  const imageModel = modelId || getBestModel('image');

  // Centralized protection: auth + paywall check (skip deduction until success)
  const protection = await withApiProtection(req, 'WITH_IMAGE', {
    returnError: true,
    skipDeduct: true // Only check auth + paywall, deduct after success
  });
  if ('error' in protection) {
    return { error: "Unauthorized", status: protection.error.status ?? 401 };
  }

  const { user, paywallResult } = protection;

  // Check if user has enough credits (before generation)
  if (!paywallResult.allowed) {
    return {
      error: JSON.stringify({
        message: paywallResult.reason || "Insufficient credits",
        upgradeRequired: paywallResult.upgradeRequired ?? true,
        creditsRequired: 5 * n,
        creditsRemaining: paywallResult.creditsRemaining ?? 0,
        totalCredits: paywallResult.totalCredits ?? 0
      }),
      status: 403
    };
  }

  // 1. ANALYZE & SPLIT PROMPT (regex-based, synchronous — no extra API call)
  const parsedPrompts = parsePrompts(prompt);

  const isMultiPrompt = parsedPrompts.length > 1;
  const promptsToRun = isMultiPrompt ? parsedPrompts : [prompt];

  let allImages: Array<{ base64: string; mimeType: string }> = [];
  let creditsDeducted = false;
  let finalCreditCount = 0;
  let actualModelUsed = imageModel;

  try {
    // 2. GENERATE IMAGES WITH AUTOMATIC PROVIDER FALLBACK
    const promises = promptsToRun.map(singlePrompt =>
      aiManager.generateImageWithFallback({
        modelId: imageModel,
        prompt: singlePrompt,
        n: isMultiPrompt ? 1 : n,
        size,
        aspectRatio,
        useSearch,
        imageSize,
        onProviderSwitch: (fromModel, toModel) => {
          // Provider switch tracked
        }
      }).catch(err => {
        console.error(`Failed to generate for prompt: "${singlePrompt.substring(0, 40)}..."`, err);
        return null;
      })
    );

    const results = await Promise.all(promises);

    // Aggregate results
    for (const result of results) {
      if (!result) continue;

      // Track which model actually succeeded
      if (result.usedModel) {
        actualModelUsed = result.usedModel;
      }

      if (result.images && result.images.length > 0) {
        allImages.push(...result.images);
      } else if (result.url && result.url.length > 0) {
        // For URL-based results (OpenAI/Fal), fetch and convert to base64
        // so frontend always receives a consistent format
        try {
          const imgResponse = await fetch(result.url);
          if (imgResponse.ok) {
            const buffer = await imgResponse.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const contentType = imgResponse.headers.get('content-type') || 'image/png';
            allImages.push({ base64, mimeType: contentType });
          }
        } catch (fetchErr) {
          console.warn('[generateImageWithCredits] Failed to fetch URL image, returning as imageUrl:', fetchErr);
        }
      }
    }

    // Fallback: If we still have a URL-based result and couldn't fetch it
    let singleImageUrl: string | undefined = undefined;
    if (allImages.length === 0 && results.length === 1 && results[0]?.url) {
      singleImageUrl = results[0].url;
      finalCreditCount = 1;
    } else {
      finalCreditCount = allImages.length;
    }

    if (allImages.length === 0 && !singleImageUrl) {
      throw new Error(MEDIA_ERRORS.NO_IMAGES_RETURNED);
    }

    // 3. DEDUCT CREDITS BASED ON ACTUAL COUNT (only after success)
    const countToCharge = isMultiPrompt ? finalCreditCount : (finalCreditCount > 0 ? finalCreditCount : n);
    const costPerImage = CREDIT_COSTS.WITH_IMAGE;
    const totalCost = costPerImage * countToCharge;

    const creditResult = await deductCredits(user.id, 'WITH_IMAGE', {
      model: actualModelUsed,
      platform,
      prompt: prompt.substring(0, 100),
      size,
      aspectRatio,
      n: countToCharge
    }, undefined, totalCost, countToCharge);

    if (!creditResult.success) {
      console.error("Failed to deduct credits after image generation:", creditResult);
    } else {
      creditsDeducted = true;
      await trackUsage(user.id, 'image_generated');
    }

    const creditsRemaining = creditResult.creditsLeft ?? paywallResult.creditsRemaining ?? 0;

    if (allImages.length > 0) {
      return {
        images: allImages,
        prompt,
        platform,
        model: actualModelUsed,
        creditsRemaining,
        message: `Successfully generated ${allImages.length} images.`
      };
    } else if (singleImageUrl) {
      return {
        imageUrl: singleImageUrl,
        prompt,
        platform,
        model: actualModelUsed,
        creditsRemaining,
        message: "Image generated successfully"
      };
    }

  } catch (error: unknown) {
    console.error("Image generation process failed:", error);

    const errorMessage = error instanceof Error ? error.message : "Image generation failed";
    return {
      error: JSON.stringify({
        error: "Image generation failed",
        message: errorMessage,
        creditsDeducted: false
      }),
      status: 500
    };
  }

  return { error: "Unknown state", status: 500 };
}
