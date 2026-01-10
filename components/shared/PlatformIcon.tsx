/**
 * PlatformIcon Component
 * Reusable platform icon with automatic color inversion
 */

'use client'

import { getPlatformIcon, needsInversion } from '@/lib/utils/platform'

interface PlatformIconProps {
  platform: string
  size?: number
  className?: string
  variant?: 'wrapper' | 'inline'
}

/**
 * Platform icon component with automatic styling
 * 
 * @param platform - Platform name (case-insensitive)
 * @param size - Icon size in pixels (default: 27)
 * @param className - Additional CSS classes
 * @param variant - Display variant: 'wrapper' (with container) or 'inline' (direct img)
 * 
 * @example
 * ```tsx
 * // With wrapper (for flex layouts)
 * <PlatformIcon platform="twitter" size={27} variant="wrapper" />
 * 
 * // Inline (for simple display)
 * <PlatformIcon platform="instagram" size={24} variant="inline" />
 * ```
 */
export function PlatformIcon({
  platform,
  size = 27,
  className = '',
  variant = 'wrapper'
}: PlatformIconProps) {
  const iconSrc = getPlatformIcon(platform)
  const shouldInvert = needsInversion(platform)
  
  const imgClassName = `w-full h-full object-contain ${
    shouldInvert ? 'filter brightness-0 invert' : ''
  } ${className}`

  if (variant === 'inline') {
    return (
      <img
        src={iconSrc}
        alt={platform}
        className={`flex-shrink-0 ${shouldInvert ? 'filter brightness-0 invert' : ''} ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  // Wrapper variant (default)
  return (
    <div 
      className="flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <img
        src={iconSrc}
        alt={platform}
        className={imgClassName}
      />
    </div>
  )
}
