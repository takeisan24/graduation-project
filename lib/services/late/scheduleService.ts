/**
 * Service: Schedule Posts via Late.dev
 * 
 * Handles complex business logic for scheduling posts including:
 * - Media upload to late.dev
 * - Post payload preparation for different platforms
 * - Response parsing and error handling
 * - Scheduled post creation and tracking
 * 
 * @module scheduleService
 */

import { LateClient } from "@/lib/late/client";
import { LateAccountWithLimits } from "./accountService";
import { Connection } from "@/lib/services/db/connections";
import { ScheduledPost } from "@/lib/services/db/posts";
import { validatePostingRequest } from "./validationService";
import { trackActivity } from "@/lib/usage";
import { findConnectionsByIdsWithProfiles, findConnectionByLateProfileId } from "@/lib/services/db/connections";
import { handleNativeYoutubeUpload } from "@/lib/services/youtube/uploadService";
import { deductCredits } from "@/lib/usage";

/**
 * Supported platform names mapped to getlate.dev platform identifiers
 * @constant
 */
const PLATFORM_MAP: Record<string, string> = {
  'Twitter': 'twitter',
  'X': 'twitter',
  'Instagram': 'instagram',
  'Facebook': 'facebook',
  'LinkedIn': 'linkedin',
  'TikTok': 'tiktok',
  'Pinterest': 'pinterest',
  'Threads': 'threads',
  'Bluesky': 'bluesky',
  'YouTube': 'youtube'
};

/**
 * Map platform name to getlate.dev platform identifier
 * 
 * Converts human-readable platform names (e.g., "Twitter", "X") to
 * getlate.dev's internal platform identifiers (e.g., "twitter").
 * 
 * @param {string} platform - Platform name to map
 * @returns {string} getlate.dev platform identifier (lowercase)
 * 
 * @example
 * ```typescript
 * const platformId = mapPlatformToGetlate('Twitter'); // Returns 'twitter'
 * const platformId = mapPlatformToGetlate('TikTok'); // Returns 'tiktok'
 * ```
 */
function mapPlatformToGetlate(platform: string): string {
  return PLATFORM_MAP[platform] || platform.toLowerCase();
}

/**
 * Minimal shape for getlate profile relation
 */
