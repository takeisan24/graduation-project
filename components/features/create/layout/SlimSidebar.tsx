"use client"

import { useCallback } from "react"
import { useTranslations } from "next-intl"
import { useNavigationStore } from "@/store"
import { useShallow } from "zustand/react/shallow"
import { useSectionNavigation } from "@/hooks/useSectionNavigation"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import CreatorHubIcon from "@/components/shared/CreatorHubIcon"
import { PenSquare, Calendar, FileText, CheckCircle, XCircle, BarChart3, Link2, Settings, UserCircle2 } from "lucide-react"

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
  { id: "operations", icon: BarChart3, group: "account" },
  { id: "connections", icon: Link2, group: "account" },
  { id: "settings", icon: Settings, group: "account" },
  { id: "profile", icon: UserCircle2, group: "account" },
] as const

export default function SlimSidebar({
  activeSection,
  isSidebarOpen,
  onSidebarToggle,
}: SlimSidebarProps) {
  const navigateToSection = useSectionNavigation()
  const t = useTranslations("CreatePage.sidebar")
  const { wizardStep } = useNavigationStore(useShallow((s) => ({ wizardStep: s.wizardStep })))

  const isInWizard = wizardStep !== "idle"

  const handleNavClick = useCallback(
    (sectionId: string) => {
      if (isInWizard && sectionId !== activeSection) return
      navigateToSection(sectionId)
      onSidebarToggle(false) // close mobile sheet
    },
    [isInWizard, activeSection, navigateToSection, onSidebarToggle]
  )

  const labelMap: Record<string, string> = {
    create: t("createPost"),
    calendar: t("calendar"),
    drafts: t("drafts"),
    published: t("published"),
    failed: t("failed"),
    operations: t("apiDashboard"),
    connections: t("connections"),
    settings: t("settings"),
    profile: t("profile"),
  }

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
        <div className="flex-1" />
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
        </SheetContent>
      </Sheet>
    </>
  )
}
