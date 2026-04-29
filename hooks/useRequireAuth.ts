"use client"

import { useEffect } from "react"
import { useLocale } from "next-intl"
import { useRouter } from "@/i18n/navigation"
import { useAuth } from "./useAuth"

/**
 * Hook to protect routes - redirects to signin if user is not authenticated
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.redirectTo - URL to redirect to if not authenticated (default: "/signin")
 * @param {boolean} options.requireAuth - Whether authentication is required (default: true)
 * 
 * @returns {Object} Auth state (same as useAuth)
 */
export function useRequireAuth(options: { redirectTo?: string; requireAuth?: boolean } = {}) {
  const { redirectTo = "/signin", requireAuth = true } = options
  const router = useRouter()
  const locale = useLocale()
  const { user, session, loading, isAuthenticated } = useAuth()
  const resolvedRedirect = redirectTo.startsWith("/")
    ? `/${locale}${redirectTo}`
    : redirectTo

  useEffect(() => {
    // Don't redirect while loading - wait for auth check to complete
    if (loading) {
      return
    }

    if (requireAuth && !isAuthenticated) {
      router.replace(resolvedRedirect)
    }
  }, [loading, isAuthenticated, requireAuth, resolvedRedirect, router, user, session])

  return {
    user,
    session,
    loading,
    isAuthenticated,
  }
}

