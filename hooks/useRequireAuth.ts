"use client"

import { useEffect } from "react"
import { useRouter } from "@/i18n/navigation"
import { useAuth } from "./useAuth"

export function useRequireAuth(options: { redirectTo?: string; requireAuth?: boolean } = {}) {
  const { redirectTo = "/signin", requireAuth = true } = options
  const router = useRouter()
  const { user, session, loading, isAuthenticated } = useAuth()
  useEffect(() => {
    if (loading) {
      return
    }

    if (requireAuth && !isAuthenticated) {
      router.replace(redirectTo)
    }
  }, [loading, isAuthenticated, requireAuth, redirectTo, router, user, session])

  return {
    user,
    session,
    loading,
    isAuthenticated,
  }
}

