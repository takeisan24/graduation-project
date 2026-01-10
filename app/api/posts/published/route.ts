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
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[API /api/posts/published] Request ${requestId} started`, {
    timestamp: new Date().toISOString(),
    userAgent: req.headers.get('user-agent')?.substring(0, 50),
    referer: req.headers.get('referer')?.substring(0, 50)
  });
  
  try {
    // Authentication
    const user = await requireAuth(req);
    if (!user) {
      console.log(`[API /api/posts/published] Request ${requestId} - Unauthorized`);
      return fail("Unauthorized", 401);
    }
    
    console.log(`[API /api/posts/published] Request ${requestId} - User authenticated:`, user.id);

    // Get pagination params from query string
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    
    console.log(`[API /api/posts/published] Pagination params:`, { limit, offset });

    // Get published posts via service layer with pagination
    const result = await getPublishedPostsForUser(user.id, { limit, offset });

    console.log(`[API /api/posts/published] Request ${requestId} - Success, returning ${result.posts.length} posts (total: ${result.count})`);
    
    return success(result);

  } catch (err: any) {
    console.error(`[API /api/posts/published] Request ${requestId} - Error:`, err);
    return fail(err.message || "Server error", 500);
  }
}

