"use client"

import { useEffect, useState } from "react"
import { getAppUrl } from "@/lib/utils/urlConfig"

/**
 * OAuth Popup Component
 * Handles OAuth flow in a popup window instead of redirecting the entire page
 * 
 * Usage:
 * <OAuthPopup
 *   url={oauthUrl}
 *   onSuccess={() => { /* handle success *\/ }}
 *   onError={(error) => { /* handle error *\/ }}
 *   onClose={() => { /* handle close *\/ }}
 * />
 */
interface OAuthPopupProps {
  url: string
  onSuccess?: () => void
  onError?: (error: string) => void
  onClose?: () => void
}

export function OAuthPopup({ url, onSuccess, onError, onClose }: OAuthPopupProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [popup, setPopup] = useState<Window | null>(null)

  useEffect(() => {
    if (!isOpen || !url) return

    // Open popup window
    const width = 600
    const height = 700
    const left = window.screen.width / 2 - width / 2
    const top = window.screen.height / 2 - height / 2

    const popupWindow = window.open(
      url,
      "oauth-popup",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
    )

    if (!popupWindow) {
      onError?.("Popup blocked. Please allow popups for this site.")
      setIsOpen(false)
      return
    }

    setPopup(popupWindow)

    // Poll for popup to close or redirect
    const pollInterval = setInterval(() => {
      try {
        if (popupWindow.closed) {
          clearInterval(pollInterval)
          setIsOpen(false)
          setPopup(null)
          onClose?.()
          return
        }

        // Check if popup has redirected to callback URL
        // Note: This won't work due to CORS, so we rely on postMessage instead
        // The callback page should send a postMessage when done
      } catch (e) {
        // Cross-origin error is expected - popup is on different domain
      }
    }, 500)

    // Listen for postMessage from popup
    const messageHandler = (event: MessageEvent) => {
      // Verify origin for security
      const allowedOrigins = [
        window.location.origin,
        getAppUrl()
      ]

      if (!allowedOrigins.includes(event.origin)) {
        console.warn("[OAuthPopup] Message from unauthorized origin:", event.origin)
        return
      }

      if (event.data?.type === "oauth-success") {
        clearInterval(pollInterval)
        popupWindow.close()
        setIsOpen(false)
        setPopup(null)
        onSuccess?.()
      } else if (event.data?.type === "oauth-error") {
        clearInterval(pollInterval)
        popupWindow.close()
        setIsOpen(false)
        setPopup(null)
        onError?.(event.data.error || "OAuth error occurred")
      }
    }

    window.addEventListener("message", messageHandler)

    return () => {
      clearInterval(pollInterval)
      window.removeEventListener("message", messageHandler)
      if (popupWindow && !popupWindow.closed) {
        popupWindow.close()
      }
    }
  }, [isOpen, url, onSuccess, onError, onClose])

  const open = () => {
    setIsOpen(true)
  }

  const close = () => {
    if (popup) {
      popup.close()
    }
    setIsOpen(false)
    setPopup(null)
    onClose?.()
  }

  return { open, close, isOpen }
}

