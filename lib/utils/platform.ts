/**
 * Platform Utility Functions
 * Functions for handling platform icons and properties
 */

import { PLATFORM_ICON_MAP, PLATFORM_COLOR_MAP, SOCIAL_PLATFORMS } from '../constants/platforms'

export function normalizePlatformKey(platform: string): string {
  const raw = (platform || '').trim().toLowerCase()

  if (raw === 'x' || raw === 'twitter' || raw === 'x (twitter)' || raw === 'twitter (x)') {
    return 'x'
  }

  return raw
}

/**
 * Get platform icon path (case-insensitive)
 * @param platform - Platform name
 * @returns Icon path
 */
export function getPlatformIcon(platform: string): string {
  const key = normalizePlatformKey(platform)
  return PLATFORM_ICON_MAP[key] || '/placeholder.svg'
}

/**
 * Check if platform icon needs color inversion
 * Uses SOCIAL_PLATFORMS configuration to determine if inversion is needed
 * @param platform - Platform name
 * @returns True if icon needs inversion
 */
export function needsInversion(platform: string): boolean {
  const normalizedPlatform = normalizePlatformKey(platform)
  const platformConfig = SOCIAL_PLATFORMS.find(
    p => normalizePlatformKey(p.name) === normalizedPlatform
  )
  if (!platformConfig) return false
  return 'invert' in platformConfig && platformConfig.invert === true
}

/**
 * Get platform color class
 * @param platform - Platform name
 * @returns Tailwind color class
 */
export function getPlatformColor(platform: string): string {
  const key = normalizePlatformKey(platform)
  return PLATFORM_COLOR_MAP[key] || 'bg-gray-500'
}

/**
 * Get platform name (normalize)
 * @param platform - Platform name
 * @returns Normalized platform name
 */
export function getPlatformName(platform: string): string {
  const nameMap: Record<string, string> = {
    'tiktok': 'TikTok',
    'instagram': 'Instagram',
    'youtube': 'YouTube',
    'facebook': 'Facebook',
    'x': 'X',
    'twitter': 'X',
    'threads': 'Threads',
    'linkedin': 'LinkedIn',
    'pinterest': 'Pinterest'
  }
  return nameMap[normalizePlatformKey(platform)] || platform
}

/**
 * Get platform value for filtering (lowercase)
 * @param platform - Platform name
 * @returns Lowercase platform identifier
 */
export function getPlatformValue(platform: string): string {
  return normalizePlatformKey(platform)
}

/**
 * Check if platform is supported
 * @param platform - Platform name
 * @returns True if platform is supported
 */
export function isPlatformSupported(platform: string): boolean {
  return normalizePlatformKey(platform) in PLATFORM_ICON_MAP
}
