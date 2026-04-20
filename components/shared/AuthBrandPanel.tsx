"use client"

import { GraduationCap, Sparkles, Share2, Calendar } from "lucide-react"
import CreatorHubIcon from "./CreatorHubIcon"
import { useTranslations } from "next-intl"

type AuthVariant = "signin" | "signup" | "forgotPassword" | "updatePassword"

const pillIcons = [
  <Sparkles key="ai" className="h-3.5 w-3.5" />,
  <Share2 key="share" className="h-3.5 w-3.5" />,
  <Calendar key="cal" className="h-3.5 w-3.5" />,
]

const pillKeys = ["aiGenerate", "platforms", "autoSchedule"] as const

export default function AuthBrandPanel({ variant }: { variant: AuthVariant }) {
  const t = useTranslations("AuthPanel")

  return (
    <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-gradient-to-br from-utc-navy via-utc-royal to-utc-sky">
      {/* Textures */}
      <div className="dot-pattern absolute inset-0" />
      <div className="radial-glow w-[500px] h-[500px] -top-40 -left-40 bg-utc-sky/10" />
      <div className="radial-glow w-[400px] h-[400px] -bottom-32 -right-32 bg-utc-gold/8" />

      <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <CreatorHubIcon className="h-10 w-10" />
          <span className="text-xl font-semibold tracking-tight">CreatorHub</span>
        </div>

        {/* Center content */}
        <div className="space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 bg-white/10 text-sm">
            <GraduationCap className="h-4 w-4" />
            <span className="font-mono text-xs uppercase tracking-wider">{t("badge")}</span>
          </div>

          {/* Heading */}
          <h2 className="text-4xl font-display leading-tight">
            {t(`${variant}.heading1`)}<br />
            <span className="text-utc-gold-bright">{t(`${variant}.heading2`)}</span>
            {t(`${variant}.heading3`) && (
              <>
                <br />{t(`${variant}.heading3`)}
              </>
            )}
          </h2>

          {/* Description */}
          <p className="text-white/70 text-lg max-w-sm leading-relaxed">
            {t(`${variant}.description`)}
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-3">
            {pillKeys.map((key, i) => (
              <div key={key} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 text-sm text-white/80">
                {pillIcons[i]}
                <span>{t(`pills.${key}`)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <p className="text-white/40 text-sm">{t("university")}</p>
      </div>
    </div>
  )
}
