function normalizePlatform(platform?: string | null): string | null {
  if (!platform) return platform ?? null;
  const trimmed = platform.trim();
  return trimmed ? trimmed.toLowerCase() : platform;
}
/**
 * Database Service: Posts
 * 
 * Handles all database operations related to scheduled_posts table
 * 
 * @module db/posts
 */

import { supabase } from "@/lib/supabase";

/**
 * Post payload stored in scheduled_posts.payload JSONB column
 * Contains post content, media URLs, and metadata
 */
interface PostPayloadPlatformEntry {
  platform?: string;
  platformPostUrl?: string;
  url?: string;
  post_url?: string;
  [key: string]: unknown;
}

interface PostPayloadWebhookData {
  platforms?: PostPayloadPlatformEntry[];
  post_url?: string;
  url?: string;
  data?: { url?: string; post_url?: string; [key: string]: unknown };
  error_message?: string;
  error?: string;
  engagement?: { likes: number; comments: number; shares: number };
  [key: string]: unknown;
}

interface PostPayloadAccountMetadata {
  username?: string;
  avatar_url?: string;
  profilePicture?: string;
  [key: string]: unknown;
}

interface PostPayloadLateDevResponse {
  post?: {
    platforms?: PostPayloadPlatformEntry[];
    url?: string;
    post_url?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface PostPayloadStatusCheckResponse {
  post?: {
    platforms?: PostPayloadPlatformEntry[];
    [key: string]: unknown;
  };
  platforms?: PostPayloadPlatformEntry[];
  [key: string]: unknown;
}

export interface PostPayload {
  connected_account_id?: string;
  platform?: string;
  text?: string;
  text_content?: string;
  mediaUrls?: string[];
  media_urls?: string[];
  id?: string;
  connected_account_metadata?: PostPayloadAccountMetadata;
  webhook_data?: PostPayloadWebhookData;
  late_dev_response?: PostPayloadLateDevResponse;
  status_check_response?: PostPayloadStatusCheckResponse;
  error_message?: string;
  error?: string;
  error_details?: Record<string, unknown> | string;
  engagement?: { likes: number; comments: number; shares: number };
  [key: string]: unknown; // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONB column with dynamic webhook/API response data
}

/**
 * Scheduled post record from scheduled_posts table
 */
export interface ScheduledPost {
  id: string;
  user_id: string;
  draft_id: string | null;
  getlate_profile_id: string | null;
  getlate_account_id: string | null;
  platform: string;
  scheduled_at: string;
  late_job_id: string | null;
  status: 'scheduled' | 'posted' | 'failed';
  post_url: string | null;
  payload: PostPayload;
  created_at: string;
  updated_at: string;
}

/**
 * Get published posts by user ID
 * 
 * Retrieves posts with status 'posted' for a specific user,
 * ordered by scheduled_at descending (most recent first).
 * 
 * Optimized for scale: Includes pagination to prevent loading too many posts at once.
 * 
 * @param {string} userId - User ID to get posts for
 * @param {object} options - Pagination options
 * @param {number} options.limit - Maximum number of posts to return (default: 100)
 * @param {number} options.offset - Number of posts to skip (default: 0)
 * @returns {Promise<ScheduledPost[]>} Array of published posts, empty array on error
 * 
 * @example
 * ```typescript
 * const posts = await getPublishedPosts('user_123', { limit: 50, offset: 0 });
 * ```
 */
export async function getPublishedPosts(
  userId: string,
  options?: { limit?: number; offset?: number }
): Promise<ScheduledPost[]> {
  const limit = options?.limit ?? 100; // Default limit: 100 posts
  const offset = options?.offset ?? 0;
  
  const { data, error } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "posted")
    .order("scheduled_at", { ascending: false })
    .range(offset, offset + limit - 1); // Supabase range is inclusive
  
  if (error) {
    console.error("[db/posts] Error getting published posts:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Get failed posts by user ID
 * 
 * Retrieves posts with status 'failed' for a specific user,
 * ordered by scheduled_at descending (most recent first).
 * 
 * Optimized for scale: Includes pagination to prevent loading too many posts at once.
 * 
 * @param {string} userId - User ID to get posts for
 * @param {object} options - Pagination options
 * @param {number} options.limit - Maximum number of posts to return (default: 100)
 * @param {number} options.offset - Number of posts to skip (default: 0)
 * @returns {Promise<ScheduledPost[]>} Array of failed posts, empty array on error
 * 
 * @example
 * ```typescript
 * const failedPosts = await getFailedPosts('user_123', { limit: 50, offset: 0 });
 * ```
 */
export async function getFailedPosts(
  userId: string,
  options?: { limit?: number; offset?: number }
): Promise<ScheduledPost[]> {
  const limit = options?.limit ?? 100; // Default limit: 100 posts
  const offset = options?.offset ?? 0;
  
  const { data, error } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "failed")
    .order("scheduled_at", { ascending: false })
    .range(offset, offset + limit - 1); // Supabase range is inclusive
  
  if (error) {
    console.error("[db/posts] Error getting failed posts:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Interface for scheduled post with draft relation
 */
export interface ScheduledPostWithDraft extends ScheduledPost {
  content_drafts?: {
    id: string;
    text_content: string | null;
    media_urls: string[] | null;
    platform: string | null;
  } | null;
}

/**
 * Get scheduled posts by user ID with draft info
 * 
 * Retrieves all scheduled posts for a user with related draft information
 * (if draft_id is present). Includes draft text_content, media_urls, and platform.
 * Ordered by scheduled_at descending (most recent first).
 * 
 * @param {string} userId - User ID to get posts for
 * @returns {Promise<ScheduledPostWithDraft[]>} Array of scheduled posts with draft info, empty array on error
 * 
 * @example
 * ```typescript
 * const posts = await getScheduledPosts('user_123');
 * ```
 */
export async function getScheduledPosts(userId: string): Promise<ScheduledPostWithDraft[]> {
  const { data, error } = await supabase
    .from("scheduled_posts")
    .select(`
      id,
      user_id,
      draft_id,
      getlate_profile_id,
      getlate_account_id,
      platform,
      scheduled_at,
      late_job_id,
      status,
      post_url,
      payload,
      created_at,
      updated_at,
      content_drafts (
        id,
        text_content,
        media_urls,
        platform
      )
    `)
    .eq("user_id", userId)
    .order("scheduled_at", { ascending: false });
  
  if (error) {
    console.error("[db/posts] Error getting scheduled posts:", error);
    return [];
  }
  
  const normalizedPosts: ScheduledPostWithDraft[] = ((data || []) as Array<ScheduledPost & { content_drafts?: { id: string; text_content: string | null; media_urls: string[] | null; platform: string | null } | { id: string; text_content: string | null; media_urls: string[] | null; platform: string | null }[] | null }>).map((post) => {
    const draftData = Array.isArray(post.content_drafts)
      ? post.content_drafts[0]
      : post.content_drafts;

    return {
      id: post.id,
      user_id: post.user_id,
      draft_id: post.draft_id,
      getlate_profile_id: post.getlate_profile_id,
      getlate_account_id: post.getlate_account_id,
      platform: post.platform,
      scheduled_at: post.scheduled_at,
      late_job_id: post.late_job_id,
      status: post.status,
      post_url: post.post_url,
      payload: post.payload,
      created_at: post.created_at,
      updated_at: post.updated_at,
      content_drafts: draftData
        ? {
            id: String(draftData.id ?? ""),
            text_content: draftData.text_content ?? null,
            media_urls: Array.isArray(draftData.media_urls) ? draftData.media_urls : null,
            platform: draftData.platform ?? null
          }
        : null
    };
  });

  return normalizedPosts;
}

/**
 * Get post by ID
 * 
 * Retrieves a single scheduled post by its ID.
 * 
 * @param {string} id - Post ID
 * @returns {Promise<ScheduledPost | null>} Post object or null if not found or error
 * 
 * @example
 * ```typescript
 * const post = await getPostById('post_123');
 * ```
 */
export async function getPostById(id: string): Promise<ScheduledPost | null> {
  const { data, error } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  
  if (error) {
    console.error("[db/posts] Error getting post:", error);
    return null;
  }
  
  return data;
}

/**
 * Interface for creating a scheduled post
 */
export interface CreateScheduledPostData {
  user_id: string;
  draft_id?: string | null;
  getlate_profile_id?: string | null;
  getlate_account_id?: string | null;
  platform: string;
  scheduled_at: string;
  late_job_id?: string | null;
  status?: 'scheduled' | 'posted' | 'failed';
  post_url?: string | null;
  payload: PostPayload;
}

/**
 * Create a new scheduled post
 * 
 * Inserts a new record into scheduled_posts table with the provided data.
 * Returns the created post record with all fields populated (including id, created_at, updated_at).
 * 
 * @param {CreateScheduledPostData} data - Post data to create
 * @param {string} data.user_id - User ID who owns this post
 * @param {string | null} [data.draft_id] - Optional draft ID this post was created from
 * @param {string | null} [data.getlate_profile_id] - Optional getlate profile ID
 * @param {string | null} [data.getlate_account_id] - Optional getlate account ID
 * @param {string} data.platform - Platform name (e.g., 'twitter', 'facebook')
 * @param {string} data.scheduled_at - ISO timestamp for when post should be published
 * @param {string | null} [data.late_job_id] - Optional late.dev job ID
 * @param {'scheduled' | 'posted' | 'failed'} [data.status='scheduled'] - Post status
 * @param {PostPayload} data.payload - Post payload JSON object with content and metadata
 * @returns {Promise<ScheduledPost | null>} Created post object or null on error
 * 
 * @example
 * ```typescript
 * const post = await createScheduledPost({
 *   user_id: 'user_123',
 *   platform: 'twitter',
 *   scheduled_at: '2024-01-15T09:00:00Z',
 *   payload: { text: 'Hello world', mediaUrls: [] }
 * });
 * ```
 */
export async function createScheduledPost(data: CreateScheduledPostData): Promise<ScheduledPost | null> {
  const normalizedPlatform = normalizePlatform(data.platform) || data.platform;

  const { data: post, error } = await supabase
    .from("scheduled_posts")
    .insert({
      user_id: data.user_id,
      draft_id: data.draft_id || null,
      getlate_profile_id: data.getlate_profile_id || null,
      getlate_account_id: data.getlate_account_id || null,
      platform: normalizedPlatform,
      scheduled_at: data.scheduled_at,
      late_job_id: data.late_job_id || null,
      status: data.status || 'scheduled',
      post_url: data.post_url || null,
      payload: data.payload
    })
    .select()
    .single();
  
  if (error) {
    console.error("[db/posts] Error creating scheduled post:", error);
    return null;
  }
  
  return post;
}

/**
 * Update post status
 * 
 * Updates the status of a scheduled post and optionally other fields.
 * 
 * @param {string} id - Post ID to update
 * @param {'scheduled' | 'posted' | 'failed'} status - New status value
 * @param {Partial<ScheduledPost>} [updates] - Optional additional fields to update
 * @returns {Promise<boolean>} True if update succeeded, false on error
 * 
 * @example
 * ```typescript
 * const success = await updatePostStatus('post_123', 'posted');
 * ```
 */
export async function updatePostStatus(
  id: string,
  status: 'scheduled' | 'posted' | 'failed',
  updates?: Partial<ScheduledPost>
): Promise<boolean> {
  const updateData: Partial<ScheduledPost> & { status: string } = { status };
  
  if (updates) {
    Object.assign(updateData, updates);
  }
  
  const { error } = await supabase
    .from("scheduled_posts")
    .update(updateData)
    .eq("id", id);
  
  if (error) {
    console.error("[db/posts] Error updating post status:", error);
    return false;
  }
  
  return true;
}

/**
 * Update post by ID and return updated post
 * 
 * Updates a scheduled post and returns the updated record. Only updates
 * posts that belong to the specified user (for security).
 * 
 * @param {string} id - Post ID to update
 * @param {string} userId - User ID who owns this post (for authorization)
 * @param {Partial<ScheduledPost>} updates - Fields to update
 * @returns {Promise<ScheduledPost | null>} Updated post object or null if not found/error
 * 
 * @example
 * ```typescript
 * const updated = await updatePost('post_123', 'user_123', {
 *   status: 'posted',
 *   payload: { ...existingPayload, post_url: 'https://twitter.com/...' }
 * });
 * ```
 */
export async function updatePost(
  id: string,
  userId: string,
  updates: Partial<ScheduledPost>
): Promise<ScheduledPost | null> {
  const normalizedUpdates = { ...updates };
  if (normalizedUpdates.platform) {
    normalizedUpdates.platform = normalizePlatform(normalizedUpdates.platform) || normalizedUpdates.platform;
  }

  const { data, error } = await supabase
    .from("scheduled_posts")
    .update(normalizedUpdates)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  
  if (error) {
    console.error("[db/posts] Error updating post:", error);
    return null;
  }
  
  return data;
}

/**
 * Interface for post with getlate_accounts relation
 */
export interface PostWithAccount extends ScheduledPost {
  getlate_accounts: {
    id: string;
    api_key: string;
  };
}

/**
 * Get posts by IDs with getlate_accounts join
 * 
 * Retrieves multiple posts by their IDs, including related getlate_accounts
 * information. Only returns posts that belong to the specified user and have
 * a non-null late_job_id.
 * 
 * @param {string[]} ids - Array of post IDs to retrieve
 * @param {string} userId - User ID for authorization
 * @returns {Promise<PostWithAccount[]>} Array of posts with account info, empty array on error
 * 
 * @example
 * ```typescript
 * const posts = await getPostsByIdsWithAccount(['post_1', 'post_2'], 'user_123');
 * ```
 */
export async function getPostsByIdsWithAccount(
  ids: string[],
  userId: string
): Promise<PostWithAccount[]> {
  const { data, error } = await supabase
    .from("scheduled_posts")
    .select(`
      *,
      getlate_accounts!inner(
        id,
        api_key
      )
    `)
    .eq("user_id", userId)
    .in("id", ids)
    .not("late_job_id", "is", null);
  
  if (error) {
    console.error("[db/posts] Error getting posts by IDs:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Get post by ID with getlate_accounts join
 * 
 * Retrieves a single post by ID, including related getlate_accounts information.
 * Only returns post if it belongs to the specified user.
 * 
 * @param {string} id - Post ID to retrieve
 * @param {string} userId - User ID for authorization
 * @returns {Promise<PostWithAccount | null>} Post with account info or null if not found/error
 * 
 * @example
 * ```typescript
 * const post = await getPostByIdWithAccount('post_123', 'user_123');
 * ```
 */
export async function getPostByIdWithAccount(
  id: string,
  userId: string
): Promise<PostWithAccount | null> {
  const { data, error } = await supabase
    .from("scheduled_posts")
    .select(`
      *,
      getlate_accounts!inner(
        id,
        api_key
      )
    `)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  
  if (error) {
    console.error("[db/posts] Error getting post by ID with account:", error);
    return null;
  }
  
  return data;
}

/**
 * Update post by late_job_id
 */
export async function updatePostByLateJobId(
  lateJobId: string,
  updates: Partial<ScheduledPost>
): Promise<boolean> {
  const normalizedUpdates = { ...updates };
  if (normalizedUpdates.platform) {
    normalizedUpdates.platform = normalizePlatform(normalizedUpdates.platform) || normalizedUpdates.platform;
  }

  const { error } = await supabase
    .from("scheduled_posts")
    .update(normalizedUpdates)
    .eq("late_job_id", lateJobId);
  
  if (error) {
    console.error("[db/posts] Error updating post by late_job_id:", error);
    return false;
  }
  
  return true;
}

/**
 * Get pending posts (scheduled but not yet posted)
 */
export async function getPendingPosts(userId?: string): Promise<ScheduledPost[]> {
  let query = supabase
    .from("scheduled_posts")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true });
  
  if (userId) {
    query = query.eq("user_id", userId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error("[db/posts] Error getting pending posts:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Delete post
 */
export async function deletePost(id: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("scheduled_posts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  
  if (error) {
    console.error("[db/posts] Error deleting post:", error);
    return false;
  }
  
  return true;
}

/**
 * Get posts with late_job_id (posts created via Late.dev) for a user
 */
export async function getLatePosts(userId: string): Promise<Pick<ScheduledPost, 'id' | 'platform' | 'scheduled_at' | 'status' | 'payload' | 'created_at' | 'updated_at' | 'late_job_id' | 'getlate_profile_id' | 'getlate_account_id'>[]> {
  const { data, error } = await supabase
    .from("scheduled_posts")
    .select(`
      id,
      platform,
      scheduled_at,
      status,
      payload,
      created_at,
      updated_at,
      late_job_id,
      getlate_profile_id,
      getlate_account_id
    `)
    .eq("user_id", userId)
    .not("late_job_id", "is", null)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("[db/posts] Error getting late posts:", error);
    return [];
  }
  
  return data || [];
}

