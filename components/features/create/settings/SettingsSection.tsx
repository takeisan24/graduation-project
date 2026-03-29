"use client"

import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { useShallow } from "zustand/react/shallow"
import { SOCIAL_PLATFORMS } from '@/lib/constants/platforms'
import { PlatformIcon } from '@/components/shared/PlatformIcon'
import { supabaseClient } from "@/lib/supabaseClient"
import { formatDate, formatTime } from "@/lib/utils/date"
import { PlatformFilter } from "@/components/shared/filters/PlatformFilter"
import { usePostFilters } from "@/hooks/usePostFilters"
import { clearConnectionsCache } from "@/lib/cache/connectionsCache";
import { getAppUrl } from "@/lib/utils/urlConfig";
import { useConnectionsStore } from "@/store"
import { Button } from "@/components/ui/button"
import { Info, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { useLocale, useTranslations } from "next-intl"
import { handleErrorWithModal } from "@/lib/utils/errorHandler"
import { LIMIT_ERRORS, GENERIC_ERRORS } from "@/lib/messages/errors"
import { handleUnauthorizedOnClient } from "@/lib/utils/authClient"

type LateConnection = {
  id: string
  platform: string | null
  profile_name: string | null
  late_profile_id?: string | null
  profile_metadata?: {
    username?: string
    email?: string
    platform?: string
    late_profile_id?: string
    [key: string]: any
  }
  created_at?: string
}

const PROVIDER_SLUGS: Record<string, string | null> = {
  TikTok: "tiktok",
  Instagram: "instagram",
  YouTube: "youtube",
  Facebook: "facebook",
  Twitter: "twitter",
  Threads: "threads",
  LinkedIn: "linkedin",
  Pinterest: "pinterest"
}

// Note: fetchConnectionsWithCache is now imported from lib/cache/connectionsCache
// This uses a shared cache across all components to prevent duplicate API calls

/**
 * Settings section component for social media account connections
 * Displays a grid of social media platforms with connection status
 */
export default function SettingsSection() {
  const t = useTranslations('CreatePage.settings')
  const locale = useLocale(); // Lấy ngôn ngữ hiện tại ('vi' hoặc 'en')
  // Tối ưu: Dùng trực tiếp từ store thay vì local state để tránh duplicate state
  const {
    connectedAccounts,
    connectedAccountsLoading,
    connectedAccountsError,
    loadConnectedAccounts,
    refreshConnectedAccounts,
  } = useConnectionsStore(useShallow((state) => ({
    connectedAccounts: state.connectedAccounts,
    connectedAccountsLoading: state.connectedAccountsLoading,
    connectedAccountsError: state.connectedAccountsError,
    loadConnectedAccounts: state.loadConnectedAccounts,
    refreshConnectedAccounts: state.refreshConnectedAccounts,
  })))
  // Credits and limit stores removed - validation handled server-side

  const [actionId, setActionId] = useState<string | null>(null)
  const hasFetchedRef = useRef(false) // Track if initial fetch has completed
  // Track whether we should force a refresh on next window focus after an OAuth attempt
  const shouldRefetchOnFocusRef = useRef(false)

  // Map store state to component state for backward compatibility
  const connections = connectedAccounts || []
  const loading = connectedAccountsLoading
  // Giữ local error state để hiển thị lỗi từ các actions (connect, disconnect, etc.)
  const [localError, setLocalError] = useState<string | null>(null)
  const error = localError || connectedAccountsError

  /**
   * Fetches connections using store's loadConnectedAccounts (có cache 30s)
   * Tối ưu: Dùng store thay vì gọi API trực tiếp
   */
  const fetchConnections = useCallback(async (force = false) => {
    try {
      // Dùng store's loadConnectedAccounts (đã có cache mechanism)
      await loadConnectedAccounts(force)
      setLocalError(null) // Clear local error on success
    } catch (err: any) {
      console.error('[Settings] Failed to load connections:', err)
      setLocalError(err?.message || 'Failed to load connections')
    } finally {
      setActionId(null)
      hasFetchedRef.current = true
    }
  }, [loadConnectedAccounts])

  /**
   * Initial fetch on mount
   * Only runs once per component lifecycle to avoid React StrictMode double-mounting issues
   * Also checks URL params to detect OAuth callback returns and force refresh if needed
   */
  useEffect(() => {
    // Check if we're returning from an OAuth callback (URL might have query params)
    // If so, force refresh to get updated connections
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const isReturningFromCallback = urlParams?.has('code') || urlParams?.has('state') || urlParams?.has('returnTo')

    // Skip if already fetched (prevents duplicate calls in StrictMode)
    // But force refresh if returning from OAuth callback
    if (hasFetchedRef.current && !isReturningFromCallback) {
      return
    }

    // Clear cache if returning from callback to ensure fresh data
    if (isReturningFromCallback) {
      clearConnectionsCache()
    }

    fetchConnections(isReturningFromCallback)
  }, [fetchConnections])

  /**
   * Handle OAuth result after full-page redirect or popup fallback
   * Reads oauth_callback / error / provider / connected from URL, shows toast + inline error,
   * forces refresh, then cleans the URL query params.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const currentUrl = new URL(window.location.href)
      const params = currentUrl.searchParams

      const oauthCallback = params.get('oauth_callback') // "success" | "error"
      const providerFromUrl = params.get('provider') || ''
      const errorParam = params.get('error')
      const connectedParam = params.get('connected')

      // If no OAuth-related params, nothing to do
      if (!oauthCallback && !errorParam && !connectedParam) {
        return
      }

      // Build a friendly provider name for messages
      const providerLabel = providerFromUrl ? providerFromUrl.charAt(0).toUpperCase() + providerFromUrl.slice(1) : 'tài khoản mạng xã hội'

      // Error case (failed connect / user cancel / provider error)
      if (oauthCallback === 'error' || errorParam) {
        const errorMessage = errorParam || `Kết nối ${providerLabel} thất bại. Vui lòng thử lại.`

        // Set inline error below social connections block
        setLocalError(errorMessage)

        // Show toast error for visibility
        toast.error(`Kết nối ${providerLabel} thất bại`, {
          description: errorMessage,
          duration: 6000,
        })
      } else if (oauthCallback === 'success' || connectedParam === 'true') {
        // Optional: show success toast when connection succeeded via full-page redirect
        toast.success(`Kết nối ${providerLabel} thành công`, {
          duration: 4000,
        })
      }

      // Force refresh connections + credits to reflect latest state
      clearConnectionsCache()
      // Use the same fetch helper with force=true to ensure we bypass any cache
      fetchConnections(true).catch(err => {
        console.warn('[Settings] Failed to refresh connections after OAuth callback:', err)
      })
      refreshCredits(true).catch(err => {
        console.warn('[Settings] Failed to refresh credits after OAuth callback:', err)
      })

      // Clean OAuth-specific params from URL so we don't re-trigger on next renders
      params.delete('oauth_callback')
      params.delete('connected')
      params.delete('provider')
      params.delete('code')
      params.delete('state')
      params.delete('returnTo')
      params.delete('error')

      const cleanedUrl = currentUrl.toString()
      window.history.replaceState({}, '', cleanedUrl)
    } catch (err) {
      console.warn('[Settings] Failed to process OAuth callback params:', err)
    }
  }, [fetchConnections, refreshCredits])

  const connectionsByPlatform = useMemo(() => {
    const map: Record<string, LateConnection> = {}
    connections.forEach((conn) => {
      if (conn.platform) {
        // Map ConnectedAccount to LateConnection format (handle undefined profile_name)
        map[conn.platform.toLowerCase()] = {
          ...conn,
          profile_name: conn.profile_name ?? null
        } as LateConnection
      }
    })
    return map
  }, [connections])

  // Filter state for connected accounts table
  const { platformFilter, setPlatformFilter } = usePostFilters()

  // Filter connections based on platform filter
  const filteredConnections = useMemo(() => {
    if (platformFilter === 'all') {
      return connections
    }
    return connections.filter(conn =>
      conn.platform?.toLowerCase() === platformFilter.toLowerCase()
    )
  }, [connections, platformFilter])

  const [blockedPopup, setBlockedPopup] = useState<{ provider: string; url: string } | null>(null)

  const handleConnect = useCallback(async (platformName: string) => {
    const provider = PROVIDER_SLUGS[platformName]
    if (!provider) {
      console.warn(`[Settings] Provider for ${platformName} is not supported yet.`)
      return
    }

    // --- LOGIC MỚI: Xử lý riêng cho YouTube Native ---
    if (provider === 'youtube') {
      try {
        // 1. Lấy session để có Token
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
          toast.error(t('loginError'));
          return;
        }

        // 2. Gọi API để lấy link đăng nhập Google (có kèm Header Authorization)
        const res = await fetch(`/api/social/youtube/auth?locale=${locale}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (!res.ok) {
          throw new Error("Không thể khởi tạo kết nối YouTube");
        }

        const data = await res.json();

        // 3. Chuyển hướng người dùng sang Google
        if (data.success && data.data.url) {
          window.location.href = data.data.url;
        } else {
          throw new Error("Link đăng nhập không hợp lệ");
        }

      } catch (e: any) {
        console.error(e);
        toast.error("Lỗi kết nối YouTube: " + e.message);
      }
      return;
    }
    // -----------------------------

    try {
      setActionId(provider)
      setLocalError(null)
      // Mark that after this OAuth attempt, if user returns focus to this window,
      // we should force a refresh of connections/credits (extra safety for popup edge cases)
      shouldRefetchOnFocusRef.current = true

      const returnTo = typeof window !== 'undefined' ? window.location.href : ''
      const { data: { session } } = await supabaseClient.auth.getSession()

      // Backend handles calling late.dev /api/v1/connect endpoint with API key
      // and returns the OAuth redirect URL directly
      const res = await fetch(`/api/late/connections/${provider}/start?json=1&returnTo=${encodeURIComponent(returnTo)}&popup=1`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      })
      if (!res.ok) {
        // Handle unauthorized globally: force logout and stop further processing
        if (res.status === 401) {
          console.warn('[Settings] Unauthorized (401) when starting connection, forcing logout')
          setActionId(null)
          await handleUnauthorizedOnClient('settings_connect_start')
          return
        }

        const errorText = await res.text()
        let errorData: any = { error: errorText || `HTTP ${res.status}` }

        // Try to parse JSON error if possible
        try {
          errorData = JSON.parse(errorText)
        } catch {
          // Not JSON, use text as is
        }

        // Handle error with modal (will show both toast and modal if it's a limit/credits error)
        await handleErrorWithModal(errorData, errorData.error || errorData.message || `HTTP ${res.status}`)

        // Set error and clear action immediately (before popup opens)
        const errorMessage = errorData.message || errorData.error || errorText || `HTTP ${res.status}`
        setLocalError(errorMessage)
        setActionId(null)
        throw new Error(errorMessage)
      }
      const json = await res.json()

      if (!json?.url) {
        throw new Error('Missing OAuth redirect URL from backend')
      }

      // Use popup window for better UX instead of redirecting entire page
      // Mở popup ngay lập tức để user thấy OAuth login page
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2

      // Mở popup ngay lập tức với URL từ backend
      const popup = window.open(
        json.url,
        "oauth-popup",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      )

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        // Popup bị block hoặc không mở được
        console.warn('[Settings] Popup blocked or failed to open. Asking user to choose popup or full-page.')
        // Clear global loading state so user can interact with the page again
        setActionId(null)
        // Store info so we can either retry popup or fallback to full-page later
        setBlockedPopup({ provider, url: json.url })
        return
      }

      // Focus vào popup để đảm bảo user thấy
      try {
        popup.focus()
      } catch (e) {
        console.warn('[Settings] Could not focus popup:', e)
      }

      // Listen for postMessage từ popup callback-page
      const messageHandler = async (event: MessageEvent) => {
        const allowedOrigins = [
          window.location.origin,
          getAppUrl()
        ]

        if (!allowedOrigins.includes(event.origin)) {
          return
        }

        if (event.data?.type === "oauth-success") {
          window.removeEventListener("message", messageHandler)
          popup.close()
          setActionId(null)
          // We've already confirmed success via postMessage; no need to trigger
          // focus-based fallback any more for this attempt
          shouldRefetchOnFocusRef.current = false
          // Force refresh connections after successful OAuth (popup flow)
          clearConnectionsCache()
          // Dùng cùng helper fetchConnections(force=true) như full-page redirect
          // để chắc chắn bypass mọi cache và cập nhật danh sách + số lượng tài khoản
          fetchConnections(true).catch(err => {
            console.error('[Settings] Failed to refresh connections after OAuth (popup):', err)
          })
          // Refresh credits/limits để cập nhật số lượng profile (limit) ngay lập tức
          refreshCredits(true).catch(err => {
            console.error('[Settings] Failed to refresh credits after OAuth (popup):', err)
          })
        } else if (event.data?.type === "oauth-error") {
          window.removeEventListener("message", messageHandler)
          popup.close()
          setActionId(null)
          setLocalError(event.data.error || "OAuth connection failed")
        }
      }

      window.addEventListener("message", messageHandler)

      // Check if popup is closed (user closes manually, or browser closes after OAuth)
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed)
          window.removeEventListener("message", messageHandler)
          setActionId(null)

          // Fallback: when popup is closed but we (for any reason) didn't receive oauth-success message,
          // still try to refresh connections + credits once. This covers edge cases where
          // browser asks for popup permission each time and message handler might not fire reliably.
          try {
            clearConnectionsCache()
            fetchConnections(true).catch(err => {
              console.warn('[Settings] Failed to refresh connections after popup closed:', err)
            })
            refreshCredits(true).catch(err => {
              console.warn('[Settings] Failed to refresh credits after popup closed:', err)
            })
            // After performing the fallback refresh once, clear the focus flag
            shouldRefetchOnFocusRef.current = false
          } catch (e) {
            console.warn('[Settings] Silent error while refreshing after popup closed:', e)
          }
        }
      }, 500)

    } catch (err) {
      console.error('[Settings] Connect error:', err)
      setLocalError(err instanceof Error ? err.message : 'Failed to start connection')
      setActionId(null)
    }
  }, [fetchConnections, refreshCredits])

  /**
   * Handles disconnecting a social media account
   * After successful disconnect, forces a fresh fetch to update the UI
   */
  const handleDisconnect = useCallback(async (connectionId: string) => {
    try {
      setActionId(connectionId)
      const { data: { session } } = await supabaseClient.auth.getSession()
      const res = await fetch('/api/late/connections', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ connectionId }),
      })
      if (!res.ok) {
        if (res.status === 401) {
          console.warn('[Settings] Unauthorized (401) when disconnecting account, forcing logout')
          setActionId(null)
          await handleUnauthorizedOnClient('settings_disconnect')
          return
        }
        const text = await res.text()
        throw new Error(text || 'Failed to disconnect')
      }

      // Clear cache and force refresh after successful disconnect
      clearConnectionsCache()
      await refreshConnectedAccounts() // Dùng store's refreshConnectedAccounts thay vì fetchConnections

      // Show success message
      // NOTE: Connection has been removed from local database
      // If it still appears in getlate.dev dashboard, user may need to disconnect manually there
    } catch (err: any) {
      console.error('[Settings] Failed to disconnect:', err)
      // Check if error is about getlate.dev API failure
      const errorMessage = err?.message || 'Failed to disconnect account'
      if (errorMessage.includes('getlate.dev') || errorMessage.includes('405') || errorMessage.includes('Method Not Allowed')) {
        // Connection removed from local DB but may still appear in getlate.dev dashboard
        setLocalError('Connection removed from system. If it still appears in getlate.dev dashboard, please disconnect manually there.')
      } else {
        setLocalError(errorMessage)
      }
      setActionId(null)
    }
  }, [fetchConnections])

  const handleResetTour = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem('hasSeenOnboarding')
    } catch (error) {
      console.warn('[Settings] Unable to clear onboarding flag:', error)
    }
    toast.success(t('onboardingTour.resetSuccess'))
    setTimeout(() => {
      window.location.href = '/create'
    }, 1000)
  }, [t])

  // Use a set of provider slugs to detect when we are in "connecting" state
  // This lets us show a global loading overlay + disable the whole settings UI
  const providerSlugSetRef = useRef(new Set(Object.values(PROVIDER_SLUGS).filter(Boolean) as string[]))
  const isConnectingInProgress = actionId ? providerSlugSetRef.current.has(actionId) : false

  /**
   * Extra safety: khi user dùng popup flow, nhiều browser sẽ hỏi phép popup
   * hoặc chuyển focus qua lại giữa popup/tab. Để tránh miss postMessage edge-cases,
   * ta lắng nghe sự kiện focus trên window và nếu vừa mới bắt đầu một OAuth connect
   * (được đánh dấu bởi shouldRefetchOnFocusRef), sẽ force refresh connections + credits
   * đúng một lần khi user quay lại tab settings.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleFocus = () => {
      if (!shouldRefetchOnFocusRef.current) return

      try {
        clearConnectionsCache()
        fetchConnections(true).catch(err => {
          console.warn('[Settings] Failed to refresh connections on window focus after OAuth:', err)
        })
        refreshCredits(true).catch(err => {
          console.warn('[Settings] Failed to refresh credits on window focus after OAuth:', err)
        })
      } finally {
        // Dù thành công hay lỗi, chỉ thử một lần trên mỗi OAuth attempt
        shouldRefetchOnFocusRef.current = false
      }
    }

    // window.addEventListener('focus', handleFocus)
    // return () => {
    //   window.removeEventListener('focus', handleFocus)
    // }
  }, [fetchConnections, refreshCredits])

  return (
    <div className="relative w-full max-w-none px-2 lg:px-4 py-2 lg:py-3 h-full overflow-y-auto">
      {/* Global overlay while connecting social account (any provider) */}
      {isConnectingInProgress && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm text-center px-4">
          <div className="w-12 h-12 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
          <p className="mt-4 text-foreground text-sm sm:text-base">
            {t('connecting')}
          </p>
        </div>
      )}

      {/* Popup blocked dialog - custom instead of native alert, gives user choice */}
      {blockedPopup && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="max-w-md w-full bg-card border border-border rounded-2xl p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {t('popupBlocked')}
            </h3>
            <p className="text-sm text-foreground/80 mb-3">
              {t('popupBlockedMessage', { provider: blockedPopup.provider })}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {t('popupBlockedDesc')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <button
                onClick={() => {
                  // User chooses full-page redirect
                  const targetUrl = blockedPopup.url
                  setBlockedPopup(null)
                  // Chuyển hẳn sang OAuth trong tab hiện tại
                  window.location.href = targetUrl
                }}
                className="flex-1 px-4 py-2 text-sm rounded-md border border-border bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
              >
                {t('continueHere')}
              </button>
              <button
                onClick={() => {
                  // User has (hoặc sẽ) cho phép popup và muốn thử mở lại
                  const targetUrl = blockedPopup.url
                  const providerName = blockedPopup.provider
                  setBlockedPopup(null)

                  try {
                    const width = 600
                    const height = 700
                    const left = window.screen.width / 2 - width / 2
                    const top = window.screen.height / 2 - height / 2

                    const popup = window.open(
                      targetUrl,
                      "oauth-popup",
                      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
                    )

                    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
                      console.warn('[Settings] Retry popup still blocked, falling back to full-page redirect')
                      window.location.href = targetUrl
                      return
                    }

                    try {
                      popup.focus()
                    } catch (e) {
                      console.warn('[Settings] Could not focus popup on retry:', e)
                    }
                  } catch (err) {
                    console.warn('[Settings] Failed to retry popup, falling back to full-page redirect:', err)
                    window.location.href = targetUrl
                  }
                }}
                className="flex-1 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {t('retryPopup')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content wrapped so we can disable interactions while connecting */}
      <div className={
        `space-y-6 ${isConnectingInProgress ? 'pointer-events-none select-none opacity-60' : ''}`
      }>
        <h2 className="text-2xl font-bold mb-6">{t('title')}</h2>
        <p className="text-muted-foreground mb-6">
          {t('description')}
        </p>

        {/* Onboarding Tour Card Removed - Moved to User Profile */}


        <div className="mt-8 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1">
                {`${t('connectionsTableTitle')} (${connections.length}/${profileLimits?.limit ?? 0})`}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">{t('connectionsTableDesc')}</p>
            </div>
            <div className="w-full sm:w-auto">
              <PlatformFilter value={platformFilter} onChange={setPlatformFilter} />
            </div>
          </div>

          <div className="rounded-2xl bg-card border border-border shadow-lg shadow-black/20">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">{t('loading')}</div>
            ) : filteredConnections.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {connections.length === 0 ? t('noConnections') : t('noConnectionsFiltered')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-4 px-5 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        {t('table.platform')}
                      </th>
                      <th className="text-left py-4 px-5 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        {t('table.account')}
                      </th>
                      <th className="text-left py-4 px-5 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">
                        {t('table.connectedAt')}
                      </th>
                      <th className="text-center py-4 px-5 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">
                        {t('table.avatar')}
                      </th>
                      <th className="text-right py-4 px-5 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        {t('table.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredConnections.map((connection) => {
                      const username = connection?.profile_metadata?.username || connection?.profile_name || 'N/A'
                      const avatarUrl = connection?.profile_metadata?.avatar_url || null
                      const connectionDate = connection?.created_at ? formatDate(connection.created_at, locale) : 'N/A'
                      const connectionTime = connection?.created_at ? formatTime(connection.created_at, locale, { hour: "2-digit", minute: "2-digit" }) : ''
                      const platformName = connection.platform || 'unknown'
                      return (
                        <tr key={connection.id} className="border-b border-border last:border-0 group hover:bg-secondary/30 transition-colors">
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-3">
                              <PlatformIcon platform={platformName} size={32} variant="inline" />
                              <span className="text-sm text-foreground font-medium capitalize">
                                {platformName}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-5">
                            <span className="text-sm text-foreground/90">
                              {username.startsWith('@') ? username : `@${username}`}
                            </span>
                          </td>
                          <td className="py-4 px-5 hidden lg:table-cell">
                            <span className="text-sm text-foreground/80">
                              {connectionDate}
                              {connectionTime && (
                                <span className="text-muted-foreground">{` · ${connectionTime}`}</span>
                              )}
                            </span>
                          </td>
                          <td className="py-4 px-5 hidden lg:table-cell">
                            {avatarUrl ? (
                              <div className="flex justify-center">
                                <img
                                  src={avatarUrl}
                                  alt={username}
                                  className="w-10 h-10 rounded-full object-cover border border-border"
                                />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center mx-auto">
                                <PlatformIcon platform={platformName} size={20} />
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-5 text-right">
                            <button
                              onClick={() => handleDisconnect(connection.id)}
                              disabled={actionId === connection.id}
                              className="px-3 py-1.5 text-xs sm:text-sm bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/40 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {actionId === connection.id ? t('disconnecting') : t('disconnect')}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 sm:mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1">{t('socialConnections')}</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">{t('socialConnectionsDesc')}</p>
              {/* Inline red error message for social connections section */}
              {error && (
                <div className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/40 rounded-md px-3 py-2">
                  {error}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500 flex-shrink-0"></div>
                <span>{t('connected')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500 flex-shrink-0"></div>
                <span>{t('notConnected')}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {SOCIAL_PLATFORMS.map((platform, idx) => {
              const provider = PROVIDER_SLUGS[platform.name]
              const connection = provider ? connectionsByPlatform[provider] : undefined
              // Check if connecting: either by provider (for new connections) or by connection.id (for existing connections being reconnected)
              const isConnecting = actionId === provider || actionId === connection?.id
              const isDisabled = !provider || loading || isConnecting

              // Format date: DD/MM/YYYY
              const formatDate = (dateString?: string) => {
                if (!dateString) return ''
                try {
                  const date = new Date(dateString)
                  const day = String(date.getDate()).padStart(2, '0')
                  const month = String(date.getMonth() + 1).padStart(2, '0')
                  const year = date.getFullYear()
                  return `${day}/${month}/${year}`
                } catch {
                  return ''
                }
              }

              // Truncate ID: show first 8 characters + "..."
              const truncateId = (id?: string | null) => {
                if (!id) return ''
                return id.length > 8 ? `${id.substring(0, 8)}...` : id
              }

              // Copy ID to clipboard
              const copyIdToClipboard = (id?: string | null) => {
                if (!id) return
                navigator.clipboard.writeText(id).then(() => {
                  // Could show a toast notification here
                }).catch(() => {})
              }

              const username = connection?.profile_metadata?.username || connection?.profile_name || ''
              const email = connection?.profile_metadata?.email || ''
              const avatarUrl = connection?.profile_metadata?.avatar_url || null
              const connectionDate = formatDate(connection?.created_at)
              // Hiển thị social_media_account_id (ID của social media account connection trên getlate.dev) thay vì late_profile_id
              // social_media_account_id này là ID cần để disconnect từ getlate.dev - được trả về từ getlate.dev khi kết nối thành công
              const socialMediaAccountId = (connection as any)?.social_media_account_id || null
              // Fallback: nếu không có social_media_account_id, thử lấy từ profile_metadata (backward compatibility)
              const fallbackAccountId = socialMediaAccountId || connection?.profile_metadata?.accountId || null
              const displayId = fallbackAccountId
                || connection?.late_profile_id
                || connection?.profile_metadata?.late_profile_id
                || (connection as any)?.profile_id // <--- DÒNG QUAN TRỌNG MỚI THÊM
                || ''
              const truncatedId = truncateId(displayId)

              return (
                <button
                  key={idx}
                  onClick={() => provider && handleConnect(platform.name)}
                  disabled={isDisabled}
                  className="group flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 rounded-xl bg-muted border border-border hover:border-primary/50 hover:bg-muted/80 transition-all duration-200 disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <PlatformIcon platform={platform.name} size={36} variant="wrapper" />
                    <span className="text-sm sm:text-base text-foreground font-medium group-hover:text-foreground transition-colors truncate leading-none">
                      {platform.name}
                    </span>
                  </div>
                  <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${connection ? 'bg-green-500 shadow-lg shadow-green-500/50' : provider ? 'bg-red-500/60' : 'bg-gray-500/60'
                    }`}></div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}