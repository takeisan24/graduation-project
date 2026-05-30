/**
 * GET /api/projects/[id]
 * Get project by ID with drafts
 * 
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getProjectWithDrafts, updateProject, deleteProject } from "@/lib/services/db/projects";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Authentication
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    // Get project with drafts via service layer
    const project = await getProjectWithDrafts(params.id, user.id);

    if (!project) {
      return fail("Project not found", 404);
    }

    return success(project);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/projects/[id] error:", message);
    return fail(message, 500);
  }
}

/**
 * PATCH /api/projects/[id]
 * Update a project (currently: đổi tên).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const name = typeof body?.name === "string" ? body.name : undefined;

    if (name !== undefined && !name.trim()) {
      return fail("Project name cannot be empty", 400);
    }

    const updated = await updateProject(params.id, user.id, { name });
    if (!updated) {
      return fail("Project not found", 404);
    }

    return success(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("PATCH /api/projects/[id] error:", message);
    return fail(message, 500);
  }
}

/**
 * DELETE /api/projects/[id]
 * Delete a project and all related data.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const ok = await deleteProject(params.id, user.id);
    if (!ok) {
      return fail("Project not found or could not be deleted", 404);
    }

    return success({ id: params.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("DELETE /api/projects/[id] error:", message);
    return fail(message, 500);
  }
}
