import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getScheduledPosts } from "@/lib/services/db/posts";
import { DEFAULT_TIMEZONE } from "@/lib/utils/date";

/**
 * GET /api/schedule
 * Get user's scheduled posts
 *
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    // Get scheduled posts via service layer
    const posts = await getScheduledPosts(user.id);

    return success(posts);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/schedule error:", message);
    return fail(message, 500);
  }
}

/**
 * POST /api/schedule
 * Schedule multiple posts for multiple platforms (without draft)
 * Saves posts to DB with scheduled status.
 *
 * Request body format:
 * {
 *   "scheduledAt": "2024-01-15T09:00:00Z",
 *   "posts": [
 *     {
 *       "platform": "Facebook",
 *       "profileIds": ["profile_id_1", "profile_id_2"],
 *       "text": "Content for Facebook",
 *       "mediaUrls": ["url1", "url2"]
 *     }
 *   ]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const body = await req.json();
    const {
      scheduledAt,
      timezone,
      posts // Array of { platform, profileIds, text, mediaUrls }
    } = body;

    // Validate required fields
    if (!scheduledAt || !posts || !Array.isArray(posts) || posts.length === 0) {
      return fail("Missing required fields: scheduledAt (ISO string), posts (non-empty array)", 400);
    }

    // Validate each post in the array
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      if (!post.platform || !post.profileIds || !Array.isArray(post.profileIds) || !post.text) {
        return fail(`Invalid post at index ${i}: Missing required fields (platform, profileIds array, text)`, 400);
      }
    }

    // Save scheduled posts to DB
    const { createScheduledPost } = await import("@/lib/services/db/posts");
    const scheduledPosts = [];
    const errors: string[] = [];

    for (const post of posts) {
      for (const profileId of post.profileIds) {
        try {
          const savedPost = await createScheduledPost({
            user_id: user.id,
            platform: post.platform,
            scheduled_at: scheduledAt,
            status: "scheduled",
            payload: {
              text: post.text,
              mediaUrls: post.mediaUrls || [],
              profile_id: profileId,
              timezone: timezone || DEFAULT_TIMEZONE
            }
          });
          if (savedPost) {
            scheduledPosts.push(savedPost);
          }
        } catch (e: unknown) {
          const eMsg = e instanceof Error ? e.message : String(e);
          errors.push(`Failed to schedule for ${post.platform}/${profileId}: ${eMsg}`);
        }
      }
    }

    if (scheduledPosts.length === 0) {
      return fail(`Failed to schedule any posts. Errors: ${JSON.stringify(errors)}`, 500);
    }

    return success({
      scheduledPosts,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully scheduled ${scheduledPosts.length} post(s) across ${new Set(scheduledPosts.map(p => p.platform)).size} platform(s)${errors.length > 0 ? `, ${errors.length} failed` : ''}`
    }, 201);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/schedule error:", message);
    return fail(message, 500);
  }
}
