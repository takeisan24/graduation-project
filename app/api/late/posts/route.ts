import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { withPaywallCheck } from "@/lib/paywall";
import { ensureValidToken } from "@/lib/late/tokenRefresh";
import {
  getLateClientForAccount,
  validatePostingRequest,
  ensureConnectionHasLateProfile
} from "@/lib/services/late";
import { createPostViaLate, mapPlatformToGetlate } from "@/lib/services/late/postService";
import { getLatePosts } from "@/lib/services/db/posts";
import { findConnectionsByIds, findConnectionByIdWithProfile, findConnectionById } from "@/lib/services/db/connections";
import { handleNativeYoutubeUpload } from "@/lib/services/youtube/uploadService";
import { deductCredits } from "@/lib/usage";

/**
 * POST /api/late/posts
 * Create a post via Late.dev
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    // Check paywall for post scheduling
    const paywallCheck = await withPaywallCheck(req, 'posts');
    if ('error' in paywallCheck) {
      return fail(paywallCheck.error.message, paywallCheck.error.status);
    }

    const { paywallResult } = paywallCheck;

    if (!paywallResult.allowed) {
      return fail(JSON.stringify({
        message: paywallResult.reason,
        upgradeRequired: paywallResult.upgradeRequired,
        currentLimit: paywallResult.currentLimit,
        limitReached: paywallResult.limitReached
      }), 403);
    }

    const body = await req.json();
    const {
      connectedAccountId,
      text,
      mediaUrls: rawMediaUrls = [],
      scheduledAt,
      timezone,
      contentType // 'regular' | 'story' | 'reel' (for Instagram/Facebook). Defaults to 'regular' if not provided
    } = body;

    if (!connectedAccountId) {
      return fail("connectedAccountId is required", 400);
    }


    // Get the connected account first to check platform for validation via service layer
    const connectedAccountForValidation = await findConnectionById(connectedAccountId);

    if (!connectedAccountForValidation || connectedAccountForValidation.user_id !== user.id) {
      return fail("Connected account not found", 404);
    }

    // Validate text and media
    // Note: TikTok requires media (video/image) - text alone is not sufficient
    // Other platforms may allow text-only posts
    const hasText = text && String(text).trim().length > 0;
    const mediaCandidates = Array.isArray(rawMediaUrls) ? rawMediaUrls.filter(Boolean) : [];
    const hasMedia = mediaCandidates.length > 0;

    const basicConnection = await findConnectionById(connectedAccountId);

    if (!basicConnection || basicConnection.user_id !== user.id) {
      return fail("Connected account not found", 404);
    }
    // 2. CHECK NATIVE MODE
    // Nếu là Native YouTube -> Đi luồng riêng
    if (basicConnection.connection_provider === 'native' && basicConnection.platform === 'youtube') {

      console.log(`[POST] Detected Native YouTube upload for connection ${connectedAccountId}`);

      // Gọi hàm xử lý (Code đã hỗ trợ scheduledAt)
      const result = await handleNativeYoutubeUpload(
        user.id,
        basicConnection,
        text || "",
        rawMediaUrls || [],
        scheduledAt, // Truyền scheduledAt vào
        contentType === 'shorts' // isShorts
      );

      if (!result.success) {
        return fail(result.errorMessage || "Upload failed", 500);
      }

      // Trừ Credits (Logic giữ nguyên)
      // Lưu ý: Schedule cũng trừ tiền ngay vì video đã được upload
      await deductCredits(user.id, 'WITH_VIDEO', {
        platform: 'youtube',
        isNative: true,
        videoId: result.scheduledPost?.id || null
      });

      // Trả về success
      return success({
        status: result.status, // 'scheduled' hoặc 'posted'
        message: result.message,
        postUrl: result.scheduledPost?.post_url
      });
    }
    // Platform-specific validation
    const platform = connectedAccountForValidation?.platform?.toLowerCase();
    const getlatePlatform = mapPlatformToGetlate(platform || '');
    const isTikTok = getlatePlatform === 'tiktok';
    const isInstagram = getlatePlatform === 'instagram';

    if (!hasText && !hasMedia) {
      return fail("Either text content or media is required for posting. Please add text or attach a video/image.", 400);
    }

    // TikTok specifically requires media (video/image)
    if (isTikTok && !hasMedia) {
      return fail("TikTok requires a video or image to be attached. Please attach a video or image before posting.", 400);
    }

    if (isInstagram && !hasMedia) {
      return fail("Instagram yêu cầu ít nhất 1 ảnh hoặc video cho mỗi bài đăng. Vui lòng đính kèm media trước khi đăng.", 400);
    }

    // Get the connected account with Late.dev profile and related getlate_profile via service layer
    // Include profile_metadata to get accountId (ID của social media account connection trên getlate.dev)
    // Also include social_media_account_id which is the accountId needed for platforms array
    let connectedAccount = await findConnectionByIdWithProfile(connectedAccountId, user.id);

    if (!connectedAccount) {
      // Legacy connections might still rely on late_profile_id (text) instead of the new UUID FK.
      // Auto-hydrate to avoid forcing the user to reconnect.
      const hydrationResult = await ensureConnectionHasLateProfile(connectedAccountId, user.id);
      if (!hydrationResult.success || !hydrationResult.connection) {
        const fallbackMessage = hydrationResult.message || "Connected account not found or not linked to Late.dev";
        return fail(fallbackMessage, 404);
      }
      connectedAccount = hydrationResult.connection;
    }

    // Extract getlate_profile and getlate_account_id
    const getlateProfile = (connectedAccount as any).getlate_profiles;
    if (!getlateProfile) {
      return fail("Getlate profile not found for this connection", 404);
    }
    const getlateProfileId = getlateProfile.id;
    const getlateAccountId = getlateProfile.getlate_account_id;

    // Ensure token is valid (auto-refresh if expired)
    // Note: For getlate.dev connections, this will skip token refresh and return connection as-is
    try {
      const refreshedAccount = await ensureValidToken(connectedAccountId);
      if (refreshedAccount) {
        // Token refresh returns a plain connection record (without profile join),
        // so re-hydrate to preserve getlate_profiles relation for downstream logic.
        const hydratedAfterRefresh = await findConnectionByIdWithProfile(connectedAccountId, user.id);
        connectedAccount = hydratedAfterRefresh || refreshedAccount;
      }
    } catch (tokenError: any) {
      console.error("[late/posts] Token refresh failed:", tokenError);
      return fail(
        "Token expired and refresh failed. Please reconnect your account.",
        401
      );
    }

    // Ensure connectedAccount is still valid after token refresh
    if (!connectedAccount) {
      return fail("Connected account not found after token refresh", 404);
    }

    // Validate posting request - check limits before posting
    // validatePostingRequest is already imported
    const validation = await validatePostingRequest(connectedAccountId, user.id);

    if (!validation.canProceed) {
      return fail(validation.errorMessage || "Cannot post. Please check your account limits.", 503);
    }

    const getlateAccount = validation.account!;

    // Create post via Late.dev using service layer
    const lateClient = getLateClientForAccount(getlateAccount);
    try {
      const hasKey = !!(getlateAccount.api_key && String(getlateAccount.api_key).trim().length > 0);
      console.log(`[late/posts] Using getlate_account ${getlateAccount.id}. api_key_present=${hasKey}`);
    } catch { }

    try {
      // Use service layer to create post
      // Note: Instagram/Facebook default to Regular posts
      // Reels are auto-detected by BE when only 1 video is provided
      const result = await createPostViaLate(
        {
          connectedAccount,
          text: text || '',
          mediaUrls: mediaCandidates,
          scheduledAt: scheduledAt || undefined,
          timezone: timezone || null,
          userId: user.id,
          connectedAccountId,
          contentType: contentType || 'regular' // Default to 'regular' if not provided
        },
        lateClient,
        getlateAccount
      );

      if (!result.success) {
        // Handle failure case
        if (result.status === 'failed' && result.errorMessage) {
          return fail(JSON.stringify({
            error: "Post creation failed",
            message: result.errorMessage,
            details: result.errorDetails,
            scheduledPost: result.scheduledPost || null
          }), 500);
        }
        return fail(result.errorMessage || "Failed to create post", 500);
      }

      // Success case
      return success({
        scheduledPost: result.scheduledPost || null,
        lateJobId: result.lateJobId || null,
        status: result.status,
        message: scheduledAt ? "Post scheduled successfully" : "Post published successfully"
      });

    } catch (lateError: any) {
      console.error("Late.dev post creation error:", lateError);
      return fail(`Failed to create post: ${lateError.message}`, 500);
    }

  } catch (err: any) {
    console.error("POST /api/late/posts error:", err);
    return fail(err.message || "Server error", 500);
  }
}

/**
 * GET /api/late/posts
 * Get posts created via Late.dev
 * 
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    // Get posts with late_job_id via service layer
    const posts = await getLatePosts(user.id);

    // Extract connected_account_ids from payload and load accounts in batch
    const connectedAccountIds = new Set<string>();
    posts.forEach((post: any) => {
      const connectedAccountId = post.payload?.connected_account_id;
      if (connectedAccountId) connectedAccountIds.add(connectedAccountId);
    });

    // Load connected_accounts in batch via service layer
    let accountsMap: Record<string, any> = {};
    if (connectedAccountIds.size > 0) {
      const accounts = await findConnectionsByIds(Array.from(connectedAccountIds), user.id);
      accounts.forEach((acc: any) => {
        accountsMap[acc.id] = acc;
      });
    }

    // Enrich posts with connected account info
    const enrichedPosts = posts.map((post: any) => {
      const connectedAccountId = post.payload?.connected_account_id;
      const connectedAccount = connectedAccountId ? accountsMap[connectedAccountId] : null;

      return {
        ...post,
        connected_account: connectedAccount ? {
          platform: connectedAccount.platform,
          profile_name: connectedAccount.profile_name,
          profile_metadata: connectedAccount.profile_metadata
        } : null
      };
    });

    return success({
      posts: enrichedPosts,
      count: enrichedPosts.length
    });

  } catch (err: any) {
    console.error("GET /api/late/posts error:", err);
    return fail(err.message || "Server error", 500);
  }
}
