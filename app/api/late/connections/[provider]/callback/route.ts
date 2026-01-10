import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { fail, success } from "@/lib/response";
import { getAppUrl } from "@/lib/utils/urlConfig";
import { checkProfilePaywall } from "@/lib/paywall";
import {
  selectLateAccount,
  getLateClientForAccount,
  incrementAccountUsage,
  findAnyProfileWithoutPlatform,
  getPlatformUsageSummary
} from "@/lib/services/late";
import {
  parseCallbackParams,
  decodeOAuthState,
  buildOAuthErrorMessage,
  getCallbackPageUrl,
  resolveUserId,
  cleanupPendingUserId,
  validateProvider,
  findExistingConnection
} from "@/lib/services/late/connectionService";
import { encryptToken } from "@/lib/crypto";
import { findProfileByLateId, removePendingFields, createProfile, upsertProfile, updateProfileMetadata, updateProfile } from "@/lib/services/db/profiles";
import { getAccountById } from "@/lib/services/db/accounts";

async function fetchFacebookPageAvatar(pageId: string, accessToken?: string | null): Promise<string | null> {
  if (!accessToken) {
    console.warn("[late/connections/callback] Skipping Facebook page avatar fetch (missing access token)");
    return null;
  }

  try {
    const url = new URL(`https://graph.facebook.com/v18.0/${pageId}`);
    url.searchParams.set("fields", "picture.type(large){url,is_silhouette}");
    url.searchParams.set("access_token", accessToken);
    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[late/connections/callback] Failed to fetch Facebook page avatar: ${response.status} ${errorText}`);
      return null;
    }
    const json = await response.json();
    const avatarUrl = json?.picture?.data?.url || null;
    if (!avatarUrl) {
      console.warn("[late/connections/callback] Facebook page avatar response missing url field");
    }
    return avatarUrl;
  } catch (error: any) {
    console.warn("[late/connections/callback] Error fetching Facebook page avatar:", error?.message || error);
    return null;
  }
}

async function fetchFacebookPageAvatarFromProfile(pageId: string): Promise<string | null> {
  try {
    const url = `https://www.facebook.com/profile.php?id=${pageId}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(`[late/connections/callback] Failed to fetch Facebook profile page for avatar (status ${response.status}). Partial response: ${text.substring(0, 200)}...`);
      return null;
    }

    const html = await response.text();
    const metaMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    if (metaMatch && metaMatch[1]) {
      return metaMatch[1];
    }

    console.warn("[late/connections/callback] Unable to locate og:image tag on Facebook profile page");
    return null;
  } catch (error: any) {
    console.warn("[late/connections/callback] Error scraping Facebook profile avatar:", error?.message || error);
    return null;
  }
}

function extractFacebookPageId(accountInfo: any): string | null {
  if (!accountInfo) return null;
  const platformUserId = accountInfo.platformUserId || accountInfo.pageId || accountInfo.page_id || null;
  if (!platformUserId) return null;
  const value = String(platformUserId);
  const parts = value.split(":");
  return parts.length > 0 ? parts[parts.length - 1] : value;
}

function sanitizeAccountInfoForLog(accountInfo: any) {
  if (!accountInfo) return accountInfo;
  const {
    accessToken,
    token,
    tokenExpiresAt,
    ...rest
  } = accountInfo;
  return {
    ...rest,
    accessToken: accessToken ? "[redacted]" : undefined,
    token: token ? "[redacted]" : undefined,
    tokenExpiresAt: tokenExpiresAt || undefined
  };
}

async function resolvePlatformAvatar(provider: string, accountInfo: any): Promise<string | null> {
  if (!accountInfo) return null;
  const baseAvatar =
    accountInfo.avatar_url ||
    accountInfo.profilePicture ||
    accountInfo.profile_picture ||
    accountInfo.picture ||
    null;

  if (provider === "facebook") {
    const pageIdFromAccountId = accountInfo.accountId;
    const pageIdFromPlatform = extractFacebookPageId(accountInfo);
    const candidateIds = [pageIdFromAccountId, pageIdFromPlatform].filter(Boolean) as string[];

    for (const pageId of candidateIds) {
      const fbAvatarGraph = await fetchFacebookPageAvatar(pageId, accountInfo.accessToken || accountInfo.token || null);
      if (fbAvatarGraph) {
        return fbAvatarGraph;
      }

      const fbAvatarProfile = await fetchFacebookPageAvatarFromProfile(pageId);
      if (fbAvatarProfile) {
        return fbAvatarProfile;
      }
    }
  }

  return baseAvatar;
}

