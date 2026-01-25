"use client";

import { useState } from "react"; // <-- MỚI: Import useState để quản lý trạng thái menu
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, Menu, X, User, LogOut } from "lucide-react"; // <-- MỚI: Import icon Menu và X
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslations } from 'next-intl';
import { useAuth } from "@/hooks/useAuth";

export default function Header() {
  const t = useTranslations('Header');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // <-- MỚI: State để điều khiển menu mobile
  const { user, isAuthenticated, loading, signOut } = useAuth();

  return (
    // THAY ĐỔI: Thêm `relative` để menu mobile có thể định vị theo header
    <header className="relative flex items-center justify-between px-4 py-4 border-b border-gray-800 top-0 bg-black z-20">
      <div className="container mx-auto px-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">CreatorHub</span>
        </Link>

        {/* --- Menu cho Desktop --- */}
        {/* Giữ nguyên logic `hidden md:flex` để chỉ hiện trên desktop */}
        {/* --- Menu cho Desktop (HIDDEN) --- */}
        <nav className="hidden md:hidden items-center gap-8">
          <Link href="/#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {t('nav.features')}
          </Link>
          <Link href="/#use-cases" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {t('nav.useCases')}
          </Link>
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {t('nav.pricing')}
          </Link>
          <Link href="/faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {t('nav.faq')}
          </Link>
        </nav>

        {/* --- Các nút bấm cho Desktop --- */}
        {/* THAY ĐỔI: Thêm `hidden md:flex` để ẩn nhóm này trên mobile */}
        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : isAuthenticated && user ? (
            <>
              <Link href="/create" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10">
                <User className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground">{user.email}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              {/* Disable prefetch to avoid redundant auth route calls */}
              <Link prefetch={false} href="/signin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t('buttons.signIn')}
              </Link>
              <Button size="sm" asChild>
                <Link prefetch={false} href="/signup">{t('buttons.getStarted')}</Link>
              </Button>
            </>
          )}
        </div>

        {/* --- Nút Hamburger cho Mobile --- */}
        {/* MỚI: Nút này chỉ hiển thị trên mobile (`md:hidden`) */}
        <div className="md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* --- Panel Menu Mobile --- */}
      {/* MỚI: Panel này sẽ hiện ra khi state `isMobileMenuOpen` là true */}
      {isMobileMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-black border-b border-gray-800 md:hidden">
          <div className="container mx-auto px-8 py-6 flex flex-col items-start gap-6">
            {/* Các link điều hướng */}
            <Link href="/#features" className="text-base text-muted-foreground hover:text-foreground" onClick={() => setIsMobileMenuOpen(false)}>
              {t('nav.features')}
            </Link>
            <Link href="/#use-cases" className="text-base text-muted-foreground hover:text-foreground" onClick={() => setIsMobileMenuOpen(false)}>
              {t('nav.useCases')}
            </Link>
            <Link href="/pricing" className="text-base text-muted-foreground hover:text-foreground" onClick={() => setIsMobileMenuOpen(false)}>
              {t('nav.pricing')}
            </Link>
            <Link href="/faq" className="text-base text-muted-foreground hover:text-foreground" onClick={() => setIsMobileMenuOpen(false)}>
              {t('nav.faq')}
            </Link>

            {/* Vạch ngăn cách */}
            <hr className="w-full border-gray-800 my-2" />

            {/* Các nút và hành động */}
            <div className="flex flex-col items-start gap-6 w-full">
                <LanguageSwitcher />
                {loading ? (
                  <div className="text-base text-muted-foreground">Loading...</div>
                ) : isAuthenticated && user ? (
                  <>
                    <Link href="/create" className="text-base text-muted-foreground hover:text-foreground" onClick={() => setIsMobileMenuOpen(false)}>
                      Dashboard
                    </Link>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 w-full">
                      <User className="h-4 w-4 text-primary" />
                      <span className="text-sm text-foreground">{user.email}</span>
                    </div>
                    <Button size="lg" variant="ghost" className="w-full" onClick={() => { signOut(); setIsMobileMenuOpen(false); }}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    {/* Disable prefetch on auth routes to prevent repeated background GETs */}
                    <Link prefetch={false} href="/signin" className="text-base text-muted-foreground hover:text-foreground" onClick={() => setIsMobileMenuOpen(false)}>
                      {t('buttons.signIn')}
                    </Link>
                    <Button size="lg" className="w-full" asChild>
                      <Link prefetch={false} href="/signup" onClick={() => setIsMobileMenuOpen(false)}>{t('buttons.getStarted')}</Link>
                    </Button>
                  </>
                )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}