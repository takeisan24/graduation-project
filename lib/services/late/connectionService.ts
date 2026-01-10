/**
 * Service: Late.dev OAuth Connection Operations
 * 
 * Handles complex business logic for OAuth connection flows including:
 * - OAuth flow initiation
 * - OAuth callback processing
 * - Profile creation and verification
 * - Connection saving and updating
 */

import jwt from "jsonwebtoken";
import { supabase } from "@/lib/supabase";
import { encryptToken } from "@/lib/crypto";
import { getAppUrl } from "@/lib/utils/urlConfig";
import {
  selectLateAccount,
  getLateClientForAccount,
  validateConnectionRequest,
  createProfileForConnection,
  canPerformOperation,
  syncAndCleanupProfiles,
  incrementAccountUsage
} from "./index";
import type { Connection } from "@/lib/services/db/connections";
import {
  createConnectionLegacy,
  findConnectionByUserPlatformAndProfileId,
  findConnectionById,
  updateConnection,
  findConnectionByIdWithProfile
} from "@/lib/services/db/connections";
import { upsertProfile, findProfileByLateId } from "@/lib/services/db/profiles";
import { selectAccountForProfileCreation } from "./accountService";
import { getPlatformUsageSummary } from "./index";

export interface OAuthStartRequest {
  provider: string;
  userId: string;
  returnTo?: string;
  popupMode?: boolean;
  jsonMode?: boolean;
}

export interface OAuthStartResult {
  success: boolean;
  oauthRedirectUrl?: string;
  requiresCredentials?: boolean;
  profileId?: string | null;
  error?: string;
}

export interface OAuthCallbackParams {
  provider: string;
  code?: string | null;
  state?: string | null;
  error?: string | null;
  errorDescription?: string | null;
  connected?: string | null;
  profileId?: string | null;
  username?: string | null;
  accountId?: string | null;
}

export interface OAuthCallbackResult {
  success: boolean;
  userId?: string | null;
  returnTo?: string;
  popup?: boolean;
  error?: string;
  connectionId?: string;
}

/**
 * Supported social media platforms via late.dev
 */
export const SUPPORTED_PROVIDERS = [
  "instagram",
  "facebook",
  "twitter",
  "linkedin",
  "tiktok",
  "youtube",
  "pinterest",
  "threads",
  "bluesky",
] as const;

export type Provider = typeof SUPPORTED_PROVIDERS[number];

/**
 * Validate provider is supported
 */
export function validateProvider(provider: string): provider is Provider {
  return SUPPORTED_PROVIDERS.includes(provider as Provider);
}

/**
 * Save pending_user_id to profile metadata for callback lookup
 */
export async function savePendingUserIdToProfile(
  profileId: string,
  userId: string,
  provider: string
): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from("getlate_profiles")
      .select("id, metadata")
      .eq("late_profile_id", profileId)
      .maybeSingle();

    if (profile) {
      const currentMetadata = profile.metadata || {};
      const updatedMetadata = {
        ...currentMetadata,
        pending_user_id: userId,
        pending_provider: provider,
        pending_timestamp: Date.now()
      };

      await supabase
        .from("getlate_profiles")
        .update({
          metadata: updatedMetadata
        })
        .eq("id", profile.id);

      console.log(`[connectionService] ✅ Saved pending_user_id to profile ${profileId} metadata`);
    } else {
      console.warn(`[connectionService] ⚠️ Profile ${profileId} not found in DB when trying to save pending_user_id`);
    }
  } catch (error: any) {
    console.warn(`[connectionService] Failed to save pending_user_id:`, error.message);
    // Non-fatal: continue with OAuth flow
  }
}

/**
 * Build state JWT for OAuth flow
 */
export function buildOAuthState(payload: {
  userId: string;
  provider: Provider;
  returnTo?: string;
  popup?: boolean;
  profileId?: string | null;
  getlateAccountId?: string;
}): string {
  const statePayload = {
    userId: payload.userId,
    provider: payload.provider,
    returnTo: payload.returnTo || "",
    popup: payload.popup || false,
    profileId: payload.profileId || null,
    getlateAccountId: payload.getlateAccountId,
    timestamp: Date.now(),
  };

  return jwt.sign(statePayload, process.env.OAUTH_STATE_SECRET!, {
    expiresIn: "10m", // State expires in 10 minutes
  });
}

