/**
 * AI Model display names used in UI (matches provider API labels)
 * DO NOT change these — backend routes map these strings directly
 */
export const MODEL_OPTIONS = [
  'ChatGPT',
  'Gemini Pro',
  'Claude Sonnet 4',
  'gpt-4.1',
  'o4-mini',
  'o3',
  'gpt-4o',
] as const;
export type ModelOption = typeof MODEL_OPTIONS[number];

/**
 * Social Media Platforms Constants
 * Central configuration for all social media platforms
 * Keys are lowercase (canonical — match DB)
 * name/icon/color are Title Case (canonical — user-facing display)
 */

/**
 * Platform display map — lowercase key → Title Case + icon + color
 * Used by components that need both display name and icon/color
 */
export const PLATFORM_DISPLAY_MAP: Record<string, {
  name: string;
  icon: string;
  color: string;
  invert?: boolean;
}> = {
  tiktok:   { name: 'TikTok',    icon: '/icons/platforms/tiktok.png',    color: 'bg-black',        invert: true },
  instagram: { name: 'Instagram', icon: '/icons/platforms/instagram.png', color: 'bg-pink-500' },
  youtube:   { name: 'YouTube',   icon: '/icons/platforms/ytube.png',    color: 'bg-red-500' },
  facebook:  { name: 'Facebook',  icon: '/icons/platforms/fb.svg',        color: 'bg-blue-500' },
  x:         { name: 'X (Twitter)', icon: '/icons/platforms/x.png',        color: 'bg-black',       invert: true },
  twitter:   { name: 'X (Twitter)', icon: '/icons/platforms/x.png',        color: 'bg-black',       invert: true },
  threads:   { name: 'Threads',  icon: '/icons/platforms/threads.png', color: 'bg-black',       invert: true },
  linkedin:  { name: 'LinkedIn',  icon: '/icons/platforms/link.svg',     color: 'bg-blue-600' },
  pinterest: { name: 'Pinterest', icon: '/icons/platforms/pinterest.svg', color: 'bg-red-500' },
};

/**
 * SOCIAL_PLATFORMS — derived from PLATFORM_DISPLAY_MAP for backward compat
 * Ordered by popularity for content creators (2025-2026)
 */
export const SOCIAL_PLATFORMS = Object.values(PLATFORM_DISPLAY_MAP);

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
