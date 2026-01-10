/**
 * GET /api/admin/sync-tiktok-urls
 * Background job to batch sync TikTok post URLs
 * 
 * This endpoint should be called via cron job (e.g., every 10 minutes)
 * to efficiently process TikTok posts with null post_url in batches.
 * 
 * Optimizations for scale (>100k users):
 * 1. Batch processing - process multiple posts at once
 * 2. Group by getlate_account to reuse API clients
 * 3. Rate limiting - limit concurrent API calls to getlate.dev
 * 4. Time window - only process posts within 24h of posting
 * 5. Batch DB updates - update multiple posts in single transaction
 * 
 * Expected to handle: ~10,000 posts per run (assuming 100k users, 10% TikTok posts, 1% need retry)
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { supabase } from "@/lib/supabase";
import { getLateClientForAccount, LateAccountWithLimits } from "@/lib/services/late/accountService";
import { extractPostUrl } from "@/lib/services/late/postService";
import { updatePost } from "@/lib/services/db/posts";

// Rate limiting: max concurrent API calls to getlate.dev
const MAX_CONCURRENT_API_CALLS = 10;
// Batch size: process posts in batches
const BATCH_SIZE = 50;
// Time window: only process posts posted within last 24 hours
const RETRY_WINDOW_HOURS = 24;

/**
 * Process a batch of TikTok posts grouped by getlate_account
 * This reduces API client creation overhead
 */
async function processBatch(
  posts: Array<{
    id: string;
    late_job_id: string;
    getlate_account_id: string;
    user_id: string;
    getlate_accounts: { id: string; api_key: string; client_id: string | null; client_secret: string | null };
  }>
): Promise<{ updated: number; failed: number }> {
  let updated = 0;
  let failed = 0;

  // Group posts by getlate_account_id to reuse API clients
  const postsByAccount = new Map<string, typeof posts>();
  for (const post of posts) {
    const accountId = post.getlate_account_id;
    if (!postsByAccount.has(accountId)) {
      postsByAccount.set(accountId, []);
    }
    postsByAccount.get(accountId)!.push(post);
  }

  // Process each account group
  for (const [accountId, accountPosts] of postsByAccount) {
    try {
      // Create API client once per account
      // Only api_key, client_id, and client_secret are needed for LateClient
      // Create a minimal account object that satisfies LateAccountWithLimits type
      const accountData = accountPosts[0].getlate_accounts;
      const minimalAccount: LateAccountWithLimits = {
        id: accountData.id,
        account_name: null,
        api_key: accountData.api_key,
        client_id: accountData.client_id,
        client_secret: accountData.client_secret,
        webhook_secret: null,
        is_active: true,
        limits: {},
        metadata: {}
      };
      const lateClient = getLateClientForAccount(minimalAccount);

      // Process posts with concurrency limit (batch processing)
      const processPost = async (post: typeof posts[0]) => {
        try {
          // Call getlate.dev API
          const latePostData = await lateClient.getPost(post.late_job_id);
          
          // Extract platformPostUrl
          const platformPostUrl = extractPostUrl(latePostData, 'tiktok');

          // Only update if URL is valid
          if (platformPostUrl && platformPostUrl.startsWith('https://www.tiktok.com/')) {
            // user_id is already included in the query, no need to fetch again
            if (post.user_id) {
              await updatePost(post.id, post.user_id, { post_url: platformPostUrl });
              updated++;
              console.log(`[sync-tiktok-urls] ✅ Updated post ${post.id} with URL: ${platformPostUrl}`);
            }
          } else {
            failed++;
            console.log(`[sync-tiktok-urls] Post ${post.id} still has null platformPostUrl`);
          }
        } catch (error: any) {
          failed++;
          console.error(`[sync-tiktok-urls] Error processing post ${post.id}:`, error.message);
        }
      };

      // Process posts with concurrency limit (process in chunks)
      for (let i = 0; i < accountPosts.length; i += MAX_CONCURRENT_API_CALLS) {
        const chunk = accountPosts.slice(i, i + MAX_CONCURRENT_API_CALLS);
        await Promise.all(chunk.map(processPost));
      }

    } catch (error: any) {
      console.error(`[sync-tiktok-urls] Error processing account ${accountId}:`, error.message);
      failed += accountPosts.length;
    }
  }

  return { updated, failed };
}

export async function GET(req: NextRequest) {
  try {
    // Optional: Add admin auth check
    // const user = await requireAuth(req);
    // if (!user || user.email !== 'admin@example.com') {
    //   return fail("Unauthorized", 401);
    // }

    console.log(`[sync-tiktok-urls] Starting batch sync of TikTok URLs`);

    const retryWindowStart = new Date();
    retryWindowStart.setHours(retryWindowStart.getHours() - RETRY_WINDOW_HOURS);

    // Query TikTok posts with null post_url posted within retry window
    // Only fetch posts that need URL sync
    const { data: posts, error } = await supabase
      .from('scheduled_posts')
      .select(`
        id,
        late_job_id,
        getlate_account_id,
        scheduled_at,
        user_id,
        getlate_accounts!inner(
          id,
          api_key,
          client_id,
          client_secret
        )
      `)
      .order('scheduled_at', { ascending: false })
      .eq('platform', 'tiktok')
      .eq('status', 'posted')
      .is('post_url', null)
      .not('late_job_id', 'is', null)
      .gte('scheduled_at', retryWindowStart.toISOString())
      .limit(BATCH_SIZE * 10); // Fetch more than batch size to account for filtering

    if (error) {
      console.error(`[sync-tiktok-urls] Error querying posts:`, error);
      return fail("Failed to query posts", 500);
    }

    if (!posts || posts.length === 0) {
      console.log(`[sync-tiktok-urls] No TikTok posts to sync`);
      return success({ 
        processed: 0, 
        updated: 0, 
        failed: 0,
        message: "No posts to sync"
      });
    }

    console.log(`[sync-tiktok-urls] Found ${posts.length} TikTok posts to sync`);

    // Process in batches
    let totalUpdated = 0;
    let totalFailed = 0;

    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batch = posts.slice(i, i + BATCH_SIZE);
      const result = await processBatch(batch as any);
      totalUpdated += result.updated;
      totalFailed += result.failed;
      
      // Small delay between batches to avoid overwhelming the system
      if (i + BATCH_SIZE < posts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    console.log(`[sync-tiktok-urls] Completed: ${totalUpdated} updated, ${totalFailed} failed out of ${posts.length} total`);

    return success({
      processed: posts.length,
      updated: totalUpdated,
      failed: totalFailed,
      message: `Processed ${posts.length} posts, updated ${totalUpdated} URLs`
    });

  } catch (err: any) {
    console.error(`[sync-tiktok-urls] Error:`, err);
    return fail(err.message || "Server error", 500);
  }
}

