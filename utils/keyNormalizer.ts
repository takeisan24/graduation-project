/**
 * Key Normalization Utilities
 * 
 * Provides consistent S3 key normalization for comparing keys across different sources.
 * Handles common mismatches: prefix differences, leading slashes, casing, whitespace.
 * 
 * @module utils/keyNormalizer
 */

/**
 * Normalize S3 key for consistent comparison
 * 
 * Normalization Rules:
 * 1. Remove leading/trailing whitespace
 * 2. Remove leading/trailing slashes
 * 3. Normalize multiple consecutive slashes to single slash
 * 4. Convert to lowercase (for case-insensitive comparison)
 * 
 * Examples:
 * ```typescript
 * normalizeS3Key("Media/User/Clip.MP4")        → "media/user/clip.mp4"
 * normalizeS3Key("/media/user/clip.mp4")       → "media/user/clip.mp4"
 * normalizeS3Key("media//user///clip.mp4")     → "media/user/clip.mp4"
 * normalizeS3Key("  media/clip.mp4  ")         → "media/clip.mp4"
 * normalizeS3Key("")                           → ""
 * normalizeS3Key(null)                         → ""
 * normalizeS3Key(undefined)                    → ""
 * ```
 * 
 * @param key - S3 key to normalize (can be null/undefined)
 * @returns Normalized key (lowercase, no leading/trailing slashes, trimmed)
 */
export function normalizeS3Key(key: string | undefined | null): string {
  if (!key) return '';
  
  return key
    .trim()                           // Remove leading/trailing whitespace
    .replace(/^\/+|\/+$/g, '')        // Remove leading/trailing slashes
    .replace(/\/+/g, '/')             // Normalize multiple slashes to single slash
    .toLowerCase();                   // Lowercase for case-insensitive comparison
}

/**
 * Check if two S3 keys match (with normalization)
 * 
 * Performs normalized comparison - handles prefix, slash, and casing differences.
 * 
 * Examples:
 * ```typescript
 * keysMatch("media/clip.mp4", "Media/Clip.MP4")    → true
 * keysMatch("/media/clip.mp4", "media/clip.mp4")   → true
 * keysMatch("media/clip.mp4", "clip.mp4")          → false (different paths)
 * keysMatch(null, "")                              → true (both normalize to "")
 * ```
 * 
 * @param key1 - First key to compare
 * @param key2 - Second key to compare
 * @returns true if keys match after normalization, false otherwise
 */
export function keysMatch(key1: string | undefined | null, key2: string | undefined | null): boolean {
  return normalizeS3Key(key1) === normalizeS3Key(key2);
}

/**
 * Check if array contains key (with normalization)
 * 
 * Performs normalized search - more reliable than Array.includes() for S3 keys.
 * 
 * Examples:
 * ```typescript
 * includesKey(["media/clip.mp4"], "Media/Clip.MP4")    → true
 * includesKey(["/media/clip.mp4"], "media/clip.mp4")   → true
 * includesKey(["clip1.mp4"], "clip2.mp4")              → false
 * includesKey([], "clip.mp4")                          → false
 * includesKey(["clip.mp4"], null)                      → false
 * ```
 * 
 * @param keys - Array of keys to search (can contain null/undefined)
 * @param key - Key to find
 * @returns true if key is in array (after normalization), false otherwise
 */
export function includesKey(keys: (string | undefined | null)[], key: string | undefined | null): boolean {
  if (!key) return false;
  const normalizedKey = normalizeS3Key(key);
  if (!normalizedKey) return false; // Safeguard for empty normalized key
  return keys.some(k => normalizeS3Key(k) === normalizedKey);
}

/**
 * Filter array to only include keys that match any of the target keys (with normalization)
 * 
 * Useful for filtering clips by selectedClipKeys.
 * 
 * Examples:
 * ```typescript
 * const clips = [
 *   { key: "media/clip1.mp4" },
 *   { key: "Media/Clip2.MP4" },
 *   { key: "media/clip3.mp4" }
 * ];
 * const selected = ["clip1.mp4", "/media/clip2.mp4"];
 * filterByKeys(clips, selected, c => c.key)
 * // Returns: [{ key: "media/clip1.mp4" }, { key: "Media/Clip2.MP4" }]
 * ```
 * 
 * @param items - Array of items to filter
 * @param targetKeys - Array of keys to match against
 * @param keyExtractor - Function to extract key from each item
 * @returns Filtered array containing only items whose key matches any targetKey
 */
export function filterByKeys<T>(
  items: T[],
  targetKeys: (string | undefined | null)[],
  keyExtractor: (item: T) => string | undefined | null
): T[] {
  const normalizedTargets = targetKeys.map(k => normalizeS3Key(k)).filter(k => k !== '');
  
  return items.filter(item => {
    const itemKey = keyExtractor(item);
    const normalizedItemKey = normalizeS3Key(itemKey);
    return normalizedItemKey && normalizedTargets.includes(normalizedItemKey);
  });
}