/**
 * GET /api/late/connections/[provider]/callback
 * Handle OAuth callback from late.dev after user authorizes social media connection
 * 
 * Flow:
 * 1. late.dev redirects here with authorization code and state
 * 2. Exchange code for access token via late.dev
 * 3. Create/update profile in late.dev using the access token
 * 4. Save connection details to database (encrypted tokens)
 * 5. Redirect user back to returnTo URL or return success
 * 
 * @param req - NextRequest with provider in params and code/state in query
 * @returns Redirect to returnTo URL or JSON success response
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const { provider } = params;

    // Validate provider
    if (!validateProvider(provider)) {
      return fail(`Unsupported provider: ${provider}`, 400);
    }

    const url = new URL(req.url);

    // Parse callback parameters using service layer
    const params_parsed = parseCallbackParams(url, provider);
    const {
      code,
      state,
      error,
      errorDescription,
      connected,
      profileId: socialMediaAccountIdFromCallback,
      username,
      accountId: accountIdFromCallback
    } = params_parsed;

    // Log all parameters for debugging
    console.log("[late/connections/callback] Callback parameters:", {
      code: code ? "present" : "missing",
      state: state ? `present (length: ${state.length})` : "missing",
      connected,
      socialMediaAccountIdFromCallback: socialMediaAccountIdFromCallback || "not present",
      username,
      accountIdFromCallback: accountIdFromCallback || "not present",
      error,
      errorDescription
    });

    // Handle OAuth errors from late.dev
    if (error) {
      // Decode state to get context
      const statePayload = state ? decodeOAuthState(state) : null;
      const profileId = statePayload?.profileId || null;
      const getlateAccountId = statePayload?.getlateAccountId || null;

      // Log error details
      console.error("[late/connections/callback] OAuth error from late.dev:", {
        error,
        errorDescription,
        provider,
        profileId,
        getlateAccountId,
        hasState: !!state
      });

      // Build error message using service layer
      const errorMessage = buildOAuthErrorMessage(error, provider, errorDescription);

      // Check if this is a popup flow
      let isPopup = statePayload?.popup === true || url.searchParams.get("popup") === "1";
      if (!isPopup && !state && error) {
        // Fallback: assume popup flow if no state
        isPopup = true;
      }

      // If popup mode, redirect to callback page with error
      if (isPopup) {
        const callbackUrl = getCallbackPageUrl(provider, false, errorMessage);
        return NextResponse.redirect(callbackUrl, { status: 302 });
      }

      return fail(errorMessage, 400);
    }

    // Handle direct connection flow (connected, profileId, username - no code/state)
    // late.dev đã xử lý OAuth và trả về kết quả trực tiếp
    // late.dev có thể truyền lại state trong callback URL, hãy thử decode nếu có
    const stateFromUrl = state ? decodeOAuthState(state) : null;

    // Check if this is direct connection flow
    // late.dev có thể trả về connected/profileId trong URL params hoặc append vào state value
    // NOTE: Trong direct connection flow, getlate.dev có thể không trả về state parameter
    // Chúng ta cần detect direct connection flow bằng cách check connected parameter
    const stateRaw = url.searchParams.get("state"); // Get raw state for checking appended params
    const hasConnected = connected === provider || (stateRaw && stateRaw.includes(`connected=${provider}`));
    const hasSocialMediaAccountId = !!socialMediaAccountIdFromCallback;

    // Direct connection flow: có connected parameter và profileId (social media account ID)
    // Hoặc có connected parameter và username (Instagram thường trả về cả hai)
    if (hasConnected && (hasSocialMediaAccountId || username)) {
      console.log("[late/connections/callback] Direct connection flow detected");

      // Get userId from state (preferred) or from session
      let userId: string | null = null;
      let returnTo: string = `${getAppUrl()}/vi/settings`;
      let popup: boolean = false;
      // Profile ID của getlate.dev đã có trong state JWT (không phải profileId từ callback URL)
      let getlateProfileId: string | null = null;

      if (stateFromUrl) {
        userId = stateFromUrl.userId || null;
        returnTo = stateFromUrl.returnTo || returnTo;
        popup = stateFromUrl.popup === true || false;
        getlateProfileId = stateFromUrl.profileId || null; // Profile ID của getlate.dev từ state JWT
        console.log("[late/connections/callback] Got info from state:", { userId, returnTo, popup, getlateProfileId });
      }

      // IMPORTANT: Trong direct connection flow, getlate.dev có thể không trả về state
      // Ưu tiên lấy userId từ session (vì đây là server-side callback, session cookie sẽ được gửi)
      if (!userId) {
        try {
          const user = await requireAuth(req);
          if (user) {
            userId = user.id;
            console.log("[late/connections/callback] ✅ Got userId from session:", userId);
          }
        } catch (authError: any) {
          console.warn("[late/connections/callback] Failed to get user from session:", authError.message);
          // Log thêm để debug popup flow session issues
          console.warn("[late/connections/callback] Session debug:", {
            hasCookies: !!req.headers.get("cookie"),
            userAgent: req.headers.get("user-agent"),
            referer: req.headers.get("referer")
          });
        }
      }

      // If still no userId, try to get from URL params (fallback)
      if (!userId) {
        userId = url.searchParams.get("userId") || null;
        returnTo = url.searchParams.get("returnTo") || returnTo;
        popup = url.searchParams.get("popup") === "1";
        console.log("[late/connections/callback] Got info from URL params:", { userId, returnTo, popup });
      }

      // Last resort: Try to find userId from getlate_profiles table using profileId
      // (profileId từ callback là late.dev profile ID, có thể tìm trong DB)
      // IMPORTANT: Cũng lấy getlateProfileId từ đây nếu không có trong state
      if (socialMediaAccountIdFromCallback) {
        try {
          // Find profile via service layer
          const profile = await findProfileByLateId(socialMediaAccountIdFromCallback);

          if (profile) {
            // Set getlateProfileId từ profile nếu chưa có (khi không có state)
            if (!getlateProfileId) {
              getlateProfileId = profile.late_profile_id;
              console.log("[late/connections/callback] ✅ Got getlateProfileId from database lookup:", getlateProfileId);
            }

            // Ưu tiên 1: Lấy từ pending_user_id trong metadata (được lưu khi start OAuth)
            if (!userId) {
              const pendingUserId = profile.metadata?.pending_user_id;
              if (pendingUserId) {
                // Kiểm tra timestamp để đảm bảo không quá cũ (10 phút)
                const pendingTimestamp = profile.metadata?.pending_timestamp || 0;
                const ageInMinutes = (Date.now() - pendingTimestamp) / (1000 * 60);

                if (ageInMinutes < 10) {
                  userId = pendingUserId;
                  console.log("[late/connections/callback] ✅ Got userId from profile metadata.pending_user_id:", userId);

                  // Clean up pending_user_id sau khi sử dụng via service layer
                  try {
                    await removePendingFields(profile.id);
                    console.log("[late/connections/callback] ✅ Cleaned up pending_user_id from profile metadata");
                  } catch (cleanupError: any) {
                    console.warn("[late/connections/callback] Failed to cleanup pending_user_id:", cleanupError.message);
                  }
                } else {
                  console.warn(`[late/connections/callback] pending_user_id expired (age: ${ageInMinutes.toFixed(2)} minutes)`);
                }
              }
            }

            // Ưu tiên 2: Tìm connected_accounts với profile này để lấy userId via service layer
            if (!userId) {
              const { getConnectionsByProfileId } = await import("@/lib/services/db/connections");
              const connections = await getConnectionsByProfileId(profile.id);

              if (connections && connections.length > 0 && connections[0].user_id) {
                userId = connections[0].user_id;
                console.log("[late/connections/callback] ✅ Got userId from existing connected_accounts:", userId);
              }
            }
          }
        } catch (dbError: any) {
          console.warn("[late/connections/callback] Failed to lookup userId/getlateProfileId from database:", dbError.message);
        }
      }

      // Fallback: Nếu vẫn không có getlateProfileId, sử dụng socialMediaAccountIdFromCallback
      // (trong direct connection flow, profileId từ callback chính là late.dev profile ID)
      if (!getlateProfileId && socialMediaAccountIdFromCallback) {
        getlateProfileId = socialMediaAccountIdFromCallback;
        console.log("[late/connections/callback] ✅ Using socialMediaAccountIdFromCallback as getlateProfileId:", getlateProfileId);
      }

      // IMPORTANT: Detect popup flow ngay cả khi không có state
      // Trong popup flow, getlate.dev có thể không trả về state, nhưng chúng ta vẫn cần redirect đến callback-page
      // Fallback: Assume popup flow nếu không có state (vì trong non-popup flow, state sẽ được preserve)
      if (!popup && !state) {
        console.log("[late/connections/callback] No state found in direct connection flow - assuming popup flow for better UX");
        popup = true; // Assume popup flow để đảm bảo popup được đóng đúng cách
      }

      // Final attempt: Try to get userId from session one more time
      // This is important because profile might have been created in start flow and saved to DB
      // but session might not have been available earlier
      if (!userId) {
        try {
          const user = await requireAuth(req);
          if (user) {
            userId = user.id;
            console.log("[late/connections/callback] ✅ Got userId from session (final attempt):", userId);
          }
        } catch (authError: any) {
          // Session still not available
          console.warn("[late/connections/callback] Session auth failed (final attempt):", authError.message);
        }
      }

      // Get user info (for validation) - this will be null if session is not available
      let user: any = null;
      if (userId) {
        try {
          user = await requireAuth(req);
          // Verify userId matches session user (if session exists)
          if (user && user.id !== userId) {
            console.warn("[late/connections/callback] userId mismatch:", { stateUserId: userId, sessionUserId: user.id });
            // Use session userId if available (more secure)
            userId = user.id;
          }
        } catch (authError: any) {
          // If session auth fails but we have userId from state/database, continue with that userId
          console.warn("[late/connections/callback] Session auth failed, but continuing with userId from state/database:", userId);
        }
      }

      // Theo getlate.dev docs: profileId trong callback URL là Profile ID của getlate.dev (KHÔNG phải ID của social media account)
      // getlate.dev không trả về ID của social media account ngay lập tức sau khi kết nối thành công
      // Vậy tạm thời để social_media_account_id là null, sau đó sẽ call /v1/accounts để lấy ID và update
      // socialMediaAccountIdFromCallback ở đây thực ra là profileId của getlate.dev, không phải account ID
      const socialMediaAccountId = null; // Sẽ được update sau khi call /v1/accounts

      // Profile ID của getlate.dev từ state JWT (đã có sẵn khi start connection)
      const profileId = getlateProfileId;

      if (!profileId) {
        console.error("[late/connections/callback] No getlate.dev profile ID found in state. Cannot proceed.");
        return fail("Missing profile ID. Please try connecting again.", 400);
      }

      console.log("[late/connections/callback] Processing direct connection:", {
        userId,
        provider,
        getlateProfileId: profileId, // Profile ID của getlate.dev từ state
        socialMediaAccountId: socialMediaAccountId, // ID của social media account từ callback URL
        username,
        connected,
        returnTo,
        popup,
        hasUserSession: !!user
      });

      // Get late.dev account
      const getlateAccount = await selectLateAccount("connect_social");
      if (!getlateAccount) {
        return fail("No available late.dev account for connecting social media. All accounts have reached their limits.", 503);
      }

      // IMPORTANT: Find profile in DB first to get the correct account that owns this profile
      // Profile may have been created with a different API key, so we need to use that account's API key
      const existingProfile = await findProfileByLateId(profileId);
      let accountUsedForProfile = getlateAccount;
      let lateClient = getLateClientForAccount(getlateAccount);

      // If profile exists in DB and belongs to a different account, use that account's API key
      if (existingProfile?.getlate_account_id && existingProfile.getlate_account_id !== getlateAccount.id) {
        try {
          const profileAccount = await getAccountById(existingProfile.getlate_account_id);

          if (profileAccount?.api_key) {
            accountUsedForProfile = {
              id: profileAccount.id,
              account_name: profileAccount.account_name || null,
              api_key: profileAccount.api_key,
              client_id: profileAccount.client_id || null,
              client_secret: profileAccount.client_secret || null,
              webhook_secret: profileAccount.webhook_secret || null,
              is_active: true,
              limits: {},
              metadata: {}
            };
            lateClient = getLateClientForAccount(accountUsedForProfile);
            console.log(`[late/connections/callback] Using profile's account ${accountUsedForProfile.id} (instead of ${getlateAccount.id}) to fetch profile info`);
          } else {
            console.warn(`[late/connections/callback] Profile ${profileId} belongs to account ${existingProfile.getlate_account_id} but API key not found. Using selected account ${getlateAccount.id}`);
          }
        } catch (accountError: any) {
          console.warn(`[late/connections/callback] Failed to get profile's account ${existingProfile.getlate_account_id}:`, accountError.message);
          console.warn(`[late/connections/callback] Using selected account ${getlateAccount.id} instead`);
        }
      }

      // Get profile info from late.dev to verify connection
      // NOTE: late.dev có thể cần thời gian để sync connection, nên retry với delay
      let lateProfile: any = null;
      let profileInfoError: any = null;
      let platformVerified = false;

      // Retry logic: late.dev có thể cần thời gian để sync connection
      // Sử dụng exponential backoff để tối ưu tốc độ: 500ms, 1000ms, 2000ms
      const maxRetries = 3;
      const getRetryDelay = (attempt: number) => {
        // Exponential backoff: 500ms, 1000ms, 2000ms
        return Math.min(500 * Math.pow(2, attempt - 1), 2000);
      };

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          lateProfile = await lateClient.getProfileInfo(profileId);
          if (!lateProfile || !lateProfile.id) {
            throw new Error("Profile not found in late.dev");
          }

          console.log(`[late/connections/callback] Profile info retrieved (attempt ${attempt}/${maxRetries}):`, {
            profileId: lateProfile.id,
            name: lateProfile.name,
            platforms: lateProfile.platforms || [],
            hasInstagram: lateProfile.platforms?.includes("instagram") || lateProfile.platforms?.includes("Instagram"),
            hasFacebook: lateProfile.platforms?.includes("facebook") || lateProfile.platforms?.includes("Facebook"),
            allPlatforms: JSON.stringify(lateProfile.platforms || []),
            // Log chi tiết để debug accountId extraction
            hasSocialMediaIds: !!lateProfile.social_media_ids,
            socialMediaIdsKeys: lateProfile.social_media_ids ? Object.keys(lateProfile.social_media_ids) : [],
            hasAccounts: Array.isArray(lateProfile.accounts),
            accountsCount: Array.isArray(lateProfile.accounts) ? lateProfile.accounts.length : 0,
            hasAccountIds: !!lateProfile.accountIds,
            accountIdsKeys: lateProfile.accountIds ? Object.keys(lateProfile.accountIds) : [],
            // Log full response structure để debug
            profileKeys: Object.keys(lateProfile || {}),
            fullProfileInfo: JSON.stringify(lateProfile, null, 2).substring(0, 1000) // Log first 1000 chars
          });

          // Verify platform is actually connected
          // late.dev có thể trả về platforms dưới dạng array hoặc object
          const platforms = lateProfile.platforms || [];
          const platformArray = Array.isArray(platforms) ? platforms : Object.keys(platforms);
          const platformLower = provider.toLowerCase();

          // Check if platform is in the list (case-insensitive)
          platformVerified = platformArray.some((p: string) =>
            p.toLowerCase() === platformLower ||
            p.toLowerCase() === platformLower + "_user_id" ||
            p.toLowerCase() === platformLower + "_page_id"
          );

          if (platformVerified) {
            console.log(`[late/connections/callback] Platform ${provider} verified in late.dev profile`);
            break; // Success, exit retry loop
          } else {
            console.warn(`[late/connections/callback] Platform ${provider} not found in profile platforms (attempt ${attempt}/${maxRetries}). Platforms:`, platformArray);
            if (attempt < maxRetries) {
              const delay = getRetryDelay(attempt);
              console.log(`[late/connections/callback] Retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        } catch (e: any) {
          profileInfoError = e;
          const errorStatus = (e as any).status || 'unknown';
          const errorResponse = (e as any).responseText || '';
          const errorMessage = e.message || String(e);

          console.warn(`[late/connections/callback] Failed to get profile info from late.dev (attempt ${attempt}/${maxRetries}):`, {
            message: errorMessage,
            status: errorStatus,
            responseText: errorResponse?.substring(0, 200),
            profileId,
            errorType: e.constructor?.name || typeof e,
            // Log thêm để debug
            hasStatus: !!(e as any).status,
            errorKeys: Object.keys(e || {})
          });

          // If it's a 404 (not found), don't retry - profile doesn't exist
          if (errorStatus === 404 || errorMessage.includes('not found') || errorMessage.includes('404')) {
            console.error(`[late/connections/callback] Profile ${profileId} not found in late.dev (404). Profile may have been deleted or API key doesn't have access.`);
            // Set lateProfile to null explicitly to prevent extraction attempts
            lateProfile = null;
            break; // Exit retry loop early
          }

          // If it's a 403 (forbidden) or 401 (unauthorized), don't retry
          if (errorStatus === 403 || errorStatus === 401 || errorMessage.includes('403') || errorMessage.includes('401')) {
            console.error(`[late/connections/callback] Access denied to profile ${profileId} (${errorStatus}). API key may not have permission.`);
            // Set lateProfile to null explicitly to prevent extraction attempts
            lateProfile = null;
            break; // Exit retry loop early
          }

          if (attempt < maxRetries) {
            const delay = getRetryDelay(attempt);
            console.log(`[late/connections/callback] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            // After all retries failed, set lateProfile to null
            lateProfile = null;
          }
        }
      }

      // Theo getlate.dev docs: profileId trong callback URL chính là ID của social media account đã kết nối thành công
      // Đây là ID cần lưu vào social_media_account_id để dùng cho disconnect và post bài
      // Ưu tiên: socialMediaAccountId từ callback URL > accountIdFromCallback > extract từ profile info
      // NOTE: Trong direct connection flow, profileId từ callback là late.dev profile ID, không phải account ID
      // Account ID sẽ được fetch từ /v1/accounts API sau khi connection được tạo
      let accountId: string | null = socialMediaAccountId || accountIdFromCallback || null;

      // Chỉ cố extract accountId từ profile nếu:
      // 1. Chưa có accountId
      // 2. lateProfile tồn tại và hợp lệ (có id)
      if (!accountId && lateProfile && lateProfile.id) {
        try {
          // Log chi tiết để debug
          console.log(`[late/connections/callback] Attempting to extract accountId for ${provider} from profile:`, {
            profileId: lateProfile.id,
            platform: provider,
            hasSocialMediaIds: !!lateProfile.social_media_ids,
            socialMediaIds: lateProfile.social_media_ids,
            hasAccounts: Array.isArray(lateProfile.accounts),
            accounts: lateProfile.accounts,
            hasAccountIds: !!lateProfile.accountIds,
            accountIds: lateProfile.accountIds,
            allKeys: Object.keys(lateProfile)
          });

          accountId = lateClient.extractAccountId(lateProfile, provider);
          if (accountId) {
            console.log(`[late/connections/callback] ✅ Extracted accountId for ${provider} from profile:`, accountId);
          } else {
            console.warn(`[late/connections/callback] ❌ Could not extract accountId for ${provider} from profile info`);
            console.warn(`[late/connections/callback] Profile structure:`, {
              social_media_ids: lateProfile.social_media_ids,
              accounts: lateProfile.accounts,
              accountIds: lateProfile.accountIds,
              // Check for any field that might contain account ID
              allFields: Object.keys(lateProfile).filter(key =>
                key.toLowerCase().includes('account') ||
                key.toLowerCase().includes('id') ||
                key.toLowerCase().includes(provider.toLowerCase())
              )
            });
            console.log(`[late/connections/callback] ℹ️ Will fetch account ID from /v1/accounts API after connection is created`);
          }
        } catch (extractError: any) {
          console.warn(`[late/connections/callback] Failed to extract accountId:`, extractError.message);
          console.warn(`[late/connections/callback] Extract error details:`, extractError);
          console.log(`[late/connections/callback] ℹ️ Will fetch account ID from /v1/accounts API after connection is created`);
        }
      } else if (!accountId && !lateProfile) {
        // Nếu không có lateProfile, log và sẽ fetch từ /v1/accounts API sau
        console.log(`[late/connections/callback] ℹ️ Profile info not available. Will fetch account ID from /v1/accounts API after connection is created.`);
      } else if (socialMediaAccountId) {
        console.log(`[late/connections/callback] ✅ Using social media account ID from callback URL (profileId param):`, socialMediaAccountId);
      } else if (accountIdFromCallback) {
        console.log(`[late/connections/callback] ✅ Using accountId from callback URL:`, accountIdFromCallback);
      }

      // Log warning if platform was not verified after all retries
      if (!platformVerified && lateProfile) {
        console.warn(`[late/connections/callback] WARNING: Platform ${provider} not found in late.dev profile after ${maxRetries} attempts. Connection may not be fully synced on late.dev dashboard.`);
        console.warn(`[late/connections/callback] Profile platforms:`, lateProfile.platforms || []);
      } else if (!lateProfile) {
        const errorStatus = profileInfoError ? (profileInfoError as any).status : 'unknown';
        if (errorStatus === 404) {
          console.error(`[late/connections/callback] ERROR: Profile ${profileId} not found in late.dev (404). This profile may have been deleted on late.dev or the API key doesn't have access.`);
          console.error(`[late/connections/callback] The connection will still be saved to local DB, but it may not work properly. Please check:`);
          console.error(`[late/connections/callback] 1. Does the profile ${profileId} exist in late.dev dashboard?`);
          console.error(`[late/connections/callback] 2. Does the API key have permission to access this profile?`);
          console.error(`[late/connections/callback] 3. Was the profile created with a different API key?`);

          // Try to verify by listing all profiles
          try {
            const allProfiles = await lateClient.listProfiles();
            const profiles = Array.isArray(allProfiles) ? allProfiles : (allProfiles.profiles || []);
            const profileIds = profiles.map((p: any) => p.id || p._id || p.profile_id || p.profileId).filter(Boolean);
            console.log(`[late/connections/callback] Available profiles in late.dev:`, profileIds);
            if (!profileIds.includes(profileId)) {
              console.error(`[late/connections/callback] Profile ${profileId} is NOT in the list of available profiles. Profile may have been deleted or belongs to a different account.`);
            }
          } catch (listError: any) {
            console.warn(`[late/connections/callback] Failed to list profiles for verification:`, listError.message);
          }
        } else if (errorStatus === 403 || errorStatus === 401) {
          console.error(`[late/connections/callback] ERROR: Access denied to profile ${profileId} (${errorStatus}). API key may not have permission.`);
        } else {
          console.warn(`[late/connections/callback] WARNING: Could not retrieve profile info from late.dev after ${maxRetries} attempts. Connection may not be fully synced on late.dev dashboard.`);
          console.warn(`[late/connections/callback] Error:`, profileInfoError?.message);
        }
      }

      // Find or create getlate_profiles record via service layer
      // Note: existingProfile was already fetched above, but we check again in case it was created during the flow
      const existingProfileCheck = existingProfile || await findProfileByLateId(profileId);

      let getlateProfileDbId: string; // Database ID của getlate_profiles record (khác với getlateProfileId từ state)
      if (existingProfileCheck) {
        getlateProfileDbId = existingProfileCheck.id;
        console.log("[late/connections/callback] Using existing getlate_profiles record:", getlateProfileDbId);

        // Update profile metadata if we got profile info via service layer
        if (lateProfile && getlateProfileDbId) {
          try {
            await updateProfile(getlateProfileDbId, {
              description: lateProfile.description || existingProfileCheck.description || null,
              metadata: {
                ...lateProfile,
                synced_at: new Date().toISOString(),
                platform_verified: platformVerified, // Track if platform was verified in late.dev
                verification_attempts: maxRetries // Track how many attempts were made
              }
            });
            console.log("[late/connections/callback] Updated profile metadata", {
              platform_verified: platformVerified,
              platforms: lateProfile.platforms || []
            });
          } catch (updateError: any) {
            console.warn("[late/connections/callback] Failed to update profile metadata (non-fatal):", updateError);
          }
        }
      } else {
        // Create new getlate_profiles record via service layer
        // Use accountUsedForProfile.id (which may be different from getlateAccount.id if profile belongs to another account)
        const { generateProfileName } = await import("@/lib/late/profileNameGenerator");
        const autoProfileName = await generateProfileName();

        const newProfile = await createProfile({
          getlate_account_id: accountUsedForProfile.id !== "env-fallback" ? accountUsedForProfile.id : getlateAccount.id,
          late_profile_id: profileId,
          profile_name: autoProfileName,
          description: lateProfile?.description || null,
          metadata: {
            connected_platform: provider,
            username: username || null,
            synced_at: new Date().toISOString(),
            profile_info_error: profileInfoError ? profileInfoError.message : null,
            platform_verified: platformVerified, // Track if platform was verified in late.dev
            verification_attempts: maxRetries, // Track how many attempts were made
            ...(lateProfile || {}) // Include profile info if available
          }
        });

        if (!newProfile) {
          console.error("[late/connections/callback] Failed to create getlate_profiles");
          return fail("Failed to create profile record", 500);
        }

        getlateProfileDbId = newProfile.id;
        console.log("[late/connections/callback] Created new getlate_profiles record:", getlateProfileDbId);
      }

      // Check if connection already exists via service layer
      if (!userId || !getlateProfileDbId) {
        return fail("Missing required data for connection", 400);
      }

      const { findConnectionByUniqueConstraint } = await import("@/lib/services/db/connections");
      const existingConnection = await findConnectionByUniqueConstraint(userId, getlateProfileDbId, provider);

      if (existingConnection) {
        console.log("[late/connections/callback] Connection already exists:", existingConnection.id);
        // Update connection with latest info
        // Get getlate_account_id from existingProfileCheck or accountUsedForProfile
        const accountIdForUpdate = existingProfileCheck?.getlate_account_id || accountUsedForProfile.id;

        // Update connection via service layer
        const { updateConnection } = await import("@/lib/services/db/connections");
        const sanitizeMetadata = (metadata: any) => {
          if (!metadata) return {};
          const sanitized = { ...metadata };
          if (sanitized.accountId === null) {
            sanitized.accountId = undefined;
          }
          return sanitized;
        };

        const updated = await updateConnection(existingConnection.id, {
          getlate_account_id: accountIdForUpdate, // Update getlate_account_id if changed
          profile_name: username || lateProfile?.name || existingConnection.profile_name || null,
          social_media_account_id: accountId || existingConnection.social_media_account_id || null, // Update social_media_account_id nếu có
          profile_metadata: sanitizeMetadata({
            ...(existingConnection.profile_metadata || {}),
            late_profile_id: profileId,
            username,
            email: lateProfile?.email || lateProfile?.metadata?.email || existingConnection.profile_metadata?.email || null,
            platform: provider,
            getlate_account_id: accountIdForUpdate,
            accountId: accountId || existingConnection.profile_metadata?.accountId || null, // ID của social media account connection trên getlate.dev (cần để disconnect) - giữ lại trong metadata để backward compatibility
            avatar_url: lateProfile?.avatar_url || existingConnection.profile_metadata?.avatar_url || null,
            verified: lateProfile?.verified ?? existingConnection.profile_metadata?.verified ?? false,
            followers_count: lateProfile?.followers_count || existingConnection.profile_metadata?.followers_count || null
          })
        });

        if (!updated) {
          console.error("[late/connections/callback] Failed to update connection");
        } else {
          console.log("[late/connections/callback] Updated existing connection:", existingConnection.id);

          // Luôn đồng bộ thông tin account (ID + avatar) từ late.dev để đảm bảo metadata chính xác
          try {
            console.log(`[late/connections/callback] Fetching account info (ID + avatar) for platform ${provider} from getlate.dev accounts API...`);
            const accountInfo = await lateClient.getAccountInfoForPlatform(profileId, provider);
            console.log(`[late/connections/callback] getlate.dev accountInfo for ${provider}:`, JSON.stringify(sanitizeAccountInfoForLog(accountInfo), null, 2));

            if (accountInfo?.accountId) {
              const resolvedAvatarUrl = await resolvePlatformAvatar(provider, accountInfo);
              // Update social_media_account_id và avatar_url với thông tin từ accounts API
              const updatedMetadata = {
                ...(existingConnection.profile_metadata || {}),
                accountId: accountInfo.accountId, // Update trong metadata để backward compatibility
                // Lưu thêm platform_user_id để nhận diện duy nhất tài khoản MXH trên platform (ví dụ: YouTube channel ID)
                platform_user_id: accountInfo.platformUserId || existingConnection.profile_metadata?.platform_user_id || null,
                // Update avatar_url nếu có từ accounts API (ưu tiên hơn profile info)
                avatar_url: resolvedAvatarUrl || existingConnection.profile_metadata?.avatar_url || null,
                username: accountInfo.username || existingConnection.profile_metadata?.username || null,
                email: accountInfo.email || existingConnection.profile_metadata?.email || null,
                verified: accountInfo.verified ?? existingConnection.profile_metadata?.verified ?? false,
                followers_count: accountInfo.followers_count || existingConnection.profile_metadata?.followers_count || null
              };

              // Update via service layer
              const { updateConnection } = await import("@/lib/services/db/connections");
              const sanitizeMetadata = (metadata: any) => {
                if (!metadata) return {};
                const sanitized = { ...metadata };
                if (sanitized.accountId === null) {
                  sanitized.accountId = undefined;
                }
                return sanitized;
              };

              const updateSuccess = await updateConnection(existingConnection.id, {
                social_media_account_id: accountInfo.accountId,
                profile_metadata: sanitizeMetadata(updatedMetadata)
              });

              if (!updateSuccess) {
                console.warn(`[late/connections/callback] Failed to update social_media_account_id and avatar`);
              } else {
                console.log(`[late/connections/callback] ✅ Updated social_media_account_id: ${accountInfo.accountId}`);
                if (resolvedAvatarUrl) {
                  console.log(`[late/connections/callback] ✅ Updated avatar_url from accounts API: ${resolvedAvatarUrl.substring(0, 50)}...`);
                }
              }
            } else {
              console.warn(`[late/connections/callback] ⚠️ Could not find account info for platform ${provider} from accounts API. Will retry later.`);
            }
          } catch (accountsError: any) {
            console.warn(`[late/connections/callback] Failed to fetch account info from accounts API (non-fatal):`, accountsError.message);
            // Non-fatal: connection đã được update thành công, có thể sync account ID sau
          }
        }
      } else {
        // Create new connection (hoặc update nếu đã tồn tại với platform khác)
        // Get getlate_account_id from existingProfileCheck or accountUsedForProfile
        const accountIdForConnection = existingProfileCheck?.getlate_account_id || accountUsedForProfile.id;

        // TEMPORARILY DISABLED: Check if this social media account (username or accountId) is already connected to another profile
        // This check was causing issues with overwriting data from other platforms or users
        // TODO: Re-enable with better logic that doesn't affect other platforms/users
        // if (username || accountId) {
        //   ... duplicate check logic ...
        // }

        // Check if connection already exists - prioritize by profile_id (for legacy constraint idx_connected_accounts_user_profile)
        // Legacy constraint only checks (user_id, profile_id) without platform, so we must check without platform filter
        let existingConnection: any = null;

        // Find existing connection via service layer (checks multiple criteria)
        if (userId) {
          existingConnection = await findExistingConnection(
            userId,
            provider,
            profileId || null,
            accountId || null,
            username || null
          );
        }

        if (existingConnection && profileId) {
          console.log(`[late/connections/callback] Found existing connection with same profile_id (${profileId}) for legacy constraint, will update:`, existingConnection.id, `(current platform: ${existingConnection.platform}, new platform: ${provider})`);
        }

        // BE Validation: Check user's profile limit before creating new connection (only if not updating existing)
        if (!existingConnection && userId) {
          const profilePaywallCheck = await checkProfilePaywall(userId);
          if (!profilePaywallCheck.allowed) {
            console.warn(`[late/connections/callback] User ${userId} has reached profile limit:`, profilePaywallCheck);
            return fail(JSON.stringify({
              message: `Bạn đã kết nối tối đa tài khoản mxh. Ngắt kết nối 1 tài khoản không sử dụng hoặc nâng cấp gói plan của bạn.`,
              upgradeRequired: profilePaywallCheck.upgradeRequired,
              currentLimit: profilePaywallCheck.currentLimit,
              limitReached: profilePaywallCheck.limitReached,
              reason: profilePaywallCheck.reason
            }), 403);
          }
        }

        // Use upsert để xử lý cả insert và update
        // onConflict: (user_id, getlate_profile_id, platform) - unique constraint mới
        const connectionData = {
          user_id: userId,
          getlate_profile_id: getlateProfileDbId,
          getlate_account_id: accountIdForConnection, // Reference đến getlate_accounts
          platform: provider,
          profile_id: profileId || null, // Use late_profile_id for backward compatibility (late_profile_id is unique, so no duplicate key issue)
          profile_name: username || lateProfile?.name || null,
          late_profile_id: profileId, // Legacy
          social_media_account_id: accountId || null, // ID của social media account connection trên getlate.dev (cần để disconnect) - được trả về từ getlate.dev khi kết nối thành công
          profile_metadata: {
            late_profile_id: profileId,
            username,
            email: lateProfile?.email || lateProfile?.metadata?.email || null, // Email từ late.dev nếu có
            platform: provider,
            getlate_account_id: accountIdForConnection, // Store in metadata for reference
            accountId: accountId || null, // Giữ lại trong metadata để backward compatibility
            avatar_url: lateProfile?.avatar_url || null,
            verified: lateProfile?.verified || false,
            followers_count: lateProfile?.followers_count || null
          }, // Legacy
          // created_at and updated_at will be set by database defaults/triggers (UTC)
        };

        let newConnection: any = null;
        let upsertError: any = null;

        // Check if connection exists with same (user_id, getlate_profile_id, platform) via service layer
        // This allows multiple accounts of the same platform (different getlate_profile_id)
        if (!userId || !getlateProfileDbId) {
          return fail("Missing required data for connection", 400);
        }

        const { findConnectionByUniqueConstraint, updateConnection, createConnection } = await import("@/lib/services/db/connections");
        const existingByUniqueConstraint = await findConnectionByUniqueConstraint(userId, getlateProfileDbId, provider);

        // Helper function to convert null to undefined for accountId in metadata
        const sanitizeMetadata = (metadata: any) => {
          if (!metadata) return {};
          const sanitized = { ...metadata };
          if (sanitized.accountId === null) {
            sanitized.accountId = undefined;
          }
          return sanitized;
        };

        if (existingByUniqueConstraint && existingByUniqueConstraint.id) {
          // Same (user_id, getlate_profile_id, platform) - update existing connection via service layer
          console.log(`[late/connections/callback] Found existing connection with same (user_id, getlate_profile_id, platform), updating:`, existingByUniqueConstraint.id);
          const updateData = {
            ...connectionData,
            profile_metadata: sanitizeMetadata(connectionData.profile_metadata)
          };
          const updated = await updateConnection(existingByUniqueConstraint.id, updateData);
          if (updated) {
            const { findConnectionById } = await import("@/lib/services/db/connections");
            newConnection = await findConnectionById(existingByUniqueConstraint.id);
          } else {
            upsertError = new Error("Failed to update connection");
          }
        } else if (existingConnection && existingConnection.id && existingConnection.platform !== provider) {
          // Found connection with same profile_id but different platform - set profile_id = null and create new via service layer
          console.log(`[late/connections/callback] Found existing connection with same profile_id but different platform (${existingConnection.platform} vs ${provider}), creating new with profile_id = null`);
          const connectionDataWithoutProfileId = {
            ...connectionData,
            profile_id: null // Set to null to avoid duplicate key error on legacy constraint
          };

          newConnection = await createConnection({
            user_id: userId,
            getlate_profile_id: getlateProfileDbId,
            getlate_account_id: accountIdForConnection !== "env-fallback" ? accountIdForConnection : "",
            platform: provider,
            profile_id: null,
            profile_name: connectionDataWithoutProfileId.profile_name || null,
            access_token: null, // Direct flow doesn't have tokens
            refresh_token: null,
            expires_at: null,
            late_profile_id: connectionDataWithoutProfileId.late_profile_id || null,
            social_media_account_id: connectionDataWithoutProfileId.social_media_account_id || null,
            profile_metadata: sanitizeMetadata(connectionDataWithoutProfileId.profile_metadata)
          });

          if (!newConnection) {
            upsertError = new Error("Failed to create connection");
          }
        } else {
          // No existing connection with same (user_id, getlate_profile_id, platform) - create new via service layer
          // This allows multiple accounts of the same platform (different getlate_profile_id)
          console.log(`[late/connections/callback] No existing connection found, creating new connection for platform ${provider}`);
          newConnection = await createConnection({
            user_id: userId,
            getlate_profile_id: getlateProfileDbId,
            getlate_account_id: accountIdForConnection !== "env-fallback" ? accountIdForConnection : "",
            platform: provider,
            profile_id: connectionData.profile_id || null,
            profile_name: connectionData.profile_name || null,
            access_token: null, // Direct flow doesn't have tokens
            refresh_token: null,
            expires_at: null,
            late_profile_id: connectionData.late_profile_id || null,
            social_media_account_id: connectionData.social_media_account_id || null,
            profile_metadata: sanitizeMetadata(connectionData.profile_metadata)
          });

          if (!newConnection) {
            upsertError = new Error("Failed to create connection");
          }
        }

        if (upsertError || !newConnection) {
          console.error("[late/connections/callback] Failed to upsert connection:", upsertError);
          return fail("Failed to create connection record", 500);
        }

        console.log("[late/connections/callback] Upserted connection:", newConnection.id);

        // Sau khi kết nối thành công, call /v1/accounts để lấy ID và avatar của social media account
        // Theo getlate.dev docs: GET /v1/accounts?profileId=xxx để lấy danh sách accounts của profile
        try {
          console.log(`[late/connections/callback] Fetching account info (ID + avatar) for platform ${provider} from getlate.dev accounts API (direct flow)...`);
          const accountInfo = await lateClient.getAccountInfoForPlatform(profileId, provider);
          console.log(`[late/connections/callback] getlate.dev accountInfo for ${provider} (direct flow):`, JSON.stringify(sanitizeAccountInfoForLog(accountInfo), null, 2));

          if (accountInfo?.accountId) {
            const resolvedAvatarUrl = await resolvePlatformAvatar(provider, accountInfo);
            // Update social_media_account_id và avatar_url với thông tin từ accounts API
            const updatedMetadata = {
              ...(newConnection.profile_metadata || {}),
              accountId: accountInfo.accountId, // Update trong metadata để backward compatibility
              // Lưu thêm platform_user_id để nhận diện duy nhất tài khoản MXH trên platform (ví dụ: YouTube channel ID)
              platform_user_id: accountInfo.platformUserId || newConnection.profile_metadata?.platform_user_id || null,
              // Update avatar_url nếu có từ accounts API (ưu tiên hơn profile info)
              avatar_url: resolvedAvatarUrl || newConnection.profile_metadata?.avatar_url || null,
              username: accountInfo.username || newConnection.profile_metadata?.username || null,
              email: accountInfo.email || newConnection.profile_metadata?.email || null,
              verified: accountInfo.verified ?? newConnection.profile_metadata?.verified ?? false,
              followers_count: accountInfo.followers_count || newConnection.profile_metadata?.followers_count || null
            };

            // Update via service layer
            const { updateConnection } = await import("@/lib/services/db/connections");
            const updateSuccess = await updateConnection(newConnection.id, {
              social_media_account_id: accountInfo.accountId,
              profile_metadata: sanitizeMetadata(updatedMetadata)
            });

            if (!updateSuccess) {
              console.warn(`[late/connections/callback] Failed to update social_media_account_id and avatar`);
            } else {
              console.log(`[late/connections/callback] ✅ Updated social_media_account_id (direct flow): ${accountInfo.accountId}`);
              if (resolvedAvatarUrl) {
                console.log(`[late/connections/callback] ✅ Updated avatar_url from accounts API: ${resolvedAvatarUrl.substring(0, 50)}...`);
              }
            }
          } else {
            console.warn(`[late/connections/callback] ⚠️ Could not find account info for platform ${provider} from accounts API (direct flow). Will retry later.`);
          }
        } catch (accountsError: any) {
          console.warn(`[late/connections/callback] Failed to fetch account info from accounts API (direct flow, non-fatal):`, accountsError.message);
          // Non-fatal: connection đã được tạo thành công, có thể sync account ID sau
        }

        // Increment account usage (use the account that was used for connection, not necessarily the one that owns the profile)
        try {
          await incrementAccountUsage(getlateAccount.id, "connect_social");
        } catch (usageError: any) {
          console.warn("[late/connections/callback] Failed to increment account usage:", usageError);
        }
      }

      // Handle popup mode (including fallback when popup was blocked and flow became full-page)
      if (popup) {
        const callbackUrl = new URL(`${getAppUrl()}/api/late/connections/${provider}/callback-page`);
        callbackUrl.searchParams.set("success", "true");
        callbackUrl.searchParams.set("provider", provider);
        callbackUrl.searchParams.set("connectionId", existingConnection?.id || "new");
        callbackUrl.searchParams.set("platform", provider);
        // Pass returnTo so callback-page can redirect back to settings in full-page scenarios
        if (returnTo) {
          callbackUrl.searchParams.set("returnTo", returnTo);
        }
        return NextResponse.redirect(callbackUrl.toString(), { status: 302 });
      }

      // Redirect to returnTo URL (non-popup mode)
      return NextResponse.redirect(returnTo, { status: 302 });
    }

    // Validate required parameters for OAuth code flow
    if (!code || !state) {
      console.error("[late/connections/callback] Missing code or state parameter. Available params:", {
        code: code ? "present" : "missing",
        state: state ? "present" : "missing",
        connected,
        socialMediaAccountIdFromCallback: socialMediaAccountIdFromCallback || "not present",
        allParams: Object.fromEntries(url.searchParams.entries())
      });
      return fail("Missing code or state parameter. If you're using direct connection flow, please ensure connected and profileId are present.", 400);
    }

    // Verify and decode state JWT using service layer
    const statePayload = decodeOAuthState(state);
    if (!statePayload || !statePayload.userId) {
      console.error("[late/connections/callback] Invalid or expired state token");
      return fail("Invalid or expired state token", 400);
    }

    const { userId, returnTo, popup } = statePayload;

    // Verify provider matches
    if (statePayload.provider !== provider) {
      return fail("Provider mismatch in state", 400);
    }

    // Step 1: Select appropriate late.dev account for connecting social media
    const getlateAccount = await selectLateAccount("connect_social");
    if (!getlateAccount) {
      return fail("No available late.dev account for connecting social media. All accounts have reached their limits.", 503);
    }
    try {
      const hasKey = !!(getlateAccount.api_key && String(getlateAccount.api_key).trim().length > 0);
      console.log(`[late/connections/callback] Using getlate_account ${getlateAccount.id}. api_key_present=${hasKey}`);
    } catch { }

    // Step 1.5: Check platform usage to see which profiles have connected which platforms
    // This helps track usage and identify available platforms
    const platformUsage = await getPlatformUsageSummary(getlateAccount.id);
    console.log(`[late/connections/callback] Platform usage for account ${getlateAccount.id}:`, {
      connected_platforms: platformUsage.connected_platforms,
      available_platforms: platformUsage.available_platforms,
      profiles_count: platformUsage.profiles.length
    });

    // Initialize late.dev client with selected account
    const lateClient = getLateClientForAccount(getlateAccount);

    // Exchange authorization code for access token via late.dev
    const redirectUri = `${getAppUrl()}/api/late/connections/${provider}/callback`;

    let tokenResponse: any;
    try {
      tokenResponse = await lateClient.exchangeCodeForToken(code, redirectUri);
    } catch (e: any) {
      console.error("[late/connections/callback] Token exchange failed:", e);
      return fail(`Failed to exchange code for token: ${e.message}`, 400);
    }

    const {
      access_token: lateAccessToken,
      refresh_token: lateRefreshToken,
      expires_in: expiresIn,
    } = tokenResponse;

    if (!lateAccessToken) {
      return fail("No access token received from late.dev", 400);
    }

    // Step 2: Check if we should reuse existing profile or create new one
    // Logic: Check if any existing profile hasn't connected this platform yet
    // If all profiles have connected this platform, check limits before creating new profile
    const { selectAccountForProfileCreation } = await import("@/lib/services/late");
    // findAnyProfileWithoutPlatform is already imported
    let existingProfile = await findAnyProfileWithoutPlatform(provider);

    let lateProfile: any;
    let profileId: string | null = null;
    let accountUsedForProfile = getlateAccount;

    if (existingProfile) {
      // Found a profile that hasn't connected this platform - reuse it
      profileId = existingProfile.late_profile_id;
      console.log(`[late/connections/callback] Reusing existing profile ${profileId} for ${provider} connection`);

      // Fetch profile info from late.dev to verify it exists
      try {
        if (profileId) {
          lateProfile = await lateClient.getProfileInfo(profileId);
          if (!lateProfile || !lateProfile.id) {
            throw new Error("Profile not found in late.dev");
          }
          console.log(`[late/connections/callback] Verified existing profile ${profileId}`);
        }

        // Get account for this profile if different
        if (existingProfile.getlate_account_id && existingProfile.getlate_account_id !== getlateAccount.id) {
          // Get account via service layer
          const profileAccount = await getAccountById(existingProfile.getlate_account_id);

          if (profileAccount?.api_key) {
            accountUsedForProfile = {
              id: profileAccount.id,
              account_name: null,
              api_key: profileAccount.api_key,
              client_id: profileAccount.client_id,
              client_secret: profileAccount.client_secret,
              webhook_secret: profileAccount.webhook_secret,
              is_active: true,
              limits: {},
              metadata: {}
            };
            console.log(`[late/connections/callback] Using different account ${accountUsedForProfile.id} for profile ${profileId}`);

            // Try to get profile info with the correct account's API key
            const { getLateClientForAccount } = await import("@/lib/services/late");
            const profileClient = getLateClientForAccount(accountUsedForProfile);
            try {
              if (profileId) {
                lateProfile = await profileClient.getProfileInfo(profileId);
                console.log(`[late/connections/callback] Successfully retrieved profile ${profileId} with account ${accountUsedForProfile.id}`);
              }
            } catch (profileError: any) {
              console.warn(`[late/connections/callback] Failed to get profile with account ${accountUsedForProfile.id}:`, profileError.message);
              // Continue with original lateClient
            }
          }
        }
      } catch (e: any) {
        const errorStatus = (e as any).status || 'unknown';
        console.warn(`[late/connections/callback] Existing profile ${profileId} not found in late.dev (status: ${errorStatus}), will create new profile:`, e.message);

        // If it's a 404, try to verify by listing profiles
        if (errorStatus === 404) {
          try {
            const allProfiles = await lateClient.listProfiles();
            const profiles = Array.isArray(allProfiles) ? allProfiles : (allProfiles.profiles || []);
            const profileIds = profiles.map((p: any) => p.id || p._id || p.profile_id || p.profileId).filter(Boolean);
            console.log(`[late/connections/callback] Available profiles in late.dev:`, profileIds);
            if (!profileIds.includes(profileId)) {
              console.error(`[late/connections/callback] Profile ${profileId} is NOT in the list. Profile may have been deleted or belongs to a different account.`);
            }
          } catch (listError: any) {
            console.warn(`[late/connections/callback] Failed to list profiles:`, listError.message);
          }
        }

        // Fall through to create new profile
        existingProfile = null;
        lateProfile = null;
      }
    }

    if (!existingProfile || !lateProfile) {
      // No existing profile available - need to create new one
      // Check limits before creating
      console.log(`[late/connections/callback] No existing profile available. Checking limits before creating new profile...`);

      const accountForProfile = await selectAccountForProfileCreation();
      if (!accountForProfile) {
        return fail(
          `All late.dev accounts have reached their profile limit. Cannot create new profile to connect ${provider}. Please upgrade your plan or remove unused profiles.`,
          503
        );
      }

      accountUsedForProfile = accountForProfile;

      // Use the account that can create profile (might be different from getlateAccount)
      const { getLateClientForAccount } = await import("@/lib/services/late");
      const accountLateClient = getLateClientForAccount(accountForProfile);

      // Create profile with access token using the account that can create profiles
      try {
        lateProfile = await accountLateClient.createProfileWithAccessToken(
          lateAccessToken,
          provider
        );
      } catch (e: any) {
        console.error("[late/connections/callback] Profile creation failed:", e);
        return fail(
          `Failed to create late.dev profile: ${e.message}. Please try connecting again.`,
          500
        );
      }

      // Ensure we have a valid profile ID
      if (!lateProfile?.id) {
        return fail("late.dev profile created but no profile ID returned", 500);
      }

      profileId = lateProfile.id;
      console.log(`[late/connections/callback] Created new profile ${profileId} for ${provider}`);

      // Update account limits (increment current_profiles)
      if (accountForProfile.id !== "env-fallback") {
        try {
          const { incrementAccountUsage } = await import("@/lib/services/late");
          await incrementAccountUsage(accountForProfile.id, "create_profile");
        } catch (usageError: any) {
          console.warn(`[late/connections/callback] Failed to increment account usage (non-fatal):`, usageError);
        }
      }
    }

    // Ensure profileId is set
    if (!profileId) {
      return fail("Profile ID is required but could not be found or created", 500);
    }

    // Generate profile name in format: PN_{số thứ tự}_{random 7 ký tự}
    const { generateProfileName } = await import("@/lib/late/profileNameGenerator");
    const autoProfileName = await generateProfileName();

    const profileName = autoProfileName; // Use generated name instead of late.dev's name

    // Step 3: Fetch full profile info to get social media account IDs
    let fullProfileInfo: any = null;
    // Theo getlate.dev docs: profileId trong callback URL là Profile ID của getlate.dev (KHÔNG phải ID của social media account)
    // getlate.dev không trả về ID của social media account ngay lập tức sau khi kết nối thành công
    // Vậy tạm thời để accountId là null, sau đó sẽ call /v1/accounts để lấy ID và update
    let accountId: string | null = accountIdFromCallback || null;

    try {
      // Use accountUsedForProfile's client to fetch profile info
      const { getLateClientForAccount } = await import("@/lib/services/late");
      const profileClient = getLateClientForAccount(accountUsedForProfile);
      fullProfileInfo = await profileClient.getProfileInfo(profileId);

      // Extract accountId from fullProfileInfo for this platform (chỉ khi chưa có từ callback URL)
      // accountId là ID của social media account connection trên getlate.dev (cần để disconnect)
      // Note: Có thể profile info chưa có account ID ngay lập tức, sẽ call /v1/accounts sau
      if (!accountId && fullProfileInfo) {
        try {
          accountId = profileClient.extractAccountId(fullProfileInfo, provider);
          if (accountId) {
            console.log(`[late/connections/callback] Extracted accountId for ${provider} (OAuth flow):`, accountId);
          } else {
            console.warn(`[late/connections/callback] Could not extract accountId for ${provider} from profile info (OAuth flow). Will call /v1/accounts API.`);
          }
        } catch (extractError: any) {
          console.warn(`[late/connections/callback] Failed to extract accountId (OAuth flow):`, extractError.message);
        }
      } else if (accountIdFromCallback) {
        console.log(`[late/connections/callback] ✅ Using accountId from callback URL (OAuth flow):`, accountIdFromCallback);
      }
    } catch (e: any) {
      console.warn("[late/connections/callback] Failed to fetch full profile info:", e);
      // Non-fatal: continue with basic profile info
    }

    // Step 4: Create or update getlate_profiles record
    // Store platform, username, avatar_url, verified, followers_count in metadata
    const getlateProfileData = {
      getlate_account_id: accountUsedForProfile.id !== "env-fallback" ? accountUsedForProfile.id : null,
      late_profile_id: profileId,
      profile_name: profileName,
      description: fullProfileInfo?.description || null,
      social_media_ids: fullProfileInfo?.social_media_ids || fullProfileInfo?.account_ids || {},
      metadata: {
        platform: provider, // The platform this profile is for
        username: fullProfileInfo?.username || null,
        avatar_url: fullProfileInfo?.avatar_url || null,
        verified: fullProfileInfo?.verified || false,
        followers_count: fullProfileInfo?.followers_count || null,
        connected_at: new Date().toISOString(), // Track when this platform was connected
        ...(fullProfileInfo?.metadata || {})
      }
    };

    // Upsert profile via service layer
    if (!getlateProfileData.late_profile_id || !getlateProfileData.getlate_account_id) {
      return fail("Missing required profile data", 400);
    }

    const getlateProfile = await upsertProfile({
      getlate_account_id: getlateProfileData.getlate_account_id,
      late_profile_id: getlateProfileData.late_profile_id,
      profile_name: getlateProfileData.profile_name,
      description: getlateProfileData.description || null,
      social_media_ids: (getlateProfileData as any).social_media_ids || {},
      metadata: getlateProfileData.metadata || {}
    });

    if (!getlateProfile) {
      console.error("[late/connections/callback] Failed to create/update getlate_profiles");
      return fail("Failed to save getlate profile", 500);
    }

    // TEMPORARILY DISABLED: Step 4 - Check if this social media account (username or accountId) is already connected to another profile
    // This check was causing issues with overwriting data from other platforms or users
    // TODO: Re-enable with better logic that doesn't affect other platforms/users
    // const usernameFromMetadata = fullProfileInfo?.username || null;
    // if (usernameFromMetadata || accountId) {
    //   ... duplicate check logic ...
    // }

    // Step 5: Create or update connected_accounts with reference to getlate_profiles
    // Get getlate_account_id from getlateProfile or accountUsedForProfile
    const accountIdForConnection = getlateProfile.getlate_account_id || accountUsedForProfile.id;

    // Check if connection already exists via service layer
    // Checks in order: profile_id (legacy), social_media_account_id, metadata.accountId, username
    const existingConnection = await findExistingConnection(
      userId,
      provider,
      profileId || null,
      accountId || null,
      fullProfileInfo?.username || null
    );

    if (existingConnection && profileId) {
      console.log(`[late/connections/callback] Found existing connection with same profile_id (${profileId}) for legacy constraint, will update:`, existingConnection.id, `(current platform: ${existingConnection.platform}, new platform: ${provider})`);
    }

    const connectionData = {
      user_id: userId,
      getlate_profile_id: getlateProfile.id, // Reference to getlate_profiles
      getlate_account_id: accountIdForConnection !== "env-fallback" ? accountIdForConnection : null, // Reference to getlate_accounts
      platform: provider, // Duplicate for quick query
      profile_id: profileId || null, // Use late_profile_id for backward compatibility (late_profile_id is unique, so no duplicate key issue)
      profile_name: profileName, // Legacy: keep for backward compatibility
      access_token: encryptToken(lateAccessToken), // Encrypt before storing
      refresh_token: lateRefreshToken ? encryptToken(lateRefreshToken) : null,
      expires_at: expiresIn
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null,
      late_profile_id: profileId, // Legacy: keep for backward compatibility
      social_media_account_id: accountId || null, // ID của social media account connection trên getlate.dev (cần để disconnect) - được trả về từ getlate.dev khi kết nối thành công
      profile_metadata: {
        late_profile_id: profileId,
        late_profile_name: profileName,
        platform: provider,
        username: fullProfileInfo?.username || null,
        email: fullProfileInfo?.email || fullProfileInfo?.metadata?.email || null, // Email từ late.dev nếu có
        social_media_ids: (getlateProfile as any).social_media_ids || {},
        metadata: getlateProfile.metadata,
        getlate_account_id: accountIdForConnection !== "env-fallback" ? accountIdForConnection : null,
        accountId: accountId || null, // ID của social media account connection trên getlate.dev (cần để disconnect) - giữ lại trong metadata để backward compatibility
        avatar_url: fullProfileInfo?.avatar_url || null,
        verified: fullProfileInfo?.verified || false,
        followers_count: fullProfileInfo?.followers_count || null
      }, // Legacy: keep for backward compatibility
      // created_at and updated_at will be set by database defaults/triggers (UTC)
    };

    // Insert or update connection
    // Unique constraint: (user_id, getlate_profile_id, platform) - allows multiple accounts of same platform (different getlate_profile_id)
    let savedConnection: any = null;
    let dbError: any = null;

    // Check if connection exists with same (user_id, getlate_profile_id, platform) - only update in this case
    // This allows multiple accounts of the same platform (different getlate_profile_id)
    // Check via service layer
    if (!userId || !getlateProfile?.id) {
      return fail("Missing required data for connection", 400);
    }

    const { findConnectionByUniqueConstraint } = await import("@/lib/services/db/connections");
    const existingByUniqueConstraint = await findConnectionByUniqueConstraint(userId, getlateProfile.id, provider);

    // Use service layer for create/update operations
    const { updateConnection, createConnection, findConnectionById } = await import("@/lib/services/db/connections");

    // Helper function to convert null to undefined for accountId in metadata
    const sanitizeMetadata = (metadata: any) => {
      if (!metadata) return {};
      const sanitized = { ...metadata };
      if (sanitized.accountId === null) {
        sanitized.accountId = undefined;
      }
      return sanitized;
    };

    if (existingByUniqueConstraint && existingByUniqueConstraint.id) {
      // Same (user_id, getlate_profile_id, platform) - update existing connection via service layer
      console.log(`[late/connections/callback] Found existing connection with same (user_id, getlate_profile_id, platform), updating:`, existingByUniqueConstraint.id);
      const updateData = {
        ...connectionData,
        profile_metadata: sanitizeMetadata(connectionData.profile_metadata)
      };
      const updated = await updateConnection(existingByUniqueConstraint.id, updateData);
      if (updated) {
        savedConnection = await findConnectionById(existingByUniqueConstraint.id);
      } else {
        dbError = new Error("Failed to update connection");
      }
    } else if (existingConnection && existingConnection.id && existingConnection.platform !== provider) {
      // Found connection with same profile_id but different platform - set profile_id = null and insert new via service layer
      console.log(`[late/connections/callback] Found existing connection with same profile_id but different platform (${existingConnection.platform} vs ${provider}), creating new with profile_id = null`);
      const connectionDataWithoutProfileId = {
        ...connectionData,
        profile_id: null // Set to null to avoid duplicate key error on legacy constraint
      };

      savedConnection = await createConnection({
        user_id: userId,
        getlate_profile_id: getlateProfile.id,
        getlate_account_id: accountIdForConnection !== "env-fallback" ? accountIdForConnection : "",
        platform: provider,
        profile_id: null,
        profile_name: connectionDataWithoutProfileId.profile_name || null,
        access_token: connectionDataWithoutProfileId.access_token || null,
        refresh_token: connectionDataWithoutProfileId.refresh_token || null,
        expires_at: connectionDataWithoutProfileId.expires_at || null,
        late_profile_id: connectionDataWithoutProfileId.late_profile_id || null,
        social_media_account_id: connectionDataWithoutProfileId.social_media_account_id || null,
        profile_metadata: sanitizeMetadata(connectionDataWithoutProfileId.profile_metadata)
      });

      if (!savedConnection) {
        dbError = new Error("Failed to create connection");
      }
    } else {
      // No existing connection with same (user_id, getlate_profile_id, platform) - create new via service layer
      // This allows multiple accounts of the same platform (different getlate_profile_id)
      console.log(`[late/connections/callback] No existing connection found, creating new connection for platform ${provider}`);
      savedConnection = await createConnection({
        user_id: userId,
        getlate_profile_id: getlateProfile.id,
        getlate_account_id: accountIdForConnection !== "env-fallback" ? accountIdForConnection : "",
        platform: provider,
        profile_id: connectionData.profile_id || null,
        profile_name: connectionData.profile_name || null,
        access_token: connectionData.access_token || null,
        refresh_token: connectionData.refresh_token || null,
        expires_at: connectionData.expires_at || null,
        late_profile_id: connectionData.late_profile_id || null,
        social_media_account_id: connectionData.social_media_account_id || null,
        profile_metadata: sanitizeMetadata(connectionData.profile_metadata)
      });

      if (!savedConnection) {
        dbError = new Error("Failed to create connection");
      }
    }

    if (dbError) {
      console.error("[late/connections/callback] Database error:", dbError);
      return fail("Failed to save connection", 500);
    }

    // Sau khi kết nối thành công, call /v1/accounts để lấy ID của social media account và update vào social_media_account_id
    // Theo getlate.dev docs: GET /v1/accounts?profileId=xxx để lấy danh sách accounts của profile
    if (!accountId && savedConnection) {
      try {
        console.log(`[late/connections/callback] Fetching account ID for platform ${provider} from getlate.dev accounts API (OAuth flow)...`);
        const { getLateClientForAccount } = await import("@/lib/services/late");
        const profileClient = getLateClientForAccount(accountUsedForProfile);
        const accountIdFromAPI = await profileClient.getAccountIdForPlatform(profileId, provider);

        if (accountIdFromAPI && savedConnection) {
          // Update social_media_account_id với ID từ accounts API via service layer
          const { updateConnection } = await import("@/lib/services/db/connections");
          const updated = await updateConnection(savedConnection.id, {
            social_media_account_id: accountIdFromAPI,
            profile_metadata: {
              ...(savedConnection.profile_metadata || {}),
              accountId: accountIdFromAPI // Update trong metadata để backward compatibility
            }
          });

          if (!updated) {
            console.warn(`[late/connections/callback] Failed to update social_media_account_id`);
          } else {
            console.log(`[late/connections/callback] ✅ Updated social_media_account_id (OAuth flow): ${accountIdFromAPI}`);
          }
        } else {
          console.warn(`[late/connections/callback] ⚠️ Could not find account ID for platform ${provider} from accounts API (OAuth flow). Will retry later.`);
        }
      } catch (accountsError: any) {
        console.warn(`[late/connections/callback] Failed to fetch account ID from accounts API (OAuth flow, non-fatal):`, accountsError.message);
        // Non-fatal: connection đã được tạo thành công, có thể sync account ID sau
      }
    }

    // Increment account usage for connection
    try {
      await incrementAccountUsage(getlateAccount.id, "connect_social");
    } catch (usageError: any) {
      console.warn("[late/connections/callback] Failed to increment account usage:", usageError);
      // Non-fatal: continue
    }

    // Check if this is a popup flow
    const isPopup = popup === true || url.searchParams.get("popup") === "1";

    // If popup mode, redirect to callback page that will send postMessage to parent
    if (isPopup && returnTo) {
      const callbackUrl = new URL(`${getAppUrl()}/api/late/connections/${provider}/callback-page`);
      callbackUrl.searchParams.set("success", "true");
      callbackUrl.searchParams.set("provider", provider);
      callbackUrl.searchParams.set("connectionId", savedConnection?.id || "");
      callbackUrl.searchParams.set("platform", savedConnection?.platform || provider);
      // Pass returnTo so callback-page can redirect back to settings in full-page scenarios
      callbackUrl.searchParams.set("returnTo", returnTo);
      return NextResponse.redirect(callbackUrl.toString(), { status: 302 });
    }

    // Redirect to returnTo URL if provided (non-popup mode), otherwise return JSON success
    if (returnTo) {
      // Add success query param to indicate successful connection
      const redirectUrl = new URL(returnTo);
      redirectUrl.searchParams.set("connected", "true");
      redirectUrl.searchParams.set("provider", provider);
      return NextResponse.redirect(redirectUrl.toString(), { status: 302 });
    }

    // Return success response if no returnTo URL
    return success({
      message: `Successfully connected ${provider}`,
      provider,
      connection: {
        id: savedConnection?.id,
        platform: savedConnection?.platform,
        profile_name: savedConnection?.profile_name,
      },
    });

  } catch (err: any) {
    console.error("[late/connections/callback] Error:", err);

    // Try to check if this is a popup flow for error handling
    try {
      const { provider: providerParam } = params;
      const url = new URL(req.url);
      const isPopup = url.searchParams.get("popup") === "1";

      if (isPopup && providerParam) {
        const callbackUrl = new URL(`${getAppUrl()}/api/late/connections/${providerParam}/callback-page`);
        callbackUrl.searchParams.set("success", "false");
        callbackUrl.searchParams.set("provider", providerParam);
        callbackUrl.searchParams.set("error", err.message || "Failed to process OAuth callback");
        // Try to propagate returnTo so callback-page can redirect back to settings in full-page scenarios
        const returnToFromUrl = url.searchParams.get("returnTo") || "";
        if (returnToFromUrl) {
          callbackUrl.searchParams.set("returnTo", returnToFromUrl);
        }
        return NextResponse.redirect(callbackUrl.toString(), { status: 302 });
      }
    } catch (e) {
      // If we can't determine popup mode, fall through to normal error response
    }

    return fail(err.message || "Failed to process OAuth callback", 500);
  }
}

