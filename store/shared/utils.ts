/**
 * Shared Utility Functions
 * 
 * Utility functions used across multiple stores
 */

import type { LateLifecycleStatus } from './types';
import { FINAL_LATE_STATUSES } from './constants';
import type { VideoFactoryState } from '@/lib/types/video';

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
 * TikTok uses longer intervals, other platforms use shorter intervals for faster updates
 */
export function getStatusCheckBuffer(platform?: string | null): number {
  const normalizedPlatform = (platform || '').toLowerCase();
  return normalizedPlatform === 'tiktok'
    ? 30 * 1000  // 30 seconds for TikTok
    : 10 * 1000; // 10 seconds for other platforms
}

/**
 * Get publishing recheck interval based on platform
 */
export function getPublishingRecheckInterval(platform?: string | null): number {
  const normalizedPlatform = (platform || '').toLowerCase();
  return normalizedPlatform === 'tiktok'
    ? 30 * 1000  // 30 seconds for TikTok
    : 10 * 1000; // 10 seconds for other platforms
}

/**
 * Create initial video factory state
 * 
 * ✅ CRITICAL: Returns a NEW object each time (no memory references)
 * This ensures safe state resets without side effects
 * 
 * @returns {VideoFactoryState} Fresh initial state object
 */
export function createInitialVideoFactoryState(): VideoFactoryState {
  // ✅ CRITICAL: Return new object literal each time (tránh tham chiếu bộ nhớ)
  // Mỗi lần gọi sẽ tạo object mới, không chia sẻ tham chiếu với lần gọi trước
  return {
    currentStep: 'input',

    // ✅ DECOUPLED: Cut Step State (Isolated)
    cutProgress: 0,
    cutMessage: '',
    cutStatus: undefined,

    // ✅ DECOUPLED: Post-Production Step State (Isolated)
    postProdProgress: 0,
    postProdMessage: '',
    postProdStatus: undefined,

    processingProgress: 0,
    processingMessage: '',
    generatedClips: [], // ✅ CRITICAL: Mảng mới mỗi lần (không có tham chiếu)
    selectedClipKeys: [], // ✅ CRITICAL: Mảng mới mỗi lần (không có tham chiếu)
    expectedClipCount: undefined, // ✅ CRITICAL: Clear expectedClipCount
    jobId: undefined, // ✅ CRITICAL: undefined (không phải null) để compatible với type
    cutJobId: undefined, // ✅ CRITICAL: Clear cutJobId
    postProcessJobId: undefined, // ✅ CRITICAL: Clear postProcessJobId
    finalUrl: undefined, // ✅ CRITICAL: Clear finalUrl
    warnings: undefined, // ✅ CRITICAL: Clear warnings
    lastErrorMessage: undefined, // ✅ CRITICAL: Clear lastErrorMessage
    // ✅ CRITICAL FIX: Generate NEW requestId on every reset (prevents stale requestId bug)
    // This ensures "Start Over" creates fresh jobs instead of returning cached results
    requestId: crypto.randomUUID(), // ✅ IDEMPOTENCY: Fresh requestId prevents zombie requests
    // ✅ SPLIT-SCREEN MODAL: Initialize modal visibility flags
    isMainModalVisible: true,  // Main modal (Panel A) visible by default
    isResultModalVisible: false, // Result modal (Panel B) hidden by default
    postProcessHistory: [], // ✅ SPLIT-SCREEN MODAL: Initialize empty history
    // ✅ NOTE: sourceConfig, cutConfig, postProdConfig không được set ở đây
    // Chúng sẽ được giữ lại từ state cũ khi reset (trong startVideoFactoryProcessing)
  };
}

