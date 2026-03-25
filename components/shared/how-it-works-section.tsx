// components/shared/how-it-works-section.tsx

"use client"

import { Card } from "@/components/ui/card"
import { Link2, Zap, Share2 } from "lucide-react"
import { useTranslations } from "next-intl"
import Image from "next/image" // Thêm Image component
import { motion } from "framer-motion"

export default function HowItWorksSection() {
  const t = useTranslations('HomePage.howItWorks');

  // Định nghĩa animation variants
  const fadeInAnimation = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3}
  };

  const steps = [
    {
      icon: <Link2 className="h-8 w-8 text-primary" />,
      title: t('step1.title'),
      description: t('step1.description'),
      image: "/how-it-works-1.png" // Đường dẫn đến ảnh cho bước 1
    },
    {
      icon: <Zap className="h-8 w-8 text-primary" />,
      title: t('step2.title'),
      description: t('step2.description'),
      image: "/how-it-works-2.png" // Đường dẫn đến ảnh cho bước 2
    },
    {
      icon: <Share2 className="h-8 w-8 text-primary" />,
      title: t('step3.title'),
      description: t('step3.description'),
      image: "/how-it-works-3.png" // Đường dẫn đến ảnh cho bước 3
    }
  ];

  return (
    <section className="py-20 md:py-32">
      {/* Sửa đổi ở đây: Thêm div bao bọc với border */}
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
        <motion.div 
          className="text-center mb-16 max-w-3xl mx-auto"
          initial="initial"
          whileInView="whileInView"
          viewport={fadeInAnimation.viewport}
          transition={{ duration: 0.5 }}
          variants={fadeInAnimation}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-balance">
            {t('title')}
          </h2>
          <p className="text-xl text-muted-foreground text-pretty">
            {t('subtitle')}
          </p>
        </motion.div>
        </div>

        {/* Thay đổi cấu trúc hiển thị để thêm ảnh */}
        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8, y: 30 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              whileHover={{ 
                scale: 1.05,
                y: -12,
                rotateY: 5,
                transition: { duration: 0.4, ease: "easeOut" }
              }}
              whileTap={{ scale: 0.95 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: index * 0.2, ease: [0.34, 1.56, 0.64, 1] }}
            >
            <Card className="p-6 bg-card border-border hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/25 transition-all duration-300 text-center flex flex-col items-center cursor-pointer group">
              <motion.div 
                className="w-full aspect-video rounded-lg overflow-hidden mb-6 bg-muted/30"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.3 }}
              >
                <Image
                  src={step.image}
                  alt={step.title}
                  width={400}
                  height={225}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
              </motion.div>
              <motion.div 
                className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4"
                whileHover={{
                  rotate: 360,
                  scale: 1.2,
                  transition: { duration: 0.6 }
                }}
              >
                {step.icon}
              </motion.div>
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}