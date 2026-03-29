"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Loader2, GraduationCap, CheckCircle2 } from "lucide-react"
import CreatorHubIcon from "@/components/shared/CreatorHubIcon"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { supabaseClient } from "@/lib/supabaseClient"
import { toast } from "sonner"

export default function ForgotPasswordPage() {
  const t = useTranslations('ForgotPasswordPage')
  const tCommon = useTranslations('Common.auth')
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const baseUrl = window.location.origin
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${baseUrl}/auth/update-password`,
      })
      if (error) throw error

      setSuccess(true)
      toast.success("Password reset link sent to your email")
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset password email")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel - UTC Branding */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-gradient-to-br from-utc-navy via-utc-royal to-utc-sky">
        <div className="dot-pattern absolute inset-0" />
        <div className="radial-glow w-[500px] h-[500px] -top-40 -left-40 bg-utc-sky/10" />
        <div className="radial-glow w-[400px] h-[400px] -bottom-32 -right-32 bg-utc-gold/8" />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <CreatorHubIcon className="h-10 w-10" />
            <span className="text-xl font-semibold tracking-tight">CreatorHub</span>
          </div>

          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 bg-white/10 text-sm">
              <GraduationCap className="h-4 w-4" />
              <span className="font-mono text-xs uppercase tracking-wider">Đồ án tốt nghiệp — UTC</span>
            </div>

            <h2 className="text-4xl font-display leading-tight">
              Khôi phục<br />
              <span className="text-utc-gold-bright">tài khoản</span> của bạn
            </h2>

            <p className="text-white/70 text-lg max-w-sm leading-relaxed">
              Đừng lo lắng, chúng tôi sẽ gửi link đặt lại mật khẩu qua email cho bạn.
            </p>
          </div>

          <p className="text-white/40 text-sm">Trường Đại học Giao thông Vận tải</p>
        </div>
      </div>

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

          {success ? (
            <div className="text-center space-y-6 py-8">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Check your email</h3>
                <p className="text-muted-foreground">
                  We have sent a password reset link to{" "}
                  <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>
              <Link
                href="/signin"
                className="inline-flex items-center gap-2 text-sm text-utc-royal hover:underline font-medium"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('backToSignIn')}
              </Link>
            </div>
          ) : (
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
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
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
          )}
        </div>
      </div>
    </div>
  )
}
