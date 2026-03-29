"use client"

import { Link2, Zap, Share2, ArrowRight } from "lucide-react"
import { useTranslations } from "next-intl"

// Re-use parent translations for section label
import { motion } from "framer-motion"

const easeOut = [0.16, 1, 0.3, 1] as const;

const fadeInUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOut } }
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15, delayChildren: 0.1 } }
};

export default function HowItWorksSection() {
  const t = useTranslations('HomePage.howItWorks');
  const tLabels = useTranslations('HomePage.sectionLabels');

  const steps = [
    {
      icon: <Link2 className="h-6 w-6 text-white" />,
      title: t('step1.title'),
      description: t('step1.description'),
      number: "01",
    },
    {
      icon: <Zap className="h-6 w-6 text-white" />,
      title: t('step2.title'),
      description: t('step2.description'),
      number: "02",
    },
    {
      icon: <Share2 className="h-6 w-6 text-white" />,
      title: t('step3.title'),
      description: t('step3.description'),
      number: "03",
    }
  ];

  return (
    <section className="py-28 md:py-36">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          className="text-center mb-20"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <motion.div variants={fadeInUp}>
            <div className="section-label mx-auto mb-6 w-fit">
              <span className="section-label-dot animate-pulse-dot" />
              <span className="section-label-text">{tLabels('howItWorks')}</span>
            </div>
          </motion.div>
          <motion.h2 variants={fadeInUp} className="font-display text-3xl md:text-[3.25rem] leading-tight mb-4">
            {t('title')}
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('subtitle')}
          </motion.p>
        </motion.div>

        {/* Timeline steps */}
        <motion.div
          className="relative grid md:grid-cols-3 gap-8 md:gap-6"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {/* Connecting line (desktop only) */}
          <div className="hidden md:block absolute top-16 left-[16.5%] right-[16.5%] h-[2px] bg-gradient-to-r from-utc-royal/20 via-utc-sky/30 to-utc-gold/20" />

          {steps.map((step, index) => (
            <motion.div key={step.number} variants={fadeInUp} className="relative text-center">
              {/* Step number circle */}
              <div className="relative mx-auto mb-8">
                <div className="w-32 h-32 mx-auto rounded-full border-2 border-utc-royal/10 flex items-center justify-center bg-card">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-utc-royal to-utc-sky flex items-center justify-center shadow-accent">
                    {step.icon}
                  </div>
                </div>

                {/* Step number badge */}
                <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-card border-2 border-border flex items-center justify-center shadow-md">
                  <span className="text-sm font-bold font-mono text-utc-royal">{step.number}</span>
                </div>

                {/* Arrow connector (between steps on desktop) */}
                {index < steps.length - 1 && (
                  <div className="hidden md:flex absolute top-1/2 -right-[calc(50%-4rem)] -translate-y-1/2 items-center justify-center w-8 h-8 rounded-full bg-utc-royal/10 border border-utc-royal/20">
                    <ArrowRight className="h-4 w-4 text-utc-royal" />
                  </div>
                )}
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold mb-3 tracking-tight">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {step.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
