"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabaseClient } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Eye, EyeOff, Loader2, GraduationCap, CheckCircle2, Lock } from "lucide-react"
import CreatorHubIcon from "@/components/shared/CreatorHubIcon"
import { useTranslations } from "next-intl"

export default function UpdatePasswordPage() {
  const router = useRouter()
  const t = useTranslations("UpdatePasswordPage")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    const hasHash = window.location.hash.length > 0

    if (!hasHash) {
      supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          toast.error(t("invalidLink"))
          router.push("/forgot-password")
        }
      })
      return
    }

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        // Valid session, user can update password
      }
    })

    const timer = setTimeout(() => {
      supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          toast.error(t("expiredLink"))
          router.push("/forgot-password")
        }
      })
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [router, t])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error(t("form.passwordMismatch"))
      return
    }

    if (password.length < 6) {
      toast.error(t("form.passwordTooShort"))
      return
    }

    setLoading(true)

    try {
      const { error } = await supabaseClient.auth.updateUser({ password })
      if (error) throw error

      setShowSuccess(true)
    } catch (error: any) {
      toast.error(error.message || "Failed to update password")
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
              Bảo mật<br />
              <span className="text-utc-gold-bright">tài khoản</span> của bạn
            </h2>

            <p className="text-white/70 text-lg max-w-sm leading-relaxed">
              Đặt mật khẩu mới để bảo vệ tài khoản CreatorHub của bạn.
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
            <div className="h-12 w-12 rounded-xl bg-utc-royal/10 flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-utc-royal" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mb-2">{t('title')}</h1>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password">{t('form.newPassword')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('form.confirmPassword')}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-12 text-base bg-gradient-to-r from-utc-royal to-utc-sky text-white shadow-sm hover:shadow-accent hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('form.updating')}</>
              ) : (
                t('form.submit')
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccess}>
        <DialogContent className="sm:max-w-sm bg-card border-border [&>button]:hidden">
          <div className="flex flex-col items-center text-center py-4 space-y-4">
            <div className="h-14 w-14 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <h3 className="text-lg font-semibold">{t('successDialog.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('successDialog.description')}</p>
            <Button
              className="w-full bg-gradient-to-r from-utc-royal to-utc-sky text-white"
              onClick={() => router.push("/signin")}
            >
              {t('successDialog.signInButton')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
