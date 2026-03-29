"use client"

import { useCallback } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useNavigationStore } from "@/store"
import { useShallow } from "zustand/react/shallow"
import { useDashboardUsage } from "@/hooks/useDashboardUsage"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import CreatorHubIcon from "@/components/shared/CreatorHubIcon"
import { Zap, PenSquare, Calendar, FileText, CheckCircle, XCircle, BarChart3, Settings } from "lucide-react"

interface SlimSidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
  isSidebarOpen: boolean
  onSidebarToggle: (isOpen: boolean) => void
}

const navItems = [
  { id: "create", icon: PenSquare, group: "menu" },
  { id: "calendar", icon: Calendar, group: "menu" },
  { id: "drafts", icon: FileText, group: "management" },
  { id: "published", icon: CheckCircle, group: "management" },
  { id: "failed", icon: XCircle, group: "management" },
  { id: "api-dashboard", icon: BarChart3, group: "account" },
  { id: "settings", icon: Settings, group: "account" },
] as const

export default function SlimSidebar({
  activeSection,
  onSectionChange,
  isSidebarOpen,
  onSidebarToggle,
}: SlimSidebarProps) {
  const router = useRouter()
  const t = useTranslations("CreatePage.sidebar")
  const { wizardStep } = useNavigationStore(useShallow((s) => ({ wizardStep: s.wizardStep })))
  const { creditsRemaining, totalCredits, creditsPercent, isCreditsLow, isCreditsCritical, storageData } = useDashboardUsage()

  const isInWizard = wizardStep !== "idle"

  const handleNavClick = useCallback(
    (sectionId: string) => {
      if (isInWizard && sectionId !== activeSection) return
      onSectionChange(sectionId)
      router.push(`/${sectionId}` as any)
      onSidebarToggle(false) // close mobile sheet
    },
    [isInWizard, activeSection, onSectionChange, router, onSidebarToggle]
  )

  const labelMap: Record<string, string> = {
    create: t("createPost"),
    calendar: t("calendar"),
    drafts: t("drafts"),
    published: t("published"),
    failed: t("failed"),
    "api-dashboard": t("apiDashboard"),
    settings: t("settings"),
  }

  const creditsColor = isCreditsCritical ? "text-destructive" : isCreditsLow ? "text-warning" : "text-utc-gold"
  const creditsTooltip = `${creditsRemaining}/${totalCredits} ${t("credits")}\n${storageData.used}/${storageData.total} GB`

  // Group nav items
  const menuItems = navItems.filter((n) => n.group === "menu")
  const managementItems = navItems.filter((n) => n.group === "management")
  const accountItems = navItems.filter((n) => n.group === "account")

  const renderNavItem = (item: typeof navItems[number], showLabel = false) => {
    const Icon = item.icon
    const isActive = activeSection === item.id
    const disabled = isInWizard && !isActive

    const btn = (
      <Button
        key={item.id}
        variant="ghost"
        onClick={() => handleNavClick(item.id)}
        disabled={disabled}
        data-tour={`nav-${item.id}`}
        className={`relative flex items-center gap-3 rounded-lg transition-all duration-200 ${
          showLabel ? "w-full px-3 py-2.5 text-sm justify-start" : "w-10 h-10 p-0 justify-center"
        } ${
          isActive
            ? "bg-utc-royal/10 text-utc-royal hover:bg-utc-royal/15"
            : disabled
            ? "opacity-30 cursor-not-allowed text-muted-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
      >
        {/* Active indicator */}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-utc-royal to-utc-sky" />
        )}
        <Icon className="h-[18px] w-[18px] flex-shrink-0" />
        {showLabel && <span>{labelMap[item.id]}</span>}
      </Button>
    )

    if (showLabel) return btn

    return (
      <Tooltip key={item.id}>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {labelMap[item.id]}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <>
      {/* Desktop slim sidebar */}
      <aside className="hidden lg:flex flex-col items-center w-16 flex-none border-r border-border/50 bg-card/50 py-3 gap-1">
        {/* Menu group */}
        <div className="flex flex-col items-center gap-1">
          {menuItems.map((item) => renderNavItem(item))}
        </div>

        <Separator className="w-8 my-2" />

        {/* Management group */}
        <div className="flex flex-col items-center gap-1">
          {managementItems.map((item) => renderNavItem(item))}
        </div>

        <Separator className="w-8 my-2" />

        {/* Account group */}
        <div className="flex flex-col items-center gap-1">
          {accountItems.map((item) => renderNavItem(item))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Credits indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${creditsColor}`}>
              <Zap className="h-[18px] w-[18px]" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="whitespace-pre-line text-xs">
            {creditsTooltip}
          </TooltipContent>
        </Tooltip>
      </aside>

      {/* Mobile sheet */}
      <Sheet open={isSidebarOpen} onOpenChange={onSidebarToggle}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="p-4 border-b border-border/50">
            <SheetTitle className="flex items-center gap-2">
              <CreatorHubIcon className="h-7 w-7" />
              <span className="text-sm font-semibold">Creator<span className="gradient-text">Hub</span></span>
            </SheetTitle>
          </SheetHeader>

          <div className="p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">{t("menu")}</p>
            {menuItems.map((item) => renderNavItem(item, true))}

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2 mt-4">{t("management")}</p>
            {managementItems.map((item) => renderNavItem(item, true))}

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2 mt-4">{t("account")}</p>
            {accountItems.map((item) => renderNavItem(item, true))}
          </div>

          {/* Credits in mobile sheet */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border/50 bg-background">
            <div className="flex items-center gap-2 text-sm">
              <Zap className={`h-4 w-4 ${creditsColor}`} />
              <span>{creditsRemaining}/{totalCredits} {t("credits")}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {storageData.used}/{storageData.total} GB {t("storage")}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
