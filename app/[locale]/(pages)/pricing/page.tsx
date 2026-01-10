"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"
import Header from "@/components/shared/header"
import Footer from "@/components/shared/footer"
import Link from "next/link"
import { useTranslations, useMessages } from 'next-intl'
import { motion } from "framer-motion"

export default function PricingPage() {

  const t = useTranslations('PricingPage');
  const messages = useMessages();
  const pricingPageMessages = messages.PricingPage as any;
// Dữ liệu cho các gói giá
  const planKeys = ['free', 'creator', 'creatorPro', 'agency'];
  const featureOrder = t.raw('featureOrder') as string[] || [];
  {/*pricingPageMessages.featureOrder*/};

  const topUpPacksData = [
      { key: "test", credits: "50 Credits", price: "$10" },
      { key: "creative", credits: "150 Credits", price: "$25" },
      { key: "professional", credits: "350 Credits", price: "$50" },
  ];

// Dữ liệu giải thích hệ thống tín dụng
  const creditSystemData = t.raw('creditSystem') as Array<{ action: string; cost: string; note: string; }>;

// Dữ liệu gói mua thêm tín dụng

// Dữ liệu FAQ
  const faqsData = t.raw('faqs') as Array<{ question: string; answer: string; }>;

  
  const FeatureValue = ({ value }: { value: any }) => {
    if (value === true) return <Check className="w-5 h-5 text-green-500" />;
    if (value === false) return <X className="w-5 h-5 text-red-500" />;
    if (value === null || value === undefined) return <span className="text-gray-500">-</span>;
    return <span className="font-semibold text-white">{value}</span>;
  };
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <motion.section 
          className="text-center py-20 px-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.h1 
            className="text-5xl md:text-6xl font-bold mb-4 py-8 bg-gradient-to-r from-primary to-primary/80 bg-clip-text"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {t('headerTitle')}
          </motion.h1>
          <motion.p 
            className="max-w-3xl mx-auto text-lg text-muted-foreground mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {t('headerSubtitle')}
          </motion.p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto items-start">
            {planKeys.map((planKey, index) => {
              const isFeatured = planKey === 'creator';
              const planData = pricingPageMessages.plans[planKey];
              return(
              <motion.div
                key={planKey}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                className="h-full"
              >
              <Card className={`flex flex-col p-6 rounded-2xl border-2 h-full transition-all ${isFeatured ? "border-primary bg-primary/5 shadow-lg shadow-primary/20" : "border-primary/30 bg-background/50 hover:border-primary/50"}`}>
                <div className="text-center mb-6">
                    {isFeatured && (
                    <span className="inline-block bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full mb-4">
                        {planData.subtitle}
                    </span>
                    )}
                    <h3 className="text-2xl font-bold">{planData.name}</h3>
                    <p className="text-4xl font-bold mt-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">{planData.price}<span className="text-lg font-normal text-muted-foreground">{t('perMonth')}</span></p>
                </div>

                <div className="flex-grow mb-6">
                  <ul className="space-y-1 divide-y divide-border">
                    {featureOrder.map((featureKey: string) => (
                      <li
                        key={featureKey}
                        className="flex justify-between items-center py-2"
                      >
                        <span className="text-sm">{t(`features.${featureKey}`)}</span>
                        <FeatureValue 
                          value={planData.featureValues[featureKey]}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
                
                <Link href={`/checkout/${planKey}`} className="w-full mt-auto">
                    <Button className={`w-full py-3 text-lg font-semibold rounded-lg transition-colors ${isFeatured ? "bg-primary hover:bg-primary/90" : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/50"}`}>
                      {planData.cta}
                    </Button>
                </Link>
              </Card>
              </motion.div>
            )})}
          </div>
        </motion.section>

        <motion.section 
          className="py-20 px-4"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
        >
            <motion.h2 
              className="text-4xl font-bold text-center mb-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {t('creditSystemTitle')}
            </motion.h2>
            <motion.p 
              className="text-lg text-muted-foreground text-center mb-12 max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              {t('creditSystemSubtitle')}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
            <Card className="max-w-4xl mx-auto bg-background/50 border border-primary/30 p-8 rounded-lg">
                <div className="space-y-6">
                    {creditSystemData.map((item, index) => (
                        <motion.div 
                          key={index} 
                          className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pb-4 border-b border-border last:border-b-0"
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                        >
                            <p className="font-semibold md:col-span-1">{item.action}</p>
                            <p className="font-bold text-primary md:col-span-1 md:text-center">{item.cost}</p>
                            <p className="text-muted-foreground md:col-span-1">{item.note}</p>
                        </motion.div>
                    ))}
                </div>
            </Card>
            </motion.div>
        </motion.section>

        <motion.section 
          className="py-20 px-4 bg-muted/30"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
        >
            <motion.h2 
              className="text-4xl font-bold text-center mb-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {t('topUpTitle')}
            </motion.h2>
            <motion.p 
              className="text-lg text-muted-foreground text-center mb-12 max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              {t('topUpSubtitle')}
            </motion.p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                {topUpPacksData.map((pack, index) => (
                    <motion.div
                      key={`${pack.key}`}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                      whileHover={{ scale: 1.05 }}
                    >
                    <Card className="flex flex-col items-center justify-center p-8 rounded-lg bg-background/50 border border-primary/30 hover:border-primary/50 transition-all h-full">
                      <p className="text-2xl font-bold mb-2">{t(`topUpPacks.${pack.key}`)}</p>
                        <p className="text-2xl font-bold text-primary mb-4">{pack.credits}</p>
                        <Button className="w-full bg-primary hover:bg-primary/90 font-semibold py-2">
                            {t('buyButton', { price: pack.price })}
                        </Button>
                    </Card>
                    </motion.div>
                ))}
            </div>
        </motion.section>

        <motion.section 
          className="py-20 px-4"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
        >
          <motion.h2 
            className="text-4xl font-bold text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {t('faqTitle')}
          </motion.h2>
          <div className="max-w-3xl mx-auto space-y-6">
            {faqsData.map((faq, index) => (
              <motion.div 
                key={index} 
                className="bg-background/50 p-6 rounded-lg border border-primary/30 hover:border-primary/50 transition-all"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                whileHover={{ scale: 1.02 }}
              >
                <h3 className="text-xl font-semibold mb-3">{faq.question}</h3>
                <p className="text-muted-foreground">{faq.answer}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </main>
      <Footer />
    </div>
  )
}


