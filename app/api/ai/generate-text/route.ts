import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { withAuthOnly } from "@/lib/middleware/api-protected";
import { generateTextWithCredits } from "@/lib/services/ai/contentGenerationService";

/**
 * POST /api/ai/generate-text
 * Generate text content for specific platforms
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check at route level (credits handled in service)
    const auth = await withAuthOnly(req);
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const {
      title,
      summary,
      platform = 'instagram',
      platforms = ['instagram'],
      tone = 'professional'
    } = body;

    // Generate text via service layer
    const result = await generateTextWithCredits(req, {
      title,
      summary,
      platform,
      platforms,
      tone
    });

    // Handle error response
    if ('error' in result) {
      return fail(result.error, result.status);
    }

    // Return success response
    return success(result);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/ai/generate-text error:", message);
    return fail(message, 500);
  }
}

