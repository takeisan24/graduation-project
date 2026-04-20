/**
 * Database Service: Files
 * 
 * Handles all database operations related to files table
 */

import { supabase } from "@/lib/supabase";

export interface FileRecord {
  id: string;
  user_id: string;
  key: string;
  bucket: string;
  mime: string | null;
  size: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get files by user ID
 */
export async function getFilesByUserId(userId: string): Promise<FileRecord[]> {
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("[db/files] Error getting files by user ID:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Get file by ID with ownership check
 */
export async function getFileById(fileId: string, userId: string): Promise<FileRecord | null> {
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("id", fileId)
    .eq("user_id", userId)
    .single();
  
  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    console.error("[db/files] Error getting file by ID:", error);
    return null;
  }
  
  return data;
}

/**
 * Create file record
 */
export async function createFile(data: {
  user_id: string;
  key: string;
  bucket: string;
  mime: string | null;
  size: number | null;
}): Promise<FileRecord | null> {
  const { data: file, error } = await supabase
    .from("files")
    .insert({
      user_id: data.user_id,
      key: data.key,
      bucket: data.bucket,
      mime: data.mime,
      size: data.size
    })
    .select()
    .single();
  
  if (error) {
    console.error("[db/files] Error creating file:", error);
    return null;
  }
  
  return file;
}

/**
 * Delete file record by ID with ownership check
 */
export async function deleteFile(fileId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("files")
    .delete()
    .eq("id", fileId)
    .eq("user_id", userId);
  
  if (error) {
    console.error("[db/files] Error deleting file:", error);
    return false;
  }
  
  return true;
}

/**
 * Get public URL for a file
 */
export async function getPublicUrl(bucket: string, path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}

/**
 * Create signed URL for a file
 * @param bucket - Storage bucket name
 * @param path - File path in storage
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns Signed URL or null if error
 */
export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  
  if (error) {
    console.error("[db/files] Error creating signed URL:", error);
    return null;
  }
  
  return data?.signedUrl || null;
}

