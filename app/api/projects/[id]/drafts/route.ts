/**
 * GET /api/projects/[id]/drafts
 * Get all drafts for a project
 * 
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { createDraft, getDraftsByProjectId, getProjectById } from "@/lib/services/db/projects";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Authentication
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    // Get drafts via service layer
    const drafts = await getDraftsByProjectId(params.id, user.id);
  
    return success(drafts);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/projects/[id]/drafts error:", message);
    return fail(message, 500);
  }
}

/**
 * POST /api/projects/[id]/drafts
 * Create a draft for a project
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const project = await getProjectById(params.id, user.id);
    if (!project) {
      return fail("Project not found", 404);
    }

    const body = await req.json().catch(() => ({}));
    const draft = await createDraft({
      project_id: params.id,
      user_id: user.id,
      platform: typeof body?.platform === 'string' ? body.platform : null,
      text_content: typeof body?.text_content === 'string' ? body.text_content : null,
      media_urls: Array.isArray(body?.media_urls) ? body.media_urls : [],
      status: body?.status === 'scheduled' || body?.status === 'posted' || body?.status === 'failed'
        ? body.status
        : 'draft',
      scheduled_at: typeof body?.scheduled_at === 'string' ? body.scheduled_at : null,
    });

    if (!draft) {
      return fail("Failed to create draft", 500);
    }

    return success(draft, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/projects/[id]/drafts error:", message);
    return fail(message, 500);
  }
}
