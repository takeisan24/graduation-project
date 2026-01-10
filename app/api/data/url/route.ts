import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { extractContentFromSource } from "@/lib/services/ai/contentExtractionService";

/**
 * POST /api/data/url
 * Body: { url: string }
 * Extract title and summary from a webpage URL
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const { url } = await req.json();
    if (!url) return fail("url is required", 400);

    // Extract content via service layer
    const result = await extractContentFromSource({
      sourceType: 'url',
      sourceContent: url
    });

    return success(result);
  } catch (err: any) {
    console.error("POST /api/data/url error:", err);
    return fail(err.message || "Server error", 500);
  }
}
