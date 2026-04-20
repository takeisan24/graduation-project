/**
 * Database Service: Profiles
 * 
 * Handles all database operations related to getlate_profiles table
 */

import { supabase } from "@/lib/supabase";

export interface ProfileMetadata {
  platform?: string;
  connected_platform?: string;
  username?: string;
  synced_at?: string;
  profile_info_error?: string;
  pending_user_id?: string;
  pending_provider?: string;
  pending_timestamp?: number;
  [key: string]: unknown;
}

export interface Profile {
  id: string;
  getlate_account_id: string;
  late_profile_id: string;
  profile_name: string | null;
  description: string | null;
  metadata: ProfileMetadata;
  created_at: string;
  updated_at: string;
}

/**
 * Find profile by late_profile_id
 */
export async function findProfileByLateId(lateProfileId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("getlate_profiles")
    .select("*")
    .eq("late_profile_id", lateProfileId)
    .maybeSingle();
  
  if (error) {
    console.error("[db/profiles] Error finding profile:", error);
    return null;
  }
  
  return data;
}

/**
 * Find profile by ID
 */
export async function findProfileById(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("getlate_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  
  if (error) {
    console.error("[db/profiles] Error finding profile by ID:", error);
    return null;
  }
  
  return data;
}

/**
 * Find profile by ID with getlate_accounts join
 */
export async function findProfileByIdWithAccount(id: string): Promise<(Profile & { getlate_accounts?: { api_key?: string } }) | null> {
  const { data, error } = await supabase
    .from("getlate_profiles")
    .select(`
      id,
      late_profile_id,
      metadata,
      getlate_account_id,
      getlate_accounts(api_key)
    `)
    .eq("id", id)
    .single();
  
  if (error) {
    console.error("[db/profiles] Error finding profile by ID with account:", error);
    return null;
  }
  
  return data as unknown as (Profile & { getlate_accounts?: { api_key?: string } }) | null;
}

/**
 * Create new profile
 */
export async function createProfile(data: {
  getlate_account_id: string;
  late_profile_id: string;
  profile_name: string;
  description?: string | null;
  social_media_ids?: Record<string, unknown>;
  metadata?: ProfileMetadata;
}): Promise<Profile | null> {
  const { data: profile, error } = await supabase
    .from("getlate_profiles")
    .insert({
      getlate_account_id: data.getlate_account_id,
      late_profile_id: data.late_profile_id,
      profile_name: data.profile_name,
      description: data.description || null,
      social_media_ids: data.social_media_ids || {},
      metadata: data.metadata || {}
    })
    .select()
    .single();
  
  if (error) {
    console.error("[db/profiles] Error creating profile:", error);
    return null;
  }
  
  return profile;
}

/**
 * Upsert profile (create or update if exists)
 */
export async function upsertProfile(data: {
  getlate_account_id: string;
  late_profile_id: string;
  profile_name: string;
  description?: string | null;
  social_media_ids?: Record<string, unknown>;
  metadata?: ProfileMetadata;
}): Promise<Profile | null> {
  const { data: profile, error } = await supabase
    .from("getlate_profiles")
    .upsert({
      getlate_account_id: data.getlate_account_id,
      late_profile_id: data.late_profile_id,
      profile_name: data.profile_name,
      description: data.description || null,
      social_media_ids: data.social_media_ids || {},
      metadata: data.metadata || {}
    }, {
      onConflict: "late_profile_id",
      ignoreDuplicates: false
    })
    .select()
    .single();
  
  if (error) {
    console.error("[db/profiles] Error upserting profile:", error);
    return null;
  }
  
  return profile;
}

/**
 * Update profile metadata
 */
export async function updateProfileMetadata(
  profileId: string,
  metadata: Partial<ProfileMetadata>
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("getlate_profiles")
    .select("metadata")
    .eq("id", profileId)
    .maybeSingle();
  
  if (!profile) {
    console.error("[db/profiles] Profile not found:", profileId);
    return false;
  }
  
  const updatedMetadata = {
    ...(profile.metadata || {}),
    ...metadata
  };
  
  const { error } = await supabase
    .from("getlate_profiles")
    .update({ metadata: updatedMetadata })
    .eq("id", profileId);
  
  if (error) {
    console.error("[db/profiles] Error updating profile metadata:", error);
    return false;
  }
  
  return true;
}

/**
 * Update profile with description and metadata
 */
export async function updateProfile(
  profileId: string,
  updates: {
    description?: string | null;
    metadata?: Partial<ProfileMetadata>;
  }
): Promise<boolean> {
  const updateData: { description?: string | null; metadata?: ProfileMetadata } = {};

  if (updates.description !== undefined) {
    updateData.description = updates.description;
  }
  
  if (updates.metadata) {
    // Get current metadata first
    const { data: profile } = await supabase
      .from("getlate_profiles")
      .select("metadata")
      .eq("id", profileId)
      .maybeSingle();
    
    if (!profile) {
      console.error("[db/profiles] Profile not found:", profileId);
      return false;
    }
    
    updateData.metadata = {
      ...(profile.metadata || {}),
      ...updates.metadata
    };
  }
  
  const { error } = await supabase
    .from("getlate_profiles")
    .update(updateData)
    .eq("id", profileId);
  
  if (error) {
    console.error("[db/profiles] Error updating profile:", error);
    return false;
  }
  
  return true;
}

/**
 * Remove pending fields from profile metadata
 */
export async function removePendingFields(profileId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from("getlate_profiles")
    .select("metadata")
    .eq("id", profileId)
    .maybeSingle();
  
  if (!profile) {
    return false;
  }
  
  const {
    pending_user_id: _pendingUserId,
    pending_provider: _pendingProvider,
    pending_timestamp: _pendingTimestamp,
    ...restMetadata
  } = profile.metadata || {};
  
  const { error } = await supabase
    .from("getlate_profiles")
    .update({ metadata: restMetadata })
    .eq("id", profileId);
  
  if (error) {
    console.error("[db/profiles] Error removing pending fields:", error);
    return false;
  }
  
  return true;
}

/**
 * Get profiles by account ID
 */
export async function getProfilesByAccountId(accountId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("getlate_profiles")
    .select("*")
    .eq("getlate_account_id", accountId);
  
  if (error) {
    console.error("[db/profiles] Error getting profiles by account:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Delete profile by late_profile_id
 */
export async function deleteProfileByLateId(lateProfileId: string): Promise<boolean> {
  const { error } = await supabase
    .from("getlate_profiles")
    .delete()
    .eq("late_profile_id", lateProfileId);
  
  if (error) {
    console.error("[db/profiles] Error deleting profile:", error);
    return false;
  }
  
  return true;
}

/**
 * Delete multiple profiles by late_profile_ids
 */
export async function deleteProfilesByLateIds(lateProfileIds: string[]): Promise<number> {
  if (lateProfileIds.length === 0) {
    return 0;
  }
  
  const { error } = await supabase
    .from("getlate_profiles")
    .delete()
    .in("late_profile_id", lateProfileIds);
  
  if (error) {
    console.error("[db/profiles] Error deleting profiles:", error);
    return 0;
  }
  
  return lateProfileIds.length;
}

