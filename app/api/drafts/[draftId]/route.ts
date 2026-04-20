import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { fail, success } from "@/lib/response";
import { deleteDraft } from "@/lib/services/db/projects";

/**
 * DELETE /api/drafts/[draftId]
 * Delete a backend draft by ID for the authenticated user.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { draftId: string } }
) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const deleted = await deleteDraft(params.draftId, user.id);
    if (!deleted) {
      return fail("Draft not found or delete failed", 404);
    }

    return success({ deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("DELETE /api/drafts/[draftId] error:", message);
    return fail(message, 500);
  }
}
