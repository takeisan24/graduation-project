import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { generateContentSuggestions } from "@/lib/services/ai/suggestionService";
import { checkCredits, deductCredits } from "@/lib/usage";

/**
 * POST /api/ai/suggestions
 * Get AI suggestions for content improvement
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const {
      content,
      contentType = 'text',
      platform = 'general',
      context = 'general',
      suggestionType = 'improve', // 'improve', 'rewrite', 'shorten', 'expand', 'hashtags', 'emojis'
      targetLanguage
    } = await req.json();

    if (!content) return fail("Content is required", 400);

    // Credit logic for translate action
    if (suggestionType === 'translate') {
      const paywallResult = await checkCredits(user.id, 'AI_REFINEMENT');
      if (!paywallResult.success) {
        return fail(paywallResult.reason || "Insufficient credits", 402);
      }
    }

    // Generate suggestions via service layer
    const result = await generateContentSuggestions({
      content,
      contentType,
      platform,
      context,
      suggestionType,
      targetLanguage
    });

    if (suggestionType === 'translate') {
      await deductCredits(user.id, 'AI_REFINEMENT', {
        suggestionType,
        targetLanguage,
        platform
      });
    }

    return success(result);

  } catch (err: any) {
    console.error("POST /api/ai/suggestions error:", err);
    return fail(err.message || "Server error", 500);
  }
}
