/**
 * Service: Content Generation
 * 
 * Handles text content generation business logic including:
 * - Credit checking and deduction
 * - Usage tracking
 * - Error handling
 * - Multi-platform generation
 */

import { NextRequest } from "next/server";
import { generatePlatformText } from "@/lib/ai/generator-v2";
import { trackUsage, deductCredits, CREDIT_COSTS } from "@/lib/usage";
import { withApiProtection } from "@/lib/middleware/api-protected";

export interface TextGenerationRequest {
  title: string;
  summary: string;
  platform?: string;
  platforms?: string[];
  tone?: string;
}

export interface TextGenerationResult {
  results: Array<{
    platform: string;
    text: string;
    tone: string;
    error?: string;
  }>;
  totalPlatforms: number;
  successCount: number;
  creditsRemaining: number;
  message: string;
}

/**
 * Generate text content for multiple platforms with credit management
 */
export async function generateTextWithCredits(
  req: NextRequest,
  request: TextGenerationRequest
): Promise<TextGenerationResult | { error: string; status: number }> {
  const {
    title,
    summary,
    platforms = ['instagram'],
    tone = 'professional'
  } = request;

  if (!title || !summary) {
    return { error: "Title and summary are required", status: 400 };
  }

  // Centralized protection: auth + paywall check (skip deduction until success)
  const protection = await withApiProtection(req, 'TEXT_ONLY', {
    count: platforms.length,
    returnError: true,
    skipDeduct: true // Only check auth + paywall, deduct after success
  });
  if ('error' in protection) {
    // protection.error is a NextResponse, but we need to return { error: string; status: number }
    // Extract error from response body or use generic message
    return { error: "Unauthorized or insufficient credits", status: 401 };
  }

  const { user, paywallResult } = protection;

  // Check if user has enough credits (before generation)
  const totalCreditsNeeded = CREDIT_COSTS.TEXT_ONLY * platforms.length;
  if (!paywallResult.allowed || (paywallResult.creditsRemaining !== undefined && paywallResult.creditsRemaining < totalCreditsNeeded)) {
    return {
      error: JSON.stringify({
        message: paywallResult.reason || "Insufficient credits",
        upgradeRequired: paywallResult.upgradeRequired ?? true,
        creditsRequired: totalCreditsNeeded,
        creditsRemaining: paywallResult.creditsRemaining ?? 0,
        totalCredits: paywallResult.totalCredits ?? 0,
        count: platforms.length
      }),
      status: 403
    };
  }

  // Generate text for each platform (Parallelized)
  const resultPromises = platforms.map(async (platformItem) => {
    try {
      const text = await generatePlatformText(platformItem, { title, summary });
      return {
        platform: platformItem,
        text,
        tone,
        success: true
      };
    } catch (error) {
      console.error(`Error generating text for ${platformItem}:`, error);
      return {
        platform: platformItem,
        text: `Auto-generated content for ${platformItem}`,
        tone,
        error: "Generation failed",
        success: false
      };
    }
  });

  const rawResults = await Promise.all(resultPromises);

  // Format results and count successes
  const results = rawResults.map(({ success: _success, ...rest }) => rest);
  const successCount = rawResults.filter(r => r.success).length;

  // Deduct credits ONLY for successful generations
  // If all platforms failed, don't deduct
  if (successCount > 0) {
    // Deduct for each successful platform
    for (let i = 0; i < successCount; i++) {
      const creditResult = await deductCredits(user.id, 'TEXT_ONLY', {
        platforms: platforms.join(','),
        tone,
        title: title.substring(0, 50),
        successCount,
        totalPlatforms: platforms.length
      });

      if (!creditResult.success) {
        console.error("Failed to deduct credits after text generation:", creditResult);
      }
    }
  }

  // Track usage
  await trackUsage(user.id, 'project_created');

  // Get latest credits after deduction
  const latestCredits = paywallResult.creditsRemaining ? paywallResult.creditsRemaining - (successCount * CREDIT_COSTS.TEXT_ONLY) : paywallResult.creditsRemaining ?? 0;

  return {
    results,
    totalPlatforms: platforms.length,
    successCount,
    creditsRemaining: latestCredits,
    message: `Generated text content for ${successCount}/${platforms.length} platform(s)`
  };
}