/**
 * Decode and verify OAuth state JWT
 */
export function decodeOAuthState(state: string): {
  userId?: string;
  provider?: string;
  returnTo?: string;
  popup?: boolean;
  profileId?: string | null;
  getlateAccountId?: string;
  timestamp?: number;
} | null {
  try {
    // Try to verify first (if not expired)
    try {
      return jwt.verify(state, process.env.OAUTH_STATE_SECRET!) as any;
    } catch (verifyError) {
      // If verification fails, try decode (might be expired or invalid)
      return jwt.decode(state) as any;
    }
  } catch (e) {
    return null;
  }
}

/**
 * Get OAuth redirect URL from late.dev
 */
export async function getOAuthRedirectUrl(
  provider: string,
  profileId: string | null,
  state: string,
  selectedAccount: any
): Promise<string | null> {
  const redirectUriBase = `${getAppUrl()}/api/late/connections/${provider}/callback`;

  // Build late.dev connect URL
  const connectUrl = new URL(`https://getlate.dev/api/v1/connect/${provider}`);
  if (profileId) {
    connectUrl.searchParams.set("profileId", profileId);
  }
  connectUrl.searchParams.set("redirect_url", redirectUriBase);
  connectUrl.searchParams.set("state", state);

  const redirectUrl = connectUrl.toString();

  try {
    console.log(`[connectionService] Calling late.dev connect endpoint:`, {
      provider,
      hasProfileId: !!profileId,
      redirectUriBase,
      hasApiKey: !!(selectedAccount.api_key && String(selectedAccount.api_key).trim().length > 0)
    });

    const response = await fetch(redirectUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${selectedAccount.api_key}`,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      redirect: "manual" // Don't follow redirects automatically
    });

    console.log(`[connectionService] late.dev response:`, {
      status: response.status,
      statusText: response.statusText
    });

    // Handle redirect response (302/301)
    if (response.status === 302 || response.status === 301) {
      const location = response.headers.get("Location");
      if (location) {
        console.log(`[connectionService] ✅ Got OAuth redirect URL from late.dev (redirect): ${location.substring(0, 150)}...`);
        return location;
      }
    }

    // Handle JSON response (200)
    if (response.status === 200) {
      try {
        const responseData = await response.json();
        if (responseData.authUrl) {
          console.log(`[connectionService] ✅ Got OAuth redirect URL from late.dev (JSON): ${responseData.authUrl.substring(0, 150)}...`);
          return responseData.authUrl;
        }
      } catch (jsonError: any) {
        const responseText = await response.text();
        console.warn(`[connectionService] ⚠️ Response 200 but failed to parse JSON:`, jsonError.message, `Response (first 500 chars):`, responseText.substring(0, 500));
      }
    }

    // Unexpected status
    const responseText = await response.text();
    console.error(`[connectionService] ❌ Unexpected response status ${response.status} from late.dev:`, {
      status: response.status,
      statusText: response.statusText,
      provider,
      hasProfileId: !!profileId,
      responseText: responseText.substring(0, 1000)
    });

    return null;
  } catch (fetchError: any) {
    console.error("[connectionService] ❌ Error calling late.dev connect endpoint:", {
      message: fetchError.message,
      provider,
      redirectUrl: redirectUrl.substring(0, 200)
    });
    throw fetchError;
  }
}

/**
 * Initiate OAuth flow for connecting social media account
 */
export async function initiateOAuthFlow(
  request: OAuthStartRequest
): Promise<OAuthStartResult> {
  const { provider, userId, returnTo, popupMode, jsonMode } = request;

  // Validate provider
  if (!validateProvider(provider)) {
    return {
      success: false,
      error: `Unsupported provider. Supported: ${SUPPORTED_PROVIDERS.join(", ")}`
    };
  }

  // Handle Bluesky differently - it uses credentials instead of OAuth
  if (provider === "bluesky") {
    if (jsonMode) {
      return {
        success: true,
        requiresCredentials: true,
        profileId: null
      };
    }
    return {
      success: false,
      error: "Bluesky connection requires credentials. Please use POST endpoint with credentials."
    };
  }

  // Select appropriate late.dev account
  const getlateAccount = await selectLateAccount("connect_social");
  if (!getlateAccount) {
    // Check if any accounts exist
    const { data: allAccounts } = await supabase
      .from("getlate_accounts")
      .select("id, account_name, is_active, metadata")
      .eq("is_active", true);

    const accountsCount = allAccounts?.length || 0;
    const hasEnvApiKey = !!(process.env.LATE_API_KEY && String(process.env.LATE_API_KEY).trim().length > 0);

    if (accountsCount === 0 && !hasEnvApiKey) {
      return {
        success: false,
        error: "No late.dev account configured. Please either:\n1. Add a late.dev account with API key in the database (getlate_accounts table), OR\n2. Set LATE_API_KEY environment variable."
      };
    }

    return {
      success: false,
      error: `No available late.dev account for connecting social media. ${accountsCount} account(s) found but all have reached their connection limits. Please check account limits or add a new account.`
    };
  }

  // Verify API key exists
  if (!getlateAccount.api_key || String(getlateAccount.api_key).trim().length === 0) {
    return {
      success: false,
      error: "Late.dev account API key is missing"
    };
  }

  // Validate connection request
  const validation = await validateConnectionRequest(provider, userId);

  if (!validation.canProceed) {
    return {
      success: false,
      error: validation.errorMessage || `Cannot connect ${provider}. Please check your account limits.`
    };
  }

  let profileId: string | null = validation.profileId || null;
  let selectedAccount = validation.account!;

  // Verify profile exists on getlate.dev if we have one from DB
  if (profileId && validation.metadata?.profileFromDB) {
    try {
      const lateClient = getLateClientForAccount(selectedAccount);
      await lateClient.getProfileInfo(profileId);
      console.log(`[connectionService] ✅ Verified profile ${profileId} exists on getlate.dev`);
    } catch (verifyError: any) {
      // Profile doesn't exist - sync and cleanup
      console.warn(`[connectionService] ⚠️ Profile ${profileId} from DB doesn't exist on getlate.dev. Syncing and cleaning up profiles...`);

      const profileAccountId = validation.account?.id || selectedAccount.id;
      const syncResult = await syncAndCleanupProfiles(profileAccountId, selectedAccount.api_key);

      console.log(`[connectionService] Sync and cleanup result: synced ${syncResult.syncedCount}, deleted ${syncResult.deletedCount}`);

      // Check if profile exists after sync
      if (!syncResult.profileIds.includes(profileId)) {
        // Re-validate to find available profile
        const revalidation = await validateConnectionRequest(provider, userId);

        if (revalidation.canProceed && revalidation.profileId) {
          profileId = revalidation.profileId;
          selectedAccount = revalidation.account!;
          console.log(`[connectionService] ✅ Found available profile ${profileId} after sync`);
        } else {
          // Need to create new profile
          const canCreate = canPerformOperation(selectedAccount, "create_profile");

          if (!canCreate.canPerform) {
            return {
              success: false,
              error: `Profile ${validation.profileId} from database doesn't exist on getlate.dev, and account cannot create new profile: ${canCreate.reason || 'Profile limit reached'}`
            };
          }

          // Create new profile
          try {
            const { profileId: newProfileId } = await createProfileForConnection(selectedAccount, provider, userId);
            profileId = newProfileId;
            console.log(`[connectionService] ✅ Created new profile ${newProfileId}`);

            // Save pending_user_id to newly created profile
            await savePendingUserIdToProfile(newProfileId, userId, provider);
          } catch (createError: any) {
            console.error(`[connectionService] Failed to create profile:`, createError);
            return {
              success: false,
              error: `Failed to create profile for connecting ${provider}: ${createError.message}. Please try again.`
            };
          }
        }
      }
    }
  }

  // Create profile if needed
  if (validation.metadata?.needsProfileCreation) {
    try {
      const { profileId: newProfileId } = await createProfileForConnection(selectedAccount, provider, userId);
      profileId = newProfileId;

      // Save pending_user_id to newly created profile
      await savePendingUserIdToProfile(newProfileId, userId, provider);
    } catch (createError: any) {
      console.error(`[connectionService] Failed to create profile:`, createError);
      return {
        success: false,
        error: `Failed to create profile for connecting ${provider}: ${createError.message}. Please try again.`
      };
    }
  }

  // Save pending_user_id to profile for callback lookup
  if (profileId) {
    await savePendingUserIdToProfile(profileId, userId, provider);
  }

  // Build state JWT
  const state = buildOAuthState({
    userId,
    provider: provider as Provider,
    returnTo,
    popup: popupMode,
    profileId,
    getlateAccountId: selectedAccount.id
  });

  // Get OAuth redirect URL from late.dev
  try {
    const oauthRedirectUrl = await getOAuthRedirectUrl(provider, profileId, state, selectedAccount);

    if (!oauthRedirectUrl) {
      return {
        success: false,
        error: "Failed to get OAuth redirect URL from late.dev. Please check your API key and profile ID."
      };
    }

    return {
      success: true,
      oauthRedirectUrl,
      profileId
    };
  } catch (fetchError: any) {
    return {
      success: false,
      error: `Failed to initiate connection with late.dev: ${fetchError.message}`
    };
  }
}

