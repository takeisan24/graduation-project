/**
 * Service: Supabase Storage Operations
 * 
 * Handles all storage operations including:
 * - Bucket management (create, check existence)
 * - File upload
 * - File deletion
 * - Public URL generation
 * 
 * @module storageService
 */

import { supabase } from "@/lib/supabase";

/**
 * Result type for bucket existence check
 */
export interface BucketExistsResult {
  success: boolean;
  error?: string;
}

/**
 * Options for file upload
 */
export interface UploadFileOptions {
  /** MIME type of the file (e.g., 'image/jpeg', 'video/mp4') */
  contentType?: string;
  /** Whether to overwrite existing file with same key (default: true) */
  upsert?: boolean;
}

/**
 * Result type for file upload operation
 */
export interface UploadFileResult {
  success: boolean;
  data?: {
    path: string;
  };
  error?: string;
}

/**
 * Result type for file deletion operation
 */
export interface DeleteFileResult {
  success: boolean;
  error?: string;
}

/**
 * Ensure bucket exists in Supabase Storage, create if it doesn't
 * 
 * Checks if a storage bucket exists by listing all buckets. If the bucket
 * doesn't exist, creates it with public access enabled. Uses service role
 * key for bucket creation (requires SUPABASE_SERVICE_ROLE_KEY).
 * 
 * @param {string} bucketName - Name of the bucket to ensure exists
 * @returns {Promise<BucketExistsResult>} Result object with success status and optional error message
 * 
 * @example
 * ```typescript
 * const result = await ensureBucketExists('uploads');
 * if (!result.success) {
 *   console.error('Failed to ensure bucket exists:', result.error);
 * }
 * ```
 */
export async function ensureBucketExists(bucketName: string): Promise<BucketExistsResult> {
  try {
    // List all buckets to check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error(`[storageService] Error listing buckets:`, listError);
      return { success: false, error: listError.message };
    }
    
    // Check if bucket exists
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName) || false;
    
    if (bucketExists) {
      return { success: true };
    }
    
    // Create bucket if it doesn't exist
    const { data: newBucket, error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true, // Make bucket public so files can be accessed via public URL
      allowedMimeTypes: null, // Allow all file types
      fileSizeLimit: null // No size limit (or set a limit if needed)
    });
    
    if (createError) {
      console.error(`[storageService] Error creating bucket '${bucketName}':`, createError);
      return { success: false, error: createError.message };
    }
    
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[storageService] Unexpected error ensuring bucket exists:`, message);
    return { success: false, error: message };
  }
}

/**
 * Upload file to Supabase Storage
 * 
 * Uploads a file to the specified bucket with automatic bucket creation
 * and retry logic. If the bucket doesn't exist, attempts to create it
 * before uploading. If upload fails due to missing bucket, retries
 * bucket creation and upload once.
 * 
 * @param {string} bucket - Name of the storage bucket
 * @param {string} key - File path/key within the bucket (e.g., 'user123/image.jpg')
 * @param {Buffer | File | Blob} file - File content to upload
 * @param {UploadFileOptions} [options] - Optional upload configuration
 * @param {string} [options.contentType] - MIME type of the file
 * @param {boolean} [options.upsert=true] - Whether to overwrite existing file
 * @returns {Promise<UploadFileResult>} Result object with success status, uploaded file path, or error message
 * 
 * @example
 * ```typescript
 * const buffer = Buffer.from('file content');
 * const result = await uploadFile('uploads', 'user123/file.jpg', buffer, {
 *   contentType: 'image/jpeg',
 *   upsert: true
 * });
 * if (result.success && result.data) {
 *   console.log('File uploaded to:', result.data.path);
 * }
 * ```
 */
export async function uploadFile(
  bucket: string,
  key: string,
  file: Buffer | File | Blob,
  options?: UploadFileOptions
): Promise<UploadFileResult> {
  try {
    const performUpload = async () => {
      return await supabase.storage
        .from(bucket)
        .upload(key, file as any, {
          contentType: options?.contentType,
          upsert: options?.upsert ?? true
        });
    };

    // First attempt (assumes bucket already exists)
    let { data, error } = await performUpload();
    
    // If bucket missing, create it once then retry
    if (error && (error.message?.includes('Bucket not found') || error.message?.includes('not found'))) {
      console.warn(`[storageService] Bucket '${bucket}' not found. Attempting to create bucket...`);
      
      const retryCheck = await ensureBucketExists(bucket);
      if (retryCheck.success) {
        const retryResult = await performUpload();
        
        if (retryResult.error) {
          console.error(`[storageService] Upload failed to bucket '${bucket}' after retry:`, retryResult.error);
          return { success: false, error: retryResult.error.message };
        }
        
        return { success: true, data: retryResult.data || undefined };
      }
    }
    
    if (error) {
      console.error(`[storageService] Upload failed to bucket '${bucket}':`, error);
      
      // Provide helpful error message if bucket still doesn't exist
      if (error.message?.includes('Bucket not found') || error.message?.includes('not found')) {
        return {
          success: false,
          error: `Storage bucket '${bucket}' does not exist and could not be created automatically. Please check Supabase Storage permissions or create the bucket manually in Supabase Dashboard > Storage.`
        };
      }
      
      return { success: false, error: error.message || "Failed to upload file" };
    }
    
    if (!data) {
      return { success: false, error: "Upload succeeded but no data returned" };
    }
    
    return { success: true, data };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[storageService] Unexpected error uploading file:`, message);
    return { success: false, error: message };
  }
}

/**
 * Delete file from Supabase Storage
 * 
 * Removes a file from the specified bucket. This operation is permanent
 * and cannot be undone.
 * 
 * @param {string} bucket - Name of the storage bucket
 * @param {string} key - File path/key within the bucket to delete
 * @returns {Promise<DeleteFileResult>} Result object with success status and optional error message
 * 
 * @example
 * ```typescript
 * const result = await deleteFileFromStorage('uploads', 'user123/file.jpg');
 * if (!result.success) {
 *   console.error('Failed to delete file:', result.error);
 * }
 * ```
 */
export async function deleteFileFromStorage(
  bucket: string,
  key: string
): Promise<DeleteFileResult> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([key]);
    
    if (error) {
      console.error(`[storageService] Error deleting file from storage:`, error);
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[storageService] Unexpected error deleting file:`, message);
    return { success: false, error: message };
  }
}

/**
 * Get public URL for a file in Supabase Storage
 * 
 * Generates a public URL that can be used to access the file directly.
 * The bucket must be configured as public for this URL to work.
 * 
 * @param {string} bucket - Name of the storage bucket
 * @param {string} path - File path/key within the bucket
 * @returns {string} Public URL for accessing the file
 * 
 * @example
 * ```typescript
 * const publicUrl = getPublicUrl('uploads', 'user123/image.jpg');
 * // Returns: 'https://[project].supabase.co/storage/v1/object/public/uploads/user123/image.jpg'
 * ```
 */
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

