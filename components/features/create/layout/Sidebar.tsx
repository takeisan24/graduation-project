"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import LanguageSwitcher from "@/components/shared/LanguageSwitcher"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useNavigationStore } from "@/store"
import { CheckCircle2, Link2, LogOut, Settings, Sparkles, UserCircle2 } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { useTranslations } from "next-intl"
import { useSectionNavigation } from "@/hooks/useSectionNavigation"
import { useRouter } from "next/navigation"

interface SidebarProps {
  activeSection: string
  isSidebarOpen: boolean
  onSidebarToggle: (isOpen: boolean) => void
}

export default function Sidebar({
  activeSection,
  isSidebarOpen,
  onSidebarToggle,
}: SidebarProps) {
  const navigateToSection = useSectionNavigation()
  const router = useRouter()
  const t = useTranslations("CreatePage.sidebar")
  const { user, signOut, loading: authLoading } = useAuth()

  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showSignOutDialog, setShowSignOutDialog] = useState(false)
  const [showMobileTooltip, setShowMobileTooltip] = useState(false)

  const wizardStep = useNavigationStore((state) => state.wizardStep)
  const isInWizard = wizardStep !== "idle"

  useEffect(() => {
    if (!isSidebarOpen) {
      setShowMobileTooltip(false)
    }
  }, [isSidebarOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMobileTooltip && window.innerWidth < 1024) {
        const target = event.target as HTMLElement
        if (!target.closest("[data-mobile-tooltip-trigger='true']")) {
          setShowMobileTooltip(false)
        }
      }
    }

    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [showMobileTooltip])

  const navigationCategories = [
    {
      title: t("menu"),
      items: [
        {
          id: "create",
          label: t("createPost"),
          icon: "/icons/sidebar/Create.svg",
        },
        {
          id: "calendar",
          label: t("calendar"),
          icon: "/icons/sidebar/Calendar.svg",
        },
      ],
    },
    {
      title: t("management"),
      items: [
        {
          id: "drafts",
          label: t("drafts"),
          icon: "/icons/sidebar/Draft.svg",
        },
        {
          id: "published",
          label: t("published"),
          icon: "/icons/sidebar/Published.svg",
        },
        {
          id: "failed",
          label: t("failed"),
          icon: "/icons/sidebar/Failed.svg",
        },
      ],
    },
    {
      title: t("account"),
      items: [
        {
          id: "operations",
          label: t("apiDashboard"),
          icon: "/icons/sidebar/API.svg",
        },
        {
          id: "connections",
          label: t("connections"),
          iconComponent: Link2,
        },
        {
          id: "settings",
          label: t("settings"),
          icon: "/icons/sidebar/Settings.svg",
        },
        {
          id: "profile",
          label: t("profile"),
          iconComponent: UserCircle2,
        },
      ],
    },
  ]

  const handleSectionClick = (itemId: string) => {
    navigateToSection(itemId)
    if (window.innerWidth < 1024) {
      onSidebarToggle(false)
    }
  }

  const handleSignOut = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      const success = await signOut()
      if (success) {
        setShowSignOutDialog(true)
        setTimeout(() => {
          router.push("/signin")
        }, 700)
      } else {
        setIsLoggingOut(false)
      }
    } catch (error) {
      console.error("Logout failed", error)
      setIsLoggingOut(false)
    }
  }

  const touchStartRef = useRef<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return

    const touchEnd = e.changedTouches[0].clientX
    const diff = touchStartRef.current - touchEnd
    const swipeThreshold = 50

    if (isSidebarOpen && diff > swipeThreshold) {
      onSidebarToggle(false)
    }

    if (!isSidebarOpen && touchStartRef.current < 40 && diff < -swipeThreshold) {
      onSidebarToggle(true)
    }

    touchStartRef.current = null
  }

  return (
    <>
      <button
        className="fixed left-4 top-4 z-[60] flex h-10 w-10 touch-manipulation items-center justify-center rounded-lg border border-border bg-card/80 text-foreground shadow-lg backdrop-blur-md transition-all active:scale-95 lg:hidden"
        onClick={() => onSidebarToggle(!isSidebarOpen)}
        aria-label="Toggle menu"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {isSidebarOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
        </svg>
      </button>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-[45] bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => onSidebarToggle(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />
      )}

      <div
        className={`
          fixed inset-y-0 left-0 z-[50] flex flex-col border-r border-border bg-card shadow-2xl transition-all duration-300 ease-out lg:absolute lg:z-20 lg:shadow-none
          ${isSidebarOpen ? "w-[280px] translate-x-0 lg:w-55" : "w-[280px] -translate-x-full lg:w-[80px] lg:translate-x-0"}
          ${isInWizard ? "pointer-events-none" : ""}
        `}
        onMouseEnter={() => !isInWizard && window.innerWidth >= 1024 && onSidebarToggle(true)}
        onMouseLeave={() => !isInWizard && window.innerWidth >= 1024 && onSidebarToggle(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 pt-[30px] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border hover:scrollbar-thumb-muted-foreground/30">
          <nav className="space-y-6">
            {navigationCategories.map((category, categoryIndex) => (
              <div key={category.title} className="space-y-2">
                {isSidebarOpen ? (
                  <div className="px-2 py-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {category.title}
                    </h3>
                  </div>
                ) : (
                  categoryIndex > 0 && <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
                )}

                <div className="space-y-1">
                  {category.items.map((item) => {
                    const isActive = activeSection === item.id || (item.id === "create" && activeSection === "create")
                    const IconComponent = "iconComponent" in item ? item.iconComponent : null
                    const iconSrc = "icon" in item ? item.icon : null
                    return (
                      <Button
                        key={item.id}
                        variant={isActive ? "secondary" : "ghost"}
                        className={`group/item h-11 w-full font-medium text-foreground transition-all duration-200 lg:h-9 ${
                          isSidebarOpen ? "justify-start px-2.5" : "justify-center px-2"
                        } ${
                          isActive
                            ? "border border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                            : "border border-transparent hover:border-primary/50 hover:bg-secondary hover:shadow-md hover:shadow-primary/10"
                        }`}
                        onClick={() => handleSectionClick(item.id)}
                      >
                        <div
                          className={`transition-transform duration-200 group-hover/item:scale-110 ${
                            isSidebarOpen ? "mr-2" : "flex items-center justify-center px-2"
                          }`}
                        >
                          {IconComponent ? (
                            <IconComponent className="h-5 w-5 flex-none opacity-90 group-hover/item:opacity-100" />
                          ) : iconSrc ? (
                            <Image
                              unoptimized
                              src={iconSrc}
                              alt={item.label}
                              width={16}
                              height={16}
                              className="h-6 w-6 flex-none opacity-90 group-hover/item:opacity-100"
                            />
                          ) : null}
                        </div>
                        {isSidebarOpen && <span className="text-base tracking-wide lg:text-xs">{item.label}</span>}
                      </Button>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex-shrink-0 border-t border-border/50">
          {authLoading ? (
            <div className="space-y-3 px-4 py-4">
              <div className={`rounded-xl border border-border bg-muted/40 ${isSidebarOpen ? "p-3" : "flex justify-center p-2"}`}>
                <div className={`flex items-center gap-3 ${isSidebarOpen ? "" : "flex-col"}`}>
                  <div className="h-8 w-8 animate-pulse rounded-full bg-secondary" />
                  {isSidebarOpen ? (
                    <div className="space-y-1">
                      <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
                      <div className="h-2.5 w-20 animate-pulse rounded bg-secondary" />
                    </div>
                  ) : (
                    <div className="h-2.5 w-8 animate-pulse rounded bg-secondary" />
                  )}
                </div>
              </div>
              {isSidebarOpen ? <div className="h-10 animate-pulse rounded-lg bg-secondary" /> : null}
            </div>
          ) : null}

          {!authLoading && user ? (
            <div className="space-y-3 px-4 py-4">
              <button
                type="button"
                data-mobile-tooltip-trigger="true"
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    setShowMobileTooltip(!showMobileTooltip)
                  }
                }}
                className={`relative w-full overflow-visible rounded-xl border border-border bg-gradient-to-br from-muted to-card transition-all duration-300 ${
                  isSidebarOpen ? "p-3 text-left" : "flex justify-center p-2"
                }`}
              >
                {isSidebarOpen ? (
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{t("connections")}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Kết nối tài khoản nền tảng và quản lý vùng xuất bản của bạn.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-semibold text-primary">Hub</span>
                  </div>
                )}

                <div
                  className={`absolute bottom-full left-0 right-0 mb-2 px-1 transition-all duration-300 z-50 ${
                    showMobileTooltip ? "visible translate-y-0 opacity-100" : "pointer-events-none invisible translate-y-2 opacity-0"
                  } lg:hidden`}
                >
                  <div className="rounded-2xl border border-border bg-card p-4 shadow-2xl">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{t("connections")}</p>
                        <p className="text-xs text-muted-foreground">
                          Kết nối tài khoản nền tảng và tiếp tục điều phối nội dung tại đây.
                        </p>
                      </div>
                    </div>
                    <div className="absolute -bottom-1.5 left-4 h-3 w-3 rotate-45 border-b border-r border-border bg-card" />
                  </div>
                </div>
              </button>

              <div className={`w-full rounded-lg border border-border bg-gradient-to-br from-secondary/50 to-secondary/20 p-2 transition-all duration-200 ${isSidebarOpen ? "" : "flex justify-center"}`}>
                <div className={`flex items-center gap-2 ${isSidebarOpen ? "" : "justify-center"}`}>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-purple-500/30 bg-gradient-to-br from-purple-500/20 to-indigo-500/20">
                    <Image unoptimized src="/icons/sidebar/Language.svg" alt="Language" width={14} height={14} className="h-3.5 w-3.5 opacity-80" />
                  </div>
                  {isSidebarOpen ? (
                    <div className="ml-2 flex flex-1 items-center justify-between overflow-hidden">
                      <span className="mr-2 whitespace-nowrap text-xs font-medium text-foreground/80">{t("language")}</span>
                      <div className="shrink-0">
                        <LanguageSwitcher />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                onClick={() => {
                  router.push("/profile")
                  if (window.innerWidth < 1024) onSidebarToggle(false)
                }}
                className={`group/user relative flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-secondary ${isSidebarOpen ? "" : "justify-center"}`}
              >
                <div className="relative">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-gradient-to-br from-purple-500 to-indigo-500">
                    {user.user_metadata?.avatar_url ? (
                      <Image unoptimized src={user.user_metadata.avatar_url} alt="Avatar" fill sizes="32px" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold uppercase text-foreground">{user.email?.[0] || "U"}</span>
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-green-500" />
                </div>

                {isSidebarOpen ? (
                  <div className="flex min-w-0 flex-1 items-center justify-between">
                    <div className="min-w-0">
                      <span className="block truncate text-base font-medium text-foreground lg:text-sm" title={user.email}>
                        {user.email?.split("@")[0]}
                      </span>
                      <span className="mt-1 inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        <UserCircle2 className="h-3 w-3" />
                        {t("profile")}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push("/profile")
                          if (window.innerWidth < 1024) onSidebarToggle(false)
                        }}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        title={t("accountSettings")}
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSignOut()
                          if (window.innerWidth < 1024) onSidebarToggle(false)
                        }}
                        disabled={isLoggingOut}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                        title={t("logout")}
                      >
                        <LogOut className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="absolute bottom-0 left-14 z-50 invisible min-w-[180px] rounded-lg border border-border bg-card p-3 opacity-0 shadow-xl transition-all group-hover/user:visible group-hover/user:opacity-100">
                    <div className="mb-3 flex items-center gap-3 border-b border-border/50 pb-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/20 text-xs font-bold text-purple-400">
                        {user.email?.[0]?.toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <p className="truncate text-sm font-bold text-foreground">{user.email}</p>
                        <p className="text-xs text-muted-foreground">{t("profile")}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSignOut()
                      }}
                      className="flex w-full items-center gap-2 rounded bg-red-500/10 px-2 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
                    >
                      <LogOut className="h-3 w-3" /> {t("logout")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={showSignOutDialog}>
        <DialogContent className="sm:max-w-sm bg-card border-border [&>button]:hidden">
          <div className="flex flex-col items-center space-y-4 py-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
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
