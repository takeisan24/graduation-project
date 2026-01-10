"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Settings, ChevronDown, ChevronUp, Play, Download, Loader2, Trash2, AlertCircle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { VIDEO_ERRORS } from "@/lib/messages/errors";
import { useVideoFactorySSE } from "@/lib/hooks/useVideoFactorySSE";
import { supabaseClient } from "@/lib/supabaseClient";
import { useVideoFactoryStore } from "@/store";
import { createInitialVideoFactoryState } from "@/store/shared/utils";

// ✅ Helper functions for development logging
const devWarn = (...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.warn(...args);
  }
};

/**
 * Postprocessed clip group (one postprocess run)
 */
interface PostprocessedClipGroup {
  groupId: string; // postprocess_job_id
  createdAt: string; // ISO timestamp
  clips: PostprocessedClip[];
  status: 'processing' | 'completed' | 'failed';
  postprodConfig?: Record<string, unknown>;
  selectedClipKeys?: string[];
  selectedCutClipIds?: string[]; // ✅ NEW: Store UUIDs for Priority 1 retry
  errorMessage?: string; // ✅ NEW: Error message for failed jobs
  errorCode?: string;    // ✅ NEW: Error code for specific handling (e.g., 'POSTPROCESS_INCOMPLETE')
}

/**
 * Postprocessed clip
 */
interface PostprocessedClip {
  clipIndex: number;
  key: string;
  title?: string; // ✅ NEW: Propagate title from backend
  url?: string; // ✅ Optional: PROCESSING clips may not have URL yet
  thumbnailUrl?: string;
  duration?: number; // ✅ Optional: May be undefined for PROCESSING clips
  startTime?: number; // ✅ Optional: May be undefined for PROCESSING clips
  endTime?: number; // ✅ Optional: May be undefined for PROCESSING clips
  clipStatus: 'PROCESSING' | 'READY' | 'FAILED' | 'DONE';
  createdAt: string;
}

interface PostprocessedClipsListModalProps {
  /** ✅ PROJECT-CENTRIC: projectId (preferred) or jobId (legacy fallback) */
  projectId?: string;
  /** Legacy: jobId for backward compatibility (used if projectId not provided) */
  jobId?: string;
  cutJobId?: string; // Cut job ID (for reference)
  isOpen: boolean;
  onClose: () => void;
  onToggleMainModal?: () => void; // Toggle Video Factory + Credit Estimate modals
  /**
   * ✅ NEW: Timestamp when user clicked "Bắt đầu hậu kỳ" button
   * - Used to calculate polling delay (2 minutes from button click, not modal open)
   */
  processingStartedAt?: number;
}

/**
 * Modal hiển thị danh sách clips đã được hậu kỳ
 * - Nhóm clips theo lần xử lý (postprocess job)
 * - Real-time updates qua SSE/Polling
 * - Play, download clips
 */
