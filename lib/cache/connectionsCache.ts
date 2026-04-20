/**
 * Shared cache for connected accounts/connections
 * Prevents duplicate API calls across multiple components
 * 
 * This module provides a centralized caching mechanism that can be used
 * by both useConnectedAccounts hook and SettingsSection component
 */

import { supabaseClient } from "@/lib/supabaseClient";
import { handleUnauthorizedOnClient } from "@/lib/utils/authClient";
import type { ConnectedAccount } from "@/store/shared/types";

/**
 * Cache configuration
 */
const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes - connections don't change frequently

/**
 * Cache state (module-level, shared across all components)
 */
let cachedConnections: ConnectedAccount[] | null = null;
let cacheTimestamp: number | null = null;
let fetchPromise: Promise<ConnectedAccount[] | null> | null = null;

/**
 * Clear the cache (useful after connecting/disconnecting accounts)
 */
export function clearConnectionsCache() {
  cachedConnections = null;
  cacheTimestamp = null;
  fetchPromise = null;
}

/**
 * Fetch connections from API with shared caching
 * 
 * @param force - If true, bypasses cache and forces a fresh fetch
 * @returns Promise resolving to connections array or null on error
 */
export async function fetchConnectionsWithCache(force = false): Promise<ConnectedAccount[] | null> {
  // Check if cache is stale (older than CACHE_MAX_AGE)
  const isCacheStale = cacheTimestamp !== null && (Date.now() - cacheTimestamp) > CACHE_MAX_AGE;

  // Return cached data if available, not forcing refresh, and cache is not stale
  if (!force && !isCacheStale && cachedConnections !== null) {
    return cachedConnections;
  }

  // Return existing promise if a fetch is already in progress
  // This prevents multiple simultaneous API calls
  if (!force && fetchPromise) {
    return fetchPromise;
  }

  // Create new fetch promise
  fetchPromise = (async () => {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        console.warn('[connectionsCache] No session found, skipping connections fetch');
        return null;
      }

      const res = await fetch('/api/connections', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });

      if (!res.ok) {
        if (res.status === 401) {
          console.warn('[connectionsCache] Unauthorized when fetching connections');
          handleUnauthorizedOnClient('fetchConnectionsWithCache');
          return null;
        }
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to fetch connections');
      }

      const json = await res.json();
      if (json?.success) {
        const connections = Array.isArray(json.data) ? json.data : [];
        cachedConnections = connections;
        cacheTimestamp = Date.now(); // Update cache timestamp
        return connections;
      } else {
        cachedConnections = [];
        cacheTimestamp = Date.now();
        return [];
      }
    } catch (err: unknown) {
      console.error('[connectionsCache] Failed to fetch connections:', err);
      return null;
    } finally {
      fetchPromise = null; // Clear promise after completion
    }
  })();

  return fetchPromise;
}

/**
 * Get cached connections without fetching (if available)
 * Returns null if cache is empty or stale
 */
export function getCachedConnections(): ConnectedAccount[] | null {
  if (cachedConnections === null || cacheTimestamp === null) {
    return null;
  }

  const isCacheStale = (Date.now() - cacheTimestamp) > CACHE_MAX_AGE;
  if (isCacheStale) {
    return null;
  }

  return cachedConnections;
}
