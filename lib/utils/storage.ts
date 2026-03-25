/**
 * LocalStorage Utility Functions
 * Handles saving and loading data with error handling
 */

/**
 * Save data to localStorage with error handling
 * @param key - The localStorage key
 * @param data - The data to save (will be JSON stringified)
 * @returns True if successful, false otherwise
 */
export function saveToLocalStorage(key: string, data: any): boolean {
  try {
    if (typeof window === 'undefined') return false
    localStorage.setItem(key, JSON.stringify(data))
    return true
  } catch (error) {
    console.error('Error saving to localStorage:', error)
    return false
  }
}

/**
 * Load data from localStorage with error handling
 * @param key - The localStorage key
 * @param defaultValue - Default value to return if key doesn't exist or parsing fails
 * @returns The parsed data or default value
 */
export function loadFromLocalStorage<T = any>(key: string, defaultValue: T): T {
  try {
    if (typeof window === 'undefined') return defaultValue
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : defaultValue
  } catch (error) {
    console.error('Error loading from localStorage:', error)
    return defaultValue
  }
}

/**
 * Remove item from localStorage
 * @param key - The localStorage key
 * @returns True if successful, false otherwise
 */
export function removeFromLocalStorage(key: string): boolean {
  try {
    if (typeof window === 'undefined') return false
    localStorage.removeItem(key)
    return true
  } catch (error) {
    console.error('Error removing from localStorage:', error)
    return false
  }
}

/**
 * Clear all localStorage
 * @returns True if successful, false otherwise
 */
export function clearLocalStorage(): boolean {
  try {
    if (typeof window === 'undefined') return false
    localStorage.clear()
    return true
  } catch (error) {
    console.error('Error clearing localStorage:', error)
    return false
  }
}

/**
 * Get current user ID from Supabase session
 * @returns userId or null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null;
    const { supabaseClient } = await import('@/lib/supabaseClient');
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session?.user?.id || null;
  } catch (error) {
    console.error('[storage] Error getting userId:', error);
    return null;
  }
}

/**
 * Get user-specific localStorage key
 * @param key - Base key name
 * @param userId - User ID (optional, will use base key if not provided for backward compatibility)
 * @returns Prefixed key: `{userId}_{key}` or fallback to base key if no userId
 */
export function getUserStorageKey(key: string, userId?: string | null): string {
  if (!userId) {
    // Fallback to base key if no userId (backward compatibility)
    return key;
  }
  return `${userId}_${key}`;
}

/**
 * Save data to user-specific localStorage
 * @param key - Base key name (will be prefixed with userId)
 * @param data - Data to save
 * @param userId - User ID (optional, will fetch if not provided)
 * @returns True if successful, false otherwise
 */
export async function saveToUserLocalStorage(key: string, data: any, userId?: string | null): Promise<boolean> {
  try {
    const effectiveUserId = userId || await getCurrentUserId();
    const userKey = getUserStorageKey(key, effectiveUserId);
    return saveToLocalStorage(userKey, data);
  } catch (error) {
    console.error('[storage] Error saving to user localStorage:', error);
    return false;
  }
}

/**
 * Load data from user-specific localStorage
 * @param key - Base key name (will be prefixed with userId)
 * @param defaultValue - Default value if not found
 * @param userId - User ID (optional, will fetch if not provided)
 * @returns The parsed data or default value
 */
export async function loadFromUserLocalStorage<T = any>(
  key: string,
  defaultValue: T,
  userId?: string | null
): Promise<T> {
  try {
    const effectiveUserId = userId || await getCurrentUserId();
    const userKey = getUserStorageKey(key, effectiveUserId);
    return loadFromLocalStorage<T>(userKey, defaultValue);
  } catch (error) {
    console.error('[storage] Error loading from user localStorage:', error);
    return defaultValue;
  }
}


/**
 * Get user-specific key for videoProjects localStorage
 * Uses sync approach to avoid async issues in Zustand store initialization
 * @returns User-specific key or fallback to base key if no userId available
 */
export function getVideoProjectsKey(): string {
  try {
    if (typeof window === 'undefined') return 'videoProjects';

    // Try to get userId from Supabase session (may be cached)
    // This is a best-effort approach - if session not available, falls back to base key
    const supabase = (window as any).__supabaseClient;
    if (!supabase) return 'videoProjects';

    // Get session synchronously from cache (if available)
    const session = supabase.auth.session?.() || null;
    const userId = session?.user?.id;

    if (userId) {
      return `${userId}_videoProjects`;
    }

    // Fallback to base key (backward compatibility)
    return 'videoProjects';
  } catch (error) {
    console.error('[storage] Error getting videoProjects key:', error);
    return 'videoProjects';
  }
}



/**
 * Check if key exists in localStorage
 * @param key - The localStorage key
 * @returns True if key exists
 */
