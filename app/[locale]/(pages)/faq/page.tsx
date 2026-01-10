"use client"

import React, { useState } from "react"
import { ChevronDown } from "lucide-react"
import Header from "@/components/shared/header"
import Footer from "@/components/shared/footer"
import { useTranslations } from 'next-intl'
import { motion } from "framer-motion"

export default function FAQPage() {
  const t = useTranslations('FAQPage');
  
  // Get FAQs data with proper type checking
  const faqsRaw = t.raw('faqs');
  const faqsData = (Array.isArray(faqsRaw) ? faqsRaw : []) as Array<{
    q: string;
    a?: string;
    list?: string[];
    steps?: string[];
    note?: string;
  }>;

  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const renderFaqAnswer = (faq: typeof faqsData[0]) => {
    return (
      <div>
        {faq.a && <p className={faq.list || faq.steps ? "mb-2" : ""}>{faq.a}</p>}
        {faq.list && (
          <ul className="list-disc list-inside space-y-1">
            {faq.list.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )}
        {faq.steps && (
          <ol className="list-decimal list-inside space-y-1">
            {faq.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}
        {faq.note && <p className="mt-2">{faq.note}</p>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-20 md:py-32 max-w-4xl">
        {/* Header */}
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.h1 
            className="text-4xl md:text-6xl font-bold mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {t('header.title')}
          </motion.h1>
          <motion.p 
            className="text-xl text-muted-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {t('header.subtitle')}
          </motion.p>
        </motion.div>

        {/* FAQ List */}
        <motion.div 
          className="space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {faqsData.map((item, idx) => {
            const isOpen = openIndex === idx
            return (
              <motion.div 
                key={idx} 
                className="border border-border rounded-lg bg-card overflow-hidden transition-all hover:border-primary/50"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 + idx * 0.05 }}
                whileHover={{ scale: 1.01 }}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full text-left p-6 flex items-center justify-between gap-4 hover:bg-muted/50 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="text-lg font-semibold pr-8">
                    {item.q}
                  </span>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChevronDown className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                  </motion.div>
                </button>
                
                <motion.div
                  initial={false}
                  animate={{ 
                    height: isOpen ? "auto" : 0,
                    opacity: isOpen ? 1 : 0
                  }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-6 text-muted-foreground leading-relaxed">
                    {renderFaqAnswer(item)}
                  </div>
                </motion.div>
              </motion.div>
            )
          })}
        </motion.div>

        {/* CTA Section */}
        <motion.div 
          className="mt-16 text-center p-8 bg-primary/5 border border-primary/20 rounded-lg"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
        >
          <motion.h2 
            className="text-2xl font-bold mb-2"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {t('cta.title')}
          </motion.h2>
          <motion.p 
            className="text-muted-foreground mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {t('cta.subtitle')}
          </motion.p>
          <motion.div 
            className="flex gap-4 justify-center flex-wrap"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <motion.a 
              href="mailto:support@omnia.com" 
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {t('cta.contactSupport')}
            </motion.a>
            <motion.a 
              href="/pricing" 
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-border hover:bg-muted transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {t('cta.viewPricing')}
            </motion.a>
          </motion.div>
        </motion.div>
      </div>

      <Footer />
    </div>
  )
}
