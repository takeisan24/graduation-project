/**
 * Service: Late.dev Post Operations
 * 
 * Handles complex business logic for posting via late.dev including:
 * - Media upload to late.dev
 * - Post payload preparation
 * - Error parsing from late.dev responses
 * - Status determination
 * - Post creation and tracking
 */

import { LateClient } from "@/lib/late/client";
import { LateAccountWithLimits } from "./accountService";
import { Connection } from "@/lib/services/db/connections";
import { createScheduledPost } from "@/lib/services/db/posts";
import { incrementAccountUsage } from "./accountService";
import { trackActivity } from "@/lib/usage";
import { getMonthStartDate, DEFAULT_TIMEZONE } from "@/lib/utils/date";

export interface PostCreationRequest {
  connectedAccount: Connection & { getlate_profiles?: any };
  text: string;
  mediaUrls: string[];
  scheduledAt?: string | null;
  timezone?: string | null;
  userId: string;
  connectedAccountId: string;
  contentType?: 'regular' | 'story' | 'reel' | 'shorts'; // For Instagram/Facebook/YouTube
  draftId?: string | null;
  additionalPayloadFields?: Record<string, any>;
}

export interface PostCreationResult {
  success: boolean;
  scheduledPost?: any;
  lateJobId?: string | null;
  status: 'scheduled' | 'posted' | 'failed';
  errorMessage?: string | null;
  errorDetails?: any;
  responseStatus?: string | null;
}

/**
 * Map platform name to getlate.dev platform identifier
 */
export function mapPlatformToGetlate(platform: string): string {
  const platformMap: Record<string, string> = {
    'tiktok': 'tiktok',
    'facebook': 'facebook',
    'instagram': 'instagram',
    'twitter': 'twitter',
    'x': 'twitter', // X is Twitter
    'pinterest': 'pinterest',
    'youtube': 'youtube',
    'linkedin': 'linkedin'
  };

  return platformMap[platform?.toLowerCase() || ''] || platform?.toLowerCase() || platform;
}

/**
 * Unified function to prepare post payload for late.dev API
 * 
 * This function handles both "post now" and "schedule" scenarios:
 * - If scheduledAt is provided: Creates a scheduled post payload
 * - If scheduledAt is null/undefined: Creates an immediate post payload
 * 
 * Handles platform-specific configurations:
 * - Instagram: Regular posts (default), Stories, Reels (auto-detected if only 1 video is provided)
 * - Facebook: Regular posts, Stories
 * - TikTok/YouTube: Uses mediaItems array
 * 
 * @param getlateProfile - Getlate profile object with late_profile_id
 * @param platform - Platform name (e.g., 'instagram', 'facebook', 'tiktok')
 * @param text - Post text content
 * @param scheduledAt - Scheduled time (ISO string) or null/undefined for immediate post
 * @param timezone - Timezone string (required if scheduledAt is provided, optional otherwise)
 * @param socialMediaAccountId - Social media account ID on getlate.dev
 * @param getlateMediaUrl - Media URL from getlate.dev (if any, legacy support)
 * @param mediaUrls - Uploaded media URLs array (used for building mediaItems payloads)
 * @param contentType - Content type: 'regular' | 'story' | 'reel' (defaults to 'regular')
 * @returns Post payload for late.dev API
 * 
 * @example
 * ```typescript
 * // Post now
 * const payload = preparePostPayload(
 *   getlateProfile, 'instagram', 'Hello!', null, undefined, accountId, undefined, mediaUrls, 'regular'
 * );
 * 
 * // Schedule post
 * const payload = preparePostPayload(
 *   getlateProfile, 'instagram', 'Hello!', '2024-01-15T09:00:00Z', 'Asia/Ho_Chi_Minh', accountId, undefined, mediaUrls, 'regular'
 * );
 * ```
 */
