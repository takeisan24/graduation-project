/**
 * Platform Utility Functions
 * Functions for handling platform icons and properties
 */

import { PLATFORM_ICON_MAP, PLATFORM_COLOR_MAP, SOCIAL_PLATFORMS } from '../constants/platforms'

/**
 * Get platform icon path (case-insensitive)
 * @param platform - Platform name
 * @returns Icon path
 */
export function getPlatformIcon(platform: string): string {
  const key = platform.toLowerCase()
  return PLATFORM_ICON_MAP[key] || platform
}

/**
 * Check if platform icon needs color inversion
 * Uses SOCIAL_PLATFORMS configuration to determine if inversion is needed
 * @param platform - Platform name
 * @returns True if icon needs inversion
 */
export function needsInversion(platform: string): boolean {
  const platformConfig = SOCIAL_PLATFORMS.find(
    p => p.name.toLowerCase() === platform.toLowerCase()
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
  const key = platform.toLowerCase()
  return PLATFORM_COLOR_MAP[key] || 'bg-gray-500'
}

/**
 * Get platform name (normalize)
 * @param platform - Platform name
 * @returns Normalized platform name
 */
export function getPlatformName(platform: string): string {
  const nameMap: Record<string, string> = {
    'x': 'Twitter',
    'twitter': 'Twitter',
    'instagram': 'Instagram',
    'facebook': 'Facebook',
    'linkedin': 'LinkedIn',
    'threads': 'Threads',
    'bluesky': 'Bluesky',
    'youtube': 'YouTube',
    'tiktok': 'TikTok',
    'pinterest': 'Pinterest'
  }
  return nameMap[platform.toLowerCase()] || platform
}

/**
 * Get platform value for filtering (lowercase)
 * @param platform - Platform name
 * @returns Lowercase platform identifier
 */
export function getPlatformValue(platform: string): string {
  return platform.toLowerCase()
}

/**
 * Check if platform is supported
 * @param platform - Platform name
 * @returns True if platform is supported
 */
export function isPlatformSupported(platform: string): boolean {
  return platform.toLowerCase() in PLATFORM_ICON_MAP
}
