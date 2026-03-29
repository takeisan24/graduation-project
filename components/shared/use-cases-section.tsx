"use client";

import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useTranslations } from 'next-intl';
import { motion } from "framer-motion";

const easeOut = [0.16, 1, 0.3, 1] as const;

const fadeInUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOut } }
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } }
};

export default function UseCasesSection() {
  const t = useTranslations('HomePage');
  const useCases = t.raw('card') as Array<{ title: string; description: string[] }>;

  return (
    <section id="use-cases" className="py-28 md:py-36">
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
              <span className="section-label-text">{t('sectionLabels.useCases')}</span>
            </div>
          </motion.div>
          <motion.h2 variants={fadeInUp} className="font-display text-3xl md:text-[3.25rem] leading-tight mb-4">
            {t('useCasesTitle')}
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('useCasesSubtitle')}
          </motion.p>
        </motion.div>

        {/* Use cases grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
        >
          {useCases.map((useCase, index) => (
            <motion.div key={index} variants={fadeInUp}>
              {/* Gradient border on first card */}
              {index === 0 ? (
                <div className="gradient-border h-full">
                  <Card className="p-8 bg-card h-full border-0">
                    <UseCaseContent useCase={useCase} />
                  </Card>
                </div>
              ) : (
                <Card className="p-8 bg-card border-border hover:border-utc-royal/30 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 h-full">
                  <UseCaseContent useCase={useCase} />
                </Card>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function UseCaseContent({ useCase }: { useCase: { title: string; description: string[] } }) {
  return (
    <>
      <h3 className="text-xl font-semibold mb-5 tracking-tight">{useCase.title}</h3>
      <ul className="space-y-3">
        {useCase.description.map((desc, descIndex) => (
          <li key={descIndex} className="flex items-start gap-3">
            <div className="mt-1 h-5 w-5 rounded-full bg-gradient-to-br from-utc-royal to-utc-sky flex items-center justify-center flex-shrink-0">
              <Check className="h-3 w-3 text-white" />
            </div>
            <span className="text-muted-foreground leading-relaxed">{desc}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