export function preparePostPayload(
  getlateProfile: any,
  platform: string,
  text: string,
  scheduledAt: string | null | undefined,
  timezone: string | undefined,
  socialMediaAccountId: string | null,
  getlateMediaUrl: string | undefined,
  mediaUrls?: string[],
  contentType?: 'regular' | 'story' | 'reel' | 'shorts' // For Instagram/Facebook/YouTube
): any {
  const getlatePlatform = mapPlatformToGetlate(platform);
  const hasText = text && String(text).trim().length > 0;

  // Build platform config with accountId
  const platformConfig: any = {
    platform: getlatePlatform
  };

  if (socialMediaAccountId) {
    platformConfig.accountId = socialMediaAccountId;
  }

  // Normalize contentType: default to 'regular' if not provided
  const normalizedContentType = contentType || 'regular';

  const postPayload: any = {
    profile_id: getlateProfile.late_profile_id,
    text: hasText ? String(text).trim() : "",
    content: hasText ? String(text).trim() : "",
    platforms: [platformConfig]
  };

  // Add scheduling fields if scheduledAt is provided
  if (scheduledAt) {
    postPayload.scheduledFor = scheduledAt;
    (postPayload as any).schedule_at = scheduledAt;
    postPayload.timezone = timezone || 'UTC';
    // IMPORTANT: Set isDraft to false when scheduling to ensure post moves to Scheduled status
    // This prevents posts from staying in Draft status when scheduled
    postPayload.isDraft = false;
  }

  // Build a normalized list of uploaded media URLs for downstream payload decisions
  const allMediaUrls = mediaUrls && mediaUrls.length > 0 ? mediaUrls : (getlateMediaUrl ? [getlateMediaUrl] : []);

  const determineMediaType = (url: string) => {
    const lower = url.toLowerCase();
    return (lower.includes('.mp4') || lower.includes('.mov') || lower.includes('.webm') || lower.includes('video'))
      ? 'video'
      : 'image';
  };

  // Add media data based on platform requirements
  // According to getlate.dev docs, ALL platforms use mediaItems array (not media_url)
  // Supported platforms: facebook, instagram, tiktok, youtube, youtube_shorts, pinterest, linkedin, twitter, threads, bluesky
  // Reddit may not support media or uses different format
  if (allMediaUrls.length > 0) {
    // Validate Facebook: Cannot mix videos and images
    if (getlatePlatform === 'facebook') {
      const mediaTypes = allMediaUrls.map(url => determineMediaType(url));
      const hasVideo = mediaTypes.some(type => type === 'video');
      const hasImage = mediaTypes.some(type => type === 'image');

      if (hasVideo && hasImage) {
        throw new Error('Facebook posts cannot mix videos and images. Please use either all images or all videos.');
      }
    }

    // All platforms use mediaItems array format
    // Each item has { type: 'image' | 'video' | 'gif' | 'document', url: string }
    postPayload.mediaItems = allMediaUrls.map(url => ({
      type: determineMediaType(url),
      url
    }));
  }

  // Handle platform-specific data for different post types
  // Instagram: Regular posts, Stories, Reels (auto-detected or explicit)
  // Facebook: Regular posts, Stories
  // YouTube: Regular videos, Shorts (auto-detected by getlate.dev based on duration ≤ 3 minutes)
  // TikTok: Regular videos (no special configuration needed)
  // Other platforms: Regular posts (no special configuration needed)

  if (getlatePlatform === 'instagram' && postPayload.mediaItems && postPayload.mediaItems.length > 0) {
    if (normalizedContentType === 'story') {
      // Instagram Stories: 24-hour ephemeral content
      platformConfig.platformSpecificData = { contentType: 'story' };
      console.log(`[late/postService] Instagram post type: Story`);
    } else if (normalizedContentType === 'reel') {
      // Instagram Reels: Explicit Reels post
      platformConfig.platformSpecificData = { postType: 'reel' };
      console.log(`[late/postService] Instagram post type: Reel (explicit)`);
    } else {
      // Auto-detect Reels: if single video and contentType is 'regular' or not provided
      // Regular posts: Images or multiple images/videos (carousel)
      const isSingleVideo = postPayload.mediaItems.length === 1 && postPayload.mediaItems[0].type === 'video';
      if (isSingleVideo && normalizedContentType === 'regular') {
        platformConfig.platformSpecificData = { postType: 'reel' };
        console.log(`[late/postService] Auto-detected Instagram Reels (1 video provided)`);
      } else {
        console.log(`[late/postService] Instagram post type: Regular post`);
      }
    }
  } else if (getlatePlatform === 'facebook') {
    // Facebook post types
    if (normalizedContentType === 'story') {
      // Facebook Stories: 24-hour ephemeral content
      platformConfig.platformSpecificData = { contentType: 'story' };
      console.log(`[late/postService] Facebook post type: Story`);
    } else {
      // Regular Facebook post (feed post)
      console.log(`[late/postService] Facebook post type: Regular post`);
    }
  } else if (getlatePlatform === 'youtube' || getlatePlatform === 'youtube_shorts') {
    // YouTube: Regular videos and Shorts
    // Shorts are auto-detected by getlate.dev based on video duration (≤ 3 minutes)

    // Explicit Shorts request
    if (normalizedContentType === 'shorts') {
      platformConfig.platform = 'youtube_shorts';
      // Append #shorts to text if not present (for safety)
      if (postPayload.text && !postPayload.text.includes('#shorts')) {
        postPayload.text += ' #shorts';
        postPayload.content = postPayload.text;
      }
      console.log(`[late/postService] YouTube post type: Shorts (explicit request)`);
    } else {
      console.log(`[late/postService] YouTube post type: ${getlatePlatform === 'youtube_shorts' ? 'Shorts (auto-detected)' : 'Regular video'}`);
    }
  } else if (getlatePlatform === 'tiktok') {
    // TikTok: Regular videos (no special configuration needed)
    console.log(`[late/postService] TikTok post type: Regular video`);
  }
  // Other platforms (Twitter, LinkedIn, Pinterest, Threads, Bluesky, etc.) use regular posts
  // No platformSpecificData needed for these platforms

  // Remove empty text/content if media is provided and text is empty
  if (!hasText && getlateMediaUrl) {
    postPayload.text = "";
    postPayload.content = "";
  }

  return postPayload;
}

