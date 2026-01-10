// components/shared/use-cases-section.tsx

"use client";

import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useTranslations } from 'next-intl';
import { motion } from "framer-motion"; // Vẫn giữ motion để animate

export default function UseCasesSection() {
  const t = useTranslations('HomePage');

  const useCases = t.raw('card') as Array<{ title: string; description: string[] }>;
  
  const fadeInAnimation = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3}
  };

  return (
    <section id="use-cases" className="py-20 md:py-32">
      <div className="container mx-auto px-4 border border-white/30 bg-white/[.03] rounded-2xl p-8 md:p-16">
        <motion.div 
          className="text-center mb-16"
          initial="initial"
          whileInView="whileInView"
          viewport={fadeInAnimation.viewport}
          transition={{ duration: 0.6 }}
          variants={fadeInAnimation}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-balance">{t('useCasesTitle')}</h2>
          <p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto">
            {t('useCasesSubtitle')}
          </p>
        </motion.div>

        {/* BỐ CỤC MỚI: LƯỚI CARD TRỰC TIẾP, KHÔNG CÓ HÌNH ẢNH */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {useCases.map((useCase, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.85, rotateX: 10 }}
              whileInView={{ opacity: 1, scale: 1, rotateX: 0 }}
              whileHover={{ 
                scale: 1.03, 
                y: -10,
                boxShadow: "0 20px 40px rgba(227, 50, 101, 0.2)",
                transition: { duration: 0.3 }
              }}
              whileTap={{ scale: 0.98 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: index * 0.15, ease: [0.25, 0.1, 0.25, 1.0] }}
            >
              <Card className="p-8 bg-background border-border hover:border-primary/40 transition-all duration-300 h-full cursor-pointer">
                <motion.h3 
                  className="text-2xl font-bold mb-4"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.15 + 0.2 }}
                >
                  {useCase.title}
                </motion.h3>
                <ul className="space-y-3">
                  {useCase.description.map((desc, descIndex) => (
                    <motion.li 
                      key={descIndex} 
                      className="flex items-start gap-3"
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.15 + 0.3 + descIndex * 0.05 }}
                    >
                      <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{desc}</span>
                    </motion.li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}