export function hasLocalStorageKey(key: string): boolean {
  try {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(key) !== null
  } catch (error) {
    console.error('Error checking localStorage key:', error)
    return false
  }
}

/**
 * Get all localStorage keys
 * @returns Array of all keys
 */
export function getAllLocalStorageKeys(): string[] {
  try {
    if (typeof window === 'undefined') return []
    return Object.keys(localStorage)
  } catch (error) {
    console.error('Error getting localStorage keys:', error)
    return []
  }
}

/**
 * Get localStorage size in bytes
 * @returns Size in bytes
 */
export function getLocalStorageSize(): number {
  try {
    if (typeof window === 'undefined') return 0
    let total = 0
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length
      }
    }
    return total
  } catch (error) {
    console.error('Error getting localStorage size:', error)
    return 0
  }
}

/**
 * Save data to localStorage with size limit check
 * If data exceeds maxSize (default 4MB), attempts to cleanup old data
 * @param key - The localStorage key
 * @param data - The data to save (will be JSON stringified)
 * @param maxSize - Maximum size in bytes (default: 4MB)
 * @returns True if successful, false otherwise
 */
export function saveToLocalStorageWithLimit(key: string, data: any, maxSize: number = 4 * 1024 * 1024): boolean {
  try {
    if (typeof window === 'undefined') return false

    const serialized = JSON.stringify(data)
    const currentSize = getLocalStorageSize()
    const newSize = serialized.length + key.length

    // If adding this data would exceed limit, try to cleanup
    if (currentSize + newSize > maxSize) {
      console.warn(`[storage] localStorage size limit approaching. Current: ${currentSize}, New item: ${newSize}, Limit: ${maxSize}`);
      // Attempt cleanup (this is a best-effort, actual cleanup should be done by specific cleanup functions)
    }

    localStorage.setItem(key, serialized)
    return true
  } catch (error: any) {
    // If quota exceeded, try cleanup and retry once
    if (error.name === 'QuotaExceededError' || error.message?.includes('quota')) {
      console.warn(`[storage] Quota exceeded for key ${key}, attempting cleanup...`);
      // Cleanup old data (best-effort)
      cleanupOldLocalStorageData()

      // Retry once after cleanup
      try {
        localStorage.setItem(key, JSON.stringify(data))
        return true
      } catch (retryError) {
        console.error(`[storage] Failed to save after cleanup:`, retryError)
        return false
      }
    }
    console.error('Error saving to localStorage:', error)
    return false
  }
}

/**
 * Cleanup old localStorage data
 * Removes old calendar events, pending posts, and limits data older than retention period
 */
export function cleanupOldLocalStorageData(): void {
  try {
    if (typeof window === 'undefined') return

    const now = new Date()
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)

    // Cleanup calendar events older than 3 months
    const calendarEvents = loadFromLocalStorage<Record<string, any[]>>('calendarEvents', {})
    const cleanedEvents: Record<string, any[]> = {}
    let removedCount = 0

    for (const [dateKey, events] of Object.entries(calendarEvents)) {
      const [year, month, day] = dateKey.split('-').map(Number)
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const eventDate = new Date(year, month, day)
        if (eventDate >= threeMonthsAgo) {
          cleanedEvents[dateKey] = events
        } else {
          removedCount += events.length
        }
      } else {
        cleanedEvents[dateKey] = events // Keep invalid date keys
      }
    }

    if (removedCount > 0) {
      saveToLocalStorage('calendarEvents', cleanedEvents)
    }

    // Cleanup pending scheduled posts older than 7 days
    const pendingPosts = loadFromLocalStorage<any[]>('pendingScheduledPosts', [])
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const validPendingPosts = pendingPosts.filter(p => {
      try {
        const scheduledTime = new Date(p.scheduledAt)
        return !isNaN(scheduledTime.getTime()) && scheduledTime >= sevenDaysAgo
      } catch {
        return false
      }
    })

    if (validPendingPosts.length < pendingPosts.length) {
      saveToLocalStorage('pendingScheduledPosts', validPendingPosts)
    }

  } catch (error) {
    console.error('[storage] Error during cleanup:', error)
  }
}

/**
 * Limit array size in localStorage
 * Keeps only the most recent N items
 * @param key - The localStorage key
 * @param maxItems - Maximum number of items to keep (default: 1000)
 * @returns Number of items removed
 */
export function limitLocalStorageArray(key: string, maxItems: number = 1000): number {
  try {
    if (typeof window === 'undefined') return 0

    const data = loadFromLocalStorage<any[]>(key, [])
    if (!Array.isArray(data) || data.length <= maxItems) {
      return 0
    }

    const removed = data.length - maxItems
    const limited = data.slice(-maxItems) // Keep last N items
    saveToLocalStorage(key, limited)
    return removed
  } catch (error) {
    console.error(`[storage] Error limiting array for key ${key}:`, error)
    return 0
  }
}