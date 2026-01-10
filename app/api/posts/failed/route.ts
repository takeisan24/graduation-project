/**
 * GET /api/posts/failed
 * Get user's failed posts from scheduled_posts table
 * Returns posts with status = 'failed'
 * 
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getFailedPostsForUser } from "@/lib/services/posts/failedPostsService";
import { DEFAULT_TIMEZONE } from "@/lib/utils/date";

export async function GET(req: NextRequest) {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[API /api/posts/failed] Request ${requestId} started`, {
    timestamp: new Date().toISOString(),
    userAgent: req.headers.get('user-agent')?.substring(0, 50),
    referer: req.headers.get('referer')?.substring(0, 50)
  });
  
  try {
    // Authentication
    const user = await requireAuth(req);
    if (!user) {
      console.log(`[API /api/posts/failed] Request ${requestId} - Unauthorized`);
      return fail("Unauthorized", 401);
    }
    
    console.log(`[API /api/posts/failed] Request ${requestId} - User authenticated:`, user.id);

    // Get pagination params from query string
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    
    console.log(`[API /api/posts/failed] Pagination params:`, { limit, offset });

    // Get failed posts via service layer with pagination
    const result = await getFailedPostsForUser(user.id, DEFAULT_TIMEZONE, { limit, offset });

    console.log(`[API /api/posts/failed] Request ${requestId} - Success, returning ${result.posts.length} posts (total: ${result.count})`);
    
    return success(result);

  } catch (err: any) {
    console.error(`[API /api/posts/failed] Request ${requestId} - Error:`, err);
    return fail(err.message || "Server error", 500);
  }
}

