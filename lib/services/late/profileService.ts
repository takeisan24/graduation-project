/**
 * Service: Late.dev Profile Management
 * 
 * Business logic for managing late.dev profiles
 * Refactored to reduce if-else nesting
 */

import { supabase } from "@/lib/supabase";
import { LateClient } from "@/lib/late/client";
import { 
  getProfilesByAccountId, 
  createProfile, 
  deleteProfileByLateId,
  deleteProfilesByLateIds
} from "@/lib/services/db/profiles";

/**
 * Sync and cleanup profiles from late.dev API
 */
export async function syncAndCleanupProfiles(
  accountId: string,
  apiKey: string
): Promise<{
  syncedCount: number;
  deletedCount: number;
  profileIds: string[];
}> {
  try {
    const lateClient = new LateClient(apiKey);
    const profilesResponse = await lateClient.listProfiles();
    
    const profiles = normalizeProfilesResponse(profilesResponse);
    const profileIdsFromLateDev = extractProfileIds(profiles);
    
    console.log(`[late/profileService] Found ${profileIdsFromLateDev.length} profile(s) in late.dev API for account ${accountId}`);
    
    const dbProfiles = await getProfilesByAccountId(accountId);
    const dbProfileIds = dbProfiles.map(p => p.late_profile_id);
    
    const deletedCount = await deleteStaleProfiles(dbProfileIds, profileIdsFromLateDev);
    const syncedCount = await syncNewProfiles(profiles, accountId, dbProfileIds);
    
    return {
      syncedCount,
      deletedCount,
      profileIds: profileIdsFromLateDev
    };
  } catch (error: any) {
    console.error(`[late/profileService] Error syncing and cleaning up profiles:`, error);
    return { syncedCount: 0, deletedCount: 0, profileIds: [] };
  }
}

/**
 * Normalize profiles response from late.dev API
 */
function normalizeProfilesResponse(profilesResponse: any): any[] {
  if (Array.isArray(profilesResponse)) {
    return profilesResponse;
  }
  return profilesResponse.profiles || [];
}

/**
 * Extract profile IDs from profiles array
 */
function extractProfileIds(profiles: any[]): string[] {
  return profiles
    .map((p: any) => String(p.id || p._id || p.profile_id || p.profileId))
    .filter(Boolean);
}

/**
 * Delete stale profiles from DB
 */
async function deleteStaleProfiles(
  dbProfileIds: string[],
  profileIdsFromLateDev: string[]
): Promise<number> {
  const staleProfileIds = dbProfileIds.filter(
    dbId => !profileIdsFromLateDev.includes(dbId)
  );
  
  if (staleProfileIds.length === 0) {
    return 0;
  }
  
  const deletedCount = await deleteProfilesByLateIds(staleProfileIds);
  console.log(`[late/profileService] Deleted ${deletedCount} stale profile(s) from DB`);
  
  return deletedCount;
}

/**
 * Sync new profiles from late.dev to DB
 */
async function syncNewProfiles(
  profiles: any[],
  accountId: string,
  dbProfileIds: string[]
): Promise<number> {
  let syncedCount = 0;
  
  for (const profile of profiles) {
    const profileId = String(profile.id || profile._id || profile.profile_id || profile.profileId);
    
    if (dbProfileIds.includes(profileId)) {
      continue; // Already exists in DB
    }
    
    try {
      await createProfile({
        getlate_account_id: accountId,
        late_profile_id: profileId,
        profile_name: profile.name || profile.profile_name || null,
        description: profile.description || null,
        metadata: {
          synced_at: new Date().toISOString(),
          synced_from: "late.dev_api"
        }
      });
      
      syncedCount++;
      console.log(`[late/profileService] Synced profile ${profileId} from late.dev API`);
    } catch (error: any) {
      console.warn(`[late/profileService] Failed to sync profile ${profileId}:`, error);
    }
  }
  
  console.log(`[late/profileService] Synced ${syncedCount} profile(s) from late.dev API`);
  return syncedCount;
}

/**
 * Find profile without platform for a specific account
 */
