"use client"

import { useEffect, useCallback, useMemo } from "react"
import { useConnectionsStore } from "@/store"
import { useShallow } from "zustand/react/shallow"

/**
 * Type definition for connected social media account
 */
export type ConnectedAccount = {
  id: string
  platform: string | null
  profile_name?: string | null
  late_profile_id?: string | null
  social_media_account_id?: string | null
  profile_metadata?: {
    username?: string
    email?: string
    platform?: string
    late_profile_id?: string
    avatar_url?: string | null
    accountId?: string
    [key: string]: any
  } | null
  created_at?: string
}

/**
 * Hook to fetch and manage connected social media accounts
 * Provides caching mechanism to prevent duplicate API calls
 * 
 * @example
 * ```tsx
 * const { accounts, loading, error, refetch } = useConnectedAccounts()
 * 
 * // Filter by platform
 * const facebookAccounts = accounts.filter(acc => acc.platform === 'facebook')
 * ```
 */
export function useConnectedAccounts(forceRefresh = false) {
  const {
    connectedAccounts,
    connectedAccountsLoading,
    connectedAccountsError,
    loadConnectedAccounts,
    refreshConnectedAccounts
  } = useConnectionsStore(useShallow((state) => ({
    connectedAccounts: state.connectedAccounts,
    connectedAccountsLoading: state.connectedAccountsLoading,
    connectedAccountsError: state.connectedAccountsError,
    loadConnectedAccounts: state.loadConnectedAccounts,
    refreshConnectedAccounts: state.refreshConnectedAccounts
  })))

  const hasAccounts = !!(connectedAccounts && connectedAccounts.length > 0)

  // Load accounts on mount or when force refresh changes
  useEffect(() => {
    if (forceRefresh) {
      refreshConnectedAccounts()
      return
    }

    if (!hasAccounts) {
      loadConnectedAccounts()
    }
  }, [forceRefresh, hasAccounts, loadConnectedAccounts, refreshConnectedAccounts])

  const accounts = connectedAccounts || []

  const refetch = useCallback(() => {
    return refreshConnectedAccounts()
  }, [refreshConnectedAccounts])

  /**
   * Get accounts grouped by platform
   */
  const accountsByPlatform = useMemo(() => {
    const map: Record<string, ConnectedAccount[]> = {}
    accounts.forEach((acc) => {
      if (acc.platform) {
        const platform = acc.platform.toLowerCase()
        if (!map[platform]) {
          map[platform] = []
        }
        map[platform].push(acc)
      }
    })
    return map
  }, [accounts])

  /**
   * Get accounts for a specific platform
   */
  const getAccountsForPlatform = useCallback((platform: string): ConnectedAccount[] => {
    const platformLower = platform.toLowerCase()
    return accountsByPlatform[platformLower] || []
  }, [accountsByPlatform])

  /**
   * Check if user has any accounts connected for a platform
   */
  const hasPlatformConnected = useCallback((platform: string): boolean => {
    return getAccountsForPlatform(platform).length > 0
  }, [getAccountsForPlatform])

  return {
    accounts,
    accountsByPlatform,
    loading: connectedAccountsLoading,
    error: connectedAccountsError,
    refetch,
    getAccountsForPlatform,
    hasPlatformConnected,
    clearCache: refreshConnectedAccounts
  }
}

