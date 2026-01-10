/**
 * Service: Failed Posts
 * 
 * Business logic for handling failed posts
 */

import { getFailedPosts } from "@/lib/services/db/posts";
import { findConnectionsByUserId } from "@/lib/services/db/connections";
import { Connection } from "@/lib/services/db/connections";
import { ScheduledPost } from "@/lib/services/db/posts";
import { getDateStringInTimezone } from "@/lib/utils/date";

export interface FailedPost {
  id: string;
  platform: string;
  content: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  error: string;
  errorMessage: string | null;
  errorDetails: any;
  profileName: string;
  profilePic: string;
  url: string | null;
  scheduledAt: string | null;
  lateJobId: string | null;
  getlateAccountId: string | null;
  /** Media URLs (images/videos) associated with this failed post for editor replay */
  media: string[] | null;
}

/**
 * Extract username from multiple sources
 */
function extractUsername(
  profileMetadata: any,
  payload: any,
  platformData: any,
  connectedAccount: Connection | null
): string {
  return profileMetadata?.username 
    || payload?.connected_account_metadata?.username
    || platformData?.accountId?.username
    || platformData?.accountId?.displayName
    || platformData?.username
    || platformData?.displayName
    || platformData?.platformSpecificData?.tiktokUsername
    || platformData?.platformSpecificData?.__usernameSnapshot
    || connectedAccount?.profile_name
    || 'Unknown Account';
}

/**
 * Extract avatar URL from multiple sources
 */
function extractAvatarUrl(
  profileMetadata: any,
  payload: any,
  platformData: any
): string {
  return profileMetadata?.avatar_url 
    || profileMetadata?.profilePicture
    || payload?.connected_account_metadata?.avatar_url
    || payload?.connected_account_metadata?.profilePicture
    || platformData?.accountId?.profilePicture
    || platformData?.accountId?.avatar_url
    || platformData?.profilePicture
    || platformData?.avatar_url
    || '/shego.jpg';
}

/**
 * Extract post URL from multiple sources (similar to publishedPostsService)
 * Priority: column post_url > platformPostUrl > url > post_url in payload
 * 
 * Note: For TikTok, we only use platformPostUrl from late.dev API. If it's null, we need to retry fetching.
 */
function extractPostUrl(
  payload: any,
  platformData: any,
  platform: string,
  username: string
): string | null {
  // For all platforms, use platformPostUrl first (most reliable - actual post URL from platform)
  // Priority: platformPostUrl > url > post_url
  return platformData?.platformPostUrl
    || platformData?.url
    || platformData?.post_url
    || payload?.webhook_data?.platforms?.[0]?.platformPostUrl
    || payload?.webhook_data?.platforms?.[0]?.url
    || payload?.webhook_data?.platforms?.[0]?.post_url
    || payload?.webhook_data?.post_url 
    || payload?.webhook_data?.url
    || null;
}

/**
 * Extract error message from multiple sources
 */
function extractErrorMessage(
  payload: any,
  platformData: any,
  defaultMessage = "Unknown error"
): { message: string; detailedMessage: string | null } {
  const platformErrorMessage = platformData?.errorMessage
    || platformData?.error
    || platformData?.error_message
    || null;

  let baseMessage = platformErrorMessage
    || payload?.error_message 
    || (payload?.error_details && typeof payload.error_details === 'object' && payload.error_details.message ? payload.error_details.message : null)
    || (payload?.error_details && typeof payload.error_details === 'string' ? payload.error_details : null)
    || payload?.webhook_data?.error_message 
    || payload?.webhook_data?.error
    || payload?.error
    || defaultMessage;
  
  // If error_message is an object, try to extract meaningful message
  if (typeof baseMessage === 'object') {
    baseMessage = baseMessage.message || baseMessage.error || JSON.stringify(baseMessage);
  }
  
  return {
    message: String(baseMessage),
    detailedMessage: platformErrorMessage || null
  };
}

/**
 * Transform database post to failed post format
 */
