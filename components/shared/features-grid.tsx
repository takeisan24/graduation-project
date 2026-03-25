"use client";

import { Card } from "@/components/ui/card";
import { Link2, Share2, Sparkles, MessageSquare, Calendar, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion"; // Import motion

export default function FeaturesGrid() {
  const t = useTranslations('HomePage');

  const fadeInAnimation = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: 0.6 }
  };

  const features = [
    { icon: <Link2 className="h-6 w-6 text-primary" />, title: t('features.feature1.title'), description: t('features.feature1.description') },
    { icon: <Share2 className="h-6 w-6 text-primary" />, title: t('features.feature2.title'), description: t('features.feature2.description') },
    { icon: <Sparkles className="h-6 w-6 text-primary" />, title: t('features.feature3.title'), description: t('features.feature3.description') },
    { icon: <MessageSquare className="h-6 w-6 text-primary" />, title: t('features.feature4.title'), description: t('features.feature4.description') },
    { icon: <Calendar className="h-6 w-6 text-primary" />, title: t('features.feature5.title'), description: t('features.feature5.description') },
    { icon: <Zap className="h-6 w-6 text-primary" />, title: t('features.feature6.title'), description: t('features.feature6.description') }
  ];

  return (
    <section id="features" className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        <motion.div 
          className="text-center mb-16"
          initial="initial"
          whileInView="whileInView"
          viewport={fadeInAnimation.viewport}
          transition={fadeInAnimation.transition}
          variants={fadeInAnimation}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-balance">
            {t('featuresTitle')}
          </h2>
          <p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto">
            {t('featureSubtitle')}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              whileHover={{ 
                scale: 1.05, 
                y: -8,
                transition: { duration: 0.3, ease: "easeOut" }
              }}
              whileTap={{ scale: 0.98 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: index * 0.1, ease: [0.25, 0.1, 0.25, 1.0] }}
            >
              <Card className="p-6 bg-card border-border hover:border-primary/50 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 h-full cursor-pointer">
                <motion.div 
                  className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4"
                  whileHover={{ rotate: [0, -10, 10, -10, 0], transition: { duration: 0.5 } }}
                >
                  {feature.icon}
                </motion.div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}