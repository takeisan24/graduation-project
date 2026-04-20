"use client";

import { motion } from "framer-motion";
import { Globe, Brain, CalendarCheck, Layers } from "lucide-react";
import { useTranslations } from "next-intl";

const easeOut = [0.16, 1, 0.3, 1] as const;

const icons = [
  <Globe key="globe" className="h-5 w-5" />,
  <Brain key="brain" className="h-5 w-5" />,
  <CalendarCheck key="cal" className="h-5 w-5" />,
  <Layers key="layers" className="h-5 w-5" />,
];

const statKeys = ["platforms", "aiModels", "scheduling", "multiplier"] as const;

export default function StatsSection() {
  const t = useTranslations('HomePage.stats');

  return (
    <section className="section-inverted relative py-20 md:py-28 overflow-hidden">
      <div className="dot-pattern absolute inset-0" />
      <div className="radial-glow radial-glow-blue w-[500px] h-[500px] -top-40 -left-40" />
      <div className="radial-glow radial-glow-gold w-[400px] h-[400px] -bottom-32 -right-32" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
        >
          {statKeys.map((key, index) => (
            <motion.div
              key={key}
              variants={{
                hidden: { opacity: 0, y: 28 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOut } }
              }}
              className="relative text-center group"
            >
              {index > 0 && (
                <div className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 w-px h-16 bg-white/10" />
              )}

              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 mb-4 group-hover:bg-white/15 transition-colors">
                {icons[index]}
              </div>

              <div className="text-4xl md:text-5xl font-bold mb-1 font-display">
                {t(`${key}.value`)}
              </div>

              <div className="text-sm font-medium mb-2 opacity-90">
                {t(`${key}.label`)}
              </div>

              <div className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-white/10">
                <span className="h-1.5 w-1.5 rounded-full bg-utc-gold animate-pulse-dot" />
                <span className="opacity-70">{t(`${key}.trend`)}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