export function PostprocessedClipsListModal({
  projectId,
  jobId,
  cutJobId,
  isOpen,
  onClose,
  onToggleMainModal,
  processingStartedAt,
}: PostprocessedClipsListModalProps) {
  const t = useTranslations('CreatePage.videoFactory');
  // ✅ SPLIT-SCREEN MODAL: Get postProcessHistory from store (optimistic updates)
  const postProcessHistory = useVideoFactoryStore((state) => state.videoFactoryState?.postProcessHistory || []);
  const updatePostProcessJob = useVideoFactoryStore((state) => state.updatePostProcessJob);

  // ✅ PERFORMANCE FIX: Memoize storeGroups to prevent re-render loop
  // Convert store history to groups format ONLY when postProcessHistory changes
  // Use JSON.stringify for deep comparison since postProcessHistory is an array of objects
  const storeGroups: PostprocessedClipGroup[] = useMemo(() => {
    console.log('[PostprocessedClipsListModal] render check - storeGroups memoizing', {
      historyLength: postProcessHistory.length,
      timestamp: new Date().toISOString(),
    });

    return postProcessHistory.map((historyItem) => ({
      groupId: historyItem.jobId,
      createdAt: historyItem.createdAt,
      status: historyItem.status,
      clips: historyItem.clips.map((clip) => ({
        clipIndex: parseInt(clip.id?.slice(-2) || '0', 10),
        key: clip.id,
        title: clip.title, // ✅ Propagate title
        url: clip.url,
        thumbnailUrl: clip.thumbnailUrl,
        duration: clip.duration,
        startTime: clip.startTime,
        endTime: clip.endTime,
        // ✅ CRITICAL FIX: Check all status fields (like PostprocessClipCard)
        clipStatus: (clip.clipStatus || (clip as any).status || (clip as any).status_clip || 'PROCESSING'),
        createdAt: clip.createdAt || historyItem.createdAt,
      })),
      postprodConfig: historyItem.config as Record<string, unknown> | undefined,
      selectedClipKeys: historyItem.selectedClipKeys,
      selectedCutClipIds: historyItem.selectedCutClipIds, // ✅ PROPAGATE: Pass UUIDs from store history to local state
    }));
  }, [JSON.stringify(postProcessHistory)]); // ✅ Deep comparison via JSON.stringify

  const [groups, setGroups] = useState<PostprocessedClipGroup[]>(storeGroups);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewClip, setPreviewClip] = useState<PostprocessedClip | null>(null);
  // ✅ FIX: Use processingStartedAt (when user clicked button) instead of modalOpenedAt
  // Fallback to modal open time if processingStartedAt not provided (backward compatibility)
  const [modalOpenedAt, setModalOpenedAt] = useState<number | null>(null);
  // ✅ NEW: Ref to track groups for polling logic (avoid stale closure)
  const groupsRef = useRef<PostprocessedClipGroup[]>([]);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ SPLIT-SCREEN MODAL: Sync store history to local groups state
  // ✅ PERFORMANCE FIX: Use storeGroups (memoized) as dependency instead of postProcessHistory.length
  useEffect(() => {
    if (storeGroups.length > 0) {
      setGroups(storeGroups);
      groupsRef.current = storeGroups;
      // Auto-expand all groups on first load
      setExpandedGroups((prev) => {
        if (prev.size === 0) {
          return new Set(storeGroups.map((g) => g.groupId));
        }
        return prev;
      });
    }
  }, [storeGroups]); // ✅ Depend on memoized storeGroups instead of length

  // Fetch postprocessed clips
  const fetchPostprocessedClips = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      // Get Supabase access token for API call
      const { data: { session } } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Unauthorized');
      }

      // ✅ PROJECT-CENTRIC: Use projectId endpoint if available, otherwise fallback to jobId endpoint
      // Note: Use Server A proxy endpoints (not Server B direct endpoints)
      const apiUrl = projectId
        ? `/api/video-factory/projects/${projectId}/postprocessed-clips`
        : `/api/v1/video-factory/jobs/${jobId}/postprocessed-clips`;

      const response = await fetch(apiUrl, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        // ✅ FIX: Handle 404 gracefully - job may not exist yet or no postprocessed clips
        if (response.status === 404) {
          // ✅ FIX: Handle 404 gracefully - job may not exist yet or no postprocessed clips
          // Use store groups if available (optimistic), otherwise empty
          if (storeGroups.length > 0) {
            console.warn('[Postprocess] API 404 - using store history fallback');
            setGroups(storeGroups);
            groupsRef.current = storeGroups;
          } else {
            setGroups([]);
            groupsRef.current = [];
          }
          if (!silent) {
            setLoading(false);
          }
          return;
        }
        throw new Error(`Failed to fetch postprocessed clips: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success && data.data) {
        const fetchedGroups = data.data.groups || [];

        // ✅ SPLIT-SCREEN MODAL: Merge API data with store history
        // Priority: Store history (optimistic) > API data (source of truth)
        // Merge strategy: Use store history if jobId exists, otherwise use API data
        const mergedGroups = fetchedGroups.map((apiGroup: PostprocessedClipGroup) => {
          const storeGroup = storeGroups.find((sg) => sg.groupId === apiGroup.groupId);
          if (storeGroup) {
            // Merge: Use store clips if available (optimistic), otherwise use API clips
            // ✅ CRITICAL FIX: "Empty List" Bug
            // If API says COMPLETED but returns empty/fewer clips than store, it might be a race condition (lag).
            // In this case, KEEP the store clips to prevent list from vanishing.
            const useStoreClips = storeGroup.clips.length > 0 && (
              apiGroup.clips.length === 0 ||
              (apiGroup.status === 'completed' && apiGroup.clips.length < storeGroup.clips.length)
            );

            if (useStoreClips) {
              console.warn('[Postprocess] API returned incomplete clips for completed job - using store fallback', {
                jobId: apiGroup.groupId,
                apiClips: apiGroup.clips.length,
                storeClips: storeGroup.clips.length
              });
            }

            return {
              ...apiGroup,
              clips: useStoreClips ? storeGroup.clips : apiGroup.clips,
              status: storeGroup.status || apiGroup.status, // Prefer store status (may be more up-to-date)
            };
          }
          return apiGroup;
        });

        // Add store groups that don't exist in API (optimistic updates)
        storeGroups.forEach((storeGroup) => {
          if (!mergedGroups.find((g: PostprocessedClipGroup) => g.groupId === storeGroup.groupId)) {
            mergedGroups.unshift(storeGroup); // Add at beginning (most recent first)
          }
        });

        setGroups(mergedGroups);
        groupsRef.current = mergedGroups; // Update ref

        // ✅ CRITICAL FIX: Auto-expand all groups on first load (use functional update to avoid dependency)
        setExpandedGroups((prev) => {
          if (prev.size === 0 && mergedGroups.length > 0) {
            return new Set(mergedGroups.map((g: PostprocessedClipGroup) => g.groupId));
          }
          return prev;
        });
      } else if (storeGroups.length > 0) {
        // ✅ SPLIT-SCREEN MODAL: If API returns no data but store has history, use store
        setGroups(storeGroups);
        groupsRef.current = storeGroups;
        // ✅ CRITICAL FIX: Auto-expand all groups on first load (use functional update to avoid dependency)
        setExpandedGroups((prev) => {
          if (prev.size === 0) {
            return new Set(storeGroups.map((g) => g.groupId));
          }
          return prev;
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      if (!silent) {
        toast.error('Không thể tải danh sách clips hậu kỳ', {
          description: errorMessage,
        });
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [projectId, jobId]); // ✅ CRITICAL FIX: Remove expandedGroups.size from deps - it's UI state, not data dependency

  // Initial fetch
  useEffect(() => {
    // ✅ CRITICAL FIX: Fetch if modal is open AND (projectId OR jobId exists)
    // This ensures we can load historical postprocessed clips even when reopening project
    // without an active postprocess job
    if (isOpen && (projectId || jobId)) {
      // ✅ FIX: Use processingStartedAt if provided (when user clicked button), otherwise use modal open time
      const startTime = processingStartedAt || Date.now();
      setModalOpenedAt(startTime);
      fetchPostprocessedClips();
    } else {
      setModalOpenedAt(null); // Reset when modal closes
    }
  }, [isOpen, projectId, jobId, processingStartedAt, fetchPostprocessedClips]);

  // SSE for real-time updates
  // ✅ NEW: Stop SSE when all groups and clips are completed
  const allGroupsCompleted = groups.length > 0 && groups.every((g) =>
    g.status === 'completed' || g.status === 'failed'
  );
  const allClipsReady = groups.length > 0 && groups.every((g) =>
    g.clips.every((clip) => clip.clipStatus === 'READY' || clip.clipStatus === 'FAILED' || clip.clipStatus === 'DONE')
  );
  const shouldDisableSSE = allGroupsCompleted && allClipsReady;

  // ✅ PROJECT-CENTRIC: SSE still uses jobId (postprocess job ID), not projectId
  // SSE requires a specific job ID to listen to, not a project ID
  const sseJobId = jobId; // Use jobId for SSE (postprocess job ID)

  const { isConnected: sseConnected } = useVideoFactorySSE(sseJobId || '', {
    enabled: !shouldDisableSSE && !!sseJobId, // ✅ NEW: Disable SSE when all clips are done or no jobId
    onStepUpdate: (update) => {
      // Refresh clips when postprocess step completes or updates
      if (update.step === 'postprocess' && update.status === 'completed') {
        fetchPostprocessedClips();
      }
    },
    onJobUpdate: (update) => {
      // Also refresh on job updates (fallback)
      if (update.steps?.postprocess?.status === 'completed') {
        fetchPostprocessedClips();
      }
    },
  });

  // ✅ FIX: Polling fallback - Start after 2 minutes from button click, then poll every 20 seconds
  // ✅ CRITICAL FIX: Hybrid Polling - Polling chạy song song với SSE, KHÔNG dừng khi SSE connected
  // ✅ CRITICAL FIX: Remove 'groups' from dependencies to prevent polling restart on every groups update
  // Groups are checked via ref inside interval callback to avoid stale closure
  useEffect(() => {
    if (!isOpen || (!projectId && !jobId) || !modalOpenedAt) return;

    const INITIAL_DELAY_MS = 5 * 1000; // ✅ FIX: Reduced from 2 mins to 5 seconds for immediate feedback
    const POLL_INTERVAL_MS = 10 * 1000; // ✅ FIX: 10 seconds (faster polling for postprocess)

    // ✅ FIX: Calculate time since processing started (button click or modal open)
    const timeSinceProcessingStarted = Date.now() - modalOpenedAt;
    const remainingDelay = Math.max(0, INITIAL_DELAY_MS - timeSinceProcessingStarted);

    // ✅ FIX: Clear any existing timeout/interval before setting new ones
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    // ✅ FORCE FETCH: Immediately fetch status once when mounting/jobId changes
    // This handles the "switch from cut to postprocess" case where stale data might be present
    fetchPostprocessedClips(true);

    // ✅ FIX: Set timeout to start regular polling
    timeoutIdRef.current = setTimeout(() => {
      // Start polling immediately after delay (silent mode to avoid loading spinner)
      fetchPostprocessedClips(true);

      // ✅ CRITICAL FIX: Set up interval to poll every 10 seconds (hybrid polling with SSE)
      intervalIdRef.current = setInterval(() => {
        // ✅ CRITICAL FIX: Hybrid Polling - KHÔNG dừng polling khi SSE connected
        // Polling chạy song song với SSE để đảm bảo không bỏ sót updates
        if (sseConnected) {
          console.log('[PostprocessedClipsListModal] SSE is connected - polling continues as fallback (hybrid mode)', {
            sseConnected,
            hint: 'Polling continues every 10s as safety net, even with SSE active',
          });
          // ✅ FIX: Continue polling even if SSE is connected - don't stop
        }

        // ✅ OPTIMIZATION: Don't poll if tab is hidden (browser tab not active)
        if (typeof document !== 'undefined' && document.hidden) {
          console.log('[PostprocessedClipsListModal] Tab is hidden, skipping poll');
          return;
        }

        // ✅ CRITICAL FIX: Check current groups state via ref (avoid stale closure)
        // This prevents polling restart when groups change
        const currentGroups = groupsRef.current;
        // ✅ FIX: Check both group status AND clips status
        const stillHasProcessingGroups = currentGroups.some((g) => g.status === 'processing');
        const stillHasProcessingClips = currentGroups.some((g) =>
          g.clips.some((clip) => clip.clipStatus === 'PROCESSING')
        );
        const stillHasAnyProcessing = stillHasProcessingGroups || stillHasProcessingClips;

        // ✅ ALWAYS POLL if we don't have any groups yet (initial load might have failed)
        const noGroupsYet = currentGroups.length === 0;

        if (stillHasAnyProcessing || noGroupsYet) {
          // Silent polling to avoid loading spinner flickering
          fetchPostprocessedClips(true);
        } else {
          // ✅ FIX: No more processing groups or clips - stop polling
          console.log('[PostprocessedClipsListModal] All clips completed, stopping polling');
          if (intervalIdRef.current) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
          }
        }
      }, POLL_INTERVAL_MS);
    }, remainingDelay);

    // ✅ CRITICAL FIX: Cleanup both timeout and interval
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [isOpen, projectId, jobId, modalOpenedAt, sseConnected, fetchPostprocessedClips]); // ✅ Removed 'groups' from deps to prevent polling restart

  // ✅ SAFETY NET: Poll Media Library every 60s for post-processed clips
  // Runs in PARALLEL with SSE to ensure eventual consistency
  // Only stops when all clips are DONE/READY
  useEffect(() => {
    if (!isOpen) return;

    const hasProcessing = groups.some(g =>
      g.status === 'processing' ||
      g.clips.some(c => (c.clipStatus || 'PROCESSING') === 'PROCESSING')
    );

    if (!hasProcessing) return;

    const POLL_INTERVAL = 60 * 1000;
    const pollId = setInterval(() => {
      useVideoFactoryStore.getState().pollMediaAssetsFallback();
    }, POLL_INTERVAL);

    // Initial check after 5s
    const initialTimeout = setTimeout(() => {
      useVideoFactoryStore.getState().pollMediaAssetsFallback();
    }, 5000);

    return () => {
      clearInterval(pollId);
      clearTimeout(initialTimeout);
    };
  }, [isOpen, groups]); // Re-check whenever groups update

  // Toggle group expand/collapse
  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // Format date time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  // ✅ NEW: Helper – cleanly prepare state and bring user back to hậu kỳ step for retrying một LẦN HẬU KỲ (group-level)
  const handleRetryGroup = useCallback(
    async (group: PostprocessedClipGroup) => {
      const selectedKeys = group.selectedClipKeys || [];

      if (!selectedKeys.length) {
        toast.error(
          'Không tìm thấy danh sách clips gốc để retry. Vui lòng chọn lại clips ở bước Hậu kỳ rồi chạy lại.'
        );
        // Optionally bring user back to main modal so they can reconfigure
        onToggleMainModal?.();
        return;
      }

      if (group.status !== 'failed') {
        toast.info('Chỉ có thể retry cho những lần hậu kỳ bị thất bại.');
        return;
      }

      // ✅ B. Smart Retry: Detect failed clips for potential optimization
      const failedClipIndices = group.clips
        .filter(c => c.clipStatus === 'FAILED')
        .map(c => c.clipIndex);
      const successfulClipIndices = group.clips
        .filter(c => c.clipStatus === 'READY' || c.clipStatus === 'DONE')
        .map(c => c.clipIndex);

      const hasPartialSuccess = successfulClipIndices.length > 0 && failedClipIndices.length > 0;

      // ✅ C. Đồng bộ Store: Update postProcessHistory to mark as retrying
      updatePostProcessJob(group.groupId, {
        status: 'processing',
        errorMessage: undefined,
        errorCode: undefined,
      });

      // ✅ B. Smart Retry: Show helpful message based on partial success
      if (hasPartialSuccess) {
        toast.info(
          `Đang retry ${failedClipIndices.length} clips thất bại. ` +
          `${successfulClipIndices.length} clips đã thành công sẽ được giữ nguyên.`,
          { duration: 5000 }
        );
      } else {
        toast.info('Đang retry hậu kỳ...', { duration: 3000 });
      }

      try {
        // ✅ AUTOMATIC RETRY (GROUP): Call API directly thay vì chỉ prefill config
        // Group-level retry: chạy lại TOÀN BỘ clips của lần hậu kỳ đó
        const { data: { session } } = await supabaseClient.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) {
          throw new Error('Unauthorized - please login again');
        }

        // Get cut_job_id from projectId or cutJobId
        const cutJobIdToUse = cutJobId || projectId;

        if (!cutJobIdToUse) {
          throw new Error('Missing cut job ID - cannot retry');
        }

        // Build postprocess payload with same config as before
        const postprocessPayload: any = {
          cut_job_id: cutJobIdToUse,
          selected_clip_keys: selectedKeys,
          selected_cut_clip_ids: group.selectedCutClipIds, // ✅ NEW: Priority 1 matching (if available)
        };

        // Add postprod config if available
        if (group.postprodConfig) {
          const config = group.postprodConfig as any;
          if (config.autoCaptions || config.auto_captions) {
            postprocessPayload.auto_captions = true;
            postprocessPayload.caption_language = config.captionLanguage || config.caption_language || 'vi';
            postprocessPayload.caption_style = config.captionStyle || config.caption_style || 'default';
          }
          if (config.broll) {
            postprocessPayload.broll = true;
            postprocessPayload.broll_provider = config.brollProvider || config.broll_provider || 'pexels';
            postprocessPayload.broll_density = config.brollDensity || config.broll_density || 'medium';
          }
        }

        // Call postprocess API cho toàn bộ clips của group
        const response = await fetch('/api/video-factory/postprocess', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(postprocessPayload),
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const newJobId = data.data?.job_id || data.job_id;

        if (!newJobId) {
          throw new Error('No job ID returned from server');
        }

        // Update store with new job ID
        updatePostProcessJob(group.groupId, {
          jobId: newJobId,
          status: 'processing',
        });

        toast.success('Retry thành công! Đang xử lý...', { duration: 3000 });

        // ✅ Keep modal open so user can monitor progress
        // No need to toggle modal - they can see updates in real-time
      } catch (error: any) {
        console.error('[PostprocessedClipsListModal] Retry error:', error);

        // Revert status back to failed
        updatePostProcessJob(group.groupId, {
          status: 'failed',
          errorMessage: group.errorMessage,
          errorCode: group.errorCode,
        });

        toast.error(
          `Retry thất bại: ${error.message || 'Lỗi không xác định'}. Vui lòng thử lại sau.`,
          { duration: 5000 }
        );
      }
    },
    [projectId, cutJobId, onToggleMainModal, updatePostProcessJob]
  );

  // ✅ NEW: Helper – Retry đúng 1 clip hậu kỳ (per-clip retry)
  // Tạo một postprocess job MỚI chỉ chứa 1 clip, với cùng config như group ban đầu
  const handleRetrySingleClip = useCallback(
    async (group: PostprocessedClipGroup, clip: PostprocessedClip) => {
      try {
        const selectedKeys = group.selectedClipKeys || [];
        const clipKey = selectedKeys[clip.clipIndex];

        if (!clipKey) {
          toast.error(
            'Không tìm thấy clip gốc để retry. Vui lòng chạy lại hậu kỳ từ bước cấu hình.'
          );
          return;
        }

        if (clip.clipStatus !== 'FAILED') {
          toast.info('Chỉ có thể retry cho những clip bị lỗi.');
          return;
        }

        if (!projectId && !cutJobId) {
          toast.error('Thiếu projectId/cutJobId cho retry clip. Vui lòng mở lại Project và thử lại.');
          return;
        }

        // Build postprocess payload dựa trên config của group, nhưng chỉ với 1 clip
        const baseConfig = (group.postprodConfig || {}) as any;
        const postprod_config = {
          auto_captions: baseConfig.auto_captions ?? baseConfig.autoCaptions ?? false,
          caption_language: baseConfig.caption_language ?? baseConfig.captionLanguage ?? 'vi',
          caption_style: baseConfig.caption_style ?? baseConfig.captionStyle ?? 'default',
          broll: baseConfig.broll ?? baseConfig.bRollInsertion ?? false,
          broll_density: baseConfig.broll_density ?? baseConfig.bRollDensity,
          broll_provider: baseConfig.broll_provider,
          broll_length_seconds: baseConfig.broll_length_seconds,
        };

        const payload: any = {
          project_id: projectId,
          cut_job_id: cutJobId,
          selected_clip_keys: [clipKey],
          selected_cut_clip_ids:
            group.selectedCutClipIds && group.selectedCutClipIds.length > 0
              ? [group.selectedCutClipIds[clip.clipIndex]]
              : undefined,
          postprod_config,
        };

        const { data: { session } } = await supabaseClient.auth.getSession();
        const accessToken = session?.access_token;
        if (!accessToken) {
          throw new Error('Unauthorized - please login lại');
        }

        const response = await fetch('/api/video-factory/postprocess', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
          credentials: 'include',
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.success) {
          const msg = data?.error || data?.message || `HTTP ${response.status}`;
          throw new Error(msg);
        }

        // ✅ Optimistic: đánh dấu clip đang PROCESSING trong history hiện tại
        updatePostProcessJob(group.groupId, {
          clips: [
            {
              id: clip.key,
              clipStatus: 'PROCESSING',
            } as any,
          ],
        });

        toast.success('Đã gửi retry cho clip này. Hệ thống sẽ cập nhật kết quả.', {
          duration: 3000,
        });

        // Refresh danh sách hậu kỳ (bao gồm cả job mới khi hoàn tất)
        fetchPostprocessedClips(true);
      } catch (error: any) {
        console.error('[PostprocessedClipsListModal] handleRetrySingleClip error:', error);
        toast.error(
          `Retry clip thất bại: ${error?.message || 'Lỗi không xác định'}. Vui lòng thử lại sau.`
        );
      }
    },
    [projectId, cutJobId, updatePostProcessJob, fetchPostprocessedClips]
  );

  // ✅ SPLIT-SCREEN MODAL: Fixed panel on the right side (not Dialog overlay)
  return (
    <>
      <div className="fixed top-0 right-0 h-full w-[400px] bg-[#0A0419] border-l border-[#E33265]/50 shadow-2xl z-50 flex flex-col transition-transform">
        {/* Header */}
        <div className="p-4 border-b border-[#E33265]/30 flex justify-between items-center bg-[#180F2E]">
          <h2 className="font-bold text-white text-lg">
            📦 Kho Thành Phẩm
          </h2>
          <div className="flex gap-2">
            {onToggleMainModal && (
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleMainModal}
                className="border-white/20 text-white hover:bg-white/10 text-xs"
              >
                ⬅️ Mở lại Config
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Body - Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Loading State */}
          {loading && groups.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              <span className="ml-2 text-white/70 text-sm">Đang tải danh sách clips...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-12">
              <p className="text-red-400 mb-4 text-sm">{error}</p>
              <Button onClick={() => fetchPostprocessedClips()} variant="outline" size="sm">
                Thử lại
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && groups.length === 0 && (
            <div className="text-center py-12">
              <p className="text-white/70 mb-4 text-sm">Chưa có clips hậu kỳ nào</p>
              <p className="text-white/50 text-xs">
                Các clips hậu kỳ sẽ xuất hiện ở đây sau khi xử lý xong
              </p>
            </div>
          )}

          {/* Groups List */}
          {!loading && !error && groups.length > 0 && (
            <div className="space-y-4">
              {groups.map((group) => (
                <PostprocessedClipGroup
                  key={group.groupId}
                  group={group}
                  isExpanded={expandedGroups.has(group.groupId)}
                  onToggle={() => toggleGroup(group.groupId)}
                  onPreview={(clip) => setPreviewClip(clip)}
                  onRetrySingleClip={handleRetrySingleClip}
                  onDelete={async () => {
                    try {
                      const { data: { session } } = await supabaseClient.auth.getSession();
                      const accessToken = session?.access_token;
                      if (!accessToken) {
                        throw new Error('Unauthorized');
                      }

                      // Confirm deletion
                      if (!confirm(`Bạn có chắc chắn muốn xóa lần xử lý hậu kỳ này?\n\nLưu ý: Chỉ xóa job/output, không xóa các file/clip trong media library.`)) {
                        return;
                      }

                      // Delete postprocess job
                      const response = await fetch(`/api/video-factory/jobs/${group.groupId}`, {
                        method: 'DELETE',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${accessToken}`,
                        },
                        credentials: 'include',
                      });

                      if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || `Failed to delete: ${response.statusText}`);
                      }

                      toast.success('Đã xóa lần xử lý hậu kỳ thành công');

                      // Refresh groups list
                      await fetchPostprocessedClips();
                    } catch (err) {
                      const errorMessage = err instanceof Error ? err.message : String(err);
                      toast.error('Không thể xóa lần xử lý hậu kỳ', {
                        description: errorMessage,
                      });
                    }
                  }}
                  formatDateTime={formatDateTime}
                  onRetryGroup={handleRetryGroup}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Video Preview Modal */}
      {previewClip && (
        <VideoPreviewModal
          clip={previewClip}
          onClose={() => setPreviewClip(null)}
        />
      )}
    </>
  );
}

