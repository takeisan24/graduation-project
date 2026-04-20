/**
 * Platform Brand Colors
 * Extended color system for UI theming per platform
 */

export interface PlatformColorConfig {
  bg: string           // Badge/indicator background
  text: string         // Text on colored bg
  border: string       // Border color
  tint: string         // Subtle background tint (for cards)
  darkTint: string     // Dark mode tint
  dot: string          // Calendar/status dot color
}

export const PLATFORM_COLORS: Record<string, PlatformColorConfig> = {
  tiktok: {
    bg: "bg-gray-900 dark:bg-gray-100",
    text: "text-white dark:text-gray-900",
    border: "border-gray-900/30 dark:border-gray-100/30",
    tint: "bg-gray-900/5",
    darkTint: "dark:bg-gray-100/5",
    dot: "bg-gray-900 dark:bg-gray-100",
  },
  instagram: {
    bg: "bg-gradient-to-r from-purple-500 to-pink-500",
    text: "text-white",
    border: "border-pink-500/30",
    tint: "bg-pink-500/5",
    darkTint: "dark:bg-pink-500/10",
    dot: "bg-pink-500",
  },
  youtube: {
    bg: "bg-red-600",
    text: "text-white",
    border: "border-red-500/30",
    tint: "bg-red-500/5",
    darkTint: "dark:bg-red-500/10",
    dot: "bg-red-500",
  },
  facebook: {
    bg: "bg-blue-600",
    text: "text-white",
    border: "border-blue-500/30",
    tint: "bg-blue-500/5",
    darkTint: "dark:bg-blue-500/10",
    dot: "bg-blue-500",
  },
  twitter: {
    bg: "bg-gray-900 dark:bg-gray-100",
    text: "text-white dark:text-gray-900",
    border: "border-gray-900/30 dark:border-gray-100/30",
    tint: "bg-gray-900/5",
    darkTint: "dark:bg-gray-100/5",
    dot: "bg-gray-900 dark:bg-gray-100",
  },
  x: {
    bg: "bg-gray-900 dark:bg-gray-100",
    text: "text-white dark:text-gray-900",
    border: "border-gray-900/30 dark:border-gray-100/30",
    tint: "bg-gray-900/5",
    darkTint: "dark:bg-gray-100/5",
    dot: "bg-gray-900 dark:bg-gray-100",
  },
  threads: {
    bg: "bg-gray-900 dark:bg-gray-100",
    text: "text-white dark:text-gray-900",
    border: "border-gray-900/30 dark:border-gray-100/30",
    tint: "bg-gray-900/5",
    darkTint: "dark:bg-gray-100/5",
    dot: "bg-gray-900 dark:bg-gray-100",
  },
  linkedin: {
    bg: "bg-blue-700",
    text: "text-white",
    border: "border-blue-600/30",
    tint: "bg-blue-600/5",
    darkTint: "dark:bg-blue-600/10",
    dot: "bg-blue-700",
  },
  pinterest: {
    bg: "bg-red-700",
    text: "text-white",
    border: "border-red-600/30",
    tint: "bg-red-600/5",
    darkTint: "dark:bg-red-600/10",
    dot: "bg-red-700",
  },
}

/** Get platform colors with fallback */
export function getPlatformColors(platform: string): PlatformColorConfig {
  const key = platform.toLowerCase()
  return PLATFORM_COLORS[key] || {
    bg: "bg-muted",
    text: "text-foreground",
    border: "border-border",
    tint: "bg-muted/50",
    darkTint: "dark:bg-muted/50",
    dot: "bg-muted-foreground",
  }
}
