"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
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
  const { user, session, loading, isAuthenticated } = useAuth()

  useEffect(() => {
    // Don't redirect while loading - wait for auth check to complete
    if (loading) {
      return
    }

    // Redirect if auth is required but user is not authenticated
    // Add a delay to give time for session to load from localStorage
    if (requireAuth && !isAuthenticated) {
      const timeoutId = setTimeout(() => {
        router.push(redirectTo)
      }, 300) // Increased delay to ensure session has time to load

      return () => clearTimeout(timeoutId)
    }
  }, [loading, isAuthenticated, requireAuth, redirectTo, router, user, session])

  return {
    user,
    session,
    loading,
    isAuthenticated,
  }
}

