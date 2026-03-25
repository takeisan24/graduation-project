/**
 * POST /api/projects/[id]/drafts/[draftId]/edit
 * AI assistant for editing drafts
 *
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { editDraftWithAssistant } from "@/lib/services/ai/assistantService";
import { deleteDraft, getDraftById } from "@/lib/services/db/projects";

export async function POST(req: NextRequest, { params }: { params: { id: string; draftId: string } }) {
  try {
    // Authentication
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const { message } = await req.json();
    if (!message) return fail("message required", 400);

    // Edit draft with AI assistant via service layer
    const result = await editDraftWithAssistant({
      draftId: params.draftId,
      projectId: params.id,
      userId: user.id,
      message
    });

    return success({
      reply: result.reply,
      isFreeRefinement: result.isFreeRefinement,
      creditsRemaining: result.creditsRemaining,
      modelUsed: result.modelUsed
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/projects/[id]/drafts/[draftId]/edit error:", message);

    // Handle specific error cases
    if (message === "Draft not found") {
      return fail("draft not found", 404);
    }
    if (message === "Insufficient credits" || message.includes("credits")) {
      return fail(JSON.stringify({
        message: message,
        upgradeRequired: true,
        creditsRequired: 1,
        creditsRemaining: 0
      }), 403);
    }

    return fail(message, 500);
  }
}

/**
 * DELETE /api/projects/[id]/drafts/[draftId]/edit
 * Delete a draft (legacy endpoint, should use /api/projects/[id]/drafts/[draftId])
 *
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */

export async function DELETE(req: NextRequest, { params }: { params: { draftId: string } }) {
  try {
    // Authentication
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const { draftId } = params;

    // Verify draft ownership via service layer
    const draft = await getDraftById(draftId, user.id);
    if (!draft) {
      return fail("Not found", 404);
    }

    if (draft.user_id !== user.id) {
      return fail("Forbidden", 403);
    }

    // Delete draft via service layer
    const deleted = await deleteDraft(draftId, user.id);

    if (!deleted) {
      return fail("Failed to delete draft", 500);
    }

    return success({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("DELETE /api/projects/[id]/drafts/[draftId]/edit error:", message);
    return fail(message, 500);
  }
}
