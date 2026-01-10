"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight, Loader2 } from "lucide-react"
import {useTranslations, useLocale} from 'next-intl'
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { supabaseClient } from "@/lib/supabaseClient"

export default function CTASection() {
  const t = useTranslations('HomePage.ctaSection');
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
        // Ensure we read the latest session before deciding where to redirect
        const { data: { session } } = await supabaseClient.auth.getSession()
        hasSession = Boolean(session)
      }

      const targetPath = hasSession ? `/${locale}/create` : `/${locale}/signin`
      router.push(targetPath)
    } catch (error) {
      console.warn('[CTASection] Failed to determine auth state, sending user to signin as fallback:', error)
      router.push(`/${locale}/signin`)
    } finally {
      setIsCtaLoading(false)
    }
  }, [authLoading, isAuthenticated, isCtaLoading, locale, router])
  
  return (
    <section className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        <motion.div 
          className="bg-primary/5 border border-white/30 border-white[.03] rounded-2xl p-8 md:p-16"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.6 }}
        >
          <div className="max-w-4xl mx-auto text-center">
            <motion.h2 
              className="text-4xl md:text-6xl font-bold mb-6 text-balance"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {t('title')}
            </motion.h2>
            <motion.p 
              className="text-xl text-muted-foreground mb-8 text-pretty max-w-2xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              {t('subtitle')}
            </motion.p>
            <motion.div 
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Button 
                size="lg" 
                className="text-base px-8"
                onClick={handleGetStarted}
                disabled={isCtaLoading}
              >
                <span>{t('cta')}</span>
                {isCtaLoading ? (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="ml-2 h-4 w-4" />
                )}
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 bg-transparent">
                <a href="/pricing">{t('pricing_view')}</a>
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