/**
 * Extract error message from late.dev response
 */
export function extractErrorMessage(latePost: any): string | null {
  let errorMessage: string | null = null;

  // Priority 1: Check platformResults for detailed error messages (most specific)
  // This gives us platform-specific error messages like "YouTube upload failed: YouTube quota exceeded..."
  if (latePost.platformResults && Array.isArray(latePost.platformResults)) {
    // Check for TikTok-specific errors (with custom message)
    const tiktokError = latePost.platformResults.find((result: any) =>
      result.platform === 'tiktok' &&
      result.error &&
      (result.error.includes('Duet is disabled') ||
        result.error.includes('Stitch is disabled') ||
        result.error.includes('TikTok UX validation failed'))
    );
    if (tiktokError) {
      errorMessage = 'Tài khoản TikTok của bạn cần được đặt ở chế độ công khai (Public) để có thể đăng bài. Vui lòng kiểm tra cài đặt quyền riêng tư trên TikTok và đảm bảo tài khoản ở chế độ công khai.';
    }

    // Check for any failed platform with error message (detailed platform error)
    if (!errorMessage) {
      const failedPlatform = latePost.platformResults.find((result: any) =>
        result.status === 'failed' && result.error
      );
      if (failedPlatform && failedPlatform.error) {
        errorMessage = failedPlatform.error;
      }
    }
  }

  // Priority 2: Check for errors in platform statuses (from post.platforms array)
  if (!errorMessage) {
    const postData = latePost.post || latePost;
    if (Array.isArray(postData.platforms)) {
      const failedPlatform = postData.platforms.find((p: any) =>
        p.status === 'failed' && p.errorMessage
      );
      if (failedPlatform && failedPlatform.errorMessage) {
        errorMessage = failedPlatform.errorMessage;
      }
    }
  }

  // Priority 3: Check top-level error fields (generic error messages)
  if (!errorMessage) {
    errorMessage = latePost.error
      || latePost.error_message
      || null;
  }

  // Priority 4: Check message field - only treat as error if it contains error keywords
  if (!errorMessage) {
    const message = latePost.message || (latePost.post && latePost.post.message) || null;
    if (message && typeof message === 'string') {
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('error') ||
        lowerMessage.includes('failed') ||
        lowerMessage.includes('fail') ||
        lowerMessage.includes('invalid') ||
        lowerMessage.includes('unauthorized') ||
        lowerMessage.includes('forbidden')) {
        errorMessage = message;
      }
    }
  }

  // Priority 5: Check for errors in details
  if (!errorMessage && latePost.details && typeof latePost.details === 'object') {
    errorMessage = latePost.details.error || latePost.details.error_message || null;
  }

  return errorMessage || null;
}

/**
 * Extract late.dev job/post ID from response
 */
export function extractLateJobId(latePost: any): string | null {
  const lateJobId = latePost.id
    || latePost.job_id
    || latePost.post_id
    || (latePost.post && (latePost.post._id || latePost.post.id))
    || null;

  const postData = latePost.post || latePost;
  return lateJobId || postData._id || postData.id || null;
}

/**
 * Extract response status from late.dev response
 */
export function extractResponseStatus(latePost: any): string | null {
  const postData = latePost.post || latePost;

  // Priority 1: Check postData.status (most reliable - from post.status)
  const postStatus = postData.status || null;
  if (postStatus) {
    return postStatus;
  }

  // Priority 2: Check platformResults for failed status
  if (latePost.platformResults && Array.isArray(latePost.platformResults)) {
    const failedPlatform = latePost.platformResults.find((result: any) => result.status === 'failed');
    if (failedPlatform) {
      return 'failed';
    }
  }

  // Priority 3: Check platform statuses from postData.platforms array
  const platformStatuses = Array.isArray(postData.platforms)
    ? postData.platforms.map((p: any) => p.status).filter(Boolean)
    : [];
  if (platformStatuses.length > 0) {
    // If any platform is failed, return failed
    if (platformStatuses.some((status: string) => status === 'failed')) {
      return 'failed';
    }
    return platformStatuses[0];
  }

  // Priority 4: Check top-level status fields
  return latePost.status
    || latePost.state
    || null;
}

