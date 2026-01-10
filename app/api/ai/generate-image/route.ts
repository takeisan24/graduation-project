import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { generateImageWithCredits } from "@/lib/services/ai/imageGenerationService";

// Allow up to 60s for image generation (Vercel Pro plan).
// Free plan caps at 30s — upgrade if image gen consistently times out.
export const maxDuration = 60;

/**
 * POST /api/ai/generate-image
 * Generate image content using AI (default: Gemini, can select OpenAI/Fal)
 * Merged logic from /api/generate-image
 */
export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    const {
      prompt,
      platform = 'general',
      size = '1024x1024',
      modelId,
      n = 1,
      aspectRatio = '1:1',
      useSearch = false,
      imageSize = '1K'
    } = body;

    // Generate image via service layer
    const result = await generateImageWithCredits(req, {
      prompt,
      platform,
      size,
      modelId,
      n,
      aspectRatio,
      useSearch,
      imageSize
    });

    // Handle error response
    if ('error' in result) {
      return fail(result.error, result.status);
    }

    // Return success response
    return success(result);

  } catch (err: any) {
    console.error("POST /api/ai/generate-image error:", err);
    const errorMessage = err instanceof Error ? err.message : "Server error";
    return fail(JSON.stringify({
      error: "Image generation failed",
      message: errorMessage,
      creditsDeducted: false
    }), 500);
  }
}
