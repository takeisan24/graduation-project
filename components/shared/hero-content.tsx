"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Zap, Share2, Calendar } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";

const easeOut = [0.16, 1, 0.3, 1] as const;

const fadeInUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOut } }
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } }
};

export default function HeroContent() {
  const t = useTranslations('HomePage');

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background gradient mesh */}
      <div className="hero-gradient-mesh">
        <div className="mesh-orb-3" />
        <div className="mesh-noise" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-28 md:py-36">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">

          {/* Left column - Text */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
          >
            {/* Section label pill */}
            <motion.div variants={fadeInUp}>
              <div className="section-label mb-8">
                <span className="section-label-dot animate-pulse-dot" />
                <span className="section-label-text">{t('hero.badge')}</span>
              </div>
            </motion.div>

            {/* Title */}
            <motion.h1
              variants={fadeInUp}
              className="font-display text-[2.75rem] sm:text-5xl md:text-[3.25rem] lg:text-[3.5rem] leading-[1.08] tracking-tight mb-6"
            >
              {t('hero.titlePre')}
              <span className="gradient-text gradient-underline">
                {t('hero.titleHighlight')}
              </span>
              {t('hero.titlePost')}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={fadeInUp}
              className="text-lg md:text-xl text-muted-foreground mb-10 max-w-xl leading-relaxed"
            >
              {t('hero.subtitle')}
            </motion.p>

            {/* CTA buttons */}
            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 mb-10">
              <Button
                size="lg"
                className="h-13 px-8 text-base bg-gradient-to-r from-utc-royal to-utc-sky text-white shadow-sm hover:shadow-accent-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 group"
                asChild
              >
                <Link href="/create">
                  {t('hero.ctaPrimary')}
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-13 px-8 text-base hover:bg-muted transition-all duration-200"
                asChild
              >
                <a href="#features">
                  {t('hero.ctaSecondary')}
                </a>
              </Button>
            </motion.div>

            {/* Platform tags */}
            <motion.div variants={fadeInUp} className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground mr-1">{t('hero.platformsLabel')}</span>
              {["TikTok", "Instagram", "YouTube", "Facebook", "X", "Threads", "LinkedIn", "Pinterest"].map((name) => (
                <span
                  key={name}
                  className="text-xs px-2.5 py-1 rounded-full bg-card border border-border text-muted-foreground hover:border-utc-royal/30 hover:text-foreground transition-colors"
                >
                  {name}
                </span>
              ))}
            </motion.div>
          </motion.div>

          {/* Right column - Animated Hero Graphic */}
          <motion.div
            className="relative hidden lg:flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: easeOut }}
          >
            {/* Decorative rotating ring */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="w-[340px] h-[340px] rounded-full border-2 border-dashed border-utc-royal/15"
                animate={{ rotate: 360 }}
                transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
              />
            </div>

            {/* Center circle */}
            <div className="relative w-[280px] h-[280px]">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-utc-royal/10 to-utc-sky/10 border border-utc-royal/20" />

              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-utc-royal to-utc-sky flex items-center justify-center shadow-accent">
                  <Sparkles className="h-10 w-10 text-white" />
                </div>
              </div>

              {/* Floating cards */}
              <motion.div
                className="absolute -top-6 -right-8 bg-card rounded-xl border border-border shadow-lg p-3 flex items-center gap-2.5"
                animate={{ y: [-8, 8, -8] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-utc-royal to-utc-sky flex items-center justify-center">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="text-xs font-semibold">AI Generate</div>
                  <div className="text-[10px] text-muted-foreground">Auto content</div>
                </div>
              </motion.div>

              <motion.div
                className="absolute -bottom-4 -left-10 bg-card rounded-xl border border-border shadow-lg p-3 flex items-center gap-2.5"
                animate={{ y: [6, -6, 6] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-utc-gold to-utc-gold-bright flex items-center justify-center">
                  <Share2 className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="text-xs font-semibold">Multi-platform</div>
                  <div className="text-[10px] text-muted-foreground">8 platforms</div>
                </div>
              </motion.div>

              <motion.div
                className="absolute top-1/2 -right-16 -translate-y-1/2 bg-card rounded-xl border border-border shadow-lg p-3 flex items-center gap-2.5"
                animate={{ y: [-5, 10, -5] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-utc-navy to-utc-royal flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="text-xs font-semibold">Schedule</div>
                  <div className="text-[10px] text-muted-foreground">Auto publish</div>
                </div>
              </motion.div>

              <div className="absolute -bottom-12 right-4 grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-utc-royal/20" />
                ))}
              </div>
              <div className="absolute -top-10 -left-6 w-6 h-6 rounded-md bg-utc-gold/80 shadow-gold" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
