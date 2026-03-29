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
  { name: 'TikTok', icon: '/icons/platforms/tiktok.png', color: 'bg-black', invert: true },
  { name: 'Instagram', icon: '/icons/platforms/instagram.png', color: 'bg-pink-500' },
  { name: 'YouTube', icon: '/icons/platforms/ytube.png', color: 'bg-red-500' },
  { name: 'Facebook', icon: '/icons/platforms/fb.svg', color: 'bg-blue-500' },
  { name: 'Twitter', icon: '/icons/platforms/x.png', color: 'bg-black', invert: true },
  { name: 'Threads', icon: '/icons/platforms/threads.png', color: 'bg-black', invert: true },
  { name: 'LinkedIn', icon: '/icons/platforms/link.svg', color: 'bg-blue-600' },
  { name: 'Pinterest', icon: '/icons/platforms/pinterest.svg', color: 'bg-red-500' }
] as const

/**
 * Legacy export for backward compatibility
 */
export const socialPlatforms = SOCIAL_PLATFORMS

/**
 * Platform icon mapping (case-insensitive)
 */
export const PLATFORM_ICON_MAP: Record<string, string> = {
  'tiktok': '/icons/platforms/tiktok.png',
  'instagram': '/icons/platforms/instagram.png',
  'youtube': '/icons/platforms/ytube.png',
  'facebook': '/icons/platforms/fb.svg',
  'twitter': '/icons/platforms/x.png',
  'x': '/icons/platforms/x.png',
  'threads': '/icons/platforms/threads.png',
  'linkedin': '/icons/platforms/link.svg',
  'pinterest': '/icons/platforms/pinterest.svg'
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