/**
 * Determine initial post status based on response
 */
export function determineInitialStatus(
  scheduledAt: string | null | undefined,
  responseStatus: string | null,
  lateJobId: string | null,
  errorMessage: string | null
): 'scheduled' | 'posted' | 'failed' {
  // Check if response status is explicitly failed (highest priority)
  if (responseStatus === 'failed') {
    return 'failed';
  }

  if (scheduledAt) {
    return 'scheduled';
  } else if (responseStatus === 'published' ||
    responseStatus === 'posted' ||
    responseStatus === 'completed' ||
    responseStatus === 'success') {
    return 'posted';
  } else if (errorMessage && !lateJobId) {
    // Only fail immediately if no job ID (no webhook will come)
    return 'failed';
  } else if (lateJobId) {
    // If we have a job ID, set to 'scheduled' and wait for webhook confirmation
    return 'scheduled';
  } else {
    // Default: set to 'scheduled' and wait for webhook confirmation
    return 'scheduled';
  }
}

/**
 * Retry fetching TikTok post URL from getlate.dev after successful post
 * TikTok sometimes doesn't return the actual video URL immediately after posting
 * This function retries 3 times with delays: 30s, 1min, 1min
 * 
 * @param lateClient - Late.dev API client
 * @param lateJobId - Late.dev job/post ID
 * @param platform - Platform name (should be 'tiktok')
 * @param fallbackUsername - Username to use for URL construction if needed
 * @param postId - Database post ID (for logging)
 * @returns Post URL string or null if not found after all retries
 */
