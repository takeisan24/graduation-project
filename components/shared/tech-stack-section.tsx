"use client";

import { motion } from "framer-motion";
import {
  Database, Globe, Cpu, Palette, Shield, BarChart3,
  Server, Code2, Layers
} from "lucide-react";
import { useTranslations } from "next-intl";

const easeOut = [0.16, 1, 0.3, 1] as const;

const fadeInUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOut } }
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } }
};

const stack = [
  {
    category: "Frontend",
    icon: <Code2 className="h-5 w-5" />,
    items: ["Next.js 14", "React 18", "TypeScript", "Tailwind CSS v4"],
  },
  {
    category: "UI Components",
    icon: <Palette className="h-5 w-5" />,
    items: ["shadcn/ui", "Radix UI", "Framer Motion", "Recharts"],
  },
  {
    category: "State & Data",
    icon: <Layers className="h-5 w-5" />,
    items: ["Zustand", "SWR", "React Hook Form", "Zod"],
  },
  {
    category: "Backend & DB",
    icon: <Database className="h-5 w-5" />,
    items: ["Supabase", "PostgreSQL", "Row Level Security", "PostgREST"],
  },
  {
    category: "AI / GenAI",
    icon: <Cpu className="h-5 w-5" />,
    items: ["Google Gemini", "OpenAI GPT", "Multi-modal Generation", "Prompt Engineering"],
    featured: true,
  },
  {
    category: "Infrastructure",
    icon: <Server className="h-5 w-5" />,
    items: ["Vercel", "Serverless Functions", "Edge Middleware", "Vercel Analytics"],
  },
  {
    category: "Internationalization",
    icon: <Globe className="h-5 w-5" />,
    items: ["next-intl", "Vietnamese", "English", "URL-based Routing"],
  },
  {
    category: "Security",
    icon: <Shield className="h-5 w-5" />,
    items: ["JWT Auth", "Credit System", "API Protection", "Input Validation"],
  },
  {
    category: "Testing",
    icon: <BarChart3 className="h-5 w-5" />,
    items: ["Playwright E2E", "10 Test Suites", "CI-ready", "Multi-browser"],
  },
];

export default function TechStackSection() {
  const t = useTranslations('HomePage');

  return (
    <section className="section-inverted relative py-28 md:py-36 overflow-hidden">
      {/* Dot pattern texture */}
      <div className="dot-pattern absolute inset-0" />

      {/* Radial glows */}
      <div className="radial-glow radial-glow-blue w-[600px] h-[600px] -top-60 -right-60" />
      <div className="radial-glow radial-glow-gold w-[400px] h-[400px] -bottom-40 -left-40" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          className="text-center mb-16"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <motion.div variants={fadeInUp}>
            <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/5 px-5 py-2 mb-6">
              <span className="h-2 w-2 rounded-full bg-utc-gold animate-pulse-dot" />
              <span className="font-mono text-xs uppercase tracking-[0.15em] text-utc-gold">
                {t('sectionLabels.techStack')}
              </span>
            </div>
          </motion.div>
          <motion.h2 variants={fadeInUp} className="font-display text-3xl md:text-[3.25rem] leading-tight mb-4">
            {t('techStack.title')}
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg opacity-70 max-w-2xl mx-auto">
            {t('techStack.subtitle')}
          </motion.p>
        </motion.div>

        {/* Tech grid */}
        <motion.div
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {stack.map((group) => (
            <motion.div
              key={group.category}
              variants={fadeInUp}
              className={`group rounded-xl border p-5 transition-all duration-300 hover:-translate-y-0.5 ${
                group.featured
                  ? "border-utc-gold/30 bg-utc-gold/5 hover:border-utc-gold/50 hover:shadow-gold"
                  : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]"
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                  group.featured
                    ? "bg-gradient-to-br from-utc-gold to-utc-gold-bright text-white"
                    : "bg-white/10"
                }`}>
                  {group.icon}
                </div>
                <h3 className="font-semibold text-sm">{group.category}</h3>
                {group.featured && (
                  <span className="ml-auto text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-utc-gold/20 text-utc-gold">
                    Core
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((item) => (
                  <span
                    key={item}
                    className="text-xs px-2.5 py-1 rounded-md bg-white/10 opacity-80 group-hover:opacity-100 transition-opacity"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
