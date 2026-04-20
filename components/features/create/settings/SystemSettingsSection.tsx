"use client"

import { useTheme } from "next-themes"
import { useLocale, useTranslations } from "next-intl"
import { MonitorCog, Palette, RotateCcw, ShieldCheck, UserRoundCog } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import SectionHeader from "../layout/SectionHeader"
import { useSectionNavigation } from "@/hooks/useSectionNavigation"

export default function SystemSettingsSection() {
  const tHeaders = useTranslations("CreatePage.sectionHeaders")
  const t = useTranslations("CreatePage.systemSettings")
  const locale = useLocale()
  const { theme, setTheme } = useTheme()
  const navigateToSection = useSectionNavigation()

  const handleResetTour = () => {
    localStorage.removeItem("hasSeenOnboarding")
    toast.success(t("tourResetSuccess"))
  }

  return (
    <div className="h-full overflow-y-auto">
      <SectionHeader
        icon={MonitorCog}
        title={tHeaders("settings.title")}
        description={tHeaders("settings.description")}
      />

      <div className="space-y-6 px-4 py-4 lg:px-6 lg:py-5">
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="rounded-3xl border-border/70 bg-card/70 p-5">
            <div className="flex items-center gap-3 text-foreground">
              <Palette className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold">{t("appearanceTitle")}</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("appearanceDesc")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant={theme === "light" ? "default" : "outline"} size="sm" onClick={() => setTheme("light")}>
                {t("light")}
              </Button>
              <Button variant={theme === "dark" ? "default" : "outline"} size="sm" onClick={() => setTheme("dark")}>
                {t("dark")}
              </Button>
            </div>
          </Card>

          <Card className="rounded-3xl border-border/70 bg-card/70 p-5">
            <div className="flex items-center gap-3 text-foreground">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold">{t("workspaceTitle")}</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("workspaceDesc")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleResetTour}>
                <RotateCcw className="mr-2 h-4 w-4" />
                {t("resetTour")}
              </Button>
            </div>
          </Card>

          <Card className="rounded-3xl border-border/70 bg-card/70 p-5">
            <div className="flex items-center gap-3 text-foreground">
              <UserRoundCog className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold">{t("accountTitle")}</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("accountDesc")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => navigateToSection("profile")}>
                {t("openProfile")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigateToSection("connections")}>
                {t("openConnections")}
              </Button>
            </div>
          </Card>
        </div>

        <Card className="rounded-3xl border-border/70 bg-card/70 p-6">
          <h3 className="text-base font-semibold text-foreground">{t("statusTitle")}</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t("currentTheme")}</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{theme === "dark" ? t("dark") : t("light")}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t("currentLocale")}</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{locale.toUpperCase()}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t("modeLabel")}</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{t("modeValue")}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