/**
 * Clean up pending_user_id from profile metadata
 */
export async function cleanupPendingUserId(profileId: string): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from("getlate_profiles")
      .select("id, metadata")
      .eq("late_profile_id", profileId)
      .maybeSingle();

    if (profile && profile.metadata) {
      const { pending_user_id, pending_provider, pending_timestamp, ...restMetadata } = profile.metadata;
      await supabase
        .from("getlate_profiles")
        .update({
          metadata: restMetadata
        })
        .eq("id", profile.id);

      console.log(`[connectionService] ✅ Cleaned up pending_user_id from profile ${profileId}`);
    }
  } catch (error: any) {
    console.warn(`[connectionService] Failed to cleanup pending_user_id:`, error.message);
  }
}

/**
 * Get userId from profile metadata (pending_user_id)
 */
export async function getUserIdFromProfileMetadata(
  profileId: string
): Promise<string | null> {
  try {
    const { data: profile } = await supabase
      .from("getlate_profiles")
      .select("id, metadata")
      .eq("late_profile_id", profileId)
      .maybeSingle();

    if (profile?.metadata?.pending_user_id) {
      // Check timestamp (10 minutes expiry)
      const pendingTimestamp = profile.metadata.pending_timestamp || 0;
      const ageInMinutes = (Date.now() - pendingTimestamp) / (1000 * 60);

      if (ageInMinutes < 10) {
        return profile.metadata.pending_user_id;
      } else {
        console.warn(`[connectionService] pending_user_id expired (age: ${ageInMinutes.toFixed(2)} minutes)`);
      }
    }

    return null;
  } catch (error: any) {
    console.warn(`[connectionService] Failed to get userId from profile metadata:`, error.message);
    return null;
  }
}

