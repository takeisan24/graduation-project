import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { fail, success } from "@/lib/response";
import { getDraftsByUserId } from "@/lib/services/db/projects";

/**
 * GET /api/drafts
 * Get all backend drafts for the authenticated user across projects.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const drafts = await getDraftsByUserId(user.id);
    return success(drafts);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/drafts error:", message);
    return fail(message, 500);
  }
}
