import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { createLateClient } from "@/lib/late/client";
import { decryptToken } from "@/lib/crypto";
import { 
  selectLateAccount, 
  getLateClientForAccount, 
  incrementAccountUsage 
} from "@/lib/services/late";
import { findConnectionsWithLateProfiles, findConnectionById, updateConnection } from "@/lib/services/db/connections";
import { upsertProfile } from "@/lib/services/db/profiles";

/**
 * POST /api/late/profiles
 * Create a Late.dev profile for a connected social media account
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const body = await req.json();
    const { connectedAccountId } = body;

    if (!connectedAccountId) {
      return fail("connectedAccountId is required", 400);
    }

    // Get the connected account via service layer
    const connectedAccount = await findConnectionById(connectedAccountId);
    
    if (!connectedAccount || connectedAccount.user_id !== user.id) {
      return fail("Connected account not found", 404);
    }

    // Check if profile already exists
    if (connectedAccount.late_profile_id) {
      return fail("Late.dev profile already exists for this account", 400);
    }

    // Decrypt access token (tokens are stored encrypted in database)
    if (!connectedAccount.access_token) {
      return fail("Access token not found. Please reconnect your account.", 400);
    }
    
    let accessToken: string;
    try {
      accessToken = decryptToken(connectedAccount.access_token);
    } catch (e: any) {
      console.error("[late/profiles] Failed to decrypt access token:", e);
      return fail("Failed to decrypt access token. Please reconnect your account.", 500);
    }

    // Select appropriate late.dev account for creating profile
    const getlateAccount = await selectLateAccount("create_profile");
    if (!getlateAccount) {
      return fail("No available late.dev account for creating profile. All accounts have reached their limits.", 503);
    }

    // Create Late.dev profile using selected account
    const lateClient = getLateClientForAccount(getlateAccount);
    try {
      const hasKey = !!(getlateAccount.api_key && String(getlateAccount.api_key).trim().length > 0);
      console.log(`[late/profiles] Using getlate_account ${getlateAccount.id}. api_key_present=${hasKey}`);
    } catch {}
    
    try {
      const lateProfile = await lateClient.createProfileWithAccessToken(
        accessToken,
        connectedAccount.platform
      );
      
      // Ensure we have a valid profile ID
      if (!lateProfile?.id) {
        return fail("late.dev profile created but no profile ID returned", 500);
      }

      const profileId = lateProfile.id;
      
      // Generate profile name in format: PN_{số thứ tự}_{random 7 ký tự}
      const { generateProfileName } = await import("@/lib/late/profileNameGenerator");
      const autoProfileName = await generateProfileName();
      
      const profileName = autoProfileName; // Use generated name instead of late.dev's name

      // Step 1: Fetch full profile info to get social media account IDs
      let fullProfileInfo: any = null;
      try {
        fullProfileInfo = await lateClient.getProfileInfo(profileId);
      } catch (e: any) {
        console.warn("[late/profiles] Failed to fetch full profile info:", e);
        // Non-fatal: continue with basic profile info
      }

      // Step 2: Create or update getlate_profiles record via service layer
      // Store platform, username, avatar_url, verified, followers_count in metadata
      const getlateProfile = await upsertProfile({
        getlate_account_id: getlateAccount.id,
        late_profile_id: profileId,
        profile_name: profileName,
        description: fullProfileInfo?.description || null,
        social_media_ids: fullProfileInfo?.social_media_ids || fullProfileInfo?.account_ids || {},
        metadata: {
          platform: connectedAccount.platform, // The platform this profile is for
          username: fullProfileInfo?.username || null,
          avatar_url: fullProfileInfo?.avatar_url || null,
          verified: fullProfileInfo?.verified || false,
          followers_count: fullProfileInfo?.followers_count || null,
          // created_at will be set by database default (UTC)
          created_via: "manual_profile_creation",
          ...(fullProfileInfo?.metadata || {})
        }
      });

      if (!getlateProfile) {
        console.error("[late/profiles] Failed to create/update getlate_profiles");
        return fail("Failed to save getlate profile to database", 500);
      }

      // Step 3: Update connected_accounts with reference to getlate_profiles via service layer
      // Get getlate_account_id from getlateProfile or getlateAccount
      const accountIdForUpdate = getlateProfile.getlate_account_id || getlateAccount.id;
      
      const updated = await updateConnection(connectedAccountId, {
        getlate_profile_id: getlateProfile.id, // Reference to getlate_profiles
        getlate_account_id: accountIdForUpdate !== "env-fallback" ? accountIdForUpdate : null, // Reference to getlate_accounts
        late_profile_id: profileId, // Legacy: keep for backward compatibility
        profile_metadata: {
          ...connectedAccount.profile_metadata,
          late_profile_id: profileId,
          late_profile_name: profileName,
          platform: connectedAccount.platform,
          social_media_ids: (getlateProfile as any).social_media_ids,
          metadata: getlateProfile.metadata,
          getlate_account_id: accountIdForUpdate !== "env-fallback" ? accountIdForUpdate : null
        } // Legacy: keep for backward compatibility
        // updated_at will be set by database trigger (UTC)
      });

      if (!updated) {
        console.error("[late/profiles] Error updating connected account");
        return fail("Failed to update connected account", 500);
      }

      // Step 4: Increment account usage for profile creation
      try {
        await incrementAccountUsage(getlateAccount.id, "create_profile");
      } catch (usageError: any) {
        console.warn("[late/profiles] Failed to increment account usage:", usageError);
        // Non-fatal: continue
      }

      return success({
        lateProfile,
        getlateProfile,
        connectedAccount: {
          ...connectedAccount,
          late_profile_id: profileId,
          getlate_profile_id: getlateProfile.id
        },
        message: `Late.dev profile created for ${connectedAccount.platform}`
      });

    } catch (lateError: any) {
      console.error("Late.dev profile creation error:", lateError);
      return fail(`Failed to create Late.dev profile: ${lateError.message}`, 500);
    }

  } catch (err: any) {
    console.error("POST /api/late/profiles error:", err);
    return fail(err.message || "Server error", 500);
  }
}

/**
 * GET /api/late/profiles
 * Get all Late.dev profiles for user's connected accounts
 * 
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    // Get connected accounts with Late.dev profiles via service layer
    const connectedAccounts = await findConnectionsWithLateProfiles(user.id);

    return success({
      profiles: connectedAccounts,
      count: connectedAccounts.length
    });

  } catch (err: any) {
    console.error("GET /api/late/profiles error:", err);
    return fail(err.message || "Server error", 500);
  }
}
