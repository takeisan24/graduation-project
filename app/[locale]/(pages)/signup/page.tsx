"use client"
import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Sparkles, Eye, EyeOff } from "lucide-react"
import Header from "@/components/shared/header"
import Footer from "@/components/shared/footer"
import Link from "next/link"
import { supabaseClient } from "@/lib/supabaseClient"
import { useAuth } from "@/hooks/useAuth"
import { useTranslations } from "next-intl"
import { getAppUrl } from "@/lib/utils/urlConfig";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function SignUpPage() {
  const router = useRouter()
  const params = useParams()
  const currentLocale = (params?.locale as string) || 'vi'
  const { isAuthenticated, loading: authLoading } = useAuth()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  // Track which OAuth provider is in progress to give precise UI feedback and avoid double submits
  const [oauthProviderLoading, setOauthProviderLoading] = useState<"google" | "facebook" | null>(null)

  const t = useTranslations('SignUpPage');
  const tCommon = useTranslations('Common.auth');

  /**
   * Handle OAuth signup (Google/Facebook)
   * Same logic as signin - Supabase will create account if email doesn't exist
   */
  const handleOAuthSignup = async (provider: "google" | "facebook") => {
    // Prevent duplicate clicks while an OAuth flow is already in progress
    if (oauthProviderLoading) return

    setError(null)
    setIsLoading(true)
    setOauthProviderLoading(provider)

    try {
      // Initiate OAuth flow directly on client so PKCE verifier is stored in browser
      const appUrl = getAppUrl()
      const redirectTo = `${appUrl}/${currentLocale}/auth/success`
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          scopes: provider === "google" ? "openid email profile" : "public_profile email",
        },
      })

      if (error) throw error
      if (!data?.url) throw new Error("Missing OAuth URL")
      window.location.href = data.url
    } catch (err: any) {
      setError(err.message || "An error occurred during OAuth signup")
      setIsLoading(false)
      setOauthProviderLoading(null)
    }
  }

  /**
   * Handle email/password signup
   */
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    if (password !== confirmPassword) {
      setError(t('form.passwordMismatch'))
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "signup",
          email,
          password,
          name: `${firstName} ${lastName}`.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Signup failed")
      }

      // Show success modal instead of direct redirect
      setShowSuccessModal(true)
    } catch (err: any) {
      setError(err.message || "An error occurred during signup")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false)
    router.push(`/${currentLocale}/signin`)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-md">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
            <p className="text-muted-foreground">
              {t('subtitle')}
            </p>
          </div>

          <Card className="p-8 bg-card border-border">
            {/* Form */}
            <form className="space-y-5" onSubmit={handleSignup}>
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t('form.firstNameLabel')}</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder={t('form.firstNamePlaceholder')}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="h-11"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t('form.lastNameLabel')}</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder={t('form.lastNamePlaceholder')}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="h-11"
                    required
                  />
                </div>
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">{tCommon('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={tCommon('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                  required
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password">{tCommon('password')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={tCommon('passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('form.confirmPasswordLabel')}</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder={t('form.confirmPasswordPlaceholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-11 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Sign Up Button */}
              <Button type="submit" className="w-full h-11 text-base" size="lg" disabled={isLoading}>
                {isLoading ? "Signing up..." : t('form.signUpButton')}
              </Button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-card text-muted-foreground">{t('divider')}</span>
                </div>
              </div>

              {/* Social Sign Up Buttons */}
              <div className="grid grid-cols-1 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => handleOAuthSignup("google")}
                  disabled={isLoading || oauthProviderLoading !== null}
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {oauthProviderLoading === "google" ? "..." : tCommon('google')}
                </Button>

                {/* <Button 
              type="button" 
              variant="outline" 
              className="w-full h-11"
              onClick={() => handleOAuthSignup("facebook")}
              disabled={isLoading || oauthProviderLoading !== null}
            >
              <svg className="w-5 h-5 mr-2" fill="#1877F2" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              {oauthProviderLoading === "facebook" ? "..." : tCommon('facebook')}
            </Button> */}
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {/* Sign In Link */}
              <div className="text-center pt-4">
                <span className="text-sm text-muted-foreground">{t('hasAccount')}</span>
                <Link href="/signin" className="text-sm text-primary hover:underline font-medium">
                  {t('signInLink')}
                </Link>
              </div>
            </form>
          </Card>
        </div>
      </div>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-center text-primary flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              {t('successModal.title')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-4 text-center space-y-4">
            <p className="text-muted-foreground">
              {t('successModal.description')}
            </p>
            <Button onClick={handleCloseSuccessModal} className="w-full">
              {t('successModal.signInButton')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  )
}
