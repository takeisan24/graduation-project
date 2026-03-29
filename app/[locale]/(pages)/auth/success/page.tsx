"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import { supabaseClient } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Loader2, ArrowRight, XCircle } from "lucide-react"
import CreatorHubIcon from "@/components/shared/CreatorHubIcon"
import { useAuth } from "@/hooks/useAuth"
import { useTranslations } from "next-intl"

export default function AuthSuccessPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { isAuthenticated } = useAuth()
  const t = useTranslations("AuthSuccessPage")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const autoRedirectRef = useRef<HTMLButtonElement | null>(null)

  const currentLocale = (params?.locale as string) || 'vi'
  const redirectPath = searchParams.get('next') ? decodeURIComponent(searchParams.get('next')!) : `/${currentLocale}/create`

  const navigateToCreate = useCallback(() => {
    try {
      window.location.href = redirectPath
    } catch {
      router.push(redirectPath)
    }
  }, [redirectPath, router])

  useEffect(() => {
    const handleAuthSuccess = async () => {
      try {
        const sessionParam = searchParams.get("session")

        if (sessionParam) {
          const session = JSON.parse(decodeURIComponent(sessionParam))
          const { error: sessionError } = await supabaseClient.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          })
          if (sessionError) throw sessionError
        } else {
          await new Promise<void>((resolve, reject) => {
            let resolved = false
            const timeout = setTimeout(async () => {
              if (resolved) return
              const { data: { session } } = await supabaseClient.auth.getSession()
              if (session) { resolved = true; resolve() }
              else reject(new Error("No session found after OAuth redirect"))
            }, 1000)

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

        // Ensure user profile exists
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
        } catch {
          // non-blocking
        }

        const { data: { session: finalSession } } = await supabaseClient.auth.getSession()
        if (!finalSession) throw new Error("Session not found after authentication")

        setIsLoading(false)
        // Auto redirect after showing success
        setTimeout(navigateToCreate, 1500)
      } catch (err: any) {
        setError(err.message || "Failed to complete authentication")
        setIsLoading(false)
      }
    }

    handleAuthSuccess()
  }, [searchParams, router, isAuthenticated, currentLocale, navigateToCreate])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex justify-center mb-2">
          <CreatorHubIcon className="h-12 w-12" />
        </div>

        {error ? (
          <>
            <div className="h-16 w-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-xl font-semibold">{t("errorTitle")}</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              onClick={() => router.push("/signin")}
              className="w-full"
            >
              {t("backToSignIn")}
            </Button>
          </>
        ) : isLoading ? (
          <>
            <div className="h-16 w-16 mx-auto rounded-full bg-utc-royal/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-utc-royal animate-spin" />
            </div>
            <h1 className="text-xl font-semibold">{t("settingUp")}</h1>
            <div className="flex justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-utc-royal animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="h-16 w-16 mx-auto rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h1 className="text-xl font-semibold">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("redirecting")}</p>
            <Button
              ref={autoRedirectRef}
              onClick={navigateToCreate}
              className="w-full bg-gradient-to-r from-utc-royal to-utc-sky text-white"
            >
              {t("goToCreate")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
