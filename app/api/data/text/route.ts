import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { extractContentFromSource } from "@/lib/services/ai/contentExtractionService";

/**
 * POST /api/data/text
 * Body: { text: string }
 * Extract title and summary from raw text (prompt)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const { text } = await req.json();
    if (!text) return fail("text is required", 400);

    // Extract content via service layer
    const result = await extractContentFromSource({
      sourceType: 'prompt',
      sourceContent: text
    });

    return success(result);
  } catch (err: any) {
    console.error("POST /api/data/text error:", err);
    return fail(err.message || "Server error", 500);
  }
}
