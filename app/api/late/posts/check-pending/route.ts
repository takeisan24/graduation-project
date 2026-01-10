import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getLateClientForAccount } from "@/lib/services/late";
import { getPostsByIdsWithAccount, updatePost } from "@/lib/services/db/posts";
import { updateDraft } from "@/lib/services/db/projects";
import { getMonthStartDate, DEFAULT_TIMEZONE } from "@/lib/utils/date";

type LateLifecycleStatus = "scheduled" | "publishing" | "posted" | "failed";

const SUCCESS_STATUSES = new Set(["posted", "completed", "success", "published"]);
const FAILURE_STATUSES = new Set(["failed", "error", "cancelled", "canceled"]);
const PUBLISHING_STATUSES = new Set(["publishing", "processing", "in_progress"]);

const normalizeLateStatus = (status?: string | null): LateLifecycleStatus => {
  const normalized = (status || "").toLowerCase().trim();
  if (SUCCESS_STATUSES.has(normalized)) {
    return "posted";
  }
  if (FAILURE_STATUSES.has(normalized)) {
    return "failed";
  }
  if (PUBLISHING_STATUSES.has(normalized)) {
    return "publishing";
  }
  return "scheduled";
};

const deriveStatusFromPlatforms = (
  platformStatuses: string[]
): LateLifecycleStatus | null => {
  const normalizedStatuses = platformStatuses.map((status) =>
    (status || "").toLowerCase().trim()
  );
  if (normalizedStatuses.some((s) => SUCCESS_STATUSES.has(s))) {
    return "posted";
  }
  if (normalizedStatuses.some((s) => FAILURE_STATUSES.has(s))) {
    return "failed";
  }
  if (normalizedStatuses.some((s) => PUBLISHING_STATUSES.has(s))) {
    return "publishing";
  }
  return null;
};

