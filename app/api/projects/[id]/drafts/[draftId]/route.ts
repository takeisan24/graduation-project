/**
 * GET /api/projects/[id]/drafts/[draftId]
 * Get a specific draft
 * 
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getDraftById, updateDraft, deleteDraft } from "@/lib/services/db/projects";

export async function GET(req: NextRequest, { params }: { params: { id: string; draftId: string } }) {
  try {
    // Authentication
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    // Get draft via service layer
    const draft = await getDraftById(params.draftId, user.id);
    
    if (!draft || draft.project_id !== params.id) {
      return fail("Draft not found", 404);
    }

    return success(draft);
    
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/projects/[id]/drafts/[draftId] error:", message);
    return fail(message, 500);
  }
}

/**
 * PUT /api/projects/[id]/drafts/[draftId]
 * Update a draft
 * 
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */

export async function PUT(req: NextRequest, { params }: { params: { id: string; draftId: string } }) {
  try {
    // Authentication
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const body = await req.json();
    const { text_content, media_urls, platform, status, scheduled_at } = body;

    // Verify draft ownership via service layer
    const existingDraft = await getDraftById(params.draftId, user.id);
    
    if (!existingDraft || existingDraft.project_id !== params.id) {
      return fail("Draft not found", 404);
    }

    // Update draft via service layer
    const updated = await updateDraft(params.draftId, user.id, {
      text_content,
      media_urls,
      platform,
      status: status === 'scheduled' || status === 'posted' || status === 'failed' || status === 'draft'
        ? status
        : existingDraft.status,
      scheduled_at: typeof scheduled_at === 'string' || scheduled_at === null
        ? scheduled_at
        : existingDraft.scheduled_at,
    });

    if (!updated) {
      return fail("Failed to update draft", 500);
    }

    // Get updated draft
    const updatedDraft = await getDraftById(params.draftId, user.id);
    
    return success(updatedDraft);
    
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("PUT /api/projects/[id]/drafts/[draftId] error:", message);
    return fail(message, 500);
  }
}

/**
 * DELETE /api/projects/[id]/drafts/[draftId]
 * Delete a draft
 * 
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */

export async function DELETE(req: NextRequest, { params }: { params: { id: string; draftId: string } }) {
  try {
    // Authentication
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    // Verify draft ownership via service layer
    const existingDraft = await getDraftById(params.draftId, user.id);
    
    if (!existingDraft || existingDraft.project_id !== params.id) {
      return fail("Draft not found", 404);
    }

    // Delete draft via service layer
    const deleted = await deleteDraft(params.draftId, user.id);

    if (!deleted) {
      return fail("Failed to delete draft", 500);
    }

    return success({ deleted: true });
    
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("DELETE /api/projects/[id]/drafts/[draftId] error:", message);
    return fail(message, 500);
  }
}