export async function retryFetchTikTokUrl(
  lateClient: any,
  lateJobId: string,
  platform: string,
  fallbackUsername: string | null,
  postId: string
): Promise<string | null> {
  // Only retry for TikTok
  if (platform?.toLowerCase() !== 'tiktok') {
    return null;
  }

  const delays = [5 * 60 * 1000, 5 * 60 * 1000, 5 * 60 * 1000]; // 5min, 5min, 5min (in milliseconds)
  let lastResponse: any = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Wait for delay (skip delay for first attempt)
      if (attempt > 0) {
        const delay = delays[attempt - 1];
        console.log(`[retryFetchTikTokUrl] Waiting ${delay / 1000}s before attempt ${attempt + 1} for post ${postId} (late_job_id: ${lateJobId})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      console.log(`[retryFetchTikTokUrl] Attempt ${attempt + 1}/3: Fetching post details from getlate.dev for post ${postId} (late_job_id: ${lateJobId})`);

      // Fetch post details from getlate.dev
      const response = await lateClient.getPost(lateJobId);
      lastResponse = response;

      // Log full response for debugging
      console.log(`[retryFetchTikTokUrl] Attempt ${attempt + 1}/3: Full response from getlate.dev:`, JSON.stringify(response, null, 2));

      // Extract URL from response (only platformPostUrl from late.dev API)
      const postUrl = extractPostUrl(response, platform);

      // Check if we got a valid URL (platformPostUrl from late.dev API)
      if (postUrl && postUrl.startsWith('https://www.tiktok.com/')) {
        console.log(`[retryFetchTikTokUrl] ✅ Successfully extracted TikTok URL on attempt ${attempt + 1}: ${postUrl}`);
        return postUrl;
      } else {
        console.log(`[retryFetchTikTokUrl] Attempt ${attempt + 1}: platformPostUrl not yet available. Extracted: ${postUrl}`);
      }
    } catch (error: any) {
      console.error(`[retryFetchTikTokUrl] Attempt ${attempt + 1}/3 failed:`, error);
      // Continue to next attempt
    }
  }

  // If all attempts failed, log the last response and return null
  console.warn(`[retryFetchTikTokUrl] ❌ Failed to get TikTok URL after 3 attempts for post ${postId}. Last response:`, JSON.stringify(lastResponse, null, 2));
  return null;
}

/**
 * Extract post URL from late.dev response
 * Handles all supported platforms: Twitter, Facebook, Instagram, LinkedIn, TikTok, YouTube, Pinterest, Threads, Bluesky
 * 
 * According to getlate.dev documentation:
 * - When a platform publishes successfully, its public URL is exposed as post.platforms[].platformPostUrl
 * - For scheduled posts, this appears after the job runs; fetch it later via GET /v1/posts/[postId]
 * 
 * Response structure:
 * {
 *   "post": {
 *     "platforms": [
 *       {
 *         "platform": "instagram",
 *         "platformPostUrl": "https://www.instagram.com/p/XXXXXXXX/"
 *       }
 *     ]
 *   }
 * }
 * 
 * Priority order:
 * 1. post.platforms[].platformPostUrl (most reliable - actual post URL from platform)
 * 2. post.platforms[].url
 * 3. post.platforms[].post_url
 * 4. post.platformPostUrl (fallback)
 * 5. post.url (fallback)
 * 6. post.post_url (fallback)
 * 7. null
 * 
 * @param latePost - Late.dev API response object (from GET /v1/posts/[postId])
 * @param platform - Platform name (e.g., 'tiktok', 'youtube', 'twitter', 'instagram')
 * @param fallbackUsername - Optional username (not used anymore, kept for backward compatibility)
 * @returns Post URL string or null if not found
 */
export function extractPostUrl(latePost: any, platform: string, fallbackUsername?: string | null): string | null {
  // Handle both wrapped response ({ post: {...} }) and direct response ({ ... })
  const postData = latePost.post || latePost;

  // Extract platforms array from post.platforms (as per getlate.dev documentation)
  const platforms = Array.isArray(postData.platforms) ? postData.platforms : [];

  // Find platform-specific data by matching platform name (case-insensitive)
  const platformData = platforms.find((p: any) => {
    const pPlatform = String(p.platform || '').toLowerCase();
    const targetPlatform = String(platform || '').toLowerCase();
    return pPlatform === targetPlatform;
  });

  if (!platformData) {
    // If no platform-specific data found, fallback to top-level URL fields
    return postData.platformPostUrl || postData.url || postData.post_url || null;
  }

  // For all platforms, prioritize platformPostUrl from post.platforms[] array
  // This is the most reliable source according to getlate.dev documentation
  // Priority: platformData.platformPostUrl > platformData.url > platformData.post_url > postData fallbacks
  return platformData.platformPostUrl
    || platformData.url
    || platformData.post_url
    || postData.platformPostUrl
    || postData.url
    || postData.post_url
    || null;
}

/**
 * Optimize Late.dev response to only store essential fields
 * Reduces payload size by removing redundant data
 */
export function optimizeLateDevResponse(latePost: any, platform: string): any {
  const postData = latePost.post || latePost;
  const platforms = Array.isArray(postData.platforms) ? postData.platforms : [];
  const platformData = platforms.find((p: any) => p.platform === platform?.toLowerCase());

  // Only store essential fields from Late.dev response
  return {
    _id: postData._id || postData.id || null,
    status: postData.status || null,
    message: latePost.message || null,
    platforms: platforms.map((p: any) => ({
      platform: p.platform,
      status: p.status,
      errorMessage: p.errorMessage || null,
      platformPostId: p.platformPostId || null,
      platformPostUrl: p.platformPostUrl || null,
      publishedAt: p.publishedAt || null
    })),
    createdAt: postData.createdAt || null,
    updatedAt: postData.updatedAt || null
  };
}

/**
 * Optimize connected account metadata to only store essential fields
 * Reduces payload size by removing redundant data
 */
export function optimizeConnectedAccountMetadata(profileMetadata: any): any {
  if (!profileMetadata) return {};

  // Only store essential fields that are not already in late_dev_response
  return {
    username: profileMetadata.username || null,
    platform: profileMetadata.platform || null,
    avatar_url: profileMetadata.avatar_url || profileMetadata.profilePicture || null,
    accountId: profileMetadata.accountId || null,
    verified: profileMetadata.verified || false
  };
}

/**
 * Clean and optimize payload to remove duplicate and unnecessary fields
 * This function ensures payload doesn't contain:
 * - Duplicate accountId (already in late_dev_response.platforms[].accountId)
 * - Duplicate post_url (stored in dedicated column)
 * - Old/unused fields from previous updates
 * - Nested duplicate data
 * 
 * @param payload - Existing payload to clean
 * @returns Cleaned and optimized payload
 */
export function cleanPayload(payload: any): any {
  if (!payload || typeof payload !== 'object') return {};

  // Create a clean payload with only essential fields
  const cleaned: any = {};

  // Content fields
  if (payload.text_content !== undefined) cleaned.text_content = payload.text_content;
  if (payload.media_urls !== undefined) cleaned.media_urls = payload.media_urls;

  // Account references (IDs only)
  if (payload.connected_account_id !== undefined) cleaned.connected_account_id = payload.connected_account_id;
  if (payload.late_profile_id !== undefined) cleaned.late_profile_id = payload.late_profile_id;
  // Note: accountId is kept for backward compatibility but could be removed if not needed

  // Optimized responses (only latest/essential)
  if (payload.late_dev_response) cleaned.late_dev_response = payload.late_dev_response;
  if (payload.status_check_response) cleaned.status_check_response = payload.status_check_response;
  if (payload.webhook_data) cleaned.webhook_data = payload.webhook_data;

  // Status and error information
  if (payload.response_status !== undefined) cleaned.response_status = payload.response_status;
  if (payload.error_message !== undefined) cleaned.error_message = payload.error_message;
  if (payload.error_details !== undefined) cleaned.error_details = payload.error_details;

  // Timestamps
  if (payload.posted_at !== undefined) cleaned.posted_at = payload.posted_at;
  if (payload.failed_at !== undefined) cleaned.failed_at = payload.failed_at;
  if (payload.rescheduled_at !== undefined) cleaned.rescheduled_at = payload.rescheduled_at;
  if (payload.previous_scheduled_at !== undefined) cleaned.previous_scheduled_at = payload.previous_scheduled_at;
  if (payload.last_status_check_at !== undefined) cleaned.last_status_check_at = payload.last_status_check_at;
  if (payload.last_webhook_at !== undefined) cleaned.last_webhook_at = payload.last_webhook_at;

  // Webhook metadata
  if (payload.webhook_event_type !== undefined) cleaned.webhook_event_type = payload.webhook_event_type;
  if (payload.webhook_status !== undefined) cleaned.webhook_status = payload.webhook_status;

  // Social media post ID
  if (payload.social_media_post_id !== undefined) cleaned.social_media_post_id = payload.social_media_post_id;

  // Profile metadata (only essential)
  if (payload.profile_metadata) {
    cleaned.profile_metadata = {
      synced_at: payload.profile_metadata.synced_at || null,
      synced_from: payload.profile_metadata.synced_from || null
    };
  }

  // Connected account metadata (only essential, not duplicated in late_dev_response)
  if (payload.connected_account_metadata) {
    cleaned.connected_account_metadata = {
      username: payload.connected_account_metadata.username || null,
      platform: payload.connected_account_metadata.platform || null,
      avatar_url: payload.connected_account_metadata.avatar_url || null,
      accountId: payload.connected_account_metadata.accountId || null,
      verified: payload.connected_account_metadata.verified || false
    };
  }

  // Post index (for batch scheduling)
  if (payload.post_index !== undefined) cleaned.post_index = payload.post_index;

  // Remove duplicate fields that are stored elsewhere:
  // - post_url: stored in dedicated column
  // - text: duplicate of text_content
  // - url: duplicate of post_url
  // - accountId: can be derived from connected_account_id or late_dev_response

  return cleaned;
}

/**
 * Create post via late.dev with full error handling and tracking
 */
export async function createPostViaLate(
  request: PostCreationRequest,
  lateClient: LateClient,
  getlateAccount: LateAccountWithLimits
): Promise<PostCreationResult> {
  const {
    connectedAccount,
    text,
    mediaUrls,
    scheduledAt,
    timezone,
    userId,
    connectedAccountId,
    contentType,
    draftId = null,
    additionalPayloadFields
  } = request;
  const postTimezone = timezone || 'UTC';

  const getlateProfile = (connectedAccount as any).getlate_profiles;
  if (!getlateProfile) {
    return {
      success: false,
      status: 'failed',
      errorMessage: 'Getlate profile not found for this connection'
    };
  }

  const hasText = !!(text && String(text).trim().length > 0);
  // Sanitize incoming media URLs to avoid null/undefined entries
  const mediaCandidates = Array.isArray(mediaUrls) ? mediaUrls.filter(Boolean) : [];
  const hasMedia = mediaCandidates.length > 0;
  const platform = connectedAccount.platform?.toLowerCase();
  const getlatePlatform = mapPlatformToGetlate(platform || '');
  const isTikTok = getlatePlatform === 'tiktok';
  const isYouTube = getlatePlatform === 'youtube' || getlatePlatform === 'youtube_shorts';
  const platformRequiresVideo = isTikTok || isYouTube;
  const platformRequiresMedia = getlatePlatform === 'instagram';

  // Validate content requirements
  if (!hasText && !hasMedia) {
    return {
      success: false,
      status: 'failed',
      errorMessage: 'Either text content or media is required for posting'
    };
  }

  if (platformRequiresVideo && !hasMedia) {
    return {
      success: false,
      status: 'failed',
      errorMessage: isTikTok
        ? 'TikTok requires a video or image to be attached'
        : 'YouTube requires an attached video file'
    };
  }

  if (platformRequiresMedia && !hasMedia) {
    return {
      success: false,
      status: 'failed',
      errorMessage: 'Instagram yêu cầu ít nhất 1 ảnh hoặc video cho mỗi bài đăng.'
    };
  }

  // Use Supabase/public URLs directly for getlate.dev payloads (already accessible)
  const finalMediaUrls = mediaCandidates;
  const getlateMediaUrl = finalMediaUrls[0];

  if (platformRequiresMedia && !getlateMediaUrl) {
    return {
      success: false,
      status: 'failed',
      errorMessage: 'Không thể tìm thấy URL media hợp lệ để đăng lên Instagram.'
    };
  }

  // Get social_media_account_id (accountId on getlate.dev) for platforms array
  const socialMediaAccountId = (connectedAccount as any).social_media_account_id
    || (connectedAccount as any).profile_metadata?.accountId
    || null;

  if (!socialMediaAccountId) {
    console.warn(`[late/postService] No social_media_account_id found for connection ${connectedAccount.id}. Platform: ${platform}`);
  }

  // Prepare post payload with platform-specific configurations
  // contentType defaults to 'regular' if not provided
  // Unified function handles both "post now" (scheduledAt = null) and "schedule" (scheduledAt != null)
  const postPayload = preparePostPayload(
    getlateProfile,
    connectedAccount.platform || '',
    text,
    scheduledAt || null,
    scheduledAt ? postTimezone : undefined, // Only pass timezone if scheduling
    socialMediaAccountId,
    getlateMediaUrl,
    finalMediaUrls, // Pass original Supabase URLs for auto-detecting Reels / mediaItems
    contentType // Pass contentType from request (defaults to 'regular')
  );

  // Log payload for debugging
  console.log(`[late/postService] Creating post for platform ${connectedAccount.platform}:`, {
    profile_id: postPayload.profile_id,
    has_text: !!postPayload.text && postPayload.text.length > 0,
    text_length: postPayload.text?.length || 0,
    has_media_url: !!postPayload.media_url,
    has_mediaItems: !!(postPayload.mediaItems && postPayload.mediaItems.length > 0),
    has_schedule_at: !!postPayload.scheduledFor,
    platforms: postPayload.platforms ? postPayload.platforms.map((p: any) => ({ platform: p.platform, has_accountId: !!p.accountId })) : null
  });

  // Create post via late.dev
  let latePost: any;
  try {
    latePost = await lateClient.createPost(postPayload);
    console.log(`[late/postService] Full late.dev response:`, JSON.stringify(latePost, null, 2));
  } catch (createError: any) {
    console.error(`[late/postService] Failed to create post via late.dev:`, createError);
    return {
      success: false,
      status: 'failed',
      errorMessage: createError.message || 'Failed to create post via late.dev',
      errorDetails: createError
    };
  }

  // Extract data from response
  const lateJobId = extractLateJobId(latePost);
  const errorMessage = extractErrorMessage(latePost);
  const errorDetails = latePost.error_details
    || latePost.details
    || latePost.error
    || null;
  const responseStatus = extractResponseStatus(latePost);
  const initialStatus = determineInitialStatus(scheduledAt, responseStatus, lateJobId, errorMessage);

  // Handle immediate failure case
  // Check if status is failed (either from responseStatus or initialStatus)
  // This handles both cases: with and without lateJobId
  if (initialStatus === 'failed' || responseStatus === 'failed') {
    console.error(`[late/postService] getlate.dev returned failed status. errorMessage: ${errorMessage}, responseStatus: ${responseStatus}, lateJobId: ${lateJobId}, errorDetails:`, errorDetails);

    // Save failed post to DB for tracking
    // Optimize payload to remove duplicate data
    const failedPost = await createScheduledPost({
      user_id: userId,
      draft_id: draftId || null,
      getlate_profile_id: getlateProfile.id,
      getlate_account_id: getlateAccount.id,
      platform: connectedAccount.platform,
      scheduled_at: scheduledAt || new Date().toISOString(),
      late_job_id: lateJobId || null, // Store lateJobId even if failed (for tracking)
      status: 'failed',
      post_url: null,
      payload: {
        // Content fields - only store text_content (remove duplicate 'text')
        text_content: text,
        media_urls: finalMediaUrls,
        // Account references - only store IDs
        connected_account_id: connectedAccountId,
        late_profile_id: getlateProfile.late_profile_id,
        accountId: (connectedAccount as any).social_media_account_id || (connectedAccount as any).profile_metadata?.accountId || null,
        // Optimized Late.dev response - only essential fields
        late_dev_response: optimizeLateDevResponse(latePost, platform || ''),
        // Error information
        error_message: errorMessage,
        error_details: errorDetails,
        response_status: responseStatus,
        // Profile metadata - only essential fields
        profile_metadata: {
          synced_at: getlateProfile.metadata?.synced_at || null,
          synced_from: getlateProfile.metadata?.synced_from || null
        },
        // Connected account metadata - only essential fields (not in late_dev_response)
        connected_account_metadata: optimizeConnectedAccountMetadata(connectedAccount.profile_metadata),
        ...(additionalPayloadFields || {})
      }
    });

    return {
      success: false,
      scheduledPost: failedPost,
      status: 'failed',
      errorMessage: errorMessage || 'Post creation failed',
      errorDetails,
      responseStatus
    };
  }

  // Save successful/scheduled post to DB
  // Optimize payload to remove duplicate data
  // Extract post URL (only platformPostUrl from late.dev API)
  const postUrl = extractPostUrl(latePost, platform || '');
  const scheduledPost = await createScheduledPost({
    user_id: userId,
    draft_id: draftId || null,
    getlate_profile_id: getlateProfile.id,
    getlate_account_id: getlateAccount.id,
    platform: connectedAccount.platform,
    scheduled_at: scheduledAt || new Date().toISOString(),
    late_job_id: lateJobId,
    status: initialStatus,
    post_url: postUrl || null, // Store in dedicated column, not in payload
    payload: {
      // Content fields - only store text_content (remove duplicate 'text')
      text_content: text,
      media_urls: finalMediaUrls,
      // Account references - only store IDs
      connected_account_id: connectedAccountId,
      late_profile_id: getlateProfile.late_profile_id,
      accountId: (connectedAccount as any).social_media_account_id || (connectedAccount as any).profile_metadata?.accountId || null,
      // Optimized Late.dev response - only essential fields
      late_dev_response: optimizeLateDevResponse(latePost, platform || ''),
      // Status and error information
      response_status: responseStatus || null,
      error_message: errorMessage || null,
      error_details: errorDetails || null,
      // Profile metadata - only essential fields
      profile_metadata: {
        synced_at: getlateProfile.metadata?.synced_at || null,
        synced_from: getlateProfile.metadata?.synced_from || null
      },
      // Connected account metadata - only essential fields (not in late_dev_response)
      connected_account_metadata: optimizeConnectedAccountMetadata(connectedAccount.profile_metadata),
      ...(additionalPayloadFields || {})
      // Note: post_url is stored in dedicated column, not in payload to avoid duplication
    }
  });

  if (!scheduledPost) {
    return {
      success: false,
      status: 'failed',
      errorMessage: 'Failed to save scheduled post to database'
    };
  }

  // Increment account usage
  try {
    await incrementAccountUsage(getlateAccount.id, scheduledAt ? "schedule_post" : "create_post");
  } catch (usageError: any) {
    console.warn(`[late/postService] Failed to increment account usage:`, usageError);
  }

  // Track activity
  if (scheduledPost) {
    const actionType: 'POST_SCHEDULED' | 'POST_PUBLISHED' = (scheduledAt || initialStatus === 'scheduled')
      ? 'POST_SCHEDULED'
      : 'POST_PUBLISHED';

    await trackActivity(
      userId,
      actionType,
      {
        resourceId: scheduledPost.id,
        resourceType: 'scheduled_post',
        platform: connectedAccount.platform,
        metadata: {
          scheduledAt: scheduledAt || null,
          lateJobId: scheduledPost.late_job_id,
          initialStatus: initialStatus,
          responseStatus: responseStatus || null,
          text: text.substring(0, 100)
        }
      }
    );
  }

  // Increment monthly usage if posted immediately
  if (scheduledPost && initialStatus === 'posted') {
    try {
      const month = getMonthStartDate(DEFAULT_TIMEZONE);
      const { supabase } = await import("@/lib/supabase");
      await supabase.rpc('increment_usage', {
        p_user_id: userId,
        p_month: month,
        p_field: 'scheduled_posts',
        p_amount: 1
      });
    } catch (usageError: any) {
      console.warn(`[late/postService] Failed to increment monthly usage:`, usageError);
    }

    // For TikTok posts that are immediately posted: retry fetching platformPostUrl if null
    // TikTok sometimes doesn't return the actual video URL immediately after posting
    // OPTIMIZATION: Instead of individual retries, rely on background cron job for batch processing
    // This reduces API calls and improves scalability for >100k users
    // Background job (/api/admin/sync-tiktok-urls) runs every 10 minutes to batch process all TikTok posts
    if (platform?.toLowerCase() === 'tiktok' && lateJobId) {
      const platformPostUrl = extractPostUrl(latePost, platform || '');

      // If platformPostUrl is available immediately, update DB
      if (platformPostUrl && platformPostUrl.startsWith('https://www.tiktok.com/')) {
        console.log(`[late/postService] ✅ Got platformPostUrl from API for TikTok post now, updating DB: ${platformPostUrl}`);
        const { updatePost } = await import("@/lib/services/db/posts");
        await updatePost(scheduledPost.id, userId, { post_url: platformPostUrl });
      } else {
        // platformPostUrl is null - leave post_url as null in DB
        // Background cron job will batch process this post along with others
        // This is more efficient than individual retries for scale (>100k users)
        console.log(`[late/postService] TikTok post immediately posted but platformPostUrl is null. post_url remains null. Background job will sync URL later.`);
      }
    }
  }

  return {
    success: true,
    scheduledPost,
    lateJobId,
    status: initialStatus,
    errorMessage: errorMessage || null,
    errorDetails: errorDetails || null,
    responseStatus: responseStatus || null
  };
}