/**
 * POST /api/late/posts/check-pending
 * Check status of multiple pending scheduled posts from getlate.dev
 * 
 * This endpoint is called by frontend to check posts that should have been posted
 * but webhook was not received
 * 
 * @param req - NextRequest with array of postIds in body
 * @returns Array of updated posts
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const body = await req.json();
    const { postIds } = body; // Array of scheduled_post IDs from database

    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return fail("postIds array is required", 400);
    }

    console.log(`[late/posts/check-pending] Checking ${postIds.length} pending posts for user ${user.id}`);

    // Get all scheduled posts for this user via service layer
    const normalizedIds = postIds.map((id: any) => String(id));
    const scheduledPosts = await getPostsByIdsWithAccount(normalizedIds, user.id);
    const foundIds = new Set((scheduledPosts || []).map((post) => String(post.id)));
    const missingPostIds = normalizedIds.filter((id: string) => !foundIds.has(id));

    const results = [];
    const errors = missingPostIds.map((postId) => ({
      postId,
      error: "Scheduled post not found or access denied"
    }));

    // Check each post status from getlate.dev
    for (const scheduledPost of scheduledPosts || []) {
      try {
        const getlateAccount = (scheduledPost as any).getlate_accounts;
        if (!getlateAccount) {
          errors.push({
            postId: scheduledPost.id,
            error: "Getlate account not found"
          });
          continue;
        }

        if (!scheduledPost.late_job_id) {
          errors.push({
            postId: scheduledPost.id,
            error: "Scheduled post is missing late_job_id"
          });
          continue;
        }

        const lateClient = getLateClientForAccount(getlateAccount);
        const latePostData = await lateClient.getPost(scheduledPost.late_job_id);
        const currentDbStatus = String(scheduledPost.status || 'scheduled');
        
        // Extract post data
        const postData = latePostData.post || latePostData;
        const postStatus = postData.status || postData.state || latePostData.status || null;
        const platformStatuses = Array.isArray(postData.platforms) 
          ? postData.platforms.map((p: any) => p.status).filter(Boolean)
          : [];
        
        const normalizedPostStatus = normalizeLateStatus(postStatus);
        const platformDerivedStatus = deriveStatusFromPlatforms(platformStatuses);
        let effectiveStatus: LateLifecycleStatus = normalizedPostStatus;
        if ((!postStatus || normalizedPostStatus === "scheduled") && platformDerivedStatus) {
          effectiveStatus = platformDerivedStatus;
        }
        const isPosted = effectiveStatus === "posted";
        const isFailed = effectiveStatus === "failed";
        
        // Extract post URL using centralized function (handles all platforms including TikTok)
        const { extractPostUrl } = await import("@/lib/services/late/postService");
        const postUrl = extractPostUrl(latePostData, scheduledPost.platform);
        
        const socialMediaPostId = postData.post_id 
          || postData.id
          || postData.platforms?.[0]?.post_id
          || null;
        
        const platformEntry = Array.isArray(postData.platforms)
          ? postData.platforms.find(
              (p: any) => p.platform?.toLowerCase() === scheduledPost.platform?.toLowerCase()
            )
          : null;

        const errorMessage = platformEntry?.errorMessage
          || postData.error 
          || postData.error_message 
          || postData.message
          || null;

        // Update database if status changed
        // Optimize payload to only store essential fields from status check
        const existingPayload = scheduledPost.payload || {};
        
        // Optimize status_check_response - only store essential fields
        const optimizedStatusCheckResponse = {
          _id: postData._id || postData.id || null,
          status: postStatus || null,
          platforms: Array.isArray(postData.platforms) ? postData.platforms.map((p: any) => ({
            platform: p.platform,
            status: p.status,
            errorMessage: p.errorMessage || null,
            platformPostId: p.platformPostId || null,
            platformPostUrl: p.platformPostUrl || null,
            publishedAt: p.publishedAt || null
          })) : [],
          updatedAt: postData.updatedAt || null
        };
        
        // Clean and optimize payload before updating to remove duplicates
        const { cleanPayload } = await import("@/lib/services/late/postService");
        const cleanedPayload = cleanPayload({
          ...existingPayload,
          last_status_check_at: new Date().toISOString(),
          latest_late_status: effectiveStatus,
          status_check_response: optimizedStatusCheckResponse
        });
        
        let updateData: any = {
          payload: cleanedPayload
        };

        if (isPosted && scheduledPost.status !== 'posted') {
          updateData.status = 'posted';
          updateData.post_url = postUrl || null; // Store in dedicated column, not in payload
          updateData.payload = cleanPayload({
            ...cleanedPayload,
            posted_at: new Date().toISOString(),
            // post_url is stored in dedicated column, not in payload to avoid duplication
            social_media_post_id: socialMediaPostId || existingPayload.social_media_post_id || null
          });
          
          // Increment usage via service layer
          try {
            const month = getMonthStartDate(DEFAULT_TIMEZONE);
            const { incrementMonthlyUsage } = await import("@/lib/services/db/users");
            await incrementMonthlyUsage(scheduledPost.user_id, month, 'scheduled_posts', 1);
          } catch (incErr: any) {
            console.warn(`[late/posts/check-pending] Failed to increment usage for post ${scheduledPost.id}:`, incErr);
          }
          
          // Update draft via service layer
          if (scheduledPost.draft_id) {
            await updateDraft(scheduledPost.draft_id, user.id, { status: 'posted' });
          }

          // For TikTok posts: if platformPostUrl is null and DB post_url is also null, retry fetching
          // TikTok sometimes doesn't return the actual video URL immediately after posting
          if (scheduledPost.platform?.toLowerCase() === 'tiktok' && scheduledPost.late_job_id) {
            const platformPostUrl = postData.platforms?.[0]?.platformPostUrl || null;
            const dbPostUrl = scheduledPost.post_url;
            
            // Only retry if both platformPostUrl and DB post_url are null
            if (!platformPostUrl && !dbPostUrl) {
              const tiktokUsername = scheduledPost.payload?.connected_account_metadata?.username || null;
              console.log(`[late/posts/check-pending] TikTok post posted but platformPostUrl is null and DB post_url is also null. Starting retry to fetch actual URL for post ${scheduledPost.id}`);
              
              // Get lateClient for this post's account
              const getlateAccount = (scheduledPost as any).getlate_accounts;
              if (getlateAccount) {
                const lateClient = getLateClientForAccount(getlateAccount);
                
                // Start retry in background (don't await to avoid blocking response)
                const { retryFetchTikTokUrl } = await import("@/lib/services/late/postService");
                retryFetchTikTokUrl(lateClient, scheduledPost.late_job_id, scheduledPost.platform, tiktokUsername, scheduledPost.id)
                  .then(async (retryUrl) => {
                    if (retryUrl) {
                      console.log(`[late/posts/check-pending] ✅ Retry successful! Updating post ${scheduledPost.id} with TikTok URL: ${retryUrl}`);
                      const { updatePost } = await import("@/lib/services/db/posts");
                      await updatePost(scheduledPost.id, user.id, { post_url: retryUrl });
                    } else {
                      console.log(`[late/posts/check-pending] ⚠️ Retry failed to get TikTok URL for post ${scheduledPost.id}`);
                    }
                  })
                  .catch((error) => {
                    console.error(`[late/posts/check-pending] Error in retry fetch TikTok URL for post ${scheduledPost.id}:`, error);
                  });
              }
            } else if (platformPostUrl && !dbPostUrl) {
              // If we got platformPostUrl from API but DB doesn't have it, update immediately
              console.log(`[late/posts/check-pending] ✅ Got platformPostUrl from API, updating DB immediately: ${platformPostUrl}`);
              const { updatePost } = await import("@/lib/services/db/posts");
              await updatePost(scheduledPost.id, user.id, { post_url: platformPostUrl });
            }
          }
          
        } else if (isFailed && scheduledPost.status !== 'failed') {
          updateData.status = 'failed';
          updateData.post_url = existingPayload.post_url || null;
          updateData.payload = cleanPayload({
            ...cleanedPayload,
            failed_at: new Date().toISOString(),
            error_message: errorMessage || "Post failed on getlate.dev",
            error_details: postData.error_details || postData.details || null
          });
          
          // Update draft via service layer
          if (scheduledPost.draft_id) {
            await updateDraft(scheduledPost.draft_id, user.id, { status: 'failed' });
          }
        } else if (effectiveStatus === 'publishing' && currentDbStatus !== 'publishing') {
          updateData.status = 'publishing';
          console.log(`[late/posts/check-pending] ℹ️ Post ${scheduledPost.id} is publishing. Updating database status.`);
        }

        // Update database via service layer
        const updatedPost = await updatePost(scheduledPost.id, user.id, updateData);
        
        if (!updatedPost) {
          errors.push({
            postId: scheduledPost.id,
            error: "Failed to update post in database"
          });
        } else {
          // Determine if status actually changed (not just detected as posted/failed)
          const actualStatusChanged = (isPosted && scheduledPost.status !== 'posted') 
            || (isFailed && scheduledPost.status !== 'failed');
          
          results.push({
            postId: scheduledPost.id,
            statusChanged: actualStatusChanged, // Only true if status actually changed in DB
            newStatus: isPosted ? 'posted' : (isFailed ? 'failed' : scheduledPost.status),
            post: updatedPost,
            isPosted, // Always include detection flags for FE to use
            isFailed,
            postStatus: effectiveStatus,
            platformStatuses
          });
        }

      } catch (postError: any) {
        console.error(`[late/posts/check-pending] Error checking post ${scheduledPost.id}:`, postError);
        errors.push({
          postId: scheduledPost.id,
          error: postError.message || 'Unknown error'
        });
      }
    }

    return success({
      message: `Checked ${scheduledPosts?.length || 0} posts. ${results.length} updated, ${errors.length} errors.`,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err: any) {
    console.error(`[late/posts/check-pending] Error:`, err);
    return fail(err.message || "Server error", 500);
  }
}

