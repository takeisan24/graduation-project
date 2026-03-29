"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ArrowLeft, Loader2, Mail } from "lucide-react"
import CreatorHubIcon from "@/components/shared/CreatorHubIcon"
import AuthBrandPanel from "@/components/shared/AuthBrandPanel"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { supabaseClient } from "@/lib/supabaseClient"
import { toast } from "sonner"

export default function ForgotPasswordPage() {
  const t = useTranslations('ForgotPasswordPage')
  const tCommon = useTranslations('Common.auth')
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const baseUrl = window.location.origin
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${baseUrl}/auth/update-password`,
      })
      if (error) throw error

      setShowSuccess(true)
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset password email")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      <AuthBrandPanel variant="forgotPassword" />

      {/* Right panel - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <CreatorHubIcon className="h-9 w-9" />
            <span className="text-lg font-semibold tracking-tight">
              Creator<span className="gradient-text">Hub</span>
            </span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight mb-2">{t('title')}</h1>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">{tCommon('email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={tCommon('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
                required
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-12 text-base bg-gradient-to-r from-utc-royal to-utc-sky text-white shadow-sm hover:shadow-accent hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('form.sending')}</>
              ) : (
                t('form.submitButton')
              )}
            </Button>

            <div className="text-center pt-4">
              <Link
                href="/signin"
                className="inline-flex items-center gap-2 text-sm text-utc-royal hover:underline font-medium"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('backToSignIn')}
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <div className="flex flex-col items-center text-center py-4 space-y-4">
            <div className="h-14 w-14 rounded-full bg-utc-royal/10 flex items-center justify-center">
              <Mail className="h-7 w-7 text-utc-royal" />
            </div>
            <h3 className="text-lg font-semibold">{t('successDialog.title')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('successDialog.description')}{" "}
              <span className="font-medium text-foreground">{email}</span>
            </p>
            <p className="text-xs text-muted-foreground">{t('successDialog.checkInbox')}</p>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/signin">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('successDialog.backToSignIn')}
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
