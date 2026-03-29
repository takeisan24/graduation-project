/**
 * Social Media Platforms Constants
 * Central configuration for all social media platforms
 */

/**
 * Platform configuration with icons, colors, and properties
 * Ordered by popularity for content creators (2025-2026)
 * Note: invert=true applies filter to convert dark icons to white for better visibility
 */
export const SOCIAL_PLATFORMS = [
  { name: 'TikTok', icon: '/tiktok.png', color: 'bg-black', invert: true },
  { name: 'Instagram', icon: '/instagram.png', color: 'bg-pink-500' },
  { name: 'YouTube', icon: '/ytube.png', color: 'bg-red-500' },
  { name: 'Facebook', icon: '/fb.svg', color: 'bg-blue-500' },
  { name: 'Twitter', icon: '/x.png', color: 'bg-black', invert: true },
  { name: 'Threads', icon: '/threads.png', color: 'bg-black', invert: true },
  { name: 'LinkedIn', icon: '/link.svg', color: 'bg-blue-600' },
  { name: 'Pinterest', icon: '/pinterest.svg', color: 'bg-red-500' }
] as const

/**
 * Legacy export for backward compatibility
 */
export const socialPlatforms = SOCIAL_PLATFORMS

/**
 * Platform icon mapping (case-insensitive)
 */
export const PLATFORM_ICON_MAP: Record<string, string> = {
  'tiktok': '/tiktok.png',
  'instagram': '/instagram.png',
  'youtube': '/ytube.png',
  'facebook': '/fb.svg',
  'twitter': '/x.png',
  'x': '/x.png',
  'threads': '/threads.png',
  'linkedin': '/link.svg',
  'pinterest': '/pinterest.svg'
}

/**
 * Platform color mapping
 */
export const PLATFORM_COLOR_MAP: Record<string, string> = {
  'tiktok': 'bg-black',
  'instagram': 'bg-pink-500',
  'youtube': 'bg-red-500',
  'facebook': 'bg-blue-500',
  'twitter': 'bg-black',
  'x': 'bg-black',
  'threads': 'bg-black',
  'linkedin': 'bg-blue-600',
  'pinterest': 'bg-red-500'
}
