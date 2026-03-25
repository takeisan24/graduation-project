"use client";

import { motion } from "framer-motion";
import {
  Database, Globe, Cpu, Palette, Shield, BarChart3,
  Server, Code2, Layers
} from "lucide-react";

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
  return (
    <section className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Công nghệ sử dụng
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Kiến trúc hiện đại, bảo mật, và có khả năng mở rộng
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {stack.map((group, index) => (
            <motion.div
              key={group.category}
              className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-sm transition-all duration-300"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  {group.icon}
                </div>
                <h3 className="font-semibold text-sm">{group.category}</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((item) => (
                  <span
                    key={item}
                    className="text-xs px-2 py-1 rounded-md bg-secondary text-muted-foreground"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
