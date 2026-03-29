"use client"

import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import CreatorHubIcon from "./CreatorHubIcon"
import { useTranslations } from "next-intl"

/**
 * Local loading spinner for section transitions
 * Displays in the content area instead of full screen
 */
export default function SectionLoader() {
  const t = useTranslations('Common');
  
  return (
    <div className="flex items-center justify-center h-full w-full">
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        {/* Spinning loader nhỏ hơn */}
        <motion.div
          className="relative"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        >
          <div className="w-12 h-12 rounded-full border-3 border-primary/20 border-t-primary"></div>
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            <CreatorHubIcon className="h-5 w-5" />
          </motion.div>
        </motion.div>

        {/* Loading text */}
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
          <span className="text-sm font-medium text-muted-foreground">
            {t('loading')}
          </span>
        </motion.div>
      </motion.div>
    </div>
  )
}
