"use client"

import { Separator } from "@/components/ui/separator"
import { useTranslations } from "next-intl"

export default function Footer() {
  const t = useTranslations('HomePage.footer');

  return (
    <footer className="border-t border-border py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-gradient-to-br from-utc-royal to-utc-sky flex items-center justify-center">
              <span className="text-white font-bold text-xs">C</span>
            </div>
            <span className="font-semibold tracking-tight">
              Creator<span className="gradient-text">Hub</span>
            </span>
          </div>

          {/* Project info */}
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">{t('thesis')}</p>
            <p className="text-sm text-muted-foreground">{t('university')}</p>
            <p className="text-sm text-muted-foreground">{t('student')}</p>
          </div>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} CreatorHub
          </p>
        </div>

        <Separator className="my-8" />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>{t('builtWith')}</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              {t('systemStatus')}
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
