"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import { supabaseClient } from "@/lib/supabaseClient"
import Header from "@/components/shared/header"
import Footer from "@/components/shared/footer"
import { Sparkles, CheckCircle2 } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { useCreditsStore } from "@/store"

/**
 * Page to handle OAuth callback success
 * Redirects user after setting session
 */
export default function AuthSuccessPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { isAuthenticated } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const autoRedirectRef = useRef<HTMLButtonElement | null>(null)

  // Get locale from URL params (e.g., /vi/auth/success or /en/auth/success)
  const currentLocale = (params?.locale as string) || 'vi'
  const redirectPath = searchParams.get('next') ? decodeURIComponent(searchParams.get('next')!) : `/${currentLocale}/create`

  const navigateToCreate = useCallback(() => {
    try {
      window.location.href = redirectPath
    } catch (navErr) {
      console.error('[AuthSuccess] Failed to navigate via button fallback:', navErr)
      router.push(redirectPath)
    }
  }, [redirectPath, router])

  useEffect(() => {
    const handleAuthSuccess = async () => {
      try {
        // Get session from URL params
        const sessionParam = searchParams.get("session")

        if (sessionParam) {
          // Case 1: Session is passed via query (server-exchanged flow)
          const session = JSON.parse(decodeURIComponent(sessionParam))

          // Update credits from session data if available
          if (session?.creditsRemaining !== undefined) {
            const { updateCredits } = useCreditsStore.getState();
            updateCredits(session.creditsRemaining);
          }

          const { error: sessionError } = await supabaseClient.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          })
          if (sessionError) throw sessionError
          // Hydrate credits from backend to ensure accuracy after OAuth session set
          try {
            const { refreshCredits } = useCreditsStore.getState();
            await refreshCredits();
          } catch (e) {
            console.warn('[AuthSuccess] refreshCredits failed:', e)
          }
        } else {
          // Case 2: No session param - rely on detectSessionInUrl and persisted session
          // Wait for SIGNED_IN event or an existing session for up to ~3s
          const waitForSession = async (): Promise<void> => {
            return new Promise((resolve, reject) => {
              let resolved = false
              // Reduce wait time to speed up redirect experience
              const timeout = setTimeout(async () => {
                if (resolved) return
                const { data: { session } } = await supabaseClient.auth.getSession()
                if (session) {
                  resolved = true
                  resolve()
                } else {
                  reject(new Error("No session found after OAuth redirect"))
                }
              }, 1000) // was 3000ms, reduced to 1500ms to avoid long wait

              const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event, session) => {
                if (!resolved && event === 'SIGNED_IN' && session) {
                  resolved = true
                  clearTimeout(timeout)
                  subscription.unsubscribe()
                  resolve()
                }
              })
            })
          }

          await waitForSession()
        }

        // Best-effort: ensure user profile exists via RPC on the client as well
        try {
          const { data: { session } } = await supabaseClient.auth.getSession()
          if (session?.user?.id) {
            await supabaseClient.rpc('ensure_user_profile', {
              p_user_id: session.user.id,
              p_email: session.user.email,
              p_name: (session.user.user_metadata?.full_name || session.user.user_metadata?.name) ?? null,
              p_avatar_url: (session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture) ?? null,
            })
          }
        } catch (e) {
          // non-blocking
          console.warn('[AuthSuccess] ensure_user_profile RPC warning:', e)
        }

        // Verify session exists before redirecting
        const { data: { session: finalSession } } = await supabaseClient.auth.getSession()
        if (!finalSession) {
          throw new Error("Session not found after authentication")
        }

        console.log('[AuthSuccess] Authentication successful, redirecting to create page with locale:', currentLocale)

        // Redirect to create page with locale prefix (e.g., /vi/create or /en/create)
        // Use window.location for full page reload to ensure all state is properly initialized
        navigateToCreate()
      } catch (err: any) {
        console.error("Auth success error:", err)
        setError(err.message || "Failed to complete authentication")
        setIsLoading(false)
      }
    }

    handleAuthSuccess()
  }, [searchParams, router, isAuthenticated, currentLocale, navigateToCreate])

  useEffect(() => {
    if (error) return
    const timer = setTimeout(() => {
      autoRedirectRef.current?.click()
    }, 500) // Reduced from 1000ms for faster experience
    return () => clearTimeout(timer)
  }, [error])

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-destructive/10 rounded-2xl mb-4">
              <span className="text-destructive text-2xl">✕</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Authentication Failed</h1>
            <p className="text-muted-foreground mb-4">{error}</p>
            <button
              onClick={() => router.push("/signin")}
              className="text-primary hover:underline"
            >
              Return to Sign In
            </button>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/10 rounded-2xl mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Authentication Successful!</h1>
          <p className="text-muted-foreground">
            {isLoading ? "Setting up your account..." : "Redirecting..."}
          </p>
          <button
            ref={autoRedirectRef}
            onClick={navigateToCreate}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
            disabled={Boolean(error)}
          >
            Tới trang tạo content
          </button>
        </div>
      </div>
      <Footer />
    </div>
  )
}