/**
 * Postprocessed Clip Group Component
 */
interface PostprocessedClipGroupProps {
  group: PostprocessedClipGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onPreview: (clip: PostprocessedClip) => void;
  onRetrySingleClip: (group: PostprocessedClipGroup, clip: PostprocessedClip) => void;
  onDelete: () => Promise<void>;
  formatDateTime: (dateString: string) => string;
  /**
   * ✅ NEW: Allow user to retry a failed hậu kỳ run (group-level retry).
   * Implementation is handled in parent so it can coordinate with global store/state.
   */
  onRetryGroup: (group: PostprocessedClipGroup) => void;
}

function PostprocessedClipGroup({
  group,
  isExpanded,
  onToggle,
  onPreview,
  onRetrySingleClip,
  onDelete,
  formatDateTime,
  onRetryGroup,
}: PostprocessedClipGroupProps) {
  const t = useTranslations('CreatePage.videoFactory');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggle when clicking delete button
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="border border-[#E33265]/30 rounded-lg overflow-hidden bg-[#180F2E]/50">
      {/* Group Header (Accordion Trigger) */}
      <div
        className="p-3 bg-[#180F2E] flex justify-between items-center cursor-pointer hover:bg-white/5 transition-colors"
        onClick={onToggle}
      >
        <div className="flex-1">
          <div className="text-xs text-white/60 mb-1">
            {new Date(group.createdAt).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {group.status === 'processing' && (
              <span className="text-yellow-400 ml-2">(Đang xử lý...)</span>
            )}
          </div>
          <div className="text-sm font-bold text-white">
            Lần chạy #{group.groupId ? group.groupId.slice(0, 8) : 'N/A'}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-white/50">{group.clips.length} clips</span>
            <span
              className={`px-2 py-0.5 rounded text-xs ${group.status === 'completed'
                ? 'bg-green-500/20 text-green-400'
                : group.status === 'processing'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/20 text-red-400'
                }`}
            >
              {group.status === 'completed'
                ? 'Hoàn thành'
                : group.status === 'processing'
                  ? 'Đang xử lý'
                  : 'Thất bại'}
            </span>
            {/* ✅ NEW: Group-level retry button when this hậu kỳ run failed */}
            {group.status === 'failed' && (
              <Button
                variant="outline"
                size="sm"
                className="border-orange-500/50 text-orange-300 hover:bg-orange-500/10 ml-1 text-xs px-2 py-1"
                onClick={(e) => {
                  // Avoid toggling accordion when clicking retry
                  e.stopPropagation();
                  onRetryGroup(group);
                }}
              >
                🔄 Retry lần này
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* ✅ NEW: Delete button */}
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-red-500/20 hover:text-red-400"
            onClick={handleDelete}
            disabled={isDeleting}
            title="Xóa lần xử lý hậu kỳ này"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
          {/* Expand/Collapse button */}
          <Button variant="ghost" size="sm" className="text-white">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* ✅ NEW: Error Banner for Failed Jobs (Partial Success Support) */}
      {group.status === 'failed' && group.errorMessage && (
        <div className="bg-red-50/10 border-t border-b border-red-500/30 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-300 mb-1">
                {VIDEO_ERRORS.POSTPROCESS_FAILED(group.errorMessage)}
              </p>
              {/* ✅ A. Partial Success: Show clip stats */}
              {group.clips.length > 0 && (
                <div className="flex items-center gap-2 mt-2 mb-1">
                  <span className="text-xs text-green-400">
                    ✓ {group.clips.filter(c => c.clipStatus === 'READY' || c.clipStatus === 'DONE').length} clips thành công
                  </span>
                  <span className="text-xs text-red-400">
                    ✗ {group.clips.filter(c => c.clipStatus === 'FAILED' || c.clipStatus === 'PROCESSING').length} clips thất bại
                  </span>
                </div>
              )}
              {group.errorCode === 'POSTPROCESS_INCOMPLETE' && (
                <p className="text-xs text-red-400/80">
                  Một số clips không thể xử lý. Bạn có thể xem các clips thành công bên dưới.
                  Hãy kiểm tra lại cấu hình (B-roll query, phụ đề,...) hoặc thử lại.
                </p>
              )}
              {group.errorCode === 'POSTPROCESS_FAILED' && (
                <p className="text-xs text-red-400/80">
                  Tất cả clips đều thất bại. Vui lòng kiểm tra lại cấu hình hoặc thử lại sau.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Clips List */}
      {isExpanded && (
        <div className="p-2 space-y-2">
          {group.clips.length === 0 ? (
            // Skeleton/placeholder
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-3 bg-gray-800/30 p-2 rounded">
                  <div className="w-32 aspect-video bg-gray-800/50 rounded flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-800/50 rounded w-3/4"></div>
                    <div className="h-8 bg-gray-800/50 rounded w-20"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {group.clips.map((clip) => (
                <PostprocessedClipCard
                  key={clip.key || `clip-${clip.clipIndex}`}
                  clip={clip}
                  onPreview={() => onPreview(clip)}
                  // ✅ Per-clip retry: dùng handleRetrySingleClip thay vì group-level retry
                  onRetry={() => onRetrySingleClip(group, clip)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Postprocessed Clip Card Component (Horizontal Row)
 */
interface PostprocessedClipCardProps {
  clip: PostprocessedClip;
  onPreview: () => void;
  onRetry?: () => void;
}

function PostprocessedClipCard({ clip, onPreview, onRetry }: PostprocessedClipCardProps) {
  const t = useTranslations('CreatePage.videoFactory');
  const isReady = clip.clipStatus === 'READY' || clip.clipStatus === 'DONE';
  const isProcessing = clip.clipStatus === 'PROCESSING';
  const isFailed = clip.clipStatus === 'FAILED';

  // Handle download
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!clip.url) return;

    try {
      const response = await fetch(clip.url, { mode: 'cors' });
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `maiovo-ai-${Date.now()}.mp4`;
        link.click();
        window.URL.revokeObjectURL(blobUrl);
        return;
      }
    } catch (fetchError) {
      console.warn('Blob download failed, fallback to link', fetchError);
    }

    const link = document.createElement('a');
    link.href = clip.url!;
    link.download = `maiovo-ai-${Date.now()}.mp4`;
    link.click();
  };

  return (
    <div className="flex gap-3 p-2 bg-[#180F2E]/30 border border-white/5 rounded-lg hover:bg-white/5 transition-colors group">
      {/* Thumbnail Section (Left) */}
      <div
        className="relative w-40 aspect-video bg-black rounded overflow-hidden cursor-pointer flex-shrink-0 border border-white/10"
        onClick={isReady ? onPreview : undefined}
      >
        {isProcessing ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/90">
            <Loader2 className="w-5 h-5 text-purple-400 animate-spin mb-1" />
            <span className="text-white/70 text-[10px]">Đang xử lý...</span>
          </div>
        ) : isFailed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/30">
            <X className="w-6 h-6 text-red-500 mb-1" />
            <span className="text-red-400 text-[10px] font-medium">Thất bại</span>
          </div>
        ) : isReady ? (
          <>
            {clip.thumbnailUrl ? (
              <img
                src={clip.thumbnailUrl}
                alt={`Clip ${clip.clipIndex}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                <Play className="w-5 h-5 text-gray-400" />
              </div>
            )}
            {/* Play Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
              <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
                <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
              </div>
            </div>
            {/* Duration Badge */}
            {clip.duration && (
              <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded backdrop-blur-md">
                {Math.round(clip.duration)}s
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/90">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin mb-1" />
          </div>
        )}
      </div>

      {/* Info & Actions Section (Right) */}
      <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
        <div>
          <div className="flex justify-between items-start">
            <h4 className="text-sm font-medium text-white/90 truncate pr-2">
              {clip.title || `Clip ${clip.clipIndex !== undefined ? clip.clipIndex + 1 : '#'}`}
            </h4>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${isReady ? 'bg-green-500/10 border-green-500/30 text-green-400' :
              isProcessing ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
                isFailed ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-gray-500/10 border-gray-500/30 text-gray-400'
              }`}>
              {isReady ? 'Hoàn thành' : isProcessing ? 'Đang xử lý' : isFailed ? 'Lỗi' : 'Unknown'}
            </span>
          </div>
          <p className="text-xs text-white/50 mt-1 truncate">
            {new Date(clip.createdAt).toLocaleString('vi-VN')}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-2">
          {isReady && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-purple-500/30 hover:bg-purple-500/20 hover:text-purple-300 bg-purple-500/10 px-3 flex-1"
              onClick={handleDownload}
            >
              <Download className="w-3 h-3" />
            </Button>
          )}
          {isFailed && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-red-500/30 hover:bg-red-500/20 hover:text-red-300 bg-red-500/10 px-3 flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onRetry?.();
              }}
            >
              <RefreshCw className="w-3 h-3 mr-1.5" />
              Thử lại
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Video Preview Modal
 */
interface VideoPreviewModalProps {
  clip: PostprocessedClip;
  onClose: () => void;
}

function VideoPreviewModal({ clip, onClose }: VideoPreviewModalProps) {
  if (!clip.url) return null;
  if (typeof window === "undefined") return null;

  return createPortal(
    <div
      // ✅ CRITICAL: Must be above app Dialog (z-[10000]) to avoid playing behind VideoFactory modal.
      className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl mx-4 bg-black rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-3 right-3 z-10 rounded-full bg-black/70 text-white p-2 hover:bg-black/90 transition-colors"
          onClick={onClose}
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>
        <video
          src={clip.url}
          controls
          autoPlay
          className="w-full max-h-[80vh] rounded-lg object-contain bg-black"
          onError={(e) => {
            console.error("Video playback error", e);
          }}
        />
      </div>
    </div>,
    document.body
  );
}

