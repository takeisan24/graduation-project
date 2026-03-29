"use client";

import { useState, useCallback } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Menu, X, User, LogOut, ArrowRight, Sun, Moon, CheckCircle2 } from "lucide-react";
import { useTheme } from "next-themes";
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslations } from 'next-intl';
import { useAuth } from "@/hooks/useAuth";

export default function Header() {
  const t = useTranslations('Header');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const { user, isAuthenticated, loading, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleSignOut = useCallback(async () => {
    setIsMobileMenuOpen(false);
    const success = await signOut();
    if (success) {
      setShowSignOutDialog(true);
      setTimeout(() => { window.location.href = '/'; }, 700);
    }
  }, [signOut]);

  return (
    <>
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo - UTC branded */}
        <Link href="/" className="flex items-center gap-2.5 group" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-utc-royal to-utc-sky flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Creator<span className="gradient-text">Hub</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            aria-label="Toggle theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          </Button>
          <LanguageSwitcher />
          {loading ? (
            <div className="text-sm text-muted-foreground px-3">{t('buttons.loading')}</div>
          ) : isAuthenticated && user ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/create">
                  {t('buttons.dashboard')}
                </Link>
              </Button>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-utc-royal/5 border border-utc-royal/10">
                <User className="h-3.5 w-3.5 text-utc-royal" />
                <span className="text-sm text-foreground/80">{user.email}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4 mr-1.5" />
                {t('buttons.signOut')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/signin">
                  {t('buttons.signIn')}
                </Link>
              </Button>
              <Button size="sm" className="bg-gradient-to-r from-utc-royal to-utc-sky text-white shadow-sm hover:shadow-accent hover:-translate-y-0.5 transition-all duration-200" asChild>
                <Link href="/signup">
                  {t('buttons.getStarted')}
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
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
        <div className="absolute top-full left-0 w-full bg-background/95 backdrop-blur-sm border-b border-border md:hidden">
          <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="h-9 w-9 text-muted-foreground"
                aria-label="Toggle theme"
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
              </Button>
              <LanguageSwitcher />
            </div>
            {loading ? (
              <div className="text-sm text-muted-foreground">{t('buttons.loading')}</div>
            ) : isAuthenticated && user ? (
              <>
                <Button variant="ghost" className="w-full justify-start" asChild>
                  <Link href="/create" onClick={() => setIsMobileMenuOpen(false)}>
                    {t('buttons.dashboard')}
                  </Link>
                </Button>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-utc-royal/5 border border-utc-royal/10">
                  <User className="h-4 w-4 text-utc-royal" />
                  <span className="text-sm">{user.email}</span>
                </div>
                <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('buttons.signOut')}
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" className="w-full justify-start" asChild>
                  <Link href="/signin" onClick={() => setIsMobileMenuOpen(false)}>
                    {t('buttons.signIn')}
                  </Link>
                </Button>
                <Button className="w-full bg-gradient-to-r from-utc-royal to-utc-sky text-white" asChild>
                  <Link href="/signup" onClick={() => setIsMobileMenuOpen(false)}>
                    {t('buttons.getStarted')}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>

      {/* Sign Out Success Dialog */}
      <Dialog open={showSignOutDialog}>
        <DialogContent className="sm:max-w-sm bg-card border-border [&>button]:hidden">
          <div className="flex flex-col items-center text-center py-4 space-y-4">
            <div className="h-14 w-14 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <h3 className="text-lg font-semibold">{t('signOutDialog.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('signOutDialog.description')}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
