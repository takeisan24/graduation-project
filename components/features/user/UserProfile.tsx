"use client"

import { useState, useEffect } from "react"
import { supabaseClient } from "@/lib/supabaseClient"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2, RotateCcw, Save, User, Mail, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"

export default function UserProfile() {
  const router = useRouter()
  const { user, refreshSession } = useAuth()
  const t = useTranslations("CreatePage.userProfile")

  const [isSaving, setIsSaving] = useState(false)
  const [name, setName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")

  useEffect(() => {
    if (user) {
      setName(user.user_metadata?.name || user.user_metadata?.full_name || "")
      setAvatarUrl(user.user_metadata?.avatar_url || "")
    }
  }, [user])

  const handleUpdateProfile = async () => {
    if (!user) return
    setIsSaving(true)
    try {
      const { error } = await supabaseClient.auth.updateUser({
        data: { name, avatar_url: avatarUrl },
      })

      if (error) throw error

      await supabaseClient.from("users").update({ name, avatar_url: avatarUrl }).eq("id", user.id)
      await refreshSession()
      toast.success(t("toast.updateSuccess"))
    } catch (error: unknown) {
      console.error(error)
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error(`${t("toast.updateError")}: ${message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetTour = () => {
    try {
      localStorage.removeItem("hasSeenOnboarding")
      toast.success(t("toast.resetTourSuccess"))
      setTimeout(() => {
        router.push("/create")
      }, 1000)
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 pb-20 text-foreground md:p-6 md:pb-6">
      <h1 className="mb-6 text-2xl font-bold md:mb-8 md:text-3xl">{t("title")}</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-border bg-card text-foreground lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("basicInfo.title")}</CardTitle>
            <CardDescription className="text-muted-foreground">{t("basicInfo.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-secondary/35 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  {t("basicInfo.email")}
                </div>
                <p className="break-all text-sm font-medium text-foreground">{user?.email || "N/A"}</p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-secondary/35 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  Trạng thái tài khoản
                </div>
                <p className="text-sm font-medium text-foreground">Đã xác thực và sẵn sàng sử dụng các tính năng quản lý nội dung.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("basicInfo.displayName")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-border bg-secondary text-foreground focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("basicInfo.avatarUrl")}</Label>
              <Input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="border-border bg-secondary text-foreground focus:border-primary"
                placeholder="https://example.com/avatar.jpg"
              />
            </div>

            <div className="pt-2">
              <Button onClick={handleUpdateProfile} disabled={isSaving} className="bg-primary hover:bg-primary/90">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" /> {t("basicInfo.save")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="border-border bg-card text-foreground">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Hồ sơ hệ thống
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Tóm tắt nhanh thông tin tài khoản phục vụ cho đồ án và phần demo sản phẩm.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Vai trò</p>
                <p className="mt-2 text-sm font-semibold text-foreground">Quản trị nội dung</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Trọng tâm sử dụng</p>
                <p className="mt-2 text-sm text-foreground">Tạo nội dung, điều phối lịch đăng và quản lý tài khoản mạng xã hội.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card text-foreground">
            <CardHeader>
              <CardTitle>{t("appSettings.title")}</CardTitle>
              <CardDescription className="text-muted-foreground">{t("appSettings.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border bg-secondary p-4">
                <h4 className="mb-1 font-medium text-foreground">{t("appSettings.resetTour")}</h4>
                <p className="mb-3 text-xs text-muted-foreground">{t("appSettings.resetTourDesc")}</p>
                <Button variant="outline" size="sm" onClick={handleResetTour} className="w-full border-border text-foreground hover:bg-secondary">
                  <RotateCcw className="mr-2 h-3 w-3" /> {t("appSettings.resetTourBtn")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