interface GetlateProfile {
  id: string;
  late_profile_id: string;
  social_media_ids?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Interface for user object (minimal required fields)
 */
interface User {
  id: string;
  email?: string;
}

/**
 * Interface for post request data
 */
interface PostRequest {
  platform: string;
  profileIds: string[];
  text: string;
  mediaUrls?: string[];
  contentType?: 'regular' | 'story' | 'reel' | 'shorts'; // For Instagram/Facebook/YouTube
}

/**
 * Interface for schedule single post result
 */
interface ScheduleSinglePostResult {
  success: boolean;
  scheduledPost?: ScheduledPost;
  error?: {
    message: string;
  };
}

/**
 * Schedule a single post for a profile (used by scheduleMultiplePosts)
 * 
 * Handles the complete flow for scheduling one post:
 * 1. Validates profile and extracts getlate profile information
 * 2. Validates TikTok media requirements
 * 3. Uploads media to getlate.dev if provided
 * 4. Prepares and sends post payload to late.dev API
 * 5. Parses response and validates job ID
 * 6. Saves scheduled post to database
 * 7. Increments account usage
 * 
 * @param {User} user - User object with at least id field
 * @param {PostRequest} post - Post request data (platform, profileIds, text, mediaUrls)
 * @param {number} postIndex - Index of this post in the batch (for error tracking)
 * @param {string} scheduledAt - ISO timestamp for scheduled post
 * @param {string | undefined} timezone - Timezone string or undefined for UTC
 * @param {Connection & { getlate_profiles?: GetlateProfile }} profile - Connection object with getlate_profiles relation
 * @param {LateClient} lateClient - Late.dev client instance
 * @param {LateAccountWithLimits} accountForPost - Late.dev account to use for posting
 * @returns {Promise<ScheduleSinglePostResult>} Result object with success status, scheduled post, or error
 * 
 * @example
 * ```typescript
 * const result = await scheduleSinglePost(
 *   user,
 *   { platform: 'Twitter', profileIds: ['id1'], text: 'Hello', mediaUrls: [] },
 *   0,
 *   '2024-01-15T09:00:00Z',
 *   'Asia/Ho_Chi_Minh',
 *   profile,
 *   lateClient,
 *   account
 * );
 * ```
 */
/**
 * Schedule a single post for a profile (used by scheduleMultiplePosts)
 * 
 * REFACTORED: Now uses createPostViaLate from postService.ts to eliminate code duplication
 * The only differences are:
 * - Adds post_index to payload for batch tracking
 * - Handles TikTok URL retry for scheduled posts (not just immediate posts)
 * - Returns ScheduleSinglePostResult instead of PostCreationResult
 * 
 * @param {User} user - User object with at least id field
 * @param {PostRequest} post - Post request data (platform, profileIds, text, mediaUrls)
 * @param {number} postIndex - Index of this post in the batch (for error tracking)
 * @param {string} scheduledAt - ISO timestamp for scheduled post
 * @param {string | undefined} timezone - Timezone string or undefined for UTC
 * @param {Connection & { getlate_profiles?: GetlateProfile }} profile - Connection object with getlate_profiles relation
 * @param {LateClient} lateClient - Late.dev client instance
 * @param {LateAccountWithLimits} accountForPost - Late.dev account to use for posting
 * @returns {Promise<ScheduleSinglePostResult>} Result object with success status, scheduled post, or error
 */
async function scheduleSinglePost(
  user: User,
  post: PostRequest,
  postIndex: number,
  scheduledAt: string,
  timezone: string | undefined,
  profile: Connection & { getlate_profiles?: GetlateProfile },
  lateClient: LateClient,
  accountForPost: LateAccountWithLimits
): Promise<ScheduleSinglePostResult> {
  try {
    const { platform, text, mediaUrls = [] } = post;

    // Extract getlate_profile
    const getlateProfile = profile.getlate_profiles;
    if (!getlateProfile) {
      throw new Error("Getlate profile not found for this connection");
    }

    // Use unified createPostViaLate from postService.ts
    // This eliminates all duplicate validation, payload preparation, API calls, and DB saving logic
    const { createPostViaLate } = await import("@/lib/services/late/postService");
    const result = await createPostViaLate(
      {
        connectedAccount: profile as Connection & { getlate_profiles?: any },
        text,
        mediaUrls: mediaUrls || [],
        scheduledAt, // Always provided for schedule
        timezone: timezone || null,
        userId: user.id,
        connectedAccountId: profile.id,
        contentType: post.contentType || 'regular', // Default to 'regular' if not provided
        additionalPayloadFields: postIndex !== undefined ? { post_index: postIndex } : undefined
      },
      lateClient,
      accountForPost
    );

    // Handle failure case
    if (!result.success || !result.scheduledPost) {
      return {
        success: false,
        error: {
          message: result.errorMessage || 'Failed to schedule post'
        }
      };
    }

    // For TikTok scheduled posts: check if platformPostUrl is available
    // TikTok sometimes doesn't return the actual video URL immediately after scheduling
    // OPTIMIZATION: Instead of individual retries, rely on background cron job for batch processing
    // This reduces API calls and improves scalability for >100k users
    // Background job (/api/admin/sync-tiktok-urls) runs every 10 minutes to batch process all TikTok posts
    if (platform?.toLowerCase() === 'tiktok' && result.lateJobId) {
      const platformPostUrl = result.scheduledPost.post_url;

      // If platformPostUrl is still null, leave it for background cron job
      // If it's available, it was already set by createPostViaLate
      if (!platformPostUrl) {
        console.log(`[scheduleService] TikTok scheduled post but platformPostUrl is null. post_url remains null. Background job will sync URL later.`);
      }
    }

    return { success: true, scheduledPost: result.scheduledPost };
  } catch (error: any) {
    console.error(`[scheduleService] Error scheduling post ${postIndex}:`, error);
    return { success: false, error: { message: error.message || String(error) } };
  }
}

/**
 * Interface for schedule error
 */
export interface ScheduleError {
  postIndex: number;
  platform: string;
  profileId?: string;
  error: string;
}

/**
 * Interface for schedule multiple posts result
 */
export interface ScheduleMultiplePostsResult {
  success: boolean;
  scheduledPosts: ScheduledPost[];
  errors: ScheduleError[];
}

/**
 * Schedule multiple posts for multiple platforms (without draft)
 * 
 * Processes an array of posts and schedules them across multiple platforms.
 * For each post:
 * 1. Validates user owns the specified profiles
 * 2. Verifies profiles are connected to Late.dev
 * 3. Validates posting limits for each profile
 * 4. Schedules posts via late.dev API
 * 5. Tracks activity for successful posts
 * 
 * Used by `app/api/schedule/route.ts` POST method.
 * 
 * @param {User} user - User object with at least id field
 * @param {PostRequest[]} posts - Array of post requests to schedule
 * @param {string} scheduledAt - ISO timestamp for scheduled posts
 * @param {string | undefined} timezone - Timezone string or undefined for UTC
 * @returns {Promise<ScheduleMultiplePostsResult>} Result object with scheduled posts and any errors
 * 
 * @example
 * ```typescript
 * const result = await scheduleMultiplePosts(
 *   user,
 *   [
 *     { platform: 'Twitter', profileIds: ['id1'], text: 'Hello', mediaUrls: [] },
 *     { platform: 'Facebook', profileIds: ['id2'], text: 'World', mediaUrls: ['url1'] }
 *   ],
 *   '2024-01-15T09:00:00Z',
 *   'Asia/Ho_Chi_Minh'
 * );
 * ```
 */
export async function scheduleMultiplePosts(
  user: User,
  posts: PostRequest[],
  scheduledAt: string,
  timezone: string | undefined
): Promise<ScheduleMultiplePostsResult> {
  const allScheduledPosts: ScheduledPost[] = [];
  const allErrors: ScheduleError[] = [];

  // Process all posts
  for (let postIndex = 0; postIndex < posts.length; postIndex++) {
    const post = posts[postIndex];
    const { platform, profileIds, text } = post;

    // Verify user owns the profiles and get Late.dev profile_ids for this platform
    const profiles = await findConnectionsByIdsWithProfiles(profileIds, user.id, platform.toLowerCase());

    if (!profiles || profiles.length === 0) {
      console.error(`[scheduleService] No profiles found for platform ${platform} and profileIds:`, profileIds);
      allErrors.push({
        postIndex,
        platform,
        error: `No profiles found for the specified profile IDs`
      });
      continue;
    }

    if (profiles.length !== profileIds.length) {
      console.warn(`[scheduleService] Mismatch: requested ${profileIds.length} profiles but found ${profiles.length} for platform ${platform}`);
      const foundIds = profiles.map((p: any) => p.id);
      const missingIds = profileIds.filter((id: string) => !foundIds.includes(id));
      console.warn(`[scheduleService] Missing profile IDs:`, missingIds);
      allErrors.push({
        postIndex,
        platform,
        error: `Some profiles not found or not connected to Late.dev. Missing: ${missingIds.join(', ')}`
      });
      continue;
    }

    // Verify all profiles have getlate_profiles with late_profile_id
    // IMPORTANT: Native YouTube doesn't use Late.dev, so skip validation for them
    const invalidProfiles = profiles.filter((p: any) => {
      // Log để debug
      console.log(`[scheduleService] Validating profile ${p.id}:`, {
        connection_provider: p.connection_provider,
        platform: p.platform,
        has_getlate_profiles: !!(p as any).getlate_profiles,
        late_profile_id: (p as any).getlate_profiles?.late_profile_id
      });

      // Skip validation cho Native YouTube (multiple checks for robustness)
      const isNativeYouTube = (
        p.connection_provider === 'native' ||
        p.connection_provider === 'Native' ||
        (p.platform?.toLowerCase() === 'youtube' && !p.getlate_profiles)
      );

      if (isNativeYouTube) {
        console.log(`[scheduleService] Profile ${p.id} is Native YouTube - skipping getlate validation`);
        return false; // Không phải invalid
      }

      // Validate Late.dev profiles
      const getlateProfile = (p as any).getlate_profiles;
      const isInvalid = !getlateProfile || !getlateProfile.late_profile_id;

      if (isInvalid) {
        console.warn(`[scheduleService] Profile ${p.id} is invalid - missing Late.dev connection`);
      }

      return isInvalid;
    });

    if (invalidProfiles.length > 0) {
      console.warn(`[scheduleService] Some profiles don't have valid getlate_profiles:`, invalidProfiles.map((p: any) => p.id));
      allErrors.push({
        postIndex,
        platform,
        error: `Some profiles are not properly connected to Late.dev. Please reconnect your accounts.`
      });
      continue;
    }

    // Schedule posts for each profile in this platform
    for (const profile of profiles) {
      if (profile.connection_provider === 'native' && profile.platform === 'youtube') {
        console.log(`[scheduleService] Detected Native YouTube scheduling for profile ${profile.id}`);

        try {
          // Chuẩn bị mediaUrl từ post data
          const mediaUrls = post.mediaUrls || [];

          // Gọi hàm Native Upload (đã hỗ trợ scheduledAt)
          // Handle Shorts if contentType is explicitly 'shorts'
          const isShorts = post.contentType === 'shorts';
          const result = await handleNativeYoutubeUpload(
            user.id,
            profile,
            text || "",
            mediaUrls,
            scheduledAt,
            isShorts
          );

          if (result.success && result.scheduledPost) {
            // 2. [QUAN TRỌNG] TRỪ CREDITS NGAY LẬP TỨC
            // Mặc dù video chưa public, nhưng việc upload đã hoàn tất và chiếm quota
            console.log(`[scheduleService] Deducting credits for Native YouTube schedule...`);

            await deductCredits(user.id, 'WITH_VIDEO', {
              platform: 'youtube',
              isNative: true,
              videoId: result.scheduledPost.id,
              type: 'schedule_native',
              scheduledAt: scheduledAt
            });

            allScheduledPosts.push(result.scheduledPost);
          } else {
            throw new Error(result.errorMessage || "Native upload failed");
          }
        } catch (error: any) {
          console.error(`[scheduleService] Native YouTube error:`, error);
          allErrors.push({
            postIndex,
            platform,
            profileId: profile.id,
            error: error.message || "Native schedule failed"
          });
        }

        // Xử lý xong Native, chuyển sang profile tiếp theo
        continue;
      }
      // ---------------------------------------

      // --- LOGIC CŨ: XỬ LÝ LATE.DEV ---

      // Verify Late.dev profile exists
      const getlateProfile = (profile as any).getlate_profiles;
      if (!getlateProfile || !getlateProfile.late_profile_id) {
        // ... log error warning
        allErrors.push({ postIndex, platform, profileId: profile.id, error: "Not connected to Late.dev" });
        continue;
      }

      // Validate posting request (Late limits)
      const validation = await validatePostingRequest(profile.id, user.id);

      if (!validation.canProceed) {
        allErrors.push({
          postIndex,
          platform,
          profileId: profile.id,
          error: validation.errorMessage || "Cannot post. Account limits reached."
        });
        continue;
      }

      // Use validated account
      const accountForPost = validation.account!;
      const { getLateClientForAccount } = await import("./accountService");
      const lateClient = getLateClientForAccount(accountForPost);

      // Schedule single post via Late
      const result = await scheduleSinglePost(
        user,
        post,
        postIndex,
        scheduledAt,
        timezone,
        profile,
        lateClient,
        accountForPost
      );

      if (result.success && result.scheduledPost) {
        allScheduledPosts.push(result.scheduledPost);
      } else {
        allErrors.push({
          postIndex,
          platform,
          profileId: profile.id,
          error: result.error?.message || "Failed to schedule post"
        });
      }
      // Validate posting request - check limits before posting
      // const validation = await validatePostingRequest(profile.id, user.id);

      // if (!validation.canProceed) {
      //   allErrors.push({
      //     postIndex,
      //     platform,
      //     profileId: profile.id,
      //     error: validation.errorMessage || "Cannot post. Account limits reached."
      //   });
      //   continue;
      // }

      // Use validated account (might be different from initial account)
      // const accountForPost = validation.account!;
      // const { getLateClientForAccount } = await import("./accountService");
      // const lateClient = getLateClientForAccount(accountForPost);

      // Schedule single post
      // const result = await scheduleSinglePost(
      //   user,
      //   post,
      //   postIndex,
      //   scheduledAt,
      //   timezone,
      //   profile,
      //   lateClient,
      //   accountForPost
      // );

      // if (result.success && result.scheduledPost) {
      //   allScheduledPosts.push(result.scheduledPost);
      // } else {
      //   allErrors.push({
      //     postIndex,
      //     platform,
      //     profileId: profile.id,
      //     error: result.error?.message || "Failed to schedule post"
      //   });
      // }
    }
  }

  // Track scheduled posts activity
  for (const scheduledPost of allScheduledPosts) {
    try {
      await trackActivity(user.id, 'POST_SCHEDULED', {
        resourceId: scheduledPost.id,
        resourceType: 'scheduled_post',
        platform: scheduledPost.platform,
        metadata: {
          scheduledAt: scheduledPost.scheduled_at,
          lateJobId: scheduledPost.late_job_id,
          draftId: scheduledPost.draft_id
        }
      });
    } catch (activityError) {
      console.error('[scheduleService] Error tracking scheduled post activity:', activityError);
    }
  }

  return {
    success: allScheduledPosts.length > 0,
    scheduledPosts: allScheduledPosts,
    errors: allErrors
  };
}

/**
 * Interface for draft object (minimal required fields)
 */
interface Draft {
  id: string;
  text_content?: string | null;
  media_urls?: string[] | null;
  platform?: string | null;
}

/**
 * Interface for schedule draft post result item
 */
interface ScheduleDraftPostResultItem {
  profileId: string;
  created?: Record<string, any> | null;
  scheduleRow?: ScheduledPost | null;
  error?: string;
}

/**
 * Interface for schedule draft post result
 */
export interface ScheduleDraftPostResult {
  success: boolean;
  results: ScheduleDraftPostResultItem[];
}

/**
 * Schedule a draft post for multiple profiles
 * 
 * Schedules an existing draft post to multiple profiles. Supports two ID types:
 * - `late_profile`: Profile IDs are already late.dev profile IDs
 * - `connected_account`: Profile IDs are connected_accounts.id, need to be resolved to late_profile_id
 * 
 * For each profile:
 * 1. Maps profile IDs to late.dev profile IDs if needed
 * 2. Uploads media from draft to getlate.dev if provided
 * 3. Schedules post via late.dev API
 * 4. Saves scheduled post to database
 * 5. Increments account usage and tracks activity
 * 
 * Used by `app/api/schedule/[draftId]/route.ts` POST method.
 * 
 * @param {User} user - User object with at least id field
 * @param {Draft} draft - Draft object with id, text_content, media_urls, platform
 * @param {string[]} profileIds - Array of profile IDs (type depends on idType)
 * @param {string} scheduledTime - ISO timestamp for scheduled post
 * @param {"late_profile" | "connected_account"} idType - Type of IDs in profileIds array
 * @returns {Promise<ScheduleDraftPostResult>} Result object with schedule results for each profile
 * @throws {Error} If no valid profile IDs found or no available late.dev account
 * 
 * @example
 * ```typescript
 * const result = await scheduleDraftPost(
 *   user,
 *   draft,
 *   ['profile_1', 'profile_2'],
 *   '2024-01-15T09:00:00Z',
 *   'late_profile'
 * );
 * ```
 */
export async function scheduleDraftPost(
  user: User,
  draft: Draft,
  profileIds: string[],
  scheduledTime: string,
  idType: "late_profile" | "connected_account",
  timeZone: string
): Promise<ScheduleDraftPostResult> {
  const { createPostViaLate } = await import("@/lib/services/late/postService");
  const { getLateClientForAccount } = await import("./accountService");

  const sanitizedMediaUrls = Array.isArray(draft.media_urls)
    ? draft.media_urls.filter(Boolean)
    : [];
  const draftText = draft.text_content ?? "";
  const draftPlatform = draft.platform?.toLowerCase();

  const results: ScheduleDraftPostResultItem[] = [];

  // Preload connections when ids refer to connected_accounts
  let connectedAccountMap: Record<string, Connection & { getlate_profiles?: GetlateProfile }> = {};
  if (idType === "connected_account") {
    const connections = await findConnectionsByIdsWithProfiles(profileIds, user.id, draftPlatform);
    connections.forEach((conn: any) => {
      connectedAccountMap[conn.id] = conn;
    });
  }

  for (const requestedId of profileIds) {
    try {
      // Resolve connection regardless of ID type
      let connection: (Connection & { getlate_profiles?: GetlateProfile }) | null = null;
      if (idType === "connected_account") {
        connection = connectedAccountMap[requestedId] || null;
      } else {
        connection = await findConnectionByLateProfileId(requestedId, user.id);
      }

      if (!connection) {
        results.push({
          profileId: requestedId,
          error: "Connected account not found or does not belong to the current user"
        });
        continue;
      }

      const getlateProfile = (connection as any).getlate_profiles as GetlateProfile | undefined;
      if (!getlateProfile || !getlateProfile.late_profile_id) {
        results.push({
          profileId: requestedId,
          error: "Connected account is missing Late.dev profile information. Please reconnect."
        });
        continue;
      }

      // Validate posting limits and select Late.dev account
      const validation = await validatePostingRequest(connection.id, user.id);
      if (!validation.canProceed || !validation.account) {
        results.push({
          profileId: getlateProfile.late_profile_id,
          error: validation.errorMessage || "Unable to schedule draft due to account limits."
        });
        continue;
      }

      const lateClient = getLateClientForAccount(validation.account);

      const creationResult = await createPostViaLate(
        {
          connectedAccount: connection,
          text: draftText,
          mediaUrls: sanitizedMediaUrls,
          scheduledAt: scheduledTime,
          timezone: timeZone,
          userId: user.id,
          connectedAccountId: connection.id,
          contentType: (draft as any)?.content_type || 'regular',
          draftId: draft.id,
          additionalPayloadFields: {
            draft_source: draft.id
          }
        },
        lateClient,
        validation.account
      );

      const profileIdentifier = getlateProfile.late_profile_id || connection.profile_id || requestedId;

      if (creationResult.success && creationResult.scheduledPost) {
        results.push({
          profileId: profileIdentifier,
          created: creationResult.scheduledPost.payload?.late_dev_response || null,
          scheduleRow: creationResult.scheduledPost
        });
      } else {
        results.push({
          profileId: profileIdentifier,
          error: creationResult.errorMessage || "Failed to schedule draft post"
        });
      }
    } catch (lateErr: any) {
      console.error("[scheduleService] scheduleDraftPost error for profile", requestedId, lateErr);
      results.push({
        profileId: requestedId,
        error: String(lateErr?.message || lateErr)
      });
    }
  }

  return {
    success: results.some(r => r.scheduleRow),
    results
  };
}

