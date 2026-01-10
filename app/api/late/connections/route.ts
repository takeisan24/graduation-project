import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { findConnectionsWithLateProfiles, findConnectionById, deleteConnection, updateConnection, findConnectionsByUserId } from "@/lib/services/db/connections";
import { updateProfileMetadata } from "@/lib/services/db/profiles";
import { getLateClientForAccount } from "@/lib/services/late";

/**
 * GET /api/late/connections
 * Get all social media connections managed via late.dev for the authenticated user
 * 
 * Returns list of connected accounts with their status and metadata
 * 
 * @param req - NextRequest with Authorization header
 * @returns JSON array of connected accounts
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth(req);
    if (!user) {
      return fail("Unauthorized", 401);
    }

    // Fetch all connected accounts for this user via service layer
    // Filter by platform to only show late.dev-managed connections
    // const connections = await findConnectionsWithLateProfiles(user.id);
    const connections = await findConnectionsByUserId(user.id);

    try {
      console.log(`[late/connections] user=${user.id} fetched ${connections?.length || 0} connection(s)`);
    } catch {}

    // Return connections (tokens are encrypted, so we don't expose them)
    return success({
      connections: connections || [],
      count: connections?.length || 0,
    });

  } catch (err: any) {
    console.error("[late/connections] Error:", err);
    return fail(err.message || "Server error", 500);
  }
}

/**
 * DELETE /api/late/connections
 * Disconnect a social media account connection managed via late.dev
 * 
 * @param req - NextRequest with connection ID in body
 * @returns JSON success response
 */
