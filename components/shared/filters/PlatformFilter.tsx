/**
 * PlatformFilter Component
 * Dropdown for filtering by platform
 */

'use client'

import { useState } from 'react'
import { needsInversion } from '@/lib/utils/platform'
import { useTranslations } from 'next-intl'

interface PlatformOption {
  value: string
  label: string
  icon: string | null
}

interface PlatformFilterProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

/**
 * Platform filter dropdown component
 * 
 * @example
 * ```tsx
 * <PlatformFilter
 *   value={platformFilter}
 *   onChange={setPlatformFilter}
 * />
 * ```
 */
export function PlatformFilter({
  value,
  onChange,
  className = ''
}: PlatformFilterProps) {
  const tCommon = useTranslations('Common');
  const [isOpen, setIsOpen] = useState(false)

  const platformOptions: PlatformOption[] = [
    { value: "all", label: tCommon('allPlatforms'), icon: null },
    { value: "twitter", label: "Twitter (X)", icon: "/x.png" },
    { value: "instagram", label: "Instagram", icon: "/instagram.png" },
    { value: "linkedin", label: "LinkedIn", icon: "/link.svg" },
    { value: "facebook", label: "Facebook", icon: "/fb.svg" },
    { value: "threads", label: "Threads", icon: "/threads.png" },
    { value: "bluesky", label: "Bluesky", icon: "/bluesky.png" },
    { value: "youtube", label: "YouTube", icon: "/ytube.png" },
    { value: "tiktok", label: "TikTok", icon: "/tiktok.png" },
    { value: "pinterest", label: "Pinterest", icon: "/pinterest.svg" }
  ]

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-[#2A2A30] border border-[#3A3A42] rounded-lg text-[#F5F5F7] hover:bg-[#3A3A42] transition-colors"
      >
        <span>{tCommon('filterByPlatform')}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-[#2A2A30] border border-[#3A3A42] rounded-lg shadow-lg z-50">
          {platformOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-[#F5F5F7] hover:bg-[#3A3A42] transition-colors first:rounded-t-lg last:rounded-b-lg"
            >
              {option.icon && (
                <img 
                  src={option.icon} 
                  alt={option.label} 
                  className={`w-5 h-5 ${needsInversion(option.label.split(' ')[0]) ? 'filter brightness-0 invert' : ''}`} 
                />
              )}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
