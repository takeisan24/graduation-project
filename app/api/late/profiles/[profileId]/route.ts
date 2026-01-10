import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { createLateClient } from "@/lib/late/client";
import { findConnectionByLateProfileId, updateConnection } from "@/lib/services/db/connections";

/**
 * GET /api/late/profiles/[profileId]
 * Get profile information from late.dev including social media account IDs
 * 
 * Fetches full profile details from late.dev and updates local database
 * 
 * @param req - NextRequest with profileId in params
 * @returns Profile information with social media IDs
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { profileId: string } }
) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const { profileId } = params;

    // Verify profile belongs to user via service layer
    const connection = await findConnectionByLateProfileId(profileId, user.id);
    
    if (!connection) {
      return fail("Profile not found or access denied", 404);
    }

    // Fetch profile info from late.dev
    const lateClient = createLateClient();
    let profileInfo: any;
    try {
      profileInfo = await lateClient.getProfileInfo(profileId);
    } catch (lateError: any) {
      console.error("[late/profiles] Failed to fetch profile from late.dev:", lateError);
      return fail(`Failed to fetch profile from late.dev: ${lateError.message}`, 500);
    }

    // Update profile metadata in database
    const profileMetadata = {
      late_profile_id: profileInfo.id,
      late_profile_name: profileInfo.name || profileInfo.username,
      platform: profileInfo.platform || connection.platform,
      social_media_ids: profileInfo.social_media_ids || profileInfo.account_ids || {},
      metadata: {
        provider: profileInfo.provider,
        username: profileInfo.username,
        avatar_url: profileInfo.avatar_url,
        verified: profileInfo.verified,
        followers_count: profileInfo.followers_count,
        ...(profileInfo.metadata || {})
      }
    };

    // Update connection with latest profile metadata via service layer
    const updated = await updateConnection(connection.id, {
      profile_metadata: profileMetadata as any
      // updated_at will be set by database trigger (UTC)
    });

    if (!updated) {
      console.warn("[late/profiles] Failed to update profile metadata");
      // Non-fatal: continue to return profile info
    }

    return success({
      profile: profileInfo,
      metadata: profileMetadata,
      connection: {
        id: connection.id,
        platform: connection.platform,
        profile_name: connection.profile_name
      }
    });

  } catch (err: any) {
    console.error("[late/profiles] Error:", err);
    return fail(err.message || "Server error", 500);
  }
}

