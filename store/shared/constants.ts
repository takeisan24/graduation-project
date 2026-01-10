/**
 * Shared Constants
 * 
 * Constants used across multiple stores
 */

import { CalendarEventType } from '@/lib/types/calendar';
import type { LateLifecycleStatus } from './types';

/**
 * Final statuses that don't need further checking
 */
export const FINAL_LATE_STATUSES: ReadonlyArray<LateLifecycleStatus> = ['posted', 'failed'];

/**
 * Map status to calendar event note type
 */
export const statusToNoteTypeMap: Record<LateLifecycleStatus, CalendarEventType> = {
  posted: 'green',
  failed: 'red',
  publishing: 'blue',
  scheduled: 'yellow'
};

/**
 * Status check intervals: Faster for all platforms except TikTok (which needs more time for URL retrieval)
 * TikTok: 30s (keep original for URL sync cron job compatibility)
 * Other platforms: 10s (faster status updates)
 */
export const STATUS_CHECK_BUFFER_MS_TIKTOK = 30 * 1000; // 30 seconds for TikTok
export const STATUS_CHECK_BUFFER_MS_OTHER = 10 * 1000; // 10 seconds for other platforms
export const PUBLISHING_RECHECK_INTERVAL_TIKTOK = 30 * 1000; // 30 seconds for TikTok
export const PUBLISHING_RECHECK_INTERVAL_OTHER = 10 * 1000; // 10 seconds for other platforms
export const PENDING_CHECK_INTERVAL_MS_TIKTOK = 30 * 1000; // 30 seconds for TikTok
export const PENDING_CHECK_INTERVAL_MS_OTHER = 10 * 1000; // 10 seconds for other platforms

/**
 * Global pending check interval (use faster one for global checks)
 */
export const PENDING_CHECK_INTERVAL_MS = PENDING_CHECK_INTERVAL_MS_OTHER; // Use faster interval for global checks

