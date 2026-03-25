"use client";

import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, GraduationCap } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";

export default function HeroContent() {
  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="hero-gradient-mesh">
        <div className="mesh-orb-3" />
        <div className="mesh-noise" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 border border-primary/20"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <GraduationCap className="h-4 w-4" />
            <span>Đồ án tốt nghiệp — CNTT</span>
          </motion.div>

          {/* Title */}
          <motion.h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-balance leading-[1.1] tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Hỗ trợ Lập kế hoạch &{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
              Sáng tạo Nội dung
            </span>{" "}
            đa nền tảng bằng AI
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Biến một nguồn nội dung duy nhất thành bài đăng tối ưu cho nhiều nền tảng mạng xã hội,
            sử dụng Generative AI để tự động hóa quy trình sáng tạo nội dung.
          </motion.p>

          {/* CTA */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Button size="lg" className="text-base px-8 shadow-lg shadow-primary/25" asChild>
              <Link href="/create">
                Trải nghiệm ngay
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8" asChild>
              <a href="#features">
                <Sparkles className="mr-2 h-4 w-4" />
                Xem tính năng
              </a>
            </Button>
          </motion.div>

          {/* Platform tags */}
          <motion.div
            className="flex flex-wrap items-center justify-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <span className="text-sm text-muted-foreground mr-2">Hỗ trợ 9 nền tảng:</span>
            {["Instagram", "TikTok", "Facebook", "YouTube", "LinkedIn", "X", "Threads", "Pinterest", "Bluesky"].map((name, i) => (
              <motion.span
                key={name}
                className="text-xs px-2.5 py-1 rounded-full bg-secondary border border-border text-muted-foreground"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.7 + i * 0.05 }}
              >
                {name}
              </motion.span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
