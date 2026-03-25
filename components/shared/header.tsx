"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, Menu, X, User, LogOut } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslations } from 'next-intl';
import { useAuth } from "@/hooks/useAuth";

export default function Header() {
  const t = useTranslations('Header');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, loading, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold">CreatorHub</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          {loading ? (
            <div className="text-sm text-muted-foreground">{t('buttons.loading')}</div>
          ) : isAuthenticated && user ? (
            <>
              <Link href="/create" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t('buttons.dashboard')}
              </Link>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10">
                <User className="h-4 w-4 text-primary" />
                <span className="text-sm">{user.email}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-1" />
                {t('buttons.signOut')}
              </Button>
            </>
          ) : (
            <>
              <Link prefetch={false} href="/signin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t('buttons.signIn')}
              </Link>
              <Button size="sm" asChild>
                <Link prefetch={false} href="/signup">{t('buttons.getStarted')}</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <div className="md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={t('buttons.toggleMenu')}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile panel */}
      {isMobileMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-background border-b border-border md:hidden">
          <div className="container mx-auto px-6 py-4 flex flex-col gap-4">
            <LanguageSwitcher />
            {loading ? (
              <div className="text-sm text-muted-foreground">{t('buttons.loading')}</div>
            ) : isAuthenticated && user ? (
              <>
                <Link href="/create" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setIsMobileMenuOpen(false)}>
                  {t('buttons.dashboard')}
                </Link>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                  <span className="text-sm">{user.email}</span>
                </div>
                <Button variant="ghost" className="w-full justify-start" onClick={() => { signOut(); setIsMobileMenuOpen(false); }}>
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('buttons.signOut')}
                </Button>
              </>
            ) : (
              <>
                <Link prefetch={false} href="/signin" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setIsMobileMenuOpen(false)}>
                  {t('buttons.signIn')}
                </Link>
                <Button className="w-full" asChild>
                  <Link prefetch={false} href="/signup" onClick={() => setIsMobileMenuOpen(false)}>{t('buttons.getStarted')}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
