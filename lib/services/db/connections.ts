/**
 * Database Service: Connections
 * 
 * Handles all database operations related to connected_accounts table
 * 
 * @module db/connections
 */

import { supabase } from "@/lib/supabase";

/**
 * Joined getlate_profiles data shape (from Supabase relation joins)
 */
export interface GetlateProfileJoin {
  id: string;
  getlate_account_id: string;
  late_profile_id: string;
  social_media_ids: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  profile_name?: string | null;
}

/**
 * Connection metadata stored in profile_metadata JSONB column
 * Contains social media account information
 */
export interface ConnectionMetadata {
  /** Social media account ID on getlate.dev */
  accountId?: string;
  /** Stable platform-level user identifier (e.g. YouTube channel ID, Facebook page ID) */
  platform_user_id?: string;
  /** Profile avatar URL */
  avatar_url?: string;
  /** Username/handle on the platform */
  username?: string;
  /** Email address (if available) */
  email?: string;
  /** Whether account is verified */
  verified?: boolean;
  /** Number of followers */
  followers_count?: number;
  /** Additional metadata fields */
  [key: string]: unknown;
}

/**
 * Connection record from connected_accounts table
 * Represents a social media account connection for a user
 */
export interface Connection {
  id: string;
  user_id: string;
  getlate_profile_id: string | null;
  getlate_account_id: string | null;
  platform: string;
  profile_id: string | null;
  profile_name: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  late_profile_id: string | null;
  social_media_account_id: string | null;
  profile_metadata: ConnectionMetadata;
  /** Connection provider: 'late' (via Late.dev) or 'native' (direct OAuth) */
  connection_provider: 'late' | 'native' | null;
  created_at: string;
  updated_at: string;
}

/**
 * Find connection by ID
 * 
 * Retrieves a single connection by its ID.
 * 
 * @param {string} id - Connection ID
 * @returns {Promise<Connection | null>} Connection object or null if not found/error
 * 
 * @example
 * ```typescript
 * const connection = await findConnectionById('conn_123');
 * ```
 */
export async function findConnectionById(id: string): Promise<Connection | null> {
  const { data, error } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  
  if (error) {
    console.error("[db/connections] Error finding connection:", error);
    return null;
  }
  
  return data;
}

/**
 * Find connection by user_id and getlate_profile_id
 * 
 * Finds a connection for a specific user and getlate profile.
 * Optionally filters by platform.
 * 
 * @param {string} userId - User ID
 * @param {string} getlateProfileId - Getlate profile ID
 * @param {string} [platform] - Optional platform filter
 * @returns {Promise<Connection | null>} Connection object or null if not found/error
 * 
 * @example
 * ```typescript
 * const connection = await findConnectionByUserAndProfile('user_123', 'profile_456', 'twitter');
 * ```
 */
