/**
 * GET /api/posts/published
 * Get user's published posts from scheduled_posts table
 * Returns posts with status = 'posted'
 * 
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getPublishedPostsForUser } from "@/lib/services/posts/publishedPostsService";

export async function GET(req: NextRequest) {
  try {
    // Authentication
    const user = await requireAuth(req);
    if (!user) {
      return fail("Unauthorized", 401);
    }

    // Get pagination params from query string
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Get published posts via service layer with pagination
    const result = await getPublishedPostsForUser(user.id, { limit, offset });

    return success(result);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error(`[API /api/posts/published] Error:`, message);
    return fail(message, 500);
  }
}

