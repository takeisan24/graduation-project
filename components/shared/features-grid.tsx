"use client";

import { Card } from "@/components/ui/card";
import { Link2, Share2, Sparkles, MessageSquare, Calendar, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";

const easeOut = [0.16, 1, 0.3, 1] as const;

const fadeInUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOut } }
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
};

export default function FeaturesGrid() {
  const t = useTranslations('HomePage');

  const features = [
    { icon: <Link2 className="h-5 w-5 text-white" />, title: t('features.feature1.title'), description: t('features.feature1.description'), featured: true },
    { icon: <Share2 className="h-5 w-5 text-white" />, title: t('features.feature2.title'), description: t('features.feature2.description') },
    { icon: <Sparkles className="h-5 w-5 text-white" />, title: t('features.feature3.title'), description: t('features.feature3.description') },
    { icon: <MessageSquare className="h-5 w-5 text-white" />, title: t('features.feature4.title'), description: t('features.feature4.description') },
    { icon: <Calendar className="h-5 w-5 text-white" />, title: t('features.feature5.title'), description: t('features.feature5.description') },
    { icon: <Zap className="h-5 w-5 text-white" />, title: t('features.feature6.title'), description: t('features.feature6.description') }
  ];

  return (
    <section id="features" className="py-28 md:py-36">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          className="text-center mb-16"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <motion.div variants={fadeInUp}>
            <div className="section-label mx-auto mb-6 w-fit">
              <span className="section-label-dot animate-pulse-dot" />
              <span className="section-label-text">{t('sectionLabels.features')}</span>
            </div>
          </motion.div>
          <motion.h2 variants={fadeInUp} className="font-display text-3xl md:text-[3.25rem] leading-tight mb-4">
            {t('featuresTitle')}
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('featureSubtitle')}
          </motion.p>
        </motion.div>

        {/* Features grid */}
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              variants={fadeInUp}
              className={index === 0 ? "md:col-span-2 lg:col-span-1" : ""}
            >
              <Card className="group relative p-6 md:p-8 bg-card border-border hover:border-utc-royal/30 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full overflow-hidden">
                {/* Hover gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-utc-royal/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Featured gradient border effect */}
                {feature.featured && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-utc-royal to-utc-sky" />
                )}

                <div className="relative z-10">
                  {/* Icon with gradient background */}
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-utc-royal to-utc-sky flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                    {feature.icon}
                  </div>

                  <h3 className="text-lg font-semibold mb-2 tracking-tight">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-[15px]">
                    {feature.description}
                  </p>

                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