export async function findProfileWithoutPlatformForAccount(
  accountId: string,
  platform: string
) {
  const profiles = await getProfilesByAccountId(accountId);
  
  for (const profile of profiles) {
    const { supabase } = await import("@/lib/supabase");
    const { data: connections } = await supabase
      .from("connected_accounts")
      .select("platform")
      .eq("getlate_profile_id", profile.id)
      .eq("platform", platform)
      .limit(1);
    
    if (!connections || connections.length === 0) {
      return {
        id: profile.id,
        late_profile_id: profile.late_profile_id,
        profile_name: profile.profile_name,
        platform: profile.metadata?.platform || null
      };
    }
  }
  
  return null;
}

/**
 * Find any profile (across all accounts) that hasn't connected a specific platform yet
 * Refactored: Uses join query to reduce nested checks
 */
export async function findProfileWithoutPlatform(platform: string) {
  const { data: allProfiles, error } = await supabase
    .from("getlate_profiles")
    .select(`
      id,
      late_profile_id,
      profile_name,
      getlate_account_id,
      metadata,
      connected_accounts(platform)
    `);
  
  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
      console.warn("[late/profileService] Table 'getlate_profiles' not found in database.");
      return null;
    }
    console.error("[late/profileService] Error fetching profiles:", error);
    return null;
  }
  
  if (!allProfiles || allProfiles.length === 0) {
    return null;
  }
  
  // Find first profile without this platform connection
  for (const profile of allProfiles) {
    const connectedAccounts = (profile as any).connected_accounts || [];
    const connectedPlatforms = connectedAccounts
      .map((acc: any) => acc?.platform)
      .filter(Boolean);
    
    if (!connectedPlatforms.includes(platform)) {
      return {
        id: profile.id,
        late_profile_id: profile.late_profile_id,
        profile_name: profile.profile_name,
        platform: profile.metadata?.platform || null,
        getlate_account_id: profile.getlate_account_id,
        metadata: profile.metadata || {}
      };
    }
  }
  
  return null; // All profiles have this platform connected
}

/**
 * Get platform usage summary for an account
 */
export async function getPlatformUsageSummary(accountId: string) {
  const profiles = await getProfilesByAccountId(accountId);
  
  // Get connected platforms for each profile
  const profilesWithConnections = await Promise.all(
    profiles.map(async (profile) => {
      const { supabase } = await import("@/lib/supabase");
      const { data: connections } = await supabase
        .from("connected_accounts")
        .select("platform")
        .eq("getlate_profile_id", profile.id)
        .not("platform", "is", null);
      
      const connectedPlatforms = (connections || []).map((conn: any) => conn.platform).filter(Boolean);
      
      return {
        id: profile.id,
        late_profile_id: profile.late_profile_id,
        profile_name: profile.profile_name,
        connected_platforms: connectedPlatforms
      };
    })
  );
  
  // Get all unique connected platforms
  const allConnectedPlatforms = new Set<string>();
  profilesWithConnections.forEach((profile) => {
    profile.connected_platforms.forEach((platform) => allConnectedPlatforms.add(platform));
  });
  
  // Common platforms that can be connected
  const commonPlatforms = [
    "instagram",
    "facebook",
    "twitter",
    "linkedin",
    "tiktok",
    "youtube",
    "pinterest",
    "threads"
  ];
  
  // Find platforms that are not yet connected to all profiles
  const availablePlatforms = commonPlatforms.filter((platform) => {
    return profilesWithConnections.some((profile) => !profile.connected_platforms.includes(platform));
  });
  
  // For each profile, find available platforms
  const profilesWithAvailability = profilesWithConnections.map((profile) => ({
    id: profile.id,
    late_profile_id: profile.late_profile_id,
    profile_name: profile.profile_name,
    connected_platforms: profile.connected_platforms,
    available_platforms: commonPlatforms.filter(
      (platform) => !profile.connected_platforms.includes(platform)
    )
  }));
  
  return {
    connected_platforms: Array.from(allConnectedPlatforms),
    available_platforms: availablePlatforms,
    profiles: profilesWithAvailability
  };
}