/**
 * Parse and clean callback parameters from URL
 */
export function parseCallbackParams(url: URL, provider: string): OAuthCallbackParams {
  // Clean state: remove any query params that were appended
  let stateRaw = url.searchParams.get("state");
  let state: string | null = null;

  if (stateRaw) {
    const questionMarkIndex = stateRaw.indexOf("?");
    if (questionMarkIndex > 0) {
      state = stateRaw.substring(0, questionMarkIndex);
      console.log("[connectionService] State had appended params, extracted JWT:", {
        originalLength: stateRaw.length,
        extractedLength: state.length
      });
    } else {
      state = stateRaw;
    }
  }

  const code = url.searchParams.get("code");
  let error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const connected = url.searchParams.get("connected");
  const profileId = url.searchParams.get("profileId");
  const username = url.searchParams.get("username");
  const accountId = url.searchParams.get("accountId") ||
    url.searchParams.get("account_id") ||
    url.searchParams.get("social_media_account_id");

  // Check if error is appended to state
  if (!error && stateRaw && stateRaw.includes("error=")) {
    const errorMatch = stateRaw.match(/[?&]error=([^&]+)/);
    if (errorMatch) {
      error = decodeURIComponent(errorMatch[1]);
      console.log("[connectionService] Extracted error from state:", error);
    }
  }

  return {
    provider,
    code,
    state,
    error,
    errorDescription,
    connected,
    profileId,
    username,
    accountId
  };
}

/**
 * Build error message for OAuth errors
 */
