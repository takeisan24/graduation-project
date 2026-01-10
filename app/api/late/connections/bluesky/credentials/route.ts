import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { fail, success } from "@/lib/response";
import { selectLateAccount, getLateClientForAccount } from "@/lib/services/late";
import { findProfileByLateId, upsertProfile } from "@/lib/services/db/profiles";
import { findConnectionByUserPlatform, updateConnection, createConnectionLegacy } from "@/lib/services/db/connections";

/**
 * POST /api/late/connections/bluesky/credentials
 * Connect Bluesky account using credentials (identifier/password)
 * According to getlate.dev docs: POST /v1/connect/bluesky/credentials
 * 
 * @param req - NextRequest with credentials in body
 * @returns Success response with connection details
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth(req);
    if (!user) {
      return fail("Unauthorized", 401);
    }

    const body = await req.json();
    const { identifier, password, profileId } = body;

    if (!identifier || !password) {
      return fail("identifier and password are required for Bluesky connection", 400);
    }

    // Select appropriate late.dev account
    const getlateAccount = await selectLateAccount("connect_social");
    if (!getlateAccount) {
      return fail("No available late.dev account for connecting social media. All accounts have reached their limits.", 503);
    }

    // Verify API key exists
    if (!getlateAccount.api_key || String(getlateAccount.api_key).trim().length === 0) {
      return fail("Late.dev account API key is missing", 500);
    }

    const lateClient = getLateClientForAccount(getlateAccount);

    // Determine profileId - use provided one or find/create one
    let finalProfileId = profileId;
    
    if (!finalProfileId) {
      // Try to find an existing profile without Bluesky connection
      const { findAnyProfileWithoutPlatform } = await import("@/lib/services/late");
      const availableProfile = await findAnyProfileWithoutPlatform("bluesky");
      
      if (availableProfile) {
        finalProfileId = availableProfile.late_profile_id;
        console.log(`[late/connections/bluesky/credentials] Using existing profile ${finalProfileId}`);
      } else {
        // Create a new profile if needed
        const { generateProfileName } = await import("@/lib/late/profileNameGenerator");
        const profileName = await generateProfileName();
        
        try {
          const newProfile = await lateClient.createProfile(profileName, `Auto-created profile for Bluesky connection`);
          finalProfileId = newProfile.id || newProfile._id || newProfile.profile_id || newProfile.profileId || 
                          newProfile.profile?.id || newProfile.profile?._id;
          
          if (!finalProfileId) {
            return fail("Failed to create profile: No ID returned from late.dev", 500);
          }
          
          console.log(`[late/connections/bluesky/credentials] Created new profile ${finalProfileId}`);
        } catch (createError: any) {
          return fail(`Failed to create profile: ${createError.message}`, 500);
        }
      }
    }

    // Connect Bluesky using credentials
    console.log(`[late/connections/bluesky/credentials] Connecting Bluesky account with identifier: ${identifier.substring(0, 5)}...`);
    
    const connectionResult = await lateClient.connectBlueskyWithCredentials(finalProfileId, {
      identifier,
      password
    });

    console.log(`[late/connections/bluesky/credentials] Successfully connected Bluesky account`);

    // Get profile info to extract account details
    let accountId: string | null = null;
    let username: string | null = null;
    
    try {
      const profileInfo = await lateClient.getProfileInfo(finalProfileId);
      accountId = lateClient.extractAccountId(profileInfo, "bluesky");
      username = profileInfo.username || profileInfo.handle || identifier;
      
      // Update or create getlate_profiles record via service layer
      let profileRecord = await findProfileByLateId(finalProfileId);
      let getlateProfileId: string | null = null;

      if (profileRecord) {
        // Update existing profile metadata via service layer
        const { updateProfileMetadata } = await import("@/lib/services/db/profiles");
        await updateProfileMetadata(profileRecord.id, {
          ...profileInfo,
          synced_at: new Date().toISOString()
        });
        getlateProfileId = profileRecord.id;
      } else {
        // Create new profile record via service layer
        const { generateProfileName } = await import("@/lib/late/profileNameGenerator");
        const autoProfileName = await generateProfileName();
        
        profileRecord = await upsertProfile({
          getlate_account_id: getlateAccount.id,
          late_profile_id: finalProfileId,
          profile_name: autoProfileName,
          metadata: {
            ...profileInfo,
            synced_at: new Date().toISOString()
          }
        });
        if (profileRecord) {
          getlateProfileId = profileRecord.id;
        }
      }

      // Create or update connected_accounts record via service layer
      const existingConnection = await findConnectionByUserPlatform(user.id, "bluesky");

      const connectionData = {
        user_id: user.id,
        platform: "bluesky",
        profile_id: accountId || identifier,
        profile_name: username || identifier,
        late_profile_id: finalProfileId,
        social_media_account_id: accountId || null, // ID của social media account connection trên getlate.dev (cần để disconnect)
        profile_metadata: {
          late_profile_id: finalProfileId,
          username: username || identifier,
          identifier,
          platform: "bluesky",
          accountId, // Giữ lại trong metadata để backward compatibility
          ...connectionResult
        },
        // updated_at will be set by database trigger (UTC)
      };

      if (existingConnection) {
        // Update existing connection via service layer
        await updateConnection(existingConnection.id, connectionData);
      } else {
        // Create new connection - use createConnection if we have getlate_profile_id, otherwise use createConnectionLegacy
        if (getlateProfileId && profileRecord) {
          const { createConnection } = await import("@/lib/services/db/connections");
          await createConnection({
            user_id: user.id,
            getlate_profile_id: getlateProfileId,
            getlate_account_id: getlateAccount.id,
            platform: "bluesky",
            profile_id: accountId || identifier,
            profile_name: username || identifier,
            late_profile_id: finalProfileId,
            social_media_account_id: accountId || null,
            profile_metadata: connectionData.profile_metadata
          });
        } else {
          // Fallback to legacy format if profile not created
          const { createConnectionLegacy } = await import("@/lib/services/db/connections");
          await createConnectionLegacy({
            user_id: user.id,
            platform: "bluesky",
            profile_id: accountId || identifier,
            profile_name: username || identifier,
            access_token: "", // No token for credentials-based connection
            profile_metadata: connectionData.profile_metadata
          } as any);
        }
      }

      // Increment account usage
      try {
        const { incrementAccountUsage } = await import("@/lib/services/late");
        await incrementAccountUsage(getlateAccount.id, "connect_social");
      } catch (usageError: any) {
        console.warn("[late/connections/bluesky/credentials] Failed to increment account usage:", usageError);
      }

      return success({
        success: true,
        message: "Bluesky account connected successfully",
        accountId,
        username: username || identifier,
        profileId: finalProfileId
      });
    } catch (profileError: any) {
      console.warn("[late/connections/bluesky/credentials] Failed to get profile info (non-fatal):", profileError.message);
      // Still return success if connection was successful
      return success({
        success: true,
        message: "Bluesky account connected successfully",
        profileId: finalProfileId,
        note: "Profile info retrieval failed, but connection was successful"
      });
    }
  } catch (error: any) {
    console.error("[late/connections/bluesky/credentials] Error:", error);
    return fail(error.message || "Failed to connect Bluesky account", 500);
  }
}

