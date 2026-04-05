/**
 * Service: Published Posts
 * 
 * Business logic for handling published posts
 */

import { getPublishedPosts } from "@/lib/services/db/posts";
import { findConnectionsByUserId } from "@/lib/services/db/connections";
import { Connection } from "@/lib/services/db/connections";
import { ScheduledPost, PostPayload } from "@/lib/services/db/posts";

/** Platform data from late.dev API response (deeply nested in JSONB payload) */
interface PlatformData {
  platform?: string;
  platformPostUrl?: string;
  url?: string;
  post_url?: string;
  username?: string;
  displayName?: string;
  profilePicture?: string;
  avatar_url?: string;
  accountId?: {
    username?: string;
    displayName?: string;
    profilePicture?: string;
    avatar_url?: string;
  };
  platformSpecificData?: {
    tiktokUsername?: string;
    __usernameSnapshot?: string;
  };
}

/** Profile metadata shape used when extracting user info */
interface ProfileInfo {
  username?: string;
  avatar_url?: string;
  profilePicture?: string;
  [key: string]: unknown;
}

export interface PublishedPost {
  id: string;
  platform: string;
  content: string;
  time: string;
  status: string;
  url: string;
  profileName: string;
  profilePic: string;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
  };
}

/**
 * Extract username from multiple sources
 */
function extractUsername(
  profileMetadata: ProfileInfo,
  payload: PostPayload,
  platformData: PlatformData | null,
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
  profileMetadata: ProfileInfo,
  payload: PostPayload,
  platformData: PlatformData | null
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
 * Extract post URL from multiple sources
 * Priority: column post_url > platformPostUrl > url > post_url in payload
 * 
 * Note: For TikTok, we only use platformPostUrl from late.dev API. If it's null, we need to retry fetching.
 */
function extractPostUrl(
  payload: PostPayload,
  platformData: PlatformData | null,
  lateDevPost: Record<string, unknown>,
  platform: string,
  username: string
): string {
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
    || payload?.webhook_data?.data?.url
    || payload?.webhook_data?.data?.post_url
    || (lateDevPost?.url as string | undefined)
    || (lateDevPost?.post_url as string | undefined)
    || `https://${(platform || '').toLowerCase()}.com/post/${payload?.id || 'unknown'}`;
}

/**
 * Transform database post to published post format
 */
function transformPostToPublished(
  post: ScheduledPost,
  accountsMap: Record<string, Connection>
): PublishedPost {
  const payload = post.payload || {};
  const connectedAccountId = payload.connected_account_id;
  const connectedAccount = connectedAccountId ? accountsMap[connectedAccountId] : null;
  const profileMetadata: ProfileInfo = connectedAccount?.profile_metadata || payload.connected_account_metadata || {};

  const lateDevResponse = payload.late_dev_response || {};
  const lateDevPost = lateDevResponse.post || {};
  const lateDevPlatforms = Array.isArray(lateDevPost.platforms) ? lateDevPost.platforms : [];

  const statusCheckResponse = payload.status_check_response || {};
  const statusCheckPost = statusCheckResponse.post || statusCheckResponse;
  const statusCheckPlatforms = Array.isArray(statusCheckPost?.platforms) ? statusCheckPost.platforms : [];
  
  // Priority: status_check_response (for published posts) > late_dev_response (for scheduled posts)
  const platformData = 
    statusCheckPlatforms.find((p: PlatformData) => 
      p.platform?.toLowerCase() === post.platform?.toLowerCase()
    ) ||
    lateDevPlatforms.find((p: PlatformData) => 
      p.platform?.toLowerCase() === post.platform?.toLowerCase()
    ) ||
    null;
  
  const username = extractUsername(profileMetadata, payload, platformData, connectedAccount);
  const avatarUrl = extractAvatarUrl(profileMetadata, payload, platformData);
  const payloadUrl = extractPostUrl(payload, platformData, lateDevPost, post.platform, username);
  const postUrl = post.post_url || payloadUrl;
  
  return {
    id: post.id,
    platform: post.platform || connectedAccount?.platform || 'Unknown',
    content: payload.text_content || '', // Use text_content only (text is duplicate)
    time: post.scheduled_at || post.created_at,
    status: post.status,
    url: postUrl || '', // Priority: column post_url > extracted from payload
    profileName: username.startsWith('@') ? username : `@${username}`,
    profilePic: avatarUrl,
    engagement: payload.engagement || payload.webhook_data?.engagement || {
      likes: 0,
      comments: 0,
      shares: 0
    }
  };
}

/**
 * Get published posts for user
 * 
 * Optimized for scale: Uses pagination to limit results (default: 100 posts)
 * 
 * @param {string} userId - User ID
 * @param {object} options - Pagination options
 * @param {number} options.limit - Maximum number of posts (default: 100)
 * @param {number} options.offset - Number of posts to skip (default: 0)
 */
export async function getPublishedPostsForUser(
  userId: string,
  options?: { limit?: number; offset?: number }
): Promise<{
  posts: PublishedPost[];
  count: number;
}> {
  // Get published posts from database with pagination
  const posts = await getPublishedPosts(userId, options);
  
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
  
  // Transform posts to published format
  const publishedPosts = posts.map((post) => 
    transformPostToPublished(post, accountsMap)
  );
  
  return {
    posts: publishedPosts,
    count: publishedPosts.length
  };
}

