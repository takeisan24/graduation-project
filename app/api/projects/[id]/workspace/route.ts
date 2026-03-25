/**
 * GET /api/projects/[id]/workspace
 * Get project workspace data (project, drafts, and connected accounts)
 * 
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getProjectById, getDraftsByProjectId } from "@/lib/services/db/projects";
import { findConnectionsByUserId } from "@/lib/services/db/connections";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Authentication
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const projectId = params.id;
    
    // Get project via service layer
    const project = await getProjectById(projectId, user.id);
    if (!project) {
      return fail("Project not found", 404);
    }

    // Get drafts via service layer
    const drafts = await getDraftsByProjectId(projectId, user.id);

    // Get connected accounts via service layer
    const accounts = await findConnectionsByUserId(user.id);

    return success({ project, drafts, accounts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/projects/[id]/workspace error:", message);
    return fail(message, 500);
  }
}
