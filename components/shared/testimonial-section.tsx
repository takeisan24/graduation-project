"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion"; // Import motion

export default function TestimonialSection() {
  const t = useTranslations('HomePage.testimonial');

  const fadeInAnimation = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: false, amount: 0.3 },
    transition: { duration: 0.6 }
  };

  const results = [
    {
      value: t('results.metric1.value'),
      label: t('results.metric1.label'),
      description: t('results.metric1.description')
    },
    {
      value: t('results.metric2.value'),
      label: t('results.metric2.label'),
      description: t('results.metric2.description')
    },
    {
      value: t('results.metric3.value'),
      label: t('results.metric3.label'),
      description: t('results.metric3.description')
    }
  ];

  return (
    <section className="py-20 md:py-32">
      {/* THÊM LỚP BỌC BÊN NGOÀI */}
      <div className="container mx-auto px-4 border border-border bg-muted/30 rounded-2xl p-8 md:p-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto">
          
          {/* CỘT BÊN TRÁI: QUOTE VÀ THÔNG TIN TÁC GIẢ */}
          <motion.div
            initial={fadeInAnimation.initial}
            whileInView={fadeInAnimation.whileInView}
            viewport={fadeInAnimation.viewport}
            transition={fadeInAnimation.transition}
            variants={fadeInAnimation}
          >
            <div className="mb-6">
              <Image 
                src="/images/placeholder-logo.svg"
                alt="Company Logo"
                width={150}
                height={40}
                style={{ filter: 'brightness(0) invert(1)' }} // Làm logo thành màu trắng
              />
            </div>
            <blockquote className="text-2xl md:text-3xl font-medium text-balance mb-8">
              "{t('quote')}"
            </blockquote>
            <div className="flex items-center gap-4">
              <Image 
                src="/images/shego.jpg"
                alt={t('author.name')}
                width={56}
                height={56}
                className="rounded-full object-cover"
              />
              <div>
                <p className="font-semibold text-lg">{t('author.name')}</p>
                <p className="text-muted-foreground">{t('author.title')}</p>
              </div>
            </div>
          </motion.div>

          {/* CỘT BÊN PHẢI: CÁC KẾT QUẢ ĐỊNH LƯỢNG */}
          <motion.div
            className="grid grid-cols-1 gap-8"
            initial="initial"
            whileInView="whileInView"
            viewport={fadeInAnimation.viewport}
            transition={{ duration: 0.6, delay: 0.2 }}
            variants={fadeInAnimation}
          >
            <h3 className="text-2xl font-bold text-center lg:text-left">{t('results.title')}</h3>
            {results.map((result, index) => (
              <motion.div 
                key={index} 
                className="flex items-start gap-6 p-4 rounded-lg hover:bg-primary/5 transition-all duration-300 cursor-pointer"
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                whileHover={{ 
                  scale: 1.05,
                  x: 10,
                  transition: { duration: 0.3 }
                }}
                transition={{ delay: 0.3 + index * 0.1 }}
              >
                <motion.div 
                  className="flex-shrink-0"
                  whileHover={{ 
                    scale: 1.2,
                    rotate: [0, -5, 5, -5, 0],
                    transition: { duration: 0.5 }
                  }}
                >
                  <span className="text-5xl font-bold text-primary">{result.value}</span>
                </motion.div>
                <div>
                  <p className="text-xl font-semibold">{result.label}</p>
                  <p className="text-muted-foreground mt-1">{result.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
          
        </div>
      </div>
    </section>
  );
}