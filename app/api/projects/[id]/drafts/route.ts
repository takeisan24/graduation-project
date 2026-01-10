/**
 * GET /api/projects/[id]/drafts
 * Get all drafts for a project
 * 
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getDraftsByProjectId } from "@/lib/services/db/projects";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Authentication
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    // Get drafts via service layer
    const drafts = await getDraftsByProjectId(params.id, user.id);
  
    return success(drafts);
  } catch (err: any) {
    console.error("GET /api/projects/[id]/drafts error:", err);
    return fail(err.message || "Server error", 500);
  }
}
