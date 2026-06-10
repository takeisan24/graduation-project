"use client"

import { useState, useCallback } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { useAuth } from "@/hooks/useAuth"
import { useDashboardUsage } from "@/hooks/useDashboardUsage"
import { useNavigationStore } from "@/store"
import CreatorHubIcon from "@/components/shared/CreatorHubIcon"
import LanguageSwitcher from "@/components/shared/LanguageSwitcher"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Sun, Moon, LogOut, ChevronRight, CheckCircle2, Link2, Menu, Settings, UserCircle2, Coins } from "lucide-react"
import { useRouter } from "@/i18n/navigation"

interface TopBarProps {
  onMobileMenuToggle?: () => void
}

export default function TopBar({ onMobileMenuToggle }: TopBarProps) {
  const router = useRouter()
  const t = useTranslations("CreatePage.topBar")
  const locale = useLocale()
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const {
    creditsRemaining,
    currentPlan,
    isCreditsLow,
    isLoadingCredits,
  } = useDashboardUsage()
  const activeSection = useNavigationStore((s) => s.activeSection)
  const [showSignOutDialog, setShowSignOutDialog] = useState(false)

  const handleSignOut = useCallback(async () => {
    const success = await signOut()
    if (success) {
      setShowSignOutDialog(true)
      setTimeout(() => { router.push("/signin") }, 700)
    }
  }, [router, signOut])

  const userInitial = user?.email?.charAt(0).toUpperCase() || "U"
  const breadcrumbLabel = t(`breadcrumb.${activeSection}` as any) || activeSection
  // Mô hình trả-theo-dùng (credit): không có gói thuê bao → nhãn "Trả theo dùng" thay vì "Free".
  const planLabel = (!currentPlan || currentPlan.toLowerCase() === "free")
    ? t("payAsYouGo")
    : currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)
  const creditsLabel = isLoadingCredits ? "..." : creditsRemaining.toLocaleString(locale === "vi" ? "vi-VN" : "en-US")

  return (
    <>
      <header className="h-14 flex-none border-b border-border/50 bg-background/90 backdrop-blur-sm flex items-center px-4 gap-3 z-50">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-9 w-9 text-muted-foreground"
          onClick={onMobileMenuToggle}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <CreatorHubIcon className="h-7 w-7" />
          <span className="hidden sm:inline text-sm font-semibold tracking-tight">
            Creator<span className="gradient-text">Hub</span>
          </span>
        </div>

        {/* Breadcrumb */}
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground ml-2">
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">{breadcrumbLabel}</span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {user && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="hidden sm:inline-flex h-9 items-center gap-2 rounded-md border border-border/70 bg-background px-2.5 text-xs text-foreground transition-colors hover:bg-accent"
                  onClick={() => router.push("/settings")}
                  aria-label={t("creditsAria", { credits: creditsLabel, plan: planLabel })}
                >
                  <Coins className={`h-3.5 w-3.5 ${isCreditsLow ? "text-amber-500" : "text-utc-royal"}`} />
                  <span className="font-semibold tabular-nums">{creditsLabel}</span>
                  <span className="hidden lg:inline text-muted-foreground">{t("creditsUnit")}</span>
                  <Badge
                    variant={isCreditsLow ? "destructive" : "secondary"}
                    className="hidden xl:inline-flex max-w-20 truncate px-1.5 py-0 text-[10px]"
                  >
                    {planLabel}
                  </Badge>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {isCreditsLow
                  ? t("creditsLowTooltip", { credits: creditsLabel, plan: planLabel })
                  : t("creditsTooltip", { credits: creditsLabel, plan: planLabel })}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Theme toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("toggleTheme")}</TooltipContent>
          </Tooltip>

          {/* Language */}
          <LanguageSwitcher />

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 px-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-gradient-to-br from-utc-royal to-utc-sky text-white text-xs font-semibold">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm max-w-[120px] truncate">
                  {user?.email}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{user?.user_metadata?.name || user?.email}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                <UserCircle2 className="mr-2 h-4 w-4" />
                {t("breadcrumb.profile" as any)}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/connections")}>
                <Link2 className="mr-2 h-4 w-4" />
                {t("breadcrumb.connections" as any)}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                {t("breadcrumb.settings" as any)}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                {t("signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Sign out dialog */}
      <Dialog open={showSignOutDialog}>
        <DialogContent className="sm:max-w-sm bg-card border-border [&>button]:hidden">
          <div className="flex flex-col items-center text-center py-4 space-y-4">
            <div className="h-14 w-14 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <h3 className="text-lg font-semibold">{t("signOutSuccess")}</h3>
            <p className="text-sm text-muted-foreground">{t("signOutRedirect")}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
