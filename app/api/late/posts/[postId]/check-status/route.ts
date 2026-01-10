import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getLateClientForAccount } from "@/lib/services/late";
import { getPostByIdWithAccount, updatePost } from "@/lib/services/db/posts";
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
 * GET /api/late/posts/[postId]/check-status
 * Check post status from getlate.dev API and update database
 * 
 * This is a fallback mechanism when webhook is not called by getlate.dev
 * 
 * @param req - NextRequest with postId in params
 * @returns Updated post information
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const { postId } = params;

    // Get the scheduled post with getlate account info via service layer
    const scheduledPost = await getPostByIdWithAccount(postId, user.id);
    
    if (!scheduledPost) {
      return fail("Scheduled post not found or access denied", 404);
    }

    const currentDbStatus = String(scheduledPost.status || 'scheduled');

    // Check if late_job_id exists
    if (!scheduledPost.late_job_id) {
      return fail("Post does not have a late.dev job ID. Cannot check status.", 400);
    }

    // Get getlate account
    const getlateAccount = (scheduledPost as any).getlate_accounts;
    if (!getlateAccount) {
      return fail("Getlate account not found for this post", 500);
    }

    // Call getlate.dev API to get post status
    const lateClient = getLateClientForAccount(getlateAccount);
    let latePostData: any;
    try {
      latePostData = await lateClient.getPost(scheduledPost.late_job_id);
      console.log(`[late/posts/check-status] Got post data from getlate.dev for postId: ${postId}, late_job_id: ${scheduledPost.late_job_id}`);
    } catch (lateError: any) {
      console.error(`[late/posts/check-status] Failed to get post from getlate.dev:`, lateError);
      return fail(
        `Failed to get post status from getlate.dev: ${lateError.message}`,
        500
      );
    }

    // Extract post data from response (getlate.dev may wrap in "post" field)
    const postData = latePostData.post || latePostData;
    
    // Extract status from multiple possible locations
    const postStatus = postData.status 
      || postData.state 
      || latePostData.status 
      || latePostData.state
      || null;
    
    // Extract platform statuses
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
    
    // Extract social media post ID
    const socialMediaPostId = postData.post_id 
      || postData.id
      || postData.platform_post_id
      || postData.platforms?.[0]?.post_id
      || postData.platforms?.[0]?.id
      || null;
    
    // Extract error message if failed
    const errorMessage = postData.error 
      || postData.error_message 
      || postData.message
      || postData.platforms?.[0]?.error
      || postData.platforms?.[0]?.error_message
      || null;
    
    console.log(`[late/posts/check-status] Post status check result:`, {
      postId,
      late_job_id: scheduledPost.late_job_id,
      postStatus,
      platformStatuses,
      effectiveStatus,
      isPosted,
      isFailed,
      postUrl,
      platformPostUrl: postData.platforms?.[0]?.platformPostUrl || null,
      dbPostUrl: scheduledPost.post_url,
      socialMediaPostId,
      errorMessage
    });

    // Update scheduled_posts table based on status
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
      // Post was successfully published
      updateData.status = 'posted';
      updateData.post_url = postUrl || null; // Store in dedicated column, not in payload
      updateData.payload = cleanPayload({
        ...cleanedPayload,
        posted_at: new Date().toISOString(),
        // post_url is stored in dedicated column, not in payload to avoid duplication
        social_media_post_id: socialMediaPostId || existingPayload.social_media_post_id || null
      });
      
      console.log(`[late/posts/check-status] ✅ Post ${postId} is now posted. Updating database.`);
      console.log(`[late/posts/check-status] latePostData ===  ${latePostData}`);

      // Increment monthly_usage.scheduled_posts if not already counted via service layer
      try {
        const month = getMonthStartDate(DEFAULT_TIMEZONE);
        const { incrementMonthlyUsage } = await import("@/lib/services/db/users");
        await incrementMonthlyUsage(scheduledPost.user_id, month, 'scheduled_posts', 1);
      } catch (incErr: any) {
        console.warn(`[late/posts/check-status] Failed to increment usage:`, incErr);
      }
      
      // Update draft status if exists via service layer
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
          console.log(`[late/posts/check-status] TikTok post posted but platformPostUrl is null and DB post_url is also null. Starting retry to fetch actual URL for post ${postId}`);
          
          // Start retry in background (don't await to avoid blocking response)
          const { retryFetchTikTokUrl } = await import("@/lib/services/late/postService");
          retryFetchTikTokUrl(lateClient, scheduledPost.late_job_id, scheduledPost.platform, tiktokUsername, postId)
            .then(async (retryUrl) => {
              if (retryUrl) {
                console.log(`[late/posts/check-status] ✅ Retry successful! Updating post ${postId} with TikTok URL: ${retryUrl}`);
                const { updatePost } = await import("@/lib/services/db/posts");
                await updatePost(postId, user.id, { post_url: retryUrl });
              } else {
                console.log(`[late/posts/check-status] ⚠️ Retry failed to get TikTok URL for post ${postId}`);
              }
            })
            .catch((error) => {
              console.error(`[late/posts/check-status] Error in retry fetch TikTok URL for post ${postId}:`, error);
            });
        } else if (platformPostUrl && !dbPostUrl) {
          // If we got platformPostUrl from API but DB doesn't have it, update immediately
          console.log(`[late/posts/check-status] ✅ Got platformPostUrl from API, updating DB immediately: ${platformPostUrl}`);
          const { updatePost } = await import("@/lib/services/db/posts");
          await updatePost(postId, user.id, { post_url: platformPostUrl });
        }
      }
      
    } else if (isFailed && scheduledPost.status !== 'failed') {
      // Post failed
      updateData.status = 'failed';
      updateData.post_url = existingPayload.post_url || null;
      updateData.payload = cleanPayload({
        ...cleanedPayload,
        failed_at: new Date().toISOString(),
        error_message: errorMessage || "Post failed on getlate.dev",
        error_details: postData.error_details || postData.details || null
      });
      
      console.log(`[late/posts/check-status] ❌ Post ${postId} failed. Updating database.`);
      
      // Update draft status if exists via service layer
      if (scheduledPost.draft_id) {
        await updateDraft(scheduledPost.draft_id, user.id, { status: 'failed' });
      }
      
    } else if (effectiveStatus === 'publishing' && currentDbStatus !== 'publishing') {
      updateData.status = 'publishing';
      console.log(`[late/posts/check-status] ℹ️ Post ${postId} is publishing. Updating database status.`);
    } else {
      // Still scheduled or processing - just update last check time
      console.log(`[late/posts/check-status] Post ${postId} is still ${effectiveStatus || scheduledPost.status || 'scheduled'}. No status change.`);
    }

    // Update database via service layer
    const updatedPost = await updatePost(postId, user.id, updateData);
    
    if (!updatedPost) {
      console.error(`[late/posts/check-status] Database update failed`);
      return fail("Failed to update scheduled post in database", 500);
    }

    // Determine if status actually changed (not just detected as posted/failed)
    const actualStatusChanged = (isPosted && scheduledPost.status !== 'posted') 
      || (isFailed && scheduledPost.status !== 'failed');
    
    return success({
      message: "Post status checked successfully",
      post: updatedPost,
      latePostData: latePostData,
      statusChanged: actualStatusChanged, // Only true if status actually changed in DB
      newStatus: isPosted ? 'posted' : (isFailed ? 'failed' : scheduledPost.status),
      isPosted, // Always include detection flags for FE to use
      isFailed,
      postStatus: effectiveStatus,
      platformStatuses
    });

  } catch (err: any) {
    console.error(`[late/posts/check-status] Error:`, err);
    return fail(err.message || "Server error", 500);
  }
}

