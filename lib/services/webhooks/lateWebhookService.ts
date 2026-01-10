/**
 * Service: Late.dev Webhook Handler
 * 
 * Handles webhook events from late.dev including:
 * - Post status updates (posted, failed, scheduled, cancelled)
 * - Draft status updates
 * - Usage tracking
 * - Job logging
 */

import { supabase } from "@/lib/supabase";
import { updatePostByLateJobId, getPostById } from "@/lib/services/db/posts";
import { updateDraft } from "@/lib/services/db/projects";
import { getMonthStartDate, DEFAULT_TIMEZONE } from "@/lib/utils/date";

export interface LateWebhookEvent {
  event?: string;
  type?: string;
  action?: string;
  data?: any;
  post?: any;
  [key: string]: any;
}

export interface ProcessedWebhookResult {
  success: boolean;
  lateJobId: string | null;
  status: string | null;
  eventType: string;
  requestId: string;
  message?: string;
}

/**
 * Find scheduled post by late_job_id (with fallback matching)
 */
export async function findPostByLateJobId(lateJobId: string): Promise<any | null> {
  // Try exact match first
  let { data: scheduledPost, error: findError } = await supabase
    .from("scheduled_posts")
    .select("id, user_id, draft_id, payload, late_job_id, platform, scheduled_at")
    .eq("late_job_id", lateJobId)
    .single();

  // If not found, try to find by partial match (in case format differs)
  if (findError || !scheduledPost) {
    console.warn(`[LateWebhook] Scheduled post not found for late_job_id: ${lateJobId}, trying partial match...`);
    
    const { data: allScheduledPosts } = await supabase
      .from("scheduled_posts")
      .select("id, user_id, draft_id, payload, late_job_id, platform, scheduled_at")
      .not("late_job_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);
    
    if (allScheduledPosts && allScheduledPosts.length > 0) {
      // Try to find by partial match
      const matchedPost = allScheduledPosts.find((post: any) => {
        const storedJobId = post.late_job_id;
        return storedJobId === lateJobId 
          || storedJobId?.includes(lateJobId)
          || lateJobId?.includes(storedJobId);
      });
      
      if (matchedPost) {
        console.log(`[LateWebhook] Found post by partial match: stored=${matchedPost.late_job_id}, webhook=${lateJobId}`);
        scheduledPost = matchedPost;
        findError = null;
      }
    }
  }

  return scheduledPost || null;
}

/**
 * Extract data from webhook body
 */
export function extractWebhookData(body: any): {
  eventType: string;
  eventData: any;
  lateJobId: string | null;
  status: string | null;
} {
  const eventType = body?.event ?? body?.type ?? body?.action ?? "unknown";
  const eventData = body?.data ?? body?.post ?? body;
  
  // Extract job ID from multiple possible locations
  const lateJobId = eventData?._id 
    || eventData?.id 
    || eventData?.job_id 
    || eventData?.post_id
    || body?.id 
    || body?.job_id 
    || body?.post_id
    || body?.post?._id
    || body?.post?.id
    || body?.data?._id
    || body?.data?.id
    || body?.data?.job_id
    || body?.data?.post_id
    || null;
  
  // Extract status from multiple possible locations
  const status = eventData?.status 
    || eventData?.state 
    || body?.status 
    || body?.state
    || body?.post?.status
    || body?.data?.status
    || null;

  return { eventType, eventData, lateJobId, status };
}

/**
 * Extract post URL and social media post ID from webhook data
 * Handles all supported platforms: Twitter, Facebook, Instagram, LinkedIn, TikTok, YouTube, Pinterest, Threads, Bluesky
 * 
 * Priority order:
 * 1. Platform-specific URL extraction (TikTok: construct from platformPostId)
 * 2. platformPostUrl (YouTube, etc.)
 * 3. url field
 * 4. post_url field
 * 5. link field
 * 
 * @param eventData - Event data from webhook
 * @param body - Full webhook body
 * @param existingPayload - Existing payload from database (for fallback)
 * @returns Object with postUrl and socialMediaPostId
 */
export function extractPostData(eventData: any, body: any, existingPayload: any): {
  postUrl: string | null;
  socialMediaPostId: string | null;
} {
  const postData = eventData?.post || eventData || body?.post || body;
  const platforms = Array.isArray(postData?.platforms) ? postData.platforms : [];
  const platformData = platforms.length > 0 ? platforms[0] : null;
  
  // Determine platform from platformData or existingPayload
  const platform = platformData?.platform 
    || existingPayload?.platform 
    || postData?.platform 
    || null;
  
  // For all platforms, use platformPostUrl first (most reliable - actual post URL from platform)
  // Priority: platformPostUrl > url > post_url > link
  const postUrl: string | null = platformData?.platformPostUrl
    || platformData?.url 
    || platformData?.post_url
    || platformData?.link
    || postData?.platformPostUrl
    || postData?.url 
    || postData?.post_url 
    || postData?.link
    || eventData?.url 
    || eventData?.post_url 
    || eventData?.link
    || body?.url 
    || body?.post_url
    || body?.link
    || existingPayload?.post_url 
    || null;
  
  const socialMediaPostId = eventData?.post_id 
    || eventData?.id 
    || eventData?.platform_post_id
    || eventData?.data?.post_id
    || eventData?.data?.id
    || eventData?.data?.platform_post_id
    || body?.post_id 
    || body?.id
    || body?.platform_post_id
    || body?.data?.post_id
    || body?.data?.id
    || body?.data?.platform_post_id
    || body?.post?.post_id
    || body?.post?.id
    || body?.post?.platform_post_id
    || body?.post?.platforms?.[0]?.post_id
    || body?.post?.platforms?.[0]?.id
    || existingPayload?.social_media_post_id 
    || null;

  return { postUrl, socialMediaPostId };
}

/**
 * Extract error message from webhook data
 */
export function extractErrorMessage(eventData: any, body: any): string {
  return eventData?.error 
    || eventData?.error_message 
    || eventData?.message 
    || body?.error 
    || body?.error_message
    || body?.message 
    || eventData?.details?.error
    || eventData?.details?.message
    || "Unknown error";
}

/**
 * Check if status indicates post was successfully posted
 */
export function isPostedStatus(status: string | null, eventType: string, body: any): boolean {
  return status === 'posted' 
    || status === 'completed' 
    || status === 'success' 
    || status === 'published'
    || eventType === 'post.posted'
    || eventType === 'post.published'
    || body?.post?.status === 'posted'
    || body?.post?.status === 'published';
}

/**
 * Check if status indicates post failed
 */
export function isFailedStatus(status: string | null, eventType: string): boolean {
  return status === 'failed' 
    || status === 'error' 
    || status === 'cancelled' 
    || eventType === 'post.failed' 
    || eventType === 'post.cancelled';
}

/**
 * Update post status to posted
 */
/**
 * Optimize webhook data to only store essential fields
 * Reduces payload size by removing redundant data
 */
export function optimizeWebhookData(body: any, eventData: any): any {
  const postData = eventData?.post || eventData || body?.post || body;
  const platforms = Array.isArray(postData?.platforms) ? postData.platforms : [];
  
  return {
    eventType: body?.event || body?.type || body?.action || null,
    status: postData?.status || body?.status || null,
    platforms: platforms.map((p: any) => ({
      platform: p.platform,
      status: p.status,
      errorMessage: p.errorMessage || null,
      platformPostId: p.platformPostId || null,
      platformPostUrl: p.platformPostUrl || null,
      publishedAt: p.publishedAt || null
    })),
    timestamp: new Date().toISOString()
  };
}

export async function updatePostToPosted(
  postId: string,
  lateJobId: string,
  body: any,
  eventType: string,
  status: string | null,
  eventData: any,
  existingPayload: any,
  getlateAccount?: any
): Promise<{ success: boolean; updatedPost?: any }> {
  const { postUrl, socialMediaPostId } = extractPostData(eventData, body, existingPayload);
  
  // Clean and optimize payload before updating to remove duplicates
  const { cleanPayload } = await import("@/lib/services/late/postService");
  const cleanedPayload = cleanPayload({
    ...existingPayload, // Preserve all existing payload fields
    posted_at: new Date().toISOString(),
    // Optimized webhook data - only essential fields
    webhook_data: optimizeWebhookData(body, eventData),
    webhook_event_type: eventType,
    webhook_status: status,
    // post_url is stored in dedicated column, not in payload to avoid duplication
    social_media_post_id: socialMediaPostId
  });

  const updateData: any = {
    status: 'posted',
    post_url: postUrl || null, // Store in dedicated column, not in payload
    payload: cleanedPayload
  };

  const { data: updatedRows, error: updateError } = await supabase
    .from("scheduled_posts")
    .update(updateData)
    .eq("id", postId)
    .select()
    .single();
  
  if (updateError) {
    console.error(`[LateWebhook] Error updating scheduled_posts status to 'posted':`, updateError);
    return { success: false };
  }

  // For TikTok posts, retry fetching the actual URL
  // TikTok sometimes doesn't return the actual video URL immediately after posting
  const platform = existingPayload?.platform || eventData?.post?.platforms?.[0]?.platform || null;
  if (platform?.toLowerCase() === 'tiktok' && lateJobId && updatedRows && getlateAccount) {
    const tiktokUsername = existingPayload?.connected_account_metadata?.username || null;
    console.log(`[LateWebhook] TikTok post posted via webhook, starting retry to fetch actual URL for post ${postId}`);
    
    // Get lateClient
    const { getLateClientForAccount } = await import("@/lib/services/late");
    const lateClient = getLateClientForAccount(getlateAccount);
    
    // Start retry in background (don't await to avoid blocking response)
    const { retryFetchTikTokUrl } = await import("@/lib/services/late/postService");
    const { getPostById } = await import("@/lib/services/db/posts");
    const post = await getPostById(postId);
    
    if (post) {
      retryFetchTikTokUrl(lateClient, lateJobId, platform, tiktokUsername, postId)
        .then(async (retryUrl) => {
          if (retryUrl) {
            console.log(`[LateWebhook] ✅ Retry successful! Updating post ${postId} with TikTok URL: ${retryUrl}`);
            const { updatePost } = await import("@/lib/services/db/posts");
            await updatePost(postId, post.user_id, { post_url: retryUrl });
          } else {
            console.log(`[LateWebhook] ⚠️ Retry failed to get TikTok URL for post ${postId}`);
          }
        })
        .catch((error) => {
          console.error(`[LateWebhook] Error in retry fetch TikTok URL for post ${postId}:`, error);
        });
    }
  }

  return { success: true, updatedPost: updatedRows };
}

/**
 * Update post status to failed
 */
export async function updatePostToFailed(
  lateJobId: string,
  body: any,
  eventType: string,
  status: string | null,
  eventData: any,
  existingPayload: any
): Promise<boolean> {
  const errorMessage = extractErrorMessage(eventData, body);
  const errorDetails = eventData?.error_details 
    || eventData?.details 
    || body?.error_details 
    || body?.details
    || eventData?.error
    || body?.error
    || null;

  // Clean and optimize payload before updating to remove duplicates
  const { cleanPayload } = await import("@/lib/services/late/postService");
  const cleanedPayload = cleanPayload({
    ...existingPayload,
    failed_at: new Date().toISOString(),
    error_message: errorMessage,
    error_details: errorDetails,
    // Optimized webhook data - only essential fields
    webhook_data: optimizeWebhookData(body, eventData),
    webhook_status: status,
    webhook_event_type: eventType
  });

  const { error: updateError } = await supabase
    .from("scheduled_posts")
    .update({ 
      status: 'failed',
      post_url: existingPayload?.post_url || null, // Keep existing post_url if any
      payload: cleanedPayload
    })
    .eq("late_job_id", lateJobId);
  
  if (updateError) {
    console.error("[LateWebhook] Error updating scheduled_posts status to 'failed':", updateError);
    return false;
  }

  return true;
}

/**
 * Update draft status
 */
export async function updateDraftStatus(
  draftId: string,
  status: 'posted' | 'failed'
): Promise<boolean> {
  // Note: updateDraft requires userId, but for webhook we don't have it
  // We'll use direct supabase call instead
  const { error } = await supabase
    .from("content_drafts")
    .update({ status })
    .eq("id", draftId);

  if (error) {
    console.error(`[LateWebhook] Error updating draft ${draftId} status to '${status}':`, error);
    return false;
  }

  return true;
}

/**
 * Increment monthly usage for scheduled posts
 */
export async function incrementScheduledPostsUsage(userId: string): Promise<void> {
  try {
    const month = getMonthStartDate(DEFAULT_TIMEZONE);
    await supabase.rpc('increment_usage', {
      p_user_id: userId,
      p_month: month,
      p_field: 'scheduled_posts',
      p_amount: 1
    });
  } catch (incErr: any) {
    console.warn('[LateWebhook] increment scheduled_posts error:', incErr);
  }
}

/**
 * Log webhook event to jobs table
 */
export async function logWebhookJob(
  requestId: string,
  body: any,
  status: 'processing' | 'done' | 'failed' = 'processing',
  error?: string
): Promise<void> {
  if (status === 'processing') {
    await supabase.from("jobs")
      .insert({ 
        job_type: 'late_webhook', 
        payload: { ...body, _webhook_request_id: requestId }, 
        status: 'processing',
        metadata: { requestId, timestamp: new Date().toISOString() }
      });
  } else {
    // Update existing job
    const { data: jobToUpdate } = await supabase
      .from("jobs")
      .select("id")
      .eq("job_type", 'late_webhook')
      .eq("payload->_webhook_request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    
    if (jobToUpdate) {
      await supabase.from("jobs")
        .update({ 
          status,
          last_error: error || null
        })
        .eq("id", jobToUpdate.id);
    }
  }
}

