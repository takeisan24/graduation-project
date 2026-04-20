"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { UserIdentity } from "@supabase/supabase-js"
import { useLocale, useTranslations } from "next-intl"
import { Loader2, Mail, RotateCcw, Save, ShieldCheck, User, UserRoundPlus } from "lucide-react"
import { toast } from "sonner"
import { supabaseClient } from "@/lib/supabaseClient"
import { getAppUrl } from "@/lib/utils/urlConfig"
import { useAuth } from "@/hooks/useAuth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "@/i18n/navigation"
import PreviewNotice from "@/components/features/create/shared/PreviewNotice"
import { getCreatePreviewCopy, getPreviewUserProfile, isCreatePreviewEnabled } from "@/lib/mocks/createSectionPreview"

const AUTH_PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "facebook", label: "Facebook" },
] as const

export default function UserProfile() {
  const router = useRouter()
  const locale = useLocale()
  const { user, loading, refreshSession } = useAuth()
  const t = useTranslations("CreatePage.userProfile")
  const previewCopy = useMemo(() => getCreatePreviewCopy(locale), [locale])
  const [previewProfile, setPreviewProfile] = useState(() => getPreviewUserProfile())
  const [previewProviders, setPreviewProviders] = useState(() => getPreviewUserProfile().linkedProviders)
  const isPreviewMode = isCreatePreviewEnabled() && !loading && !user

  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingEmail, setIsSavingEmail] = useState(false)
  const [loadingIdentities, setLoadingIdentities] = useState(false)
  const [providerAction, setProviderAction] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [email, setEmail] = useState("")
  const [identities, setIdentities] = useState<UserIdentity[]>([])
  const previewIdentities = useMemo(
    () => previewProviders.map((provider) => ({ identity_id: `preview-${provider}`, provider } as UserIdentity)),
    [previewProviders]
  )

  useEffect(() => {
    if (isPreviewMode) {
      setName(previewProfile.name)
      setAvatarUrl(previewProfile.avatarUrl)
      setEmail(previewProfile.email)
      return
    }

    if (!user) return
    setName(user.user_metadata?.name || user.user_metadata?.full_name || "")
    setAvatarUrl(user.user_metadata?.avatar_url || "")
    setEmail(user.email || "")
  }, [isPreviewMode, previewProfile.avatarUrl, previewProfile.email, previewProfile.name, user])

  const loadIdentities = useCallback(async () => {
    if (isPreviewMode) {
      setIdentities(previewIdentities)
      return
    }

    if (!user) return
    setLoadingIdentities(true)
    try {
      const { data, error } = await supabaseClient.auth.getUserIdentities()
      if (error) throw error
      setIdentities(data.identities || [])
    } catch (error) {
      console.error(error)
      toast.error(t("toast.loadIdentitiesError"))
    } finally {
      setLoadingIdentities(false)
    }
  }, [isPreviewMode, previewIdentities, t, user])

  useEffect(() => {
    void loadIdentities()
  }, [loadIdentities])

  const handleUpdateProfile = async () => {
    if (!user && !isPreviewMode) return
    setIsSavingProfile(true)
    try {
      if (isPreviewMode) {
        setPreviewProfile((current) => ({ ...current, name, avatarUrl }))
        toast.success(t("toast.updateSuccess"))
        return
      }

      if (!user) return

      const { error } = await supabaseClient.auth.updateUser({
        data: { name, avatar_url: avatarUrl },
      })

      if (error) throw error

      await supabaseClient
        .from("users")
        .update({ name, avatar_url: avatarUrl })
        .eq("id", user.id)

      await refreshSession()
      toast.success(t("toast.updateSuccess"))
    } catch (error: unknown) {
      console.error(error)
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error(`${t("toast.updateError")}: ${message}`)
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleUpdateEmail = async () => {
    const currentEmail = isPreviewMode ? previewProfile.email : user?.email
    if ((!user && !isPreviewMode) || !email || email === currentEmail) return
    setIsSavingEmail(true)
    try {
      if (isPreviewMode) {
        setPreviewProfile((current) => ({ ...current, email }))
        toast.success(t("toast.emailUpdateRequested"))
        return
      }

      const redirectTo = `${getAppUrl()}/${locale}/profile`
      const { error } = await supabaseClient.auth.updateUser(
        { email },
        { emailRedirectTo: redirectTo }
      )
      if (error) throw error
      toast.success(t("toast.emailUpdateRequested"))
    } catch (error: unknown) {
      console.error(error)
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error(`${t("toast.updateError")}: ${message}`)
    } finally {
      setIsSavingEmail(false)
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

  const handleLinkProvider = async (provider: "google" | "facebook") => {
    setProviderAction(provider)
    try {
      if (isPreviewMode) {
        await new Promise((resolve) => window.setTimeout(resolve, 300))
        setPreviewProviders((current) => (current.includes(provider) ? current : [...current, provider]))
        setProviderAction(null)
        toast.success(t("toast.identityLinkStarted", { provider: provider === "google" ? "Google" : "Facebook" }))
        return
      }

      const { data, error } = await supabaseClient.auth.linkIdentity({
        provider,
        options: {
          redirectTo: `${getAppUrl()}/${locale}/profile`,
          scopes: provider === "google" ? "openid email profile" : "public_profile email",
        },
      })

      if (error) throw error
      if (data?.url) {
        window.location.href = data.url
        return
      }
      toast.success(t("toast.identityLinkStarted", { provider: provider === "google" ? "Google" : "Facebook" }))
    } catch (error: unknown) {
      console.error(error)
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error(`${t("toast.identityLinkError")}: ${message}`)
    }
    setProviderAction(null)
  }

  const handleUnlinkIdentity = async (identity: UserIdentity) => {
    setProviderAction(identity.provider)
    try {
      if (isPreviewMode) {
        await new Promise((resolve) => window.setTimeout(resolve, 200))
        setPreviewProviders((current) => current.filter((provider) => provider !== identity.provider))
        toast.success(t("toast.identityUnlinked"))
        return
      }

      const { error } = await supabaseClient.auth.unlinkIdentity(identity)
      if (error) throw error
      await loadIdentities()
      toast.success(t("toast.identityUnlinked"))
    } catch (error: unknown) {
      console.error(error)
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error(`${t("toast.identityUnlinkError")}: ${message}`)
    } finally {
      setProviderAction(null)
    }
  }

  const providerState = useMemo(() => {
    const providers = new Set(identities.map((identity) => identity.provider))
    return AUTH_PROVIDERS.map((provider) => ({
      ...provider,
      connected: providers.has(provider.id),
      identity: identities.find((identity) => identity.provider === provider.id) || null,
    }))
  }, [identities])

  const displayEmail = isPreviewMode ? previewProfile.email : user?.email || ""
  const userInitial = (name || displayEmail || "U").trim().charAt(0).toUpperCase() || "U"

  return (
    <div className="container mx-auto max-w-6xl p-4 pb-20 text-foreground md:p-6 md:pb-6">
      <h1 className="mb-6 text-2xl font-bold md:mb-8 md:text-3xl">{t("title")}</h1>
      {isPreviewMode ? (
        <div className="mb-6">
          <PreviewNotice badge={previewCopy.badge} description={previewCopy.emptyDescription} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <div className="space-y-6">
          <Card className="border-border bg-card text-foreground">
            <CardHeader>
              <CardTitle>{t("basicInfo.title")}</CardTitle>
              <CardDescription className="text-muted-foreground">{t("basicInfo.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-secondary/25 p-5 sm:flex-row sm:items-center">
                <Avatar className="h-20 w-20 border border-border/70">
                  <AvatarImage src={avatarUrl || undefined} alt={name || displayEmail || "User"} />
                  <AvatarFallback className="bg-gradient-to-br from-utc-royal to-utc-sky text-xl font-semibold text-white">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-foreground">{name || t("basicInfo.noDisplayName")}</p>
                  <p className="text-sm text-muted-foreground">{displayEmail || "N/A"}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-secondary/35 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {t("basicInfo.email")}
                  </div>
                  <p className="break-all text-sm font-medium text-foreground">{displayEmail || "N/A"}</p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-secondary/35 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <ShieldCheck className="h-4 w-4" />
                    {t("status.title")}
                  </div>
                  <p className="text-sm font-medium text-foreground">{t("status.description")}</p>
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
                <Button onClick={handleUpdateProfile} disabled={isSavingProfile} className="bg-primary hover:bg-primary/90">
                  {isSavingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" /> {t("basicInfo.save")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card text-foreground">
            <CardHeader>
              <CardTitle>{t("emailSection.title")}</CardTitle>
              <CardDescription className="text-muted-foreground">{t("emailSection.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("emailSection.newEmail")}</Label>
                <Input
                  value={email}
                  type="email"
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-border bg-secondary text-foreground focus:border-primary"
                />
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{t("emailSection.hint")}</p>
              <Button onClick={handleUpdateEmail} disabled={isSavingEmail || email === displayEmail}>
                {isSavingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("emailSection.save")}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border bg-card text-foreground">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRoundPlus className="h-5 w-5 text-primary" />
                {t("loginMethods.title")}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {t("loginMethods.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-secondary/25 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t("loginMethods.currentProviders")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {loadingIdentities ? (
                    <span className="text-sm text-muted-foreground">{t("loginMethods.loading")}</span>
                  ) : (
                    identities.map((identity) => (
                      <span key={identity.identity_id} className="rounded-full border border-border/70 bg-background px-3 py-1 text-sm text-foreground">
                        {identity.provider}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {providerState.map((provider) => {
                const canUnlink = Boolean(provider.identity) && identities.length > 1
                const isLoading = providerAction === provider.id
                return (
                  <div key={provider.id} className="rounded-2xl border border-border/70 bg-secondary/25 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-semibold text-foreground">{provider.label}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {provider.connected ? t("loginMethods.connected") : t("loginMethods.notConnected")}
                        </p>
                      </div>
                      {provider.connected ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canUnlink || isLoading}
                          onClick={() => provider.identity && handleUnlinkIdentity(provider.identity)}
                        >
                          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {t("loginMethods.unlink")}
                        </Button>
                      ) : (
                        <Button size="sm" disabled={isLoading} onClick={() => handleLinkProvider(provider.id)}>
                          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {t("loginMethods.link")}
                        </Button>
                      )}
                    </div>
                    {provider.connected && !canUnlink ? (
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">{t("loginMethods.unlinkHint")}</p>
                    ) : null}
                  </div>
                )
              })}
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

          <Card className="border-border bg-card text-foreground">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                {t("systemProfile.title")}
              </CardTitle>
              <CardDescription className="text-muted-foreground">{t("systemProfile.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("systemProfile.roleLabel")}</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{t("systemProfile.roleValue")}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("systemProfile.focusLabel")}</p>
                <p className="mt-2 text-sm text-foreground">{t("systemProfile.focusValue")}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
