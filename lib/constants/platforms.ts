/**
 * Social Media Platforms Constants
 * Central configuration for all social media platforms
 */

/**
 * Platform configuration with icons, colors, and properties
 * Note: invert=true applies filter to convert dark icons to white for better visibility
 */
export const SOCIAL_PLATFORMS = [
  { name: 'Facebook', icon: '/fb.svg', color: 'bg-blue-500' },
  { name: 'Instagram', icon: '/instagram.png', color: 'bg-pink-500' },
  { name: 'Twitter', icon: '/x.png', color: 'bg-black', invert: true },
  { name: 'Threads', icon: '/threads.png', color: 'bg-black', invert: true },
  { name: 'LinkedIn', icon: '/link.svg', color: 'bg-blue-600' },
  { name: 'Bluesky', icon: '/bluesky.png', color: 'bg-sky-500' },
  { name: 'YouTube', icon: '/ytube.png', color: 'bg-red-500' },
  { name: 'TikTok', icon: '/tiktok.png', color: 'bg-black', invert: true },
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
  'facebook': '/fb.svg',
  'instagram': '/instagram.png',
  'twitter': '/x.png',
  'x': '/x.png',
  'threads': '/threads.png',
  'bluesky': '/bluesky.png',
  'youtube': '/ytube.png',
  'tiktok': '/tiktok.png',
  'pinterest': '/pinterest.svg',
  'linkedin': '/link.svg'
}

/**
 * Platform color mapping
 */
export const PLATFORM_COLOR_MAP: Record<string, string> = {
  'facebook': 'bg-blue-500',
  'instagram': 'bg-pink-500',
  'twitter': 'bg-black',
  'x': 'bg-black',
  'threads': 'bg-black',
  'bluesky': 'bg-sky-500',
  'youtube': 'bg-red-500',
  'tiktok': 'bg-black',
  'pinterest': 'bg-red-500',
  'linkedin': 'bg-blue-600'
}
