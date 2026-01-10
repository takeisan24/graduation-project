import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { generateTextWithCredits } from "@/lib/services/ai/contentGenerationService";

/**
 * POST /api/ai/generate-text
 * Generate text content for specific platforms
 */
export async function POST(req: NextRequest) {
  try {
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

  } catch (err: any) {
    console.error("POST /api/ai/generate-text error:", err);
    return fail(err.message || "Server error", 500);
  }
}

// Export the generatePlatformText function for use in other files
export { generatePlatformText } from "@/lib/ai/contentService";
