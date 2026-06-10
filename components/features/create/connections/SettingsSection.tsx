"use client"

import Image from "next/image"
import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { useShallow } from "zustand/react/shallow"
import { SOCIAL_PLATFORMS } from '@/lib/constants/platforms'
import { PlatformIcon } from '@/components/shared/PlatformIcon'
import { supabaseClient } from "@/lib/supabaseClient"
import { formatDate } from "@/lib/utils/date"
import { clearConnectionsCache } from "@/lib/cache/connectionsCache";
import { getAppUrl } from "@/lib/utils/urlConfig";
import { useConnectionsStore } from "@/store"
import { Settings } from "lucide-react"
import SectionHeader from '../layout/SectionHeader'
import PreviewNotice from "../shared/PreviewNotice"
import { toast } from "sonner"
import { useLocale, useTranslations } from "next-intl"
import { handleErrorWithModal } from "@/lib/utils/errorHandler"
import { handleUnauthorizedOnClient } from "@/lib/utils/authClient"
import { getPlatformColors } from '@/lib/constants/platformColors'
import { createPreviewConnectedAccount, getCreatePreviewCopy, getPreviewConnectedAccounts, isCreatePreviewEnabled } from "@/lib/mocks/createSectionPreview"

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
    avatar_url?: string | null
    accountId?: string | null
    [key: string]: unknown
  }
  created_at?: string
  social_media_account_id?: string | null
  profile_id?: string | null
}