export async function DELETE(req: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth(req);
    if (!user) {
      return fail("Unauthorized", 401);
    }

    const body = await req.json();
    const { connectionId } = body;

    if (!connectionId) {
      return fail("connectionId is required", 400);
    }

    // Verify connection belongs to user before deleting via service layer
    const connection = await findConnectionById(connectionId);
    
    if (!connection || connection.user_id !== user.id) {
      return fail("Connection not found or access denied", 404);
    }
    
    // Get getlate_profile info separately if needed via service layer
    let getlateProfile: any = null;
    if (connection.getlate_profile_id) {
      const { findProfileByIdWithAccount } = await import("@/lib/services/db/profiles");
      getlateProfile = await findProfileByIdWithAccount(connection.getlate_profile_id);
    }

    const platform = connection.platform;

    // Step 1: Disconnect from late.dev API (if profile exists)
    // IMPORTANT: We DO NOT delete profiles from late.dev API - profiles are shared resources
    // We only disconnect the social media platform from the profile
    // According to getlate.dev docs: DELETE /v1/accounts/[accountId]
    if (getlateProfile?.late_profile_id && getlateProfile?.getlate_accounts?.api_key) {
      try {
        // Convert account to LateAccountWithLimits format
        const lateAccount = {
          id: getlateProfile.getlate_account_id,
          account_name: null,
          api_key: getlateProfile.getlate_accounts.api_key,
          client_id: null,
          client_secret: null,
          webhook_secret: null,
          is_active: true,
          limits: {},
          metadata: {}
        };
        const lateClient = getLateClientForAccount(lateAccount as any);
        
        // First, try to get accountId from connection's social_media_account_id (trường mới, ưu tiên)
        // accountId là ID của social media account connection trên getlate.dev (cần để disconnect)
        let accountId: string | null = connection.social_media_account_id || null;
        
        // Fallback: try to get from profile_metadata (backward compatibility)
        if (!accountId) {
          accountId = connection.profile_metadata?.accountId || null;
        }
        
        // If not found in DB, try to extract from late.dev API
        if (!accountId) {
          try {
            const profileInfo = await lateClient.getProfileInfo(getlateProfile.late_profile_id);
            accountId = lateClient.extractAccountId(profileInfo, platform);
            
            if (accountId) {
              console.log(`[late/connections] Extracted accountId from late.dev API:`, accountId);
              // Update connection metadata with extracted accountId for future use via service layer
              try {
                await updateConnection(connectionId, {
                  profile_metadata: {
                    ...(connection.profile_metadata || {}),
                    accountId: accountId
                  } as any
                });
                console.log(`[late/connections] Updated connection metadata with accountId`);
              } catch (updateError: any) {
                console.warn(`[late/connections] Failed to update connection metadata with accountId (non-fatal):`, updateError.message);
              }
            } else {
              // Try to get accountId from connection's profile_id as last resort
              accountId = connection.profile_id || null;
              
              if (!accountId) {
                console.warn(`[late/connections] Could not find accountId for platform ${platform} in profile ${getlateProfile.late_profile_id}`);
                console.warn(`[late/connections] Profile info:`, JSON.stringify(profileInfo, null, 2));
                throw new Error(`Account ID not found for platform ${platform}`);
              }
            }
          } catch (profileError: any) {
            console.warn(`[late/connections] Failed to get profile info to extract accountId:`, profileError.message);
            // Try to use profile_id from connection as fallback
            accountId = connection.profile_id || null;
            if (!accountId) {
              throw new Error(`Could not determine accountId: ${profileError.message}`);
            }
          }
        } else {
          console.log(`[late/connections] Using accountId from connection metadata:`, accountId);
        }
        
        console.log(`[late/connections] Disconnecting account ${accountId} (platform: ${platform}) from late.dev profile ${getlateProfile.late_profile_id}`);
        
        // Call late.dev API to disconnect the social media account
        // According to docs: DELETE /v1/accounts/[accountId]
        await lateClient.disconnectSocialMedia(accountId);
        
        console.log(`[late/connections] Successfully disconnected account ${accountId} from late.dev`);
      } catch (disconnectError: any) {
        // Log detailed error for debugging
        console.warn(`[late/connections] Failed to disconnect ${platform} from late.dev (non-fatal, continuing with DB deletion):`, {
          error: disconnectError.message,
          profileId: getlateProfile.late_profile_id,
          platform,
          note: "Connection removed from local DB but may still appear in getlate.dev dashboard."
        });
        // Non-fatal: continue with DB deletion even if late.dev disconnect fails
        // The connection will be removed from our system but may still show in late.dev dashboard
        // User will need to disconnect manually from getlate.dev dashboard if needed
      }
    }

    // Step 2: Update getlate_profiles metadata to track disconnected platforms
    if (getlateProfile?.id) {
      const currentMetadata = getlateProfile.metadata || {};
      const disconnectedPlatforms = currentMetadata.disconnected_platforms || [];
      
      // Add this platform to disconnected list if not already there
      if (!disconnectedPlatforms.includes(platform)) {
        disconnectedPlatforms.push(platform);
      }

      // Remove platform from connected platforms list in metadata
      const updatedMetadata = {
        ...currentMetadata,
        disconnected_platforms: disconnectedPlatforms,
        disconnected_at: {
          ...(currentMetadata.disconnected_at || {}),
          [platform]: new Date().toISOString()
        },
        // Remove platform from metadata if it was stored there
        platform: currentMetadata.platform === platform ? null : currentMetadata.platform
      };

      // Update getlate_profiles metadata via service layer
      const updated = await updateProfileMetadata(getlateProfile.id, updatedMetadata);
      
      if (!updated) {
        console.warn("[late/connections] Failed to update getlate_profiles metadata (non-fatal)");
        // Non-fatal: continue with connection deletion
      }
    }

    // Step 3: Delete connection from connected_accounts via service layer
    const deleted = await deleteConnection(connectionId, user.id);
    
    if (!deleted) {
      console.error("[late/connections] Delete failed");
      return fail("Failed to delete connection", 500);
    }

    // Step 4: Decrement account usage (if we track connections)
    // Note: We don't currently track connection count in limits, but we could add this
    // For now, we'll just log the disconnection

    return success({
      message: `Disconnected ${platform}`,
      connectionId,
      platform,
    });

  } catch (err: any) {
    console.error("[late/connections] Error:", err);
    return fail(err.message || "Server error", 500);
  }
}

