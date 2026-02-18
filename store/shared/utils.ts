/**
 * Shared Utility Functions
 *
 * Utility functions used across multiple stores
 */

import type { LateLifecycleStatus } from './types';
import { FINAL_LATE_STATUSES } from './constants';

/**
 * Normalize status string to LateLifecycleStatus
 */
export function normalizeLateLifecycleStatus(status?: string | null): LateLifecycleStatus {
  const normalized = (status || '').toLowerCase().trim();
  if (['posted', 'published', 'success', 'completed'].includes(normalized)) {
    return 'posted';
  }
  if (['failed', 'error', 'cancelled', 'canceled'].includes(normalized)) {
    return 'failed';
  }
  if (['publishing', 'processing', 'in_progress'].includes(normalized)) {
    return 'publishing';
  }
  return 'scheduled';
}

/**
 * Check if status is final (posted or failed)
 */
export function isFinalLateStatus(status: LateLifecycleStatus): boolean {
  return FINAL_LATE_STATUSES.includes(status);
}

/**
 * Get status check buffer based on platform
 */
export function getStatusCheckBuffer(platform?: string | null): number {
  return 10 * 1000; // 10 seconds
}

/**
 * Get publishing recheck interval based on platform
 */
export function getPublishingRecheckInterval(platform?: string | null): number {
  return 10 * 1000; // 10 seconds
}
