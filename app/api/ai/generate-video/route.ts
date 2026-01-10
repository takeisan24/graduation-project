import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { generateVideoWithCredits } from "@/lib/services/ai/videoGenerationService";
import { requireAuth } from "@/lib/auth";

/**
 * POST /api/ai/generate-video
 * Generate video content using AI (default: Gemini, can select Fal)
 * Merged logic from /api/generate-video
 */

export const maxDuration = 1800; // 30 minutes

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    const {
      prompt,
      platform = 'general',
      modelId,
      negativePrompt,
      aspectRatio = '16:9',
      resolution = '1080p'
    } = body;

    // Get user ID for service
    const user = await requireAuth(req);
    if (!user) {
      return fail("Unauthorized", 401);
    }

    // Generate video via service layer
    const result = await generateVideoWithCredits(req, {
      prompt,
      platform,
      modelId,
      negativePrompt,
      aspectRatio,
      resolution,
      userId: user.id
    });

    // Handle error response
    if ('error' in result) {
      return fail(result.error, result.status);
    }

    // Return success response
    return success(result);

  } catch (err: any) {
    console.error("POST /api/ai/generate-video error:", err);
    const errorMessage = err instanceof Error ? err.message : "Server error";
    return fail(JSON.stringify({
      error: "Video generation failed",
      message: errorMessage,
      creditsDeducted: false
    }), 500);
  }
}