export async function findConnectionByUserAndProfile(
  userId: string,
  getlateProfileId: string,
  platform?: string
): Promise<Connection | null> {
  let query = supabase
    .from("connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("getlate_profile_id", getlateProfileId);
  
  if (platform) {
    query = query.eq("platform", platform);
  }
  
  const { data, error } = await query.maybeSingle();
  
  if (error) {
    console.error("[db/connections] Error finding connection:", error);
    return null;
  }
  
  return data;
}

/**
 * Find all connections by user ID
 * 
 * Retrieves social media connections for a specific user.
 * 
 * Optimized for scale: Includes reasonable limit to prevent loading too many connections.
 * Most users won't have more than 50-100 connections, so default limit is 100.
 * 
 * @param {string} userId - User ID
 * @param {object} options - Query options
 * @param {number} options.limit - Maximum number of connections (default: 100)
 * @returns {Promise<Connection[]>} Array of connections, empty array on error
 * 
 * @example
 * ```typescript
 * const connections = await findConnectionsByUserId('user_123', { limit: 50 });
 * ```
 */
export async function findConnectionsByUserId(
  userId: string,
  options?: { limit?: number }
): Promise<Connection[]> {
  const limit = options?.limit ?? 100; // Default limit: 100 connections
  
  const { data, error } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error("[db/connections] Error finding connections:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Find connections by user ID with Late.dev profiles
 * 
 * Retrieves connections that have a late_profile_id (are connected to Late.dev).
 * Ordered by created_at descending (most recent first).
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Connection[]>} Array of connections with Late.dev profiles, empty array on error
 * 
 * @example
 * ```typescript
 * const connections = await findConnectionsWithLateProfiles('user_123');
 * ```
 */
export async function findConnectionsWithLateProfiles(userId: string): Promise<Connection[]> {
  const { data, error } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .not("late_profile_id", "is", null)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("[db/connections] Error finding connections with late profiles:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Find connection by user_id and profile_id (legacy)
 */
export async function findConnectionByUserAndProfileId(
  userId: string,
  profileId: string
): Promise<Connection | null> {
  const { data, error } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("profile_id", profileId)
    .maybeSingle();
  
  if (error) {
    console.error("[db/connections] Error finding connection:", error);
    return null;
  }
  
  return data;
}

/**
 * Create new connection
 */
export async function createConnection(data: {
  user_id: string;
  getlate_profile_id: string;
  getlate_account_id: string;
  platform: string;
  profile_id?: string | null;
  profile_name?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: string | null;
  late_profile_id?: string | null;
  social_media_account_id?: string | null;
  profile_metadata?: ConnectionMetadata;
  connection_provider?: 'late' | 'native' | null;
}): Promise<Connection | null> {
  const { data: connection, error } = await supabase
    .from("connected_accounts")
    .insert({
      user_id: data.user_id,
      getlate_profile_id: data.getlate_profile_id,
      getlate_account_id: data.getlate_account_id,
      platform: data.platform,
      profile_id: data.profile_id || null,
      profile_name: data.profile_name || null,
      access_token: data.access_token || null,
      refresh_token: data.refresh_token || null,
      expires_at: data.expires_at || null,
      late_profile_id: data.late_profile_id || null,
      social_media_account_id: data.social_media_account_id || null,
      profile_metadata: data.profile_metadata || {},
      connection_provider: data.connection_provider || 'late'
    })
    .select()
    .single();
  
  if (error) {
    console.error("[db/connections] Error creating connection:", error);
    return null;
  }
  
  return connection;
}

/**
 * Update connection
 */
export async function updateConnection(
  id: string,
  updates: Partial<Connection>
): Promise<boolean> {
  const { error } = await supabase
    .from("connected_accounts")
    .update(updates)
    .eq("id", id);
  
  if (error) {
    console.error("[db/connections] Error updating connection:", error);
    return false;
  }
  
  return true;
}

/**
 * Delete connection
 */
export async function deleteConnection(id: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("connected_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  
  if (error) {
    console.error("[db/connections] Error deleting connection:", error);
    return false;
  }
  
  return true;
}

/**
 * Get connections by getlate_profile_id
 */
export async function getConnectionsByProfileId(getlateProfileId: string): Promise<Connection[]> {
  const { data, error } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("getlate_profile_id", getlateProfileId);
  
  if (error) {
    console.error("[db/connections] Error getting connections by profile:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Find connections by IDs (for batch lookup)
 * Returns minimal connection data for quick lookups
 */
export async function findConnectionsByIds(ids: string[], userId: string): Promise<Pick<Connection, 'id' | 'profile_id' | 'platform' | 'user_id' | 'profile_name' | 'profile_metadata'>[]> {
  if (ids.length === 0) return [];
  
  const { data, error } = await supabase
    .from("connected_accounts")
    .select("id, profile_id, platform, user_id, profile_name, profile_metadata")
    .in("id", ids)
    .eq("user_id", userId);
  
  if (error) {
    console.error("[db/connections] Error finding connections by IDs:", error);
    return [];
  }
  
  return data as Pick<Connection, 'id' | 'profile_id' | 'platform' | 'user_id' | 'profile_name' | 'profile_metadata'>[];
}

/**
 * Find connection by late_profile_id with getlate_profiles join
 */
export async function findConnectionByLateProfileId(
  lateProfileId: string,
  userId: string
): Promise<(Connection & { getlate_profiles?: GetlateProfileJoin }) | null> {
  const { data, error } = await supabase
    .from("connected_accounts")
    .select(`
      id,
      profile_metadata,
      platform,
      getlate_profile_id,
      social_media_account_id,
      getlate_profiles!inner(
        id,
        getlate_account_id,
        late_profile_id,
        social_media_ids,
        metadata
      )
    `)
    .eq("late_profile_id", lateProfileId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[db/connections] Error finding connection by late_profile_id:", error);
    return null;
  }

  return data as unknown as (Connection & { getlate_profiles?: GetlateProfileJoin }) | null;
}

/**
 * Find connection by user_id, platform, and profile_id (for duplicate check)
 */
export async function findConnectionByUserPlatformAndProfileId(
  userId: string,
  platform: string,
  profileId: string
): Promise<Connection | null> {
  const { data, error } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("profile_id", profileId)
    .maybeSingle();
  
  if (error) {
    console.error("[db/connections] Error finding connection:", error);
    return null;
  }
  
  return data;
}

/**
 * Find connection by user_id and platform (for finding existing connection)
 */
export async function findConnectionByUserPlatform(
  userId: string,
  platform: string
): Promise<Connection | null> {
  const { data, error } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform)
    .maybeSingle();
  
  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    console.error("[db/connections] Error finding connection by user and platform:", error);
    return null;
  }
  
  return data;
}

/**
 * Find connection by user_id, platform, and social_media_account_id
 */
export async function findConnectionBySocialMediaAccountId(
  userId: string,
  platform: string,
  socialMediaAccountId: string
): Promise<Connection | null> {
  const { data, error } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("social_media_account_id", socialMediaAccountId)
    .maybeSingle();
  
  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    console.error("[db/connections] Error finding connection by social media account ID:", error);
    return null;
  }
  
  return data;
}

/**
 * Find connections by user_id and platform (for filtering by metadata)
 */
export async function findConnectionsByUserPlatform(
  userId: string,
  platform: string
): Promise<Connection[]> {
  const { data, error } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform);
  
  if (error) {
    console.error("[db/connections] Error finding connections by user and platform:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Find connection by user_id, platform, and username (from profile_metadata)
 */
export async function findConnectionByUsername(
  userId: string,
  platform: string,
  username: string
): Promise<Connection | null> {
  const { data, error } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("profile_metadata->>username", username)
    .maybeSingle();
  
  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    console.error("[db/connections] Error finding connection by username:", error);
    return null;
  }
  
  return data;
}

/**
 * Find connection by user_id, getlate_profile_id, and platform (for unique constraint check)
 */
export async function findConnectionByUniqueConstraint(
  userId: string,
  getlateProfileId: string,
  platform: string
): Promise<Connection | null> {
  const { data, error } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("getlate_profile_id", getlateProfileId)
    .eq("platform", platform)
    .maybeSingle();
  
  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    console.error("[db/connections] Error finding connection by unique constraint:", error);
    return null;
  }
  
  return data;
}

/**
 * Create connection (legacy format - for POST /api/connections)
 */
export async function createConnectionLegacy(data: {
  user_id: string;
  platform: string;
  access_token: string;
  refresh_token?: string | null;
  profile_name?: string | null;
  profile_id: string;
  expires_at?: string | null;
}): Promise<Connection | null> {
  const { data: connection, error } = await supabase
    .from("connected_accounts")
    .insert({
      user_id: data.user_id,
      platform: data.platform,
      access_token: data.access_token,
      refresh_token: data.refresh_token || null,
      profile_name: data.profile_name || null,
      profile_id: data.profile_id,
      expires_at: data.expires_at || null,
      profile_metadata: {}
    })
    .select()
    .single();
  
  if (error) {
    console.error("[db/connections] Error creating connection:", error);
    return null;
  }
  
  return connection;
}

/**
 * Find connection by ID with getlate_profiles join (for late.dev operations)
 */
export async function findConnectionByIdWithProfile(
  id: string,
  userId: string
): Promise<(Connection & { getlate_profiles?: GetlateProfileJoin }) | null> {
  const { data, error } = await supabase
    .from("connected_accounts")
    .select(`
      *,
      social_media_account_id,
      profile_metadata,
      getlate_profiles(
        id,
        getlate_account_id,
        late_profile_id,
        profile_name,
        social_media_ids,
        metadata
      )
    `)
    .eq("id", id)
    .eq("user_id", userId)
    .not("late_profile_id", "is", null)
    .maybeSingle();

  if (error) {
    console.error("[db/connections] Error finding connection with profile:", error);
    return null;
  }

  return data as unknown as (Connection & { getlate_profiles?: GetlateProfileJoin }) | null;
}

/**
 * Find connections by IDs with getlate_profiles join (for schedule operations)
 */
export async function findConnectionsByIdsWithProfiles(
  ids: string[],
  userId: string,
  platform?: string
): Promise<(Connection & { getlate_profiles?: GetlateProfileJoin })[]> {
  if (ids.length === 0) return [];
  
  let query = supabase
    .from("connected_accounts")
    .select(`
      id,
      platform,
      profile_id,
      late_profile_id,
      profile_metadata,
      getlate_profile_id,
      social_media_account_id,
      connection_provider,      
      platform_metadata,
      access_token,             
      refresh_token,            
      expires_at,               
      getlate_profiles (       
        id,
        getlate_account_id,
        late_profile_id,
        social_media_ids,
        metadata
      )
    `) // Bỏ "!inner" để thành LEFT JOIN (Lấy cả Native)
    .eq("user_id", userId)
    .in("id", ids);
  
  if (platform) {
    query = query.eq("platform", platform.toLowerCase());
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error("[db/connections] Error finding connections with profiles:", error);
    return [];
  }
  
  return (data || []) as unknown as (Connection & { getlate_profiles?: GetlateProfileJoin })[];
}
