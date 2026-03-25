/**
 * GET /api/projects/[id]
 * Get project by ID with drafts
 * 
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getProjectWithDrafts } from "@/lib/services/db/projects";

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