function transformPostToFailed(
  post: ScheduledPost,
  accountsMap: Record<string, Connection>,
  timeZone: string
): FailedPost {
  const payload = post.payload || {};
  const connectedAccountId = payload.connected_account_id;
  const connectedAccount = connectedAccountId ? accountsMap[connectedAccountId] : null;
  const profileMetadata = connectedAccount?.profile_metadata || payload.connected_account_metadata || {};
  
  const lateDevResponse = payload.late_dev_response || {};
  const lateDevPost = lateDevResponse.post || {};
  const lateDevPlatforms = Array.isArray(lateDevPost.platforms) ? lateDevPost.platforms : [];

  const statusCheckResponse = payload.status_check_response || {};
  const statusCheckPost = statusCheckResponse.post || statusCheckResponse;
  const statusCheckPlatforms = Array.isArray(statusCheckPost?.platforms) ? statusCheckPost.platforms : [];

  const platformData =
    lateDevPlatforms.find(
      (p: any) => p.platform?.toLowerCase() === post.platform?.toLowerCase()
    ) ||
    statusCheckPlatforms.find(
      (p: any) => p.platform?.toLowerCase() === post.platform?.toLowerCase()
    ) ||
    null;
  
  const scheduledDate = post.scheduled_at ? new Date(post.scheduled_at) : new Date(post.created_at);
  const username = extractUsername(profileMetadata, payload, platformData, connectedAccount);
  const avatarUrl = extractAvatarUrl(profileMetadata, payload, platformData);
  const { message: errorMessage, detailedMessage } = extractErrorMessage(
    payload,
    platformData
  );
  
  // Extract post URL (for TikTok, this will construct URL from platformPostId in status_check_response)
  const payloadUrl = extractPostUrl(payload, platformData, post.platform, username);
  const postUrl = post.post_url || payloadUrl;
  // Extract media URLs from payload (supports both camelCase and snake_case for backward compatibility)
  const mediaUrls: string[] | null =
    (Array.isArray(payload.mediaUrls) && payload.mediaUrls.length > 0 && payload.mediaUrls)
    || (Array.isArray((payload as any).media_urls) && (payload as any).media_urls.length > 0 && (payload as any).media_urls)
    || null;
  
  return {
    id: post.id,
    platform: post.platform || connectedAccount?.platform || 'Unknown',
    content: payload.text_content || '', // Use text_content only (text is duplicate)
    date: getDateStringInTimezone(scheduledDate, timeZone),
    time: scheduledDate.toTimeString().slice(0, 5), // HH:MM
    error: errorMessage,
    errorMessage: detailedMessage || errorMessage,
    errorDetails: payload.error_details || null,
    profileName: username.startsWith('@') ? username : `@${username}`,
    profilePic: avatarUrl,
    // Priority: column post_url > extracted from payload (including TikTok URL construction)
    url: postUrl,
    scheduledAt: post.scheduled_at,
    lateJobId: post.late_job_id || null,
    getlateAccountId: post.getlate_account_id || null,
    media: mediaUrls
  };
}

/**
 * Get failed posts for user
 * 
 * Optimized for scale: Uses pagination to limit results (default: 100 posts)
 * 
 * @param {string} userId - User ID
 * @param {string} timeZone - Timezone for date formatting
 * @param {object} options - Pagination options
 * @param {number} options.limit - Maximum number of posts (default: 100)
 * @param {number} options.offset - Number of posts to skip (default: 0)
 */
export async function getFailedPostsForUser(
  userId: string,
  timeZone: string,
  options?: { limit?: number; offset?: number }
): Promise<{
  posts: FailedPost[];
  count: number;
}> {
  // Get failed posts from database with pagination
  const posts = await getFailedPosts(userId, options);
  
  // Extract unique connected_account_ids from payload
  const connectedAccountIds = new Set<string>();
  posts.forEach((post) => {
    const connectedAccountId = post.payload?.connected_account_id;
    if (connectedAccountId) {
      connectedAccountIds.add(connectedAccountId);
    }
  });
  
  // Load connected_accounts in batch
  const accountsMap: Record<string, Connection> = {};
  if (connectedAccountIds.size > 0) {
    const allConnections = await findConnectionsByUserId(userId);
    allConnections.forEach((acc) => {
      if (connectedAccountIds.has(acc.id)) {
        accountsMap[acc.id] = acc;
      }
    });
  }
  
  // Transform posts to failed format
  const failedPosts = posts.map((post) => 
    transformPostToFailed(post, accountsMap, timeZone)
  );
  
  return {
    posts: failedPosts,
    count: failedPosts.length
  };
}

