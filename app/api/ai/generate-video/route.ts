import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { withAuthOnly } from "@/lib/middleware/api-protected";
import { generateVideoWithCredits } from "@/lib/services/ai/videoGenerationService";

// Veo sinh video có thể mất khá lâu — đặt mốc tối đa trước khi Vercel ngắt.
export const maxDuration = 60;

/**
 * POST /api/ai/generate-video
 * Sinh video bằng Google Gemini Veo (veo-3.0). Credits xử lý trong service layer.
 */
export async function POST(req: NextRequest) {
  try {
    // Auth ở route level (credits xử lý trong service)
    const auth = await withAuthOnly(req);
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const { prompt, negativePrompt, aspectRatio, resolution, modelId } = body;

    const result = await generateVideoWithCredits(req, {
      prompt,
      negativePrompt,
      aspectRatio,
      resolution,
      modelId,
    });

    if ('error' in result) {
      return fail(result.error, result.status);
    }

    return success(result);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/ai/generate-video error:", errorMessage);
    return fail(JSON.stringify({
      error: "Video generation failed",
      message: errorMessage,
      creditsDeducted: false,
    }), 500);
  }
}
