"use client"

import { useEffect, useRef, useState } from "react"
import LanguageSwitcher from "@/components/shared/LanguageSwitcher"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useNavigationStore } from "@/store"
import { Zap, AlertTriangle, RefreshCw, Plus, HardDrive, ChevronUp, LogOut, Users, Settings, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

import { supabaseClient } from "@/lib/supabaseClient";
import { toast } from "sonner";
import useSWR from "swr";

interface SidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
  isSidebarOpen: boolean
  onSidebarToggle: (isOpen: boolean) => void
  language?: 'vi' | 'en'
  onLanguageChange?: (lang: 'vi' | 'en') => void
  onPlanModalClick?: () => void
  onTopUpClick?: (e?: React.MouseEvent) => void
}

/**
 * Main sidebar navigation component for the create page
 * Handles navigation between different sections and sidebar expand/collapse
 */
export default function Sidebar({
  activeSection,
  onSectionChange,
  isSidebarOpen,
  onSidebarToggle,
  onPlanModalClick,
  onTopUpClick,
}: SidebarProps) {

  const router = useRouter();
  const t = useTranslations('CreatePage.sidebar');
  const { user, signOut, loading: authLoading } = useAuth();

  // Fetch credits and usage data from API
  const { data: usageData, isLoading: isLoadingCredits, mutate: refreshCredits } = useSWR(
    user ? '/api/usage' : null,
    async (url: string) => {
      const session = await supabaseClient.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return null;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data;
    },
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  // Fetch storage data separately
  const { data: storageData_raw } = useSWR(
    user ? '/api/usage/storage' : null,
    async (url: string) => {
      const session = await supabaseClient.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return null;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data;
    },
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const creditsRemaining = usageData?.credits?.balance ?? usageData?.credits?.remaining ?? 0;
  const creditsUsed = usageData?.credits?.used ?? 0;
  const totalCredits = usageData?.credits?.total ?? 0;
  const currentPlan = usageData?.plan || 'free';
  const profileLimits = usageData?.limits?.profiles ?? { current: 0, limit: 2 };
  const storageUsage = storageData_raw ?? null;

  // --- STORAGE DATA ---
  // Default fallback if loading or null
  const defaultStorage = { used: 0, total: 1, percent: 0 };
  const storageData = storageUsage ? {
    used: Number((storageUsage.usedBytes / (1024 * 1024 * 1024)).toFixed(2)),
    total: storageUsage.limitGB,
    percent: storageUsage.usagePercent
  } : defaultStorage;
  // --------------------------------------------------
  // --- STATE XỬ LÝ LOGOUT ---
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  const handleSignOut = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      const success = await signOut();
      if (success) {
        setShowSignOutDialog(true);
        setTimeout(() => { window.location.href = '/signin'; }, 700);
      }
    } catch (error) {
      console.error("Logout failed", error);
      setIsLoggingOut(false);
    }
  };

  // --------------------------------------------------
  const formatPlanLabel = (plan: string) =>
    plan
      ? plan
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      : 'Free';
  const planLabel = formatPlanLabel(currentPlan || 'free');
  const percentUsed = totalCredits > 0 ? (creditsUsed / totalCredits) * 100 : 0;
  const isLowCredits = totalCredits > 0 && (creditsRemaining / totalCredits) <= 0.2; // Warn if <= 20% remaining
  const isCriticalCredits = totalCredits > 0 && (creditsRemaining / totalCredits) <= 0.05; // Critical if <= 5% remaining
  const progressColor = isCriticalCredits ? 'bg-red-500' : isLowCredits ? 'bg-yellow-500' : 'bg-primary';
  const textColor = isCriticalCredits ? 'text-red-400' : isLowCredits ? 'text-yellow-400' : 'text-foreground';

  // Get wizard state to check if sidebar should be blocked
  const wizardStep = useNavigationStore(state => state.wizardStep);
  const isInWizard = wizardStep !== 'idle';

  // --- STATE FOR MOBILE TOOLTIP ---
  const [showMobileTooltip, setShowMobileTooltip] = useState(false);

  // Close tooltip when clicking outside or sidebar closes
  useEffect(() => {
    if (!isSidebarOpen) {
      setShowMobileTooltip(false);
    }
  }, [isSidebarOpen]);

  // Handle click outside to close tooltip on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMobileTooltip && window.innerWidth < 1024) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-mobile-tooltip-trigger="true"]')) {
          setShowMobileTooltip(false);
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMobileTooltip]);


  // Navigation items organized by categories
  const navigationCategories = [
    {
      title: t('menu'),
      items: [
        {
          id: "create",
          label: t('createPost'),
          icon: "/icons/sidebar/Create.svg",
          url: "/create"
        },
        {
          id: "calendar",
          label: t('calendar'),
          icon: "/icons/sidebar/Calendar.svg",
          url: "/calendar"
        }
      ]
    },
    {
      title: t('management'),
      items: [
        {
          id: "drafts",
          label: t('drafts'),
          icon: "/icons/sidebar/Draft.svg",
          url: "/drafts"
        },
        {
          id: "published",
          label: t('published'),
          icon: "/icons/sidebar/Published.svg",
          url: "/published"
        },
        {
          id: "failed",
          label: t('failed'),
          icon: "/icons/sidebar/Failed.svg",
          url: "/failed"
        }
      ]
    },
    {
      title: t('account'),
      items: [
        {
          id: "api-dashboard",
          label: t('apiDashboard'),
          icon: "/icons/sidebar/API.svg",
          url: "/api-dashboard"
        },
        {
          id: "settings",
          label: t('settings'),
          icon: "/icons/sidebar/Settings.svg",
          url: "/settings"
        }
      ]
    }
  ]

  // ... (previous code)
  const handleSectionClick = (itemId: string, itemUrl: string) => {
    onSectionChange(itemId);
    router.push(itemUrl);
    // Close mobile menu after navigation
    if (window.innerWidth < 1024) {
      onSidebarToggle(false);
    }
  }

  // --- SWIPE GESTURE HANDLER ---
  const touchStartRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Logic handled in TouchEnd for simplicity or here for real-time (but simple swipe is mostly end)
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStartRef.current - touchEnd;
    const SWIPE_THRESHOLD = 50;

    // Swipe Left (Open -> Close)
    if (isSidebarOpen && diff > SWIPE_THRESHOLD) {
      onSidebarToggle(false);
    }

    // Swipe Right (Close -> Open) - Only if starting near left edge (edge swipe)
    // Check if touchStart was within 30px of left edge
    if (!isSidebarOpen && touchStartRef.current < 40 && diff < -SWIPE_THRESHOLD) {
      onSidebarToggle(true);
    }

    touchStartRef.current = null;
  };

  return (
    <>
      {/* Mobile: Hamburger Button - Restored & Redesigned */}
      <button
        className="lg:hidden fixed top-4 left-4 z-[60] w-10 h-10 flex items-center justify-center rounded-lg bg-card/80 backdrop-blur-md border border-border shadow-lg text-foreground touch-manipulation active:scale-95 transition-all"
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
          {isSidebarOpen ? (
            <path d="M18 6L6 18M6 6l12 12" />
          ) : (
            <path d="M3 12h18M3 6h18M3 18h18" />
          )}
        </svg>
      </button>

      {/* Mobile: Overlay */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/70 z-[45] backdrop-blur-sm"
          onClick={() => onSidebarToggle(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          ${isSidebarOpen ? 'w-[280px] lg:w-55' : 'w-[280px] lg:w-[80px]'} 
          transition-all duration-300 ease-out 
          border-r border-border bg-card
          flex flex-col 
          ${isInWizard ? 'pointer-events-none' : ''}
          fixed lg:absolute inset-y-0 left-0 z-[50] lg:z-20
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          shadow-2xl lg:shadow-none
        `}
        onMouseEnter={() => !isInWizard && window.innerWidth >= 1024 && onSidebarToggle(true)}
        onMouseLeave={() => !isInWizard && window.innerWidth >= 1024 && onSidebarToggle(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* SCROLLABLE NAVIGATION AREA */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pt-[30px] scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/30">
          <nav className="space-y-6">
            {navigationCategories.map((category, categoryIndex) => (
              <div key={category.title} className="space-y-2">
                {/* Category Header */}
                {isSidebarOpen ? (
                  <div className="px-2 py-1">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {category.title}
                    </h3>
                  </div>
                ) : (
                  /* White divider when sidebar is closed - skip for first category (MENU) */
                  categoryIndex > 0 && <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>
                )}

                {/* Category Items */}
                <div className={`space-y-1 ${category.title === 'QUẢN LÝ' ? 'pt-2' : ''} ${category.title === 'TÀI KHOẢN' ? 'pt-2' : ''}`}>
                  {category.items.map((item) => {
                    const isActive = activeSection === item.id || (item.id === 'create' && activeSection === 'create');
                    return (
                      <Button
                        key={item.id}
                        variant={isActive ? "secondary" : "ghost"}
                        // Increased height for easier tapping on mobile (h-11 vs h-9)
                        className={`group/item w-full ${isSidebarOpen ? 'justify-start px-2.5' : 'justify-center px-2'} h-11 lg:h-9 text-foreground font-medium transition-all duration-200 ${isActive
                          ? "bg-primary border border-primary shadow-lg shadow-primary/20 text-primary-foreground"
                          : "border border-transparent hover:bg-secondary hover:border-primary/50 hover:shadow-md hover:shadow-primary/10"
                          }`}
                        onClick={() => {
                          handleSectionClick(item.id, item.url);
                        }}
                      >
                        {isSidebarOpen ? (
                          <div className="mr-2 transition-transform duration-200 group-hover/item:scale-110">
                            <img
                              src={item.icon}
                              alt={item.label}
                              className="w-6 h-6 flex-none opacity-90 group-hover/item:opacity-100"
                              style={{ width: 16, height: 16 }}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center px-2 justify-center transition-transform duration-200 group-hover/item:scale-110">
                            <img
                              src={item.icon}
                              alt={item.label}
                              className="w-6 h-6 flex-none opacity-90 group-hover/item:opacity-100"
                              style={{ width: 16, height: 16 }}
                            />
                          </div>
                        )}
                        {/* Typography Increased for Mobile: text-base for mobile, text-xs/tracking-wide for desktop */}
                        {isSidebarOpen && <span className="text-base lg:text-xs tracking-wide">{item.label}</span>}
                      </Button>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* CREDITS & STORAGE DISPLAY AREA */}
        {/* TRƯỜNG HỢP 1: ĐANG TẢI (SKELETON LOADER) - Đồng bộ với layout thật */}
        {authLoading && (
          <div className="flex-shrink-0 border-t border-border/50">
            {/* Skeleton cho Credits Section */}
            <div className="pt-3 px-4 pb-3">
              <div className={`w-full relative overflow-hidden bg-gradient-to-br from-muted to-card border border-border rounded-xl transition-all duration-300 ${isSidebarOpen ? 'p-3' : 'p-2 flex justify-center'}`}>
                {isSidebarOpen ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary animate-pulse" />
                      <div className="flex flex-col gap-1">
                        <div className="h-3.5 w-8 bg-secondary rounded animate-pulse" />
                        <div className="h-2.5 w-12 bg-secondary rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-secondary animate-pulse" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full bg-secondary animate-pulse" />
                    <div className="h-2.5 w-6 bg-secondary rounded animate-pulse" />
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-secondary animate-pulse" />
                  </div>
                )}
              </div>
            </div>

            {/* Skeleton cho Language Switcher Section */}
            <div className="px-4 py-2 border-t border-border/50">
              <div className={`w-full flex items-center gap-2 p-2 rounded-lg bg-gradient-to-br from-secondary/50 to-secondary/20 border border-border ${isSidebarOpen ? '' : 'justify-center'}`}>
                <div className="w-7 h-7 rounded-lg bg-secondary shrink-0 animate-pulse" />
                {isSidebarOpen && (
                  <div className="flex-1 flex items-center justify-between">
                    <div className="h-2.5 w-16 bg-secondary rounded animate-pulse" />
                    <div className="h-6 w-20 bg-secondary rounded animate-pulse" />
                  </div>
                )}
              </div>
            </div>

            {/* Skeleton cho User Profile Section */}
            <div className="px-4 pb-3">
              <div className={`flex items-center gap-3 p-2 rounded-lg bg-secondary ${isSidebarOpen ? '' : 'justify-center'}`}>
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-secondary shrink-0 animate-pulse" />
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-secondary border-2 border-card rounded-full animate-pulse" />
                </div>
                {isSidebarOpen && (
                  <div className="flex-1 flex items-center justify-between">
                    <div className="flex flex-col gap-1.5">
                      <div className="h-3.5 w-20 bg-secondary rounded animate-pulse" />
                      <div className="h-2.5 w-16 bg-secondary rounded animate-pulse" />
                    </div>
                    <div className="w-6 h-6 rounded-md bg-secondary animate-pulse" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex-shrink-0 border-t border-border/50">
          {/* CREDITS SECTION */}
          {!authLoading && user && (
            <div className="pt-3 px-4 pb-3 relative group"
              onMouseEnter={() => {
                if (window.innerWidth >= 1024) refreshCredits();
              }}
            >
              {/* Tooltip hiện khi hover (Desktop) HOẶC Click (Mobile) - Absolute positioned */}
              <div className={`absolute bottom-full left-0 right-0 mb-2 px-4 transition-all duration-300 z-50
                ${(window.innerWidth < 1024 && showMobileTooltip) ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible translate-y-2 pointer-events-none lg:group-hover:opacity-100 lg:group-hover:visible lg:group-hover:translate-y-0'}
            `}>
                <div className="relative bg-gradient-to-br from-card to-background rounded-2xl p-4 border border-border shadow-2xl backdrop-blur-sm">

                  <div className="flex justify-between items-center mb-3 pb-3 border-b border-border/50">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('currentPlan')}</span>
                    <div className="flex items-center gap-2">
                      {isLoadingCredits && <RefreshCw className="w-3 h-3 text-muted-foreground animate-spin" />}
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-primary/20 to-purple-500/20 text-foreground uppercase border border-border">
                        {planLabel}
                      </span>
                    </div>
                  </div>

                  {/* Credits Section */}
                  <div className="mb-4">
                    <div className="flex justify-between items-end text-xs mb-1.5">
                      <span className="text-muted-foreground">{t('credits')}</span>
                      <span className={`font-mono font-bold ${textColor}`}>
                        {creditsRemaining} <span className="text-muted-foreground font-normal">/ {totalCredits || '--'}</span>
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/50">
                      <div className={`h-full transition-all duration-500 ${progressColor}`} style={{ width: `${Math.min(100, percentUsed)}%` }} />
                    </div>
                    {isLowCredits && (
                      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-yellow-400 bg-yellow-400/5 p-1.5 rounded border border-yellow-400/10">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{t('lowCreditsWarning')}.</span>
                      </div>
                    )}
                  </div>

                  {/* Storage Section */}
                  <div className="mb-4">
                    <div className="flex justify-between items-end text-xs mb-1.5">
                      <span className="text-muted-foreground flex items-center gap-1"><HardDrive className="w-3 h-3" /> {t('storage')}</span>
                      <span className="font-mono font-bold text-foreground">
                        {storageData.used} <span className="text-muted-foreground font-normal">/ {storageData.total} GB</span>
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/50">
                      {/* Màu xanh blue cho storage để phân biệt với credits */}
                      <div
                        className="h-full transition-all duration-500 bg-blue-500"
                        style={{ width: `${Math.min(100, storageData.percent)}%` }}
                      />
                    </div>
                  </div>

                  {/* Profiles Section */}
                  <div className="mb-4">
                    <div className="flex justify-between items-end text-xs mb-1.5">
                      <span className="text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> {t('profiles')}</span>
                      <span className="font-mono font-bold text-foreground">
                        {profileLimits?.current || 0} <span className="text-muted-foreground font-normal">/ {profileLimits?.limit === -1 ? '∞' : profileLimits?.limit}</span>
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/50">
                      <div
                        className="h-full transition-all duration-500 bg-orange-500"
                        style={{ width: `${profileLimits?.limit === -1 ? 5 : Math.min(100, ((profileLimits?.current || 0) / (profileLimits?.limit || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Arrow tooltip */}
                  <div className={`absolute -bottom-1.5 w-3 h-3 bg-card border-b border-r border-border transform rotate-45 ${isSidebarOpen ? 'left-1/2 -translate-x-1/2' : 'left-4'}`}></div>
                </div>
              </div>

              {/* MAIN BUTTON (Credits Bar) */}
              <button
                type="button"
                data-mobile-tooltip-trigger="true"
                onClick={() => {
                  // Mobile: Click toggles Tooltip
                  if (window.innerWidth < 1024) {
                    setShowMobileTooltip(!showMobileTooltip);
                    // Optional: Also refresh credits when opening
                    if (!showMobileTooltip) refreshCredits();
                    return;
                  }
                  // Desktop: Click opens Plan/Debug Modal
                  if (!isInWizard && onPlanModalClick) {
                    onPlanModalClick();
                  }
                }}
                disabled={isInWizard}
                className={`w-full relative overflow-visible group/btn bg-gradient-to-br from-muted to-card border border-border hover:border-primary/50 rounded-xl transition-all duration-300 ${isSidebarOpen ? 'p-3' : 'p-2 flex justify-center'}`}
              >
                {isSidebarOpen ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${isCriticalCredits ? 'bg-red-500/10 border-red-500/30' : 'bg-primary/10 border-primary/30'}`}>
                        <Zap className={`w-4 h-4 ${isCriticalCredits ? 'text-red-500' : 'text-primary'}`} />
                      </div>
                      <div className="flex flex-col items-start">
                        <span className={`text-sm font-bold ${textColor}`}>{creditsRemaining}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Credits</span>
                      </div>
                    </div>

                    {/* --- NÚT MUA GÓI / NẠP TIỀN (+) --- */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent parent click
                        router.push('/buy-plan'); // Now works with locale routing
                        // On mobile, also toggle sidebar close if needed? Usually navigating closes it from handleSectionClick but this is manual
                        if (window.innerWidth < 1024) onSidebarToggle(false);
                      }}
                      className="w-7 h-7 rounded-lg bg-secondary hover:bg-primary flex items-center justify-center transition-colors cursor-pointer border border-border/50 shadow-sm z-20 group/plus"
                      title="Buy Credits"
                    >
                      <Plus className="w-4 h-4 text-foreground group-hover/plus:scale-110 transition-transform" />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${isCriticalCredits ? 'bg-red-500/10 border-red-500/30' : 'bg-primary/10 border-primary/30'}`}>
                      <Zap className={`w-4 h-4 ${isCriticalCredits ? 'text-red-500' : 'text-primary'}`} />
                    </div>
                    <span className={`text-[10px] font-bold ${textColor}`}>{creditsRemaining}</span>

                    {/* Nút mua credits khi sidebar đóng */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push('/buy-plan');
                        if (window.innerWidth < 1024) onSidebarToggle(false);
                      }}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary border-2 border-card flex items-center justify-center cursor-pointer hover:scale-110 transition-transform z-20"
                      title="Buy Credits"
                    >
                      <Plus className="w-3 h-3 text-foreground" />
                    </div>
                  </div>
                )}

                {/* Hiệu ứng glow nhẹ khi hover */}
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none" />
              </button>
            </div>
          )}

          {/* LANGUAGE SWITCHER SECTION */}
          {!authLoading && (
            <div className="px-4 py-2 border-t border-border/50">
              <div className={`w-full flex items-center gap-2 p-2 rounded-lg bg-gradient-to-br from-secondary/50 to-secondary/20 border border-border hover:border-purple-500/30 hover:bg-secondary/60 transition-all duration-200 group/lang ${isSidebarOpen ? '' : 'justify-center'}`}>
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 shrink-0 group-hover/lang:scale-105 transition-transform duration-200">
                  <img src="/icons/sidebar/Language.svg" alt="Language" className="w-3.5 h-3.5 opacity-80 group-hover/lang:opacity-100 transition-opacity" />
                </div>
                {isSidebarOpen && (
                  <div className="flex-1 flex items-center justify-between ml-2 overflow-hidden">
                    <span className="text-xs font-medium text-foreground/80 whitespace-nowrap mr-2">{t('language')}</span>
                    <div className="shrink-0">
                      <LanguageSwitcher />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* USER PROFILE SECTION */}
          {!authLoading && user && (
            <div
              onClick={() => {
                router.push('/profile');
                if (window.innerWidth < 1024) onSidebarToggle(false);
              }}
              className={`flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer group/user ${isSidebarOpen ? '' : 'justify-center'}`}
            >
              {/* Avatar */}
              <div className="relative">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-border bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shrink-0">
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-foreground uppercase">{user.email?.[0] || 'U'}</span>
                  )}
                </div>
                {/* Online Status Dot */}
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-card rounded-full"></div>
              </div>

              {/* Info & Logout (Chỉ hiện khi mở Sidebar) */}
              {isSidebarOpen && (
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <div className="min-w-0 flex flex-col">
                    <span className="text-base lg:text-sm font-medium text-foreground truncate max-w-[100px]" title={user.email}>{user.email?.split('@')[0]}</span>

                    <span className="text-[10px] text-muted-foreground font-medium bg-secondary px-1.5 py-0.5 rounded w-fit capitalize">
                      {planLabel}
                    </span>

                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push('/profile');
                        if (window.innerWidth < 1024) onSidebarToggle(false);
                      }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      title={t('accountSettings')}
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSignOut();
                        if (window.innerWidth < 1024) onSidebarToggle(false);
                      }}
                      disabled={isLoggingOut}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title={t('logout')}
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Tooltip khi đóng Sidebar */}
              {!isSidebarOpen && (
                <div className="absolute left-14 bottom-0 bg-card border border-border rounded-lg p-3 min-w-[180px] shadow-xl opacity-0 invisible group-hover/user:opacity-100 group-hover/user:visible transition-all z-50">
                  <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border/50">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">{user.email?.[0]?.toUpperCase()}</div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold text-foreground truncate">{user.email}</p>

                      <p className="text-xs text-muted-foreground capitalize">{planLabel} Plan</p>

                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSignOut();
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors"
                  >
                    <LogOut className="w-3 h-3" /> {t('logout')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Sign Out Success Dialog */}
      <Dialog open={showSignOutDialog}>
        <DialogContent className="sm:max-w-sm bg-card border-border [&>button]:hidden">
          <div className="flex flex-col items-center text-center py-4 space-y-4">
            <div className="h-14 w-14 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <h3 className="text-lg font-semibold">{t('signOutSuccess')}</h3>
            <p className="text-sm text-muted-foreground">{t('signOutRedirect')}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}