export function buildOAuthErrorMessage(
  error: string,
  provider: string,
  errorDescription?: string | null
): string {
  let errorMessage = errorDescription || error;

  if (error === "connection_failed") {
    if (provider === "twitter") {
      errorMessage = `Failed to connect Twitter/X. This may be due to:
- Twitter/X OAuth app của getlate.dev chưa được cấu hình đúng hoặc chưa được approve
- Redirect URI trong Twitter Developer Portal không match với redirect URI của getlate.dev
- User đã từ chối authorize trên Twitter/X
- Twitter/X app của getlate.dev có vấn đề về permissions hoặc settings

Vui lòng:
1. Kiểm tra trong getlate.dev dashboard xem Twitter/X connection có hoạt động không
2. Thử lại sau vài phút (có thể Twitter/X đang có vấn đề tạm thời)
3. Liên hệ getlate.dev support nếu vấn đề vẫn tiếp tục`;
    } else {
      errorMessage = `Failed to connect ${provider}. This may be due to:
- Invalid profile ID or API key
- OAuth provider (${provider}) configuration issue
- Network connectivity problem
- User denied authorization

Please check your late.dev account settings and try again.`;
    }
  } else if (error === "no_facebook_pages") {
    errorMessage = `No Facebook Pages found. To connect Facebook:
- You need to have at least one Facebook Page
- Make sure you have admin access to the Page
- Try creating a Facebook Page first, then connect again`;
  }

  return errorMessage;
}

/**
 * Get callback page URL for popup flow
 */
export function getCallbackPageUrl(
  provider: string,
  success: boolean,
  error?: string,
  connectionId?: string
): string {
  const callbackUrl = new URL(`${getAppUrl()}/api/late/connections/${provider}/callback-page`);
  callbackUrl.searchParams.set("success", success ? "true" : "false");
  callbackUrl.searchParams.set("provider", provider);
  if (error) {
    callbackUrl.searchParams.set("error", error);
  }
  if (connectionId) {
    callbackUrl.searchParams.set("connectionId", connectionId);
  }
  return callbackUrl.toString();
}

/**
 * Result returned by ensureConnectionHasLateProfile
 */
export interface ConnectionProfileHydrationResult {
  /** Whether we successfully linked the connection to a Late.dev profile */
  success: boolean;
  /** Hydrated connection (with getlate_profiles join) when success=true */
  connection?: (Connection & { getlate_profiles?: any }) | null;
  /** Machine friendly reason for failures to help callers branch */
  reason?:
  | "connection_not_found"
  | "not_owner"
  | "legacy_profile_missing"
  | "profile_not_synced"
  | "update_failed"
  | "hydration_failed";
  /** Human friendly context for logging or API responses */
  message?: string;
}

/**
 * Ensure a legacy connection record is linked to the normalized getlate_profiles table.
 * Some early connections only stored `late_profile_id` (text) and never populated
 * `getlate_profile_id` (uuid). That breaks inner joins when publishing posts.
 *
 * This helper backfills the missing foreign key so the rest of the pipeline can
 * operate without forcing users to reconnect their accounts.
 */
export async function ensureConnectionHasLateProfile(
  connectionId: string,
  userId: string
): Promise<ConnectionProfileHydrationResult> {
  const connection = await findConnectionById(connectionId);

  if (!connection) {
    return {
      success: false,
      reason: "connection_not_found",
      message: "Connected account not found"
    };
  }

  if (connection.user_id !== userId) {
    return {
      success: false,
      reason: "not_owner",
      message: "Connected account does not belong to this user"
    };
  }

  if (connection.getlate_profile_id) {
    const hydrated = await findConnectionByIdWithProfile(connectionId, userId);
    if (hydrated?.getlate_profiles) {
      return { success: true, connection: hydrated };
    }
  }

  if (!connection.late_profile_id) {
    console.warn(`[connectionService] Connection ${connectionId} is missing legacy late_profile_id; cannot backfill getlate_profile_id automatically.`);
    return {
      success: false,
      reason: "legacy_profile_missing",
      message: "Connection is missing Late.dev profile metadata. Please reconnect this account."
    };
  }

  const legacyProfile = await findProfileByLateId(connection.late_profile_id);
  if (!legacyProfile) {
    console.warn(`[connectionService] Legacy profile ${connection.late_profile_id} not found in getlate_profiles table while hydrating connection ${connectionId}.`);
    return {
      success: false,
      reason: "profile_not_synced",
      message: "Late.dev profile for this connection is not synced. Please run profile sync and try again."
    };
  }

  const isUpdated = await updateConnection(connectionId, {
    getlate_profile_id: legacyProfile.id
  });

  if (!isUpdated) {
    return {
      success: false,
      reason: "update_failed",
      message: "Failed to link connection to Late.dev profile"
    };
  }

  const hydrated = await findConnectionByIdWithProfile(connectionId, userId);
  if (!hydrated?.getlate_profiles) {
    return {
      success: false,
      reason: "hydration_failed",
      message: "Linked profile but failed to load connection afterwards"
    };
  }

  console.log(`[connectionService] ✅ Backfilled getlate_profile_id for connection ${connectionId} using legacy profile ${connection.late_profile_id}`);
  return {
    success: true,
    connection: hydrated
  };
}

