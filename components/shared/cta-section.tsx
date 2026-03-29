"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight, Loader2 } from "lucide-react"
import { useTranslations, useLocale } from 'next-intl'
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { supabaseClient } from "@/lib/supabaseClient"

const easeOut = [0.16, 1, 0.3, 1] as const;

export default function CTASection() {
  const t = useTranslations('HomePage.ctaSection');
  const tLabels = useTranslations('HomePage.sectionLabels');
  const locale = useLocale()
  const router = useRouter()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [isCtaLoading, setIsCtaLoading] = useState(false)

  const handleGetStarted = useCallback(async () => {
    if (isCtaLoading) return
    setIsCtaLoading(true)
    try {
      let hasSession = isAuthenticated
      if (!hasSession && authLoading) {
        const { data: { session } } = await supabaseClient.auth.getSession()
        hasSession = Boolean(session)
      }
      router.push(hasSession ? `/${locale}/create` : `/${locale}/signin`)
    } catch {
      router.push(`/${locale}/signin`)
    } finally {
      setIsCtaLoading(false)
    }
  }, [authLoading, isAuthenticated, isCtaLoading, locale, router])

  return (
    <section className="section-inverted relative py-28 md:py-36 overflow-hidden">
      {/* Textures */}
      <div className="dot-pattern absolute inset-0" />
      <div className="radial-glow radial-glow-blue w-[500px] h-[500px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: easeOut }}
        >
          {/* Section label */}
          <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/5 px-5 py-2 mb-8">
            <span className="h-2 w-2 rounded-full bg-utc-gold animate-pulse-dot" />
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-utc-gold">
              {tLabels('cta')}
            </span>
          </div>

          <h2 className="font-display text-3xl md:text-[3.25rem] leading-tight mb-6">
            {t('title')}
          </h2>

          <p className="text-lg opacity-70 mb-10 max-w-xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="h-14 px-10 text-base bg-gradient-to-r from-utc-royal to-utc-sky text-white shadow-accent hover:shadow-accent-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 group"
              onClick={handleGetStarted}
              disabled={isCtaLoading}
            >
              <span>{t('cta')}</span>
              {isCtaLoading ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
