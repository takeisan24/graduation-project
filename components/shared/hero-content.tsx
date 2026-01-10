// components/shared/hero-content.tsx

"use client";

import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Play } from "lucide-react";
import Image from "next/image";
import { useTranslations } from 'next-intl';
import SocialProof from "./social-proof";
import { motion } from "framer-motion";

export default function HeroContent() {
  const t = useTranslations('HomePage.hero');
  return (
    <>
    <section className="relative container mx-auto px-4 pt-20 md:pt-32 pb-0 overflow-hidden">
      {/* NỀN ĐỘNG MỚI */}
      <div className="gradient-blob-container pointer-events-none">
        <div className="gradient-blob blob-1"></div>
        <div className="gradient-blob blob-2"></div>
      </div>
      {/* Lớp nền gradient mờ (giữ nguyên) */}
      <Image 
        src="/gradient-hero-bg.jpg"
        alt="Gradient background"
        layout="fill"
        className="object-cover opacity-50 blur-2xl"
      />
      
      {/* --- BỐ CỤC MỚI: GRID 2 CỘT --- */}
      <div className="relative grid md:grid-cols-2 items-center gap-8 md:gap-16 max-w-7xl mx-auto">
        
        {/* CỘT BÊN TRÁI: NỘI DUNG VĂN BẢN */}
        <motion.div 
          className="text-center md:text-left"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div 
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Sparkles className="h-4 w-4" />
            <span>{t('AI_powered')}</span>
          </motion.div>
          <motion.h1 
            className="text-5xl md:text-7xl font-bold mb-6 text-balance leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {t('title')}
          </motion.h1>
          <motion.p 
            className="text-xl text-muted-foreground mb-8 text-pretty max-w-2xl mx-auto md:mx-0 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {t('subtitle')}
          </motion.p>
          <motion.div 
            className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Button size="lg" className="text-base px-8">
              <a href="/create">{t('ctaPrimary')}</a>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8 bg-transparent">
              <Play className="mr-2 h-4 w-4" />
              {t('ctaSecondary')}
            </Button>
          </motion.div>
        </motion.div>

        {/* CỘT BÊN PHẢI: HÌNH ẢNH */}
        <motion.div 
          className="w-full"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="rounded-2xl border border-white/10 p-2 bg-black/20 backdrop-blur-sm shadow-2xl shadow-primary/20">
            <Image
              src="/hero-abstract-art.png"
              alt="Maiovo AI content generation abstract art"
              width={1200}
              height={700}
              className="w-full h-auto rounded-xl"
            />
          </div>
        </motion.div>

      </div>
    </section>
      
    {/* PHẦN SOCIAL PROOF - RA NGOÀI CONTAINER ĐỂ FULL WIDTH */}
    <motion.div 
      className="mt-24"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.8 }}
    >
      <SocialProof />
    </motion.div>
    </>
  );
}