/**
 * Get userId from multiple sources (state, session, profile metadata, existing connection)
 */
export async function resolveUserId(
  statePayload: any,
  profileId: string | null,
  requireAuthFn: () => Promise<any>
): Promise<{ userId: string | null; user: any | null }> {
  let userId: string | null = statePayload?.userId || null;
  let user: any = null;

  // Try to get from session
  try {
    user = await requireAuthFn();
    if (user) {
      // Verify userId matches session user if both exist
      if (userId && user.id !== userId) {
        console.warn("[connectionService] userId mismatch:", { stateUserId: userId, sessionUserId: user.id });
        userId = user.id; // Use session userId (more secure)
      } else if (!userId) {
        userId = user.id;
      }
    }
  } catch (authError: any) {
    console.warn("[connectionService] Session auth failed:", authError.message);
  }

  // Try to get from profile metadata if still no userId
  if (!userId && profileId) {
    userId = await getUserIdFromProfileMetadata(profileId);
    if (userId) {
      console.log("[connectionService] ✅ Got userId from profile metadata:", userId);
      // Clean up pending_user_id after use
      await cleanupPendingUserId(profileId);
    }
  }

  // Try to get from existing connection if still no userId
  if (!userId && profileId) {
    try {
      const { data: connection } = await supabase
        .from("connected_accounts")
        .select("user_id")
        .eq("getlate_profile_id", profileId)
        .limit(1)
        .maybeSingle();

      if (connection?.user_id) {
        userId = connection.user_id;
        console.log("[connectionService] ✅ Got userId from existing connection:", userId);
      }
    } catch (dbError: any) {
      console.warn("[connectionService] Failed to lookup userId from database:", dbError.message);
    }
  }

  return { userId, user };
}

/**
 * Find existing connection by multiple criteria (for callback route)
 * Checks in order: profile_id (legacy), social_media_account_id, metadata.accountId, username
 */
export async function findExistingConnection(
  userId: string,
  provider: string,
  profileId: string | null,
  accountId: string | null,
  username: string | null
): Promise<any | null> {
  const {
    findConnectionByUserAndProfileId,
    findConnectionBySocialMediaAccountId,
    findConnectionsByUserPlatform,
    findConnectionByUsername
  } = await import("@/lib/services/db/connections");

  let existingConnection: any = null;

  // First check by profile_id WITHOUT platform filter (for legacy constraint)
  if (profileId) {
    existingConnection = await findConnectionByUserAndProfileId(userId, profileId);
    if (existingConnection) {
      console.log(`[connectionService] Found existing connection by profile_id: ${existingConnection.id}`);
      return existingConnection;
    }
  }

  // Check by social_media_account_id
  if (accountId) {
    existingConnection = await findConnectionBySocialMediaAccountId(userId, provider, accountId);
    if (existingConnection) {
      console.log(`[connectionService] Found existing connection by social_media_account_id: ${existingConnection.id}`);
      return existingConnection;
    }

    // Also check in profile_metadata.accountId (backward compatibility)
    const allConnections = await findConnectionsByUserPlatform(userId, provider);
    const foundByMetadata = allConnections.find((conn: any) =>
      conn.profile_metadata?.accountId === accountId
    );

    if (foundByMetadata) {
      console.log(`[connectionService] Found existing connection by metadata.accountId: ${foundByMetadata.id}`);
      return foundByMetadata;
    }
  }

  // Check by username if not found yet
  if (username) {
    existingConnection = await findConnectionByUsername(userId, provider, username);
    if (existingConnection) {
      console.log(`[connectionService] Found existing connection by username: ${existingConnection.id}`);
      return existingConnection;
    }
  }

  return null;
}

