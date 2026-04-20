"use client"

import { useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { useAuth } from "@/hooks/useAuth"
import { useNavigationStore } from "@/store"
import CreatorHubIcon from "@/components/shared/CreatorHubIcon"
import LanguageSwitcher from "@/components/shared/LanguageSwitcher"
import { Button } from "@/components/ui/button"
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
import { Sun, Moon, LogOut, ChevronRight, CheckCircle2, Link2, Menu, Settings, UserCircle2 } from "lucide-react"
import { useRouter } from "@/i18n/navigation"

interface TopBarProps {
  onMobileMenuToggle?: () => void
}

export default function TopBar({ onMobileMenuToggle }: TopBarProps) {
  const router = useRouter()
  const t = useTranslations("CreatePage.topBar")
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
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
