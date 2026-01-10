/**
 * POST /api/posts/published/tiktok-urls
 * Check and update TikTok post URLs for posts with null post_url
 * 
 * Called by frontend when user visits published page to sync TikTok URLs
 * 
 * Request body: { postIds: string[] } - Array of TikTok post IDs with null post_url
 * Response: { updatedUrls: Record<string, string> } - Map of postId -> post_url (only includes posts that got URLs)
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getPostByIdWithAccount } from "@/lib/services/db/posts";
import { getLateClientForAccount } from "@/lib/services/late";
import { extractPostUrl } from "@/lib/services/late/postService";
import { updatePost } from "@/lib/services/db/posts";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) {
      return fail("Unauthorized", 401);
    }

    const body = await req.json();
    const { postIds } = body;

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return success({ updatedUrls: {} });
    }

    console.log(`[API /api/posts/published/tiktok-urls] Checking ${postIds.length} TikTok posts for URLs`);

    const updatedUrls: Record<string, string> = {};

    // OPTIMIZATION: Batch fetch all posts at once instead of N+1 queries
    const { getPostsByIdsWithAccount } = await import("@/lib/services/db/posts");
    const posts = await getPostsByIdsWithAccount(postIds, user.id);

    // Filter to only TikTok posts with null post_url
    const tiktokPostsToProcess = posts.filter(post => 
      post.platform?.toLowerCase() === 'tiktok' && 
      !post.post_url && 
      post.late_job_id
    );

    if (tiktokPostsToProcess.length === 0) {
      console.log(`[API /api/posts/published/tiktok-urls] No TikTok posts to process`);
      return success({ updatedUrls: {} });
    }

    // OPTIMIZATION: Group posts by getlate_account_id to reuse API clients
    const postsByAccount = new Map<string, typeof tiktokPostsToProcess>();
    for (const post of tiktokPostsToProcess) {
      const accountId = post.getlate_account_id;
      if (!accountId) continue;
      if (!postsByAccount.has(accountId)) {
        postsByAccount.set(accountId, []);
      }
      postsByAccount.get(accountId)!.push(post);
    }

    // OPTIMIZATION: Process with concurrency limit to avoid overwhelming getlate.dev API
    const MAX_CONCURRENT = 5; // Limit concurrent API calls
    const processAccountGroup = async (accountId: string, accountPosts: typeof tiktokPostsToProcess) => {
      const getlateAccount = (accountPosts[0] as any).getlate_accounts;
      if (!getlateAccount) return;

      const lateClient = getLateClientForAccount(getlateAccount);

      // Process posts with concurrency limit
      const processPost = async (post: typeof tiktokPostsToProcess[0]) => {
        try {
          if (!post.late_job_id) {
            console.warn(`[API /api/posts/published/tiktok-urls] Missing late_job_id for post ${post.id}, skipping`);
            return;
          }
          // Call getlate.dev API
          const latePostData = await lateClient.getPost(post.late_job_id);
          
          // Extract platformPostUrl
          const platformPostUrl = extractPostUrl(latePostData, post.platform || 'tiktok');

          // Only update DB if platformPostUrl is found and valid
          if (platformPostUrl && platformPostUrl.startsWith('https://www.tiktok.com/')) {
            console.log(`[API /api/posts/published/tiktok-urls] ✅ Found URL for post ${post.id}: ${platformPostUrl}`);
            
            // Update DB
            await updatePost(post.id, user.id, { post_url: platformPostUrl });
            
            // Add to response
            updatedUrls[post.id] = platformPostUrl;
          } else {
            console.log(`[API /api/posts/published/tiktok-urls] Post ${post.id} still has null platformPostUrl, not updating DB`);
          }
        } catch (error: any) {
          console.error(`[API /api/posts/published/tiktok-urls] Error processing post ${post.id}:`, error);
        }
      };

      // Process posts with concurrency limit
      const chunks = [];
      for (let i = 0; i < accountPosts.length; i += MAX_CONCURRENT) {
        chunks.push(accountPosts.slice(i, i + MAX_CONCURRENT));
      }

      for (const chunk of chunks) {
        await Promise.all(chunk.map(processPost));
      }
    };

    // Process all account groups
    await Promise.all(
      Array.from(postsByAccount.entries()).map(([accountId, posts]) => 
        processAccountGroup(accountId, posts)
      )
    );

    console.log(`[API /api/posts/published/tiktok-urls] Updated ${Object.keys(updatedUrls).length} out of ${postIds.length} posts`);

    return success({ updatedUrls });
  } catch (err: any) {
    console.error(`[API /api/posts/published/tiktok-urls] Error:`, err);
    return fail(err.message || "Server error", 500);
  }
}

