/**
 * Service: Admin Cleanup Operations
 * 
 * Handles admin cleanup operations including:
 * - Finding inactive users
 * - Cleaning up inactive connections
 * - Updating profile metadata
 * - Job logging
 */

import { supabase } from "@/lib/supabase";
import { updateProfileMetadata } from "@/lib/services/db/profiles";
import { deleteConnection } from "@/lib/services/db/connections";

export interface InactiveUser {
  id: string;
  name: string;
  email: string;
  last_login_at: string | null;
  created_at: string;
}

export interface ConnectionWithProfile {
  id: string;
  user_id: string;
  platform: string;
  getlate_profile_id: string;
  getlate_profiles?: {
    id: string;
    late_profile_id: string;
    metadata: any;
  };
}

export interface CleanupResult {
  inactiveUsersCount: number;
  connectionsDeleted: number;
  profilesUpdated: number;
  cutoffDate: string;
  month: string;
}

/**
 * Find inactive users (haven't logged in for X days)
 */
export async function findInactiveUsers(
  inactiveDays: number
): Promise<InactiveUser[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, last_login_at, created_at")
    .or(`last_login_at.is.null,last_login_at.lt.${cutoffDate.toISOString()}`)
    .lt("created_at", cutoffDate.toISOString());

  if (error) {
    console.error("[admin/cleanup] Error fetching inactive users:", error);
    return [];
  }

  return data || [];
}

/**
 * Get connections for user IDs with profile information
 */
export async function getConnectionsForUsers(
  userIds: string[]
): Promise<ConnectionWithProfile[]> {
  const { data, error } = await supabase
    .from("connected_accounts")
    .select(`
      id,
      user_id,
      platform,
      getlate_profile_id,
      getlate_profiles(
        id,
        late_profile_id,
        metadata
      )
    `)
    .in("user_id", userIds);

  if (error) {
    console.error("[admin/cleanup] Error fetching connections:", error);
    return [];
  }

  const normalizedConnections: ConnectionWithProfile[] = (data || []).map((connection: any) => {
    const profileData = Array.isArray(connection.getlate_profiles)
      ? connection.getlate_profiles[0]
      : connection.getlate_profiles;

    return {
      id: connection.id,
      user_id: connection.user_id,
      platform: connection.platform,
      getlate_profile_id: connection.getlate_profile_id,
      getlate_profiles: profileData
        ? {
            id: String(profileData.id ?? ""),
            late_profile_id: String(profileData.late_profile_id ?? ""),
            metadata: profileData.metadata ?? {}
          }
        : undefined
    };
  });

  return normalizedConnections;
}

/**
 * Update profile metadata with disconnected platforms
 */
export async function updateProfileWithDisconnectedPlatforms(
  profileId: string,
  platforms: string[]
): Promise<boolean> {
  const { data: profile, error: fetchError } = await supabase
    .from("getlate_profiles")
    .select("metadata")
    .eq("id", profileId)
    .single();

  if (fetchError || !profile) {
    console.warn(`[admin/cleanup] Failed to fetch profile ${profileId}:`, fetchError);
    return false;
  }

  const currentMetadata = profile.metadata || {};
  const disconnectedPlatforms = new Set(currentMetadata.disconnected_platforms || []);
  const disconnectedAt = currentMetadata.disconnected_at || {};

  // Add platforms to disconnected list
  platforms.forEach(platform => {
    disconnectedPlatforms.add(platform);
    disconnectedAt[platform] = new Date().toISOString();
  });

  const updatedMetadata = {
    ...currentMetadata,
    disconnected_platforms: Array.from(disconnectedPlatforms),
    disconnected_at: disconnectedAt,
    // Remove platform from metadata if it was stored there
    platform: platforms.includes(currentMetadata.platform) ? null : currentMetadata.platform
  };

  return await updateProfileMetadata(profileId, updatedMetadata);
}

/**
 * Delete connections by IDs
 */
export async function deleteConnectionsByIds(connectionIds: string[]): Promise<boolean> {
  const { error } = await supabase
    .from("connected_accounts")
    .delete()
    .in("id", connectionIds);

  if (error) {
    console.error("[admin/cleanup] Error deleting connections:", error);
    return false;
  }

  return true;
}

/**
 * Log cleanup job
 */
export async function logCleanupJob(
  currentMonth: string,
  cutoffDate: Date,
  inactiveDays: number,
  status: 'processing' | 'completed' | 'failed',
  result?: CleanupResult,
  error?: string
): Promise<void> {
  if (status === 'processing') {
    await supabase.from("jobs").insert({
      job_type: "cleanup_inactive_connections",
      payload: {
        month: currentMonth,
        cutoffDate: cutoffDate.toISOString(),
        inactiveDays: inactiveDays
      },
      status: "processing"
    });
  } else if (status === 'completed' && result) {
    await supabase
      .from("jobs")
      .update({
        status: "completed",
        payload: {
          month: currentMonth,
          cutoffDate: cutoffDate.toISOString(),
          inactiveDays: inactiveDays,
          inactiveUsersCount: result.inactiveUsersCount,
          connectionsDeleted: result.connectionsDeleted,
          profilesUpdated: result.profilesUpdated
        }
      })
      .eq("job_type", "cleanup_inactive_connections")
      .eq("status", "processing")
      .order("created_at", { ascending: false })
      .limit(1);
  } else if (status === 'failed' && error) {
    await supabase
      .from("jobs")
      .update({
        status: "failed",
        last_error: error
      })
      .eq("job_type", "cleanup_inactive_connections")
      .eq("status", "processing")
      .order("created_at", { ascending: false })
      .limit(1);
  }
}

/**
 * Get inactive users statistics (without deleting)
 */
export async function getInactiveUsersStats(inactiveDays: number): Promise<{
  inactiveUsersCount: number;
  connectionsCount: number;
  cutoffDate: string;
}> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

  const inactiveUsers = await findInactiveUsers(inactiveDays);
  
  if (inactiveUsers.length === 0) {
    return {
      inactiveUsersCount: 0,
      connectionsCount: 0,
      cutoffDate: cutoffDate.toISOString()
    };
  }

  const userIds = inactiveUsers.map(u => u.id);
  const { count, error } = await supabase
    .from("connected_accounts")
    .select("*", { count: "exact", head: true })
    .in("user_id", userIds);

  if (error) {
    console.error("[admin/cleanup] Error counting connections:", error);
    return {
      inactiveUsersCount: inactiveUsers.length,
      connectionsCount: 0,
      cutoffDate: cutoffDate.toISOString()
    };
  }

  return {
    inactiveUsersCount: inactiveUsers.length,
    connectionsCount: count || 0,
    cutoffDate: cutoffDate.toISOString()
  };
}

/**
 * Check if cleanup job already ran this month
 */
export async function hasCleanupRunThisMonth(currentMonth: string): Promise<boolean> {
  const { data } = await supabase
    .from("jobs")
    .select("created_at")
    .eq("job_type", "cleanup_inactive_connections")
    .gte("created_at", `${currentMonth}-01T00:00:00Z`)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return !!data;
}