const PROVIDER_SLUGS: Record<string, string | null> = {
  TikTok: "tiktok",
  Instagram: "instagram",
  YouTube: "youtube",
  Facebook: "facebook",
  X: "x",
  Twitter: "x",
  "X (Twitter)": "x",
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
  const t = useTranslations('CreatePage.connections')
  const tHeaders = useTranslations('CreatePage.sectionHeaders')
  const locale = useLocale(); // Lấy ngôn ngữ hiện tại ('vi' hoặc 'en')
  // Tối ưu: Dùng trực tiếp từ store thay vì local state để tránh duplicate state
  const {
    connectedAccounts,
    hasLoadedConnectedAccounts,
    connectedAccountsLoading,
    connectedAccountsError,
    loadConnectedAccounts,
    refreshConnectedAccounts,
  } = useConnectionsStore(useShallow((state) => ({
    connectedAccounts: state.connectedAccounts,
    hasLoadedConnectedAccounts: state.hasLoadedConnectedAccounts,
    connectedAccountsLoading: state.connectedAccountsLoading,
    connectedAccountsError: state.connectedAccountsError,
    loadConnectedAccounts: state.loadConnectedAccounts,
    refreshConnectedAccounts: state.refreshConnectedAccounts,
  })))
  const [actionId, setActionId] = useState<string | null>(null)
  const hasFetchedRef = useRef(false) // Track if initial fetch has completed
  // Track whether we should force a refresh on next window focus after an OAuth attempt
  const shouldRefetchOnFocusRef = useRef(false)

  // Map store state to component state for backward compatibility
  const connections = useMemo(() => connectedAccounts ?? [], [connectedAccounts])
  const loading = connectedAccountsLoading
  // Giữ local error state để hiển thị lỗi từ các actions (connect, disconnect, etc.)
  const [localError, setLocalError] = useState<string | null>(null)
  const error = localError || connectedAccountsError
  const previewCopy = useMemo(() => getCreatePreviewCopy(locale), [locale])
  const [previewConnections, setPreviewConnections] = useState(() => getPreviewConnectedAccounts())
  const isPreviewMode = isCreatePreviewEnabled() && hasLoadedConnectedAccounts && !loading && connections.length === 0
  const displayConnections = isPreviewMode ? previewConnections : connections

  /**
   * Fetches connections using store's loadConnectedAccounts (có cache 30s)
   * Tối ưu: Dùng store thay vì gọi API trực tiếp
   */
  const fetchConnections = useCallback(async (force = false) => {
    try {
      // Dùng store's loadConnectedAccounts (đã có cache mechanism)
      await loadConnectedAccounts(force)
      setLocalError(null) // Clear local error on success
    } catch (err: unknown) {
      console.error('[Settings] Failed to load connections:', err)
      setLocalError(err instanceof Error ? err.message : 'Failed to load connections')
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
        const errorMessage = errorParam || t('oauthFailedMessage', { provider: providerLabel })

        // Set inline error below social connections block
        setLocalError(errorMessage)

        // Show toast error for visibility
        toast.error(t('oauthFailedTitle', { provider: providerLabel }), {
          description: errorMessage,
          duration: 6000,
        })
      } else if (oauthCallback === 'success' || connectedParam === 'true') {
        // Optional: show success toast when connection succeeded via full-page redirect
        toast.success(t('oauthSuccessTitle', { provider: providerLabel }), {
          duration: 4000,
        })
      }

      // Force refresh connections to reflect latest state
      clearConnectionsCache()
      // Use the same fetch helper with force=true to ensure we bypass any cache
      fetchConnections(true).catch(err => {
        console.warn('[Settings] Failed to refresh connections after OAuth callback:', err)
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
  }, [fetchConnections, t])

  const connectionsByPlatform = useMemo(() => {
    const map: Record<string, LateConnection> = {}
    displayConnections.forEach((conn) => {
      if (conn.platform) {
        // Map ConnectedAccount to LateConnection format (handle undefined profile_name)
        map[conn.platform.toLowerCase()] = {
          ...conn,
          profile_name: conn.profile_name ?? null
        } as LateConnection
      }
    })
    return map
  }, [displayConnections])

  const [blockedPopup, setBlockedPopup] = useState<{ provider: string; url: string } | null>(null)

  const handleConnect = useCallback(async (platformName: string) => {
    const provider = PROVIDER_SLUGS[platformName]
    if (!provider) {
      console.warn(`[Settings] Provider for ${platformName} is not supported yet.`)
      return
    }

    if (isPreviewMode) {
      if (displayConnections.some((connection) => connection.platform?.toLowerCase() === provider)) {
        return
      }

      setActionId(provider)
      setLocalError(null)

      await new Promise((resolve) => window.setTimeout(resolve, 450))

      setPreviewConnections((current) => [...current, createPreviewConnectedAccount(platformName)])
      setActionId(null)
      toast.success(t('previewConnectSuccess', { platform: platformName }))
      return
    }

    try {
      setActionId(provider)
      setLocalError(null)
      // Mark that after this OAuth attempt, if user returns focus to this window,
      // we should force a refresh of connections (extra safety for popup edge cases)
      shouldRefetchOnFocusRef.current = true

      const returnTo = typeof window !== 'undefined' ? window.location.href : ''
      const { data: { session } } = await supabaseClient.auth.getSession()

      // Route nội bộ canonical cho flow kết nối tài khoản trong phạm vi đồ án.
      const res = await fetch(`/api/connections/start/${provider}?json=1&returnTo=${encodeURIComponent(returnTo)}&popup=1`, {
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
        let errorData: Record<string, unknown> = { error: errorText || `HTTP ${res.status}` }

        // Try to parse JSON error if possible
        try {
          errorData = JSON.parse(errorText)
        } catch {
          // Not JSON, use text as is
        }

        // Handle error with modal (will show both toast and modal if it's a limit/credits error)
        await handleErrorWithModal(
          errorData,
          String(errorData.error || errorData.message || `HTTP ${res.status}`)
        )

        // Set error and clear action immediately (before popup opens)
        const errorMessage = String(errorData.message || errorData.error || errorText || `HTTP ${res.status}`)
        setLocalError(errorMessage)
        setActionId(null)
        throw new Error(errorMessage)
      }
      const json = await res.json()

      if (!json?.url) {
        throw new Error('Missing OAuth redirect URL from backend')
      }

      // Only append token for same-origin popup URLs (local preview flow).
      // External Zernio OAuth URLs must not have our token appended.
      const isSameOrigin = json.url.startsWith(window.location.origin)
      const popupUrl = isSameOrigin && session?.access_token
        ? `${json.url}&token=${encodeURIComponent(session.access_token)}`
        : json.url

      // Use popup window for better UX instead of redirecting entire page
      // Mở popup ngay lập tức để user thấy OAuth login page
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2

      // Mở popup ngay lập tức với URL từ backend
      const popup = window.open(
        popupUrl,
        "oauth-popup",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      )

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        // Popup bị block hoặc không mở được
        console.warn('[Settings] Popup blocked or failed to open. Asking user to choose popup or full-page.')
        // Clear global loading state so user can interact with the page again
        setActionId(null)
        // Store info so we can either retry popup or fallback to full-page later
        setBlockedPopup({ provider, url: popupUrl })
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
          // still try to refresh connections once. This covers edge cases where
          // browser asks for popup permission each time and message handler might not fire reliably.
          try {
            clearConnectionsCache()
            fetchConnections(true).catch(err => {
              console.warn('[Settings] Failed to refresh connections after popup closed:', err)
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
  }, [displayConnections, fetchConnections, isPreviewMode, t])

  /**
   * Handles disconnecting a social media account
   * After successful disconnect, forces a fresh fetch to update the UI
   */
  const handleDisconnect = useCallback(async (connectionId: string) => {
    if (isPreviewMode) {
      setActionId(connectionId)
      await new Promise((resolve) => window.setTimeout(resolve, 250))
      setPreviewConnections((current) => current.filter((connection) => connection.id !== connectionId))
      setActionId(null)
      toast.success(t('previewDisconnectSuccess'))
      return
    }

    try {
      setActionId(connectionId)
      const { data: { session } } = await supabaseClient.auth.getSession()
      const res = await fetch(`/api/connections/${connectionId}`, {
        method: 'DELETE',
        headers: {
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
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
    } catch (err: unknown) {
      console.error('[Settings] Failed to disconnect:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect account'
      if (errorMessage.includes('getlate.dev') || errorMessage.includes('405') || errorMessage.includes('Method Not Allowed')) {
        // Connection removed from local DB but may still appear in getlate.dev dashboard
        setLocalError('Connection removed from system. If it still appears in getlate.dev dashboard, please disconnect manually there.')
      } else {
        setLocalError(errorMessage)
      }
      setActionId(null)
    }
  }, [isPreviewMode, refreshConnectedAccounts, t])

  // Use a set of provider slugs to detect when we are in "connecting" state
  // This lets us show a global loading overlay + disable the whole settings UI
  const providerSlugSetRef = useRef(new Set(Object.values(PROVIDER_SLUGS).filter(Boolean) as string[]))
  const isConnectingInProgress = actionId ? providerSlugSetRef.current.has(actionId) : false

  /**
   * Extra safety: khi user dùng popup flow, nhiều browser sẽ hỏi phép popup
   * hoặc chuyển focus qua lại giữa popup/tab. Để tránh miss postMessage edge-cases,
   * ta lắng nghe sự kiện focus trên window và nếu vừa mới bắt đầu một OAuth connect
   * (được đánh dấu bởi shouldRefetchOnFocusRef), sẽ force refresh connections
   * đúng một lần khi user quay lại tab settings.
   */
  return (
    <div className="relative w-full max-w-none py-2 lg:py-3 h-full overflow-y-auto">
      {/* Global overlay while connecting social account (any provider) */}
      {isConnectingInProgress && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm text-center px-4">
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
        <SectionHeader icon={Settings} title={tHeaders('connections.title')} description={tHeaders('connections.description')} />
        <div className="mx-auto w-full max-w-[1440px] px-4 pb-8 sm:px-6 xl:px-8">
        <div className="space-y-8">
        {isPreviewMode ? (
          <PreviewNotice badge={previewCopy.badge} description={previewCopy.emptyDescription} />
        ) : null}

        {/* Onboarding Tour Card Removed - Moved to User Profile */}

        <div className="mt-2 sm:mt-4">
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
              const isConnecting = actionId === provider || actionId === connection?.id
              const isDisabled = !provider || loading || isConnecting
              const platColors = getPlatformColors(platform.name)

              const rawUsername = connection?.profile_metadata?.username || connection?.profile_name || ''
              const displayUsername = rawUsername ? (rawUsername.startsWith('@') ? rawUsername : `@${rawUsername}`) : ''
              const avatarUrl = connection?.profile_metadata?.avatar_url || null
              const connectedAt = connection?.created_at ? formatDate(connection.created_at, locale) : ''

              const handleCardClick = () => {
                // Đã kết nối → mở popup để THÊM/ĐỔI tài khoản cùng nền tảng; chưa kết nối → kết nối mới.
                if (!provider || isDisabled) return
                handleConnect(platform.name)
              }

              return (
                <div
                  key={idx}
                  role="button"
                  tabIndex={isDisabled ? -1 : 0}
                  aria-disabled={isDisabled}
                  onClick={handleCardClick}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) { e.preventDefault(); handleCardClick() }
                  }}
                  title={connection ? t('connect') : undefined}
                  className={`group flex flex-col gap-3 rounded-2xl border p-4 sm:p-5 transition-all duration-200 ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50 hover:shadow-md'} ${
                    connection
                      ? `${platColors.tint} ${platColors.darkTint} ${platColors.border}`
                      : 'bg-muted border-border hover:bg-muted/80'
                  }`}
                >
                  {/* Hàng tiêu đề: icon + tên + chấm trạng thái */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <PlatformIcon platform={platform.name} size={36} variant="wrapper" />
                      <span className="text-sm sm:text-base text-foreground font-medium truncate leading-none">
                        {platform.name}
                      </span>
                    </div>
                    <span className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${connection ? 'bg-green-500 shadow-lg shadow-green-500/50' : provider ? 'bg-red-500/60' : 'bg-gray-500/60'}`}></span>
                  </div>

                  {connection ? (
                    <>
                      {/* Thông tin tài khoản đã kết nối */}
                      <div className="flex items-center gap-3 min-w-0">
                        {avatarUrl ? (
                          <Image
                            unoptimized
                            src={avatarUrl}
                            alt={displayUsername || platform.name}
                            width={36}
                            height={36}
                            className="w-9 h-9 rounded-full object-cover border border-border flex-shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                            <PlatformIcon platform={platform.name} size={18} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{displayUsername || t('connected')}</p>
                          {connectedAt && <p className="text-xs text-muted-foreground truncate">{connectedAt}</p>}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDisconnect(connection.id) }}
                        disabled={actionId === connection.id}
                        className="self-start px-3 py-1.5 text-xs sm:text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/40 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionId === connection.id ? t('disconnecting') : t('disconnect')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (!isDisabled) handleConnect(platform.name) }}
                      disabled={isDisabled}
                      className="self-start px-3 py-1.5 text-xs sm:text-sm bg-primary/10 hover:bg-primary/20 text-primary border border-primary/40 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isConnecting ? t('connecting') : t('connect')}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        </div>
        </div>
      </div>
    </div>
  )
}
