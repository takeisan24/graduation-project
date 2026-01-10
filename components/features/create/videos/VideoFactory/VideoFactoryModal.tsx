"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";

// ✅ Helper function for development-only logging
const devLog = (...args: any[]) => {
  /* if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  } */
};

const devWarn = (...args: any[]) => {
  /* if (process.env.NODE_ENV === 'development') {
    console.warn(...args);
  } */
};
import { useShallow } from "zustand/react/shallow";
import { useVideoFactoryStore, useCreditsStore, useLimitExceededModalStore } from "@/store";
// ✅ OPTIMIZATION: Use custom hooks for cleaner code and better maintainability
import {
  useVideoFactoryConfigs,
  useCurrentJobId,
  useCurrentStep,
  useVideoFactoryClips,
  useExpectedClipCount,
  useSelectedClipKeys,
  useFinalUrl,
  useProcessingProgress,
  useCutProgress,
  usePostProdProgress,
  useIsCompleted,
  useIsProcessing,
  useIsPostprocess
} from "@/store/videos/videoFactory.selectors";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { X, Info, AlertCircle, RefreshCw } from "lucide-react";
import { VIDEO_ERRORS } from "@/lib/messages/errors";
import { InputStage } from "./InputStage";
import { ConfigStage } from "./ConfigStage";
import { PostProdStage } from "./PostProdStage";
import { SummaryStage } from "./SummaryStage";
import { ProcessingStage } from "./ProcessingStage";
import { PostprocessSelectionStage } from "./PostprocessSelectionStage";
import { PostprocessedClipsListModal } from "./PostprocessedClipsListModal";
import { splitVideoFactoryCredits } from "@/lib/utils/videoUtils";
import { VideoCutConfig, PostProductionConfig, ClipDuration } from "@/lib/types/video";
import { JobDetailPage } from "./JobDetailPage";
import { JobErrorBoundary } from "./JobErrorBoundary";
import { useVideoFactorySSE } from "@/lib/hooks/useVideoFactorySSE";
import { supabaseClient } from "@/lib/supabaseClient";
import { createInitialVideoFactoryState } from "@/store/shared/utils";
import { toast } from "sonner";

export function VideoFactoryModal() {
  // Use useShallow to select multiple properties with stable references (prevents infinite loops)
  // This ensures getSnapshot returns the same object reference if content hasn't changed
  const {
    isVideoFactoryOpen,
    videoFactoryState,
    setVideoFactoryStep,
    updateVideoFactorySource,
    updateVideoFactoryCut,
    updateVideoFactoryPostProd,
    startVideoFactoryProcessing,
    startVideoFactoryPostProcess,
    resetVideoFactory,
    toggleMainModal,
    toggleResultModal,
    updateSelectedClipKeys,
  } = useVideoFactoryStore(
    useShallow((state) => ({
      isVideoFactoryOpen: state.isVideoFactoryOpen,
      videoFactoryState: state.videoFactoryState,
      setVideoFactoryStep: state.setVideoFactoryStep,
      updateVideoFactorySource: state.updateVideoFactorySource,
      updateVideoFactoryCut: state.updateVideoFactoryCut,
      updateVideoFactoryPostProd: state.updateVideoFactoryPostProd,
      startVideoFactoryProcessing: state.startVideoFactoryProcessing,
      startVideoFactoryPostProcess: state.startVideoFactoryPostProcess,
      resetVideoFactory: state.resetVideoFactory,
      toggleMainModal: state.toggleMainModal,
      toggleResultModal: state.toggleResultModal,
      updateSelectedClipKeys: state.updateSelectedClipKeys,
    }))
  );

  // ✅ FE CREDIT CHECK HOOKS
  const { creditsRemaining, currentPlan } = useCreditsStore();
  const openLimitModal = useLimitExceededModalStore(state => state.openModal);

  // ✅ OPTIMIZATION: Use custom hooks for cleaner code and better maintainability
  // useVideoFactoryConfigs uses useShallow internally to prevent unnecessary re-renders
  const { sourceConfig, cutConfig, postProdConfig } = useVideoFactoryConfigs();

  // Live configs để panel credit bên phải update real-time theo lựa chọn hiện tại
  const [liveCutConfig, setLiveCutConfig] = useState<VideoCutConfig | undefined>(cutConfig);
  const [livePostProdConfig, setLivePostProdConfig] = useState<PostProductionConfig | undefined>(postProdConfig);

  // Đồng bộ khi state trong store thay đổi (ví dụ khi reopen modal)
  // ✅ OPTIMIZATION: useVideoFactoryConfigs already uses useShallow, so references are stable
  useEffect(() => {
    setLiveCutConfig(cutConfig);
    setLivePostProdConfig(postProdConfig);
  }, [cutConfig, postProdConfig]);

  // Memoize onConfigChange callbacks to prevent infinite loops in child components
  // Tạo object mới mỗi lần để đảm bảo React detect được sự thay đổi và trigger useMemo recalculate
  const handleCutConfigChange = useCallback((config: VideoCutConfig) => {
    // Tạo object mới để đảm bảo reference equality check trong useMemo hoạt động đúng
    setLiveCutConfig({
      ...config,
      ...(config.method === 'auto' && config.autoCutConfig
        ? { autoCutConfig: { ...config.autoCutConfig } }
        : {}),
      ...(config.method === 'manual' && config.manualSelections
        ? { manualSelections: [...config.manualSelections] }
        : {}),
    });
  }, []);

  const handlePostProdConfigChange = useCallback((config: PostProductionConfig) => {
    setLivePostProdConfig(config);
  }, []);

  // ✅ NEW: Estimate credits tách riêng theo step
  // - Step 'config': Chỉ tính cutCredits
  // ✅ OPTIMIZATION: Use custom hooks for cleaner code
  const currentStep = useCurrentStep();
  const generatedClips = useVideoFactoryClips();
  const selectedClipKeys = useSelectedClipKeys();
  const finalUrl = useFinalUrl();
  const { progress: cutProgress, message: cutMessage, status: cutStatus } = useCutProgress();
  const { progress: postProdProgress, message: postProdMessage, status: postProdStatus } = usePostProdProgress();
  const { progress: processingProgress, message: processingMessage } = useProcessingProgress();

  // - Step 'postprocess': Chỉ tính postProdCredits dựa trên số clips được chọn
  // - Các step khác: Tính tổng (backward compatibility)
  // ✅ DEBUG: Log store state updates for debugging credit estimate responsiveness
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && (currentStep === 'postprocess' || currentStep === 'postprod')) {
      /* console.log('[VideoFactoryModal] Store update received:', {
        selectedKeysCount: selectedClipKeys.length,
        selectedKeys: selectedClipKeys,
        autoCaptions: postProdConfig?.autoCaptions,
        bRollInsertion: postProdConfig?.bRollInsertion,
        currentStep,
        hint: 'Credit estimate UI should update based on these values',
      }); */
    }
  }, [selectedClipKeys, postProdConfig, currentStep]);

  const estimatedCreditsSide = useMemo(() => {

    // ✅ Step 'config': Chỉ tính credit cho cut phase
    if (currentStep === 'config') {
      if (!liveCutConfig) return 0;

      let clipCount = 0;
      let clipDuration: ClipDuration = '60-90s';

      if (liveCutConfig.method === 'auto' && liveCutConfig.autoCutConfig) {
        clipCount = liveCutConfig.autoCutConfig.clipCount;
        clipDuration = liveCutConfig.autoCutConfig.clipDuration;
      } else if (liveCutConfig.method === 'manual' && liveCutConfig.manualSelections?.length) {
        clipCount = liveCutConfig.manualSelections.length;
        clipDuration = '<60s';
      }

      if (clipCount <= 0) return 0;

      const credits = splitVideoFactoryCredits({
        clipCount,
        clipDuration,
        bRollInsertion: false, // ✅ Chỉ tính cut
        autoCaptions: false,   // ✅ Chỉ tính cut
      });

      return credits.cutCredits;
    }

    // ✅ Step 'postprocess': Chỉ tính credit cho hậu kỳ dựa trên số clips được chọn
    if (currentStep === 'postprocess' || currentStep === 'postprod') {
      // ✅ CRITICAL FIX: Use store config directly for postprocess step (real-time updates)
      // PostprocessSelectionStage updates store directly, so we should read from store
      // Fallback to livePostProdConfig if store is undefined (though unlikely)
      const post = currentStep === 'postprocess' ? postProdConfig : livePostProdConfig;

      // ✅ CRITICAL FIX: Nếu user bỏ chọn hết clip → selectedCount = 0 (không fallback sang tổng clips)
      const selectedCount = selectedClipKeys.length;

      if (selectedCount <= 0) return 0;

      // Ước tính clipDuration từ clips (nếu có), ngược lại dùng default
      let clipDuration: ClipDuration = '60-90s';
      if (generatedClips.length > 0) {
        // Tính trung bình duration của clips
        const avgDuration = generatedClips.reduce((sum, clip) => {
          const duration = typeof clip.duration === 'number' ? clip.duration : (clip.endTime && clip.startTime ? clip.endTime - clip.startTime : 0);
          return sum + (typeof duration === 'number' ? duration : 0);
        }, 0) / generatedClips.length;

        if (avgDuration < 60) clipDuration = '<60s';
        else if (avgDuration <= 90) clipDuration = '60-90s';
        else clipDuration = '>90s';
      }

      const credits = splitVideoFactoryCredits({
        clipCount: selectedCount,
        clipDuration,
        bRollInsertion: post?.bRollInsertion || false,
        bRollDensity: post?.bRollInsertion ? post.bRollDensity : undefined,
        autoCaptions: post?.autoCaptions || false,
      });

      return credits.postProdCredits;
    }

    // ✅ Các step khác: Tính tổng (backward compatibility)
    if (!liveCutConfig) return 0;

    const post = livePostProdConfig;
    let clipCount = 0;
    let clipDuration: ClipDuration = '60-90s';

    if (liveCutConfig.method === 'auto' && liveCutConfig.autoCutConfig) {
      clipCount = liveCutConfig.autoCutConfig.clipCount;
      clipDuration = liveCutConfig.autoCutConfig.clipDuration;
    } else if (liveCutConfig.method === 'manual' && liveCutConfig.manualSelections?.length) {
      clipCount = liveCutConfig.manualSelections.length;
      clipDuration = '<60s';
    }

    if (clipCount <= 0) return 0;

    const credits = splitVideoFactoryCredits({
      clipCount,
      clipDuration,
      bRollInsertion: post?.bRollInsertion || false,
      bRollDensity: post?.bRollInsertion ? post.bRollDensity : undefined,
      autoCaptions: post?.autoCaptions || false,
    });

    return credits.totalCredits;
  }, [liveCutConfig, livePostProdConfig, postProdConfig, currentStep, generatedClips, selectedClipKeys,
    // ✅ CRITICAL FIX: Add deep dependency on clips status/count to force recalc
    generatedClips.length,
    generatedClips.map(c => c.status).join(',')
  ]);

  // Memoize callbacks to prevent infinite loops
  const handleSnapshot = useCallback((data: any) => {
    // ✅ CRITICAL FIX #1 (Hidden Issue): Update timestamp when SSE message arrives
    // This ensures stuck state detection tracks BOTH polling AND SSE activity
    lastProgressUpdateRef.current = Date.now();
    setIsStuckState(false); // Clear stuck state on any SSE message

    // ✅ Initial state for logic
    const currentStateSnapshot = useVideoFactoryStore.getState().videoFactoryState;
    if (!currentStateSnapshot) return;
    const isInPostprocessStep = currentStateSnapshot.currentStep === 'postprocess';

    // ✅ CRITICAL FIX: Verify jobId match to prevent processing events from different jobs
    const eventJobId = data.jobId || data.job_id || data.id;
    const currentJobId = currentStateSnapshot.jobId;
    if (eventJobId && currentJobId && eventJobId !== currentJobId) {
      devWarn('[VideoFactoryModal][handleSnapshot] Ignoring snapshot from different job', {
        eventJobId,
        currentJobId,
        hint: 'This prevents mixing clips from different jobs',
      });
      return; // Ignore events from different job
    }

    // ✅ DATA SEPARATION: Determine if this snapshot is for CUT or POST-PRODUCTION
    const cutStep = data.steps?.cut || data.steps?.thumbnail;
    const cutOutput = cutStep?.output;
    const clipsArray = cutOutput?.clips || cutOutput?.segments || [];

    // ✅ CRITICAL FIX: Only ignore snapshot when in postprocess AND the update is for CUT clips AND we already have real clips.
    // If the snapshot contains POSTPROCESS data (outputs), we handle it separately via history.
    const hasRealClips = (currentStateSnapshot.generatedClips || []).some((c: any) => !c.isPlaceholder);
    
    // If we are in postprocess step and this is a CUT update, only skip if we are already finalized.
    if (isInPostprocessStep && clipsArray.length > 0 && hasRealClips) {
      // Check if there are any REMAINING placeholders. If yes, we SHOULD NOT skip because those skeletons need to turn into real clips.
      const hasPlaceholders = (currentStateSnapshot.generatedClips || []).some((c: any) => c.isPlaceholder);
      
      if (!hasPlaceholders) {
        devLog('[VideoFactoryModal][handleSnapshot] Ignoring cut-related update - already finalized');
        return;
      }
    }

    // Debug log - only in development
    devLog('[VideoFactoryModal] Processing snapshot', {
      hasSteps: !!data.steps,
      hasCutStep: !!cutStep,
      cutStepStatus: cutStep?.status,
      hasCutOutput: !!cutOutput,
      clipsCount: clipsArray.length,
      currentStep: currentStateSnapshot.currentStep,
      isInPostprocessStep,
    });

    if (clipsArray.length > 0) {
      const clips = clipsArray.map((c: any, idx: number) => {
        const clipUrl = c.publicUrl || c.url;
        const clipId = c.clipId || c.id;
        const thumbnailAssetId = c.thumbnailAssetId || c.thumbnail_asset_id ||
          (clipId ? `clip-thumb:${clipId}` : undefined) || // ✅ NEW: Use clipId (UUID)
          (c.index !== undefined ? `clip-thumb:${currentJobId}-${c.index}` : undefined); // ✅ LEGACY: Fallback to old format

        const thumbnailUrl = c.thumbnailUrl || c.thumbnail || '';
        const startTime = c.startTime ?? c.start ?? c.start_time ?? 0;
        const endTime = c.endTime ?? c.end ?? c.end_time ?? 0;
        const durationSeconds = c.duration ?? (endTime > startTime ? endTime - startTime : 0);
        const durationFormatted = durationSeconds > 0 ? `${Math.round(durationSeconds)}s` : '';

        return {
          id: c.id || `clip-${c.index ?? idx}`,
          clipId: clipId, // ✅ Store clipId (UUID) for Asset Gateway
          index: c.index ?? idx,
          thumbnail: thumbnailUrl, // ✅ LEGACY: Keep for backward compatibility (may be empty)
          thumbnailAssetId: thumbnailAssetId, // ✅ CRITICAL: Use this for Asset Gateway (/api/assets/{assetId})
          duration: durationFormatted,
          title: c.title || `Clip ${(c.index ?? idx) + 1}`,
          startTime,
          endTime,
          url: clipUrl,
          status: (() => {
            const s = (c.clipStatus || c.status_clip || c.status || 'PROCESSING').toUpperCase();
            return (s === 'READY' || s === 'DONE' || s === 'COMPLETED') ? 'DONE' : s === 'FAILED' ? 'FAILED' : 'PROCESSING';
          })(),
          storageKey: c.storageKey || c.key || c.storage_key,
          bucket: c.bucket,
        };
      });

      const isCutCompleted = cutStep?.status === 'completed';
      const isCurrentlyProcessing = currentStateSnapshot.currentStep === 'processing';
      const hasCompletedClip = clips.some((c: any) => c.url && c.url.startsWith('http'));

      const shouldTransitionToPostprocess = clips.length > 0 &&
        isCurrentlyProcessing &&
        (hasCompletedClip || isCutCompleted);

      const pollingDataTimestamp = currentStateSnapshot.pollingDataTimestamp;
      const now = Date.now();

      if (
        pollingDataTimestamp &&
        (now - pollingDataTimestamp) < 5000 &&
        isInPostprocessStep
      ) {
        devLog('[VideoFactoryModal][handleSnapshot] Ignoring SSE snapshot - polling data is newer');
        return;
      }

      const isFailedLike = data.status === 'failed' || cutStep?.status === 'failed' || data.status === 'cancelled' || data.status === 'abandoned';
      const isAlreadyFailed = currentStateSnapshot.currentStep === 'postprocess' && currentStateSnapshot.lastErrorMessage;

      if (isAlreadyFailed && !isFailedLike) return;

      useVideoFactoryStore.setState((s: any) => {
        if (!s.videoFactoryState) return s;

        let nextGeneratedClips = clips;
        if (isInPostprocessStep) {
          const existing = s.videoFactoryState.generatedClips || [];
          const hasPlaceholders = existing.some((c: any) => c.isPlaceholder);
          
          if (hasPlaceholders) {
            nextGeneratedClips = existing.map((oldClip: any) => {
              if (oldClip.isPlaceholder) {
                const realClip = clips.find((c: any) => Number(c.index) === Number(oldClip.index));
                return realClip ? { ...realClip, isPlaceholder: false } : oldClip;
              }
              return oldClip;
            });
          } else {
            nextGeneratedClips = existing;
          }
        }

        if (isFailedLike) {
          return {
            videoFactoryState: {
              ...s.videoFactoryState,
              generatedClips: nextGeneratedClips,
              currentStep: 'postprocess', // Move back to postprocess step
              cutStatus: 'failed' as const,
              cutMessage: data.progressMessage || data.error?.message || s.videoFactoryState.cutMessage,
              processingProgress: data.progress ?? s.videoFactoryState.processingProgress,
              processingMessage: data.progressMessage || data.error?.message || s.videoFactoryState.processingMessage,
              lastErrorMessage: data.progressMessage || data.error?.message || s.videoFactoryState.lastErrorMessage,
            }
          };
        }

        return {
          videoFactoryState: {
            ...s.videoFactoryState,
            generatedClips: nextGeneratedClips,
            cutProgress: data.progress ?? s.videoFactoryState.cutProgress,
            cutMessage: data.progressMessage || s.videoFactoryState.cutMessage,
            cutStatus: isCutCompleted ? 'completed' : 'processing',
            processingProgress: data.progress ?? s.videoFactoryState.processingProgress,
            processingMessage: data.progressMessage || s.videoFactoryState.processingMessage,
            currentStep: shouldTransitionToPostprocess ? 'postprocess' : s.videoFactoryState.currentStep,
            pollingDataTimestamp: undefined,
          }
        };
      });
    } else {
      // No clips in snapshot - check for failed status
      const isFailedLike = data.status === 'failed' || data.status === 'cancelled' || data.status === 'abandoned';
      const isAlreadyFailed = currentStateSnapshot.currentStep === 'postprocess' && currentStateSnapshot.lastErrorMessage;

      if (isAlreadyFailed && !isFailedLike) return;

      useVideoFactoryStore.setState((s: any) => {
        if (!s.videoFactoryState) return s;

        if (isFailedLike) {
          return {
            videoFactoryState: {
              ...s.videoFactoryState,
              currentStep: 'postprocess',
              processingProgress: data.progress ?? s.videoFactoryState.processingProgress,
              processingMessage: data.progressMessage || data.error?.message || s.videoFactoryState.processingMessage,
              lastErrorMessage: data.progressMessage || data.error?.message || s.videoFactoryState.lastErrorMessage,
            }
          };
        }

        return {
          videoFactoryState: {
            ...s.videoFactoryState,
            processingProgress: data.progress ?? s.videoFactoryState.processingProgress,
            processingMessage: data.progressMessage || s.videoFactoryState.processingMessage,
          }
        };
      });
    }
  }, []);

  const handleStepUpdate = useCallback((data: any) => {
    // ✅ CRITICAL FIX #1 (Hidden Issue): Update timestamp when SSE message arrives
    // This ensures stuck state detection tracks BOTH polling AND SSE activity
    lastProgressUpdateRef.current = Date.now();
    setIsStuckState(false); // Clear stuck state on any SSE message

    // ✅ Initial state for logic
    const currentStateStep = useVideoFactoryStore.getState().videoFactoryState;
    if (!currentStateStep) return;
    const isInPostprocessStep = currentStateStep.currentStep === 'postprocess';

    // ✅ CRITICAL FIX: Verify jobId match to prevent processing events from different jobs
    const eventJobId = data.jobId || data.job_id || data.id;
    const currentJobId = currentStateStep.jobId;
    if (eventJobId && currentJobId && eventJobId !== currentJobId) {
      devWarn('[VideoFactoryModal][handleStepUpdate] Ignoring step update from different job', {
        eventJobId,
        currentJobId,
        step: data.step,
        status: data.status,
        hint: 'This prevents mixing clips from different jobs',
      });
      return; // Ignore events from different job
    }

    // ✅ CRITICAL FIX: If cut step is completed but no output, fetch job details
    if (data.step === 'cut' && data.status === 'completed' && !data.output) {
      devLog('[VideoFactoryModal] Cut step completed but no output in SSE, fetching job details', {
        jobId: currentJobId,
      });
      // Use onForceRefresh to fetch job details
      if (currentJobId) {
        try {
          const store = useVideoFactoryStore.getState();
          store.openVideoFactoryWithJob(currentJobId);
        } catch (err) {
          // ignore error
        }
      }
      return;
    }

    // ✅ CRITICAL FIX: Process cut/postprocess step output BẤT KỂ status nào (waiting/running/completed)
    // Chỉ cần có output.clips là hiển thị ngay, không cần chờ status === 'completed'
    // ✅ BE gửi step.completed cho cả "cut" và "thumbnail"; thumbnail step trả về data.output.clips (cut clips).
    // FE phải lấy đúng data.output.clips cho CẢ HAI step cut và thumbnail để cập nhật skeleton → real clips.
    // ✅ DATA SEPARATION: Handle 'cut'/'thumbnail' (cut clips) and 'postprocess' separately.
    // Cut clips chỉ thay đổi skeleton/loading ở step cut/thumbnail. Ở step postprocess không đụng tới cut clips.
    const isCutOrThumbnailStep = data.step === 'cut' || data.step === 'thumbnail';
    if (isCutOrThumbnailStep && data.output) {
      // ✅ Ở postprocess: chỉ cho phép update nốt các skeleton còn sót lại.
      const hasPlaceholders = (currentStateStep.generatedClips || []).some((c: any) => c.isPlaceholder);
      
      // Nếu đã ở step 4 và HẾT skeleton → block hoàn toàn để tránh nhảy data (Finalized).
      if (isInPostprocessStep && !hasPlaceholders) {
        devLog('[VideoFactoryModal][handleStepUpdate] Ignoring cut/thumbnail step update - already finalized', {
          currentStep: currentStateStep.currentStep,
          step: data.step,
        });
        return;
      }

      // ✅ Nguồn clips: data.output.clips (BE gửi đúng trong step cut và step thumbnail)
      const stepOutput = data.output;
      const isPartial = stepOutput.isPartial === true;
      const clipsArray = stepOutput.clips || stepOutput.segments || [];

      if (clipsArray.length > 0) {
        const cutJobIdForThumb = eventJobId || data.jobId || currentJobId;
        const clips = clipsArray
          .map((c: any, idx: number) => {
            const clipUrl = c.publicUrl || c.url;
            const clipId = c.clipId || c.id;
            const thumbnailAssetId = c.thumbnailAssetId || c.thumbnail_asset_id ||
              (clipId ? `clip-thumb:${clipId}` : undefined) ||
              (c.index !== undefined && cutJobIdForThumb ? `clip-thumb:${cutJobIdForThumb}-${c.index}` : undefined);

            const thumbnailUrl = c.thumbnailUrl || c.thumbnail_url || c.thumbnail || '';
            const startTime = c.startTime ?? c.start ?? c.start_time ?? 0;
            const endTime = c.endTime ?? c.end ?? c.end_time ?? 0;
            const durationSeconds = c.duration ?? (endTime > startTime ? endTime - startTime : 0);

            return {
              id: c.id || `clip-${c.index ?? idx}`,
              clipId: clipId,
              index: c.index ?? idx,
              thumbnail: thumbnailUrl,
              thumbnailAssetId: thumbnailAssetId,
              duration: durationSeconds > 0 ? `${Math.round(durationSeconds)}s` : '',
              title: c.title || `Clip ${(c.index ?? idx) + 1}`,
              startTime,
              endTime,
              url: clipUrl,
              status: (() => {
                const s = (c.clipStatus || c.status_clip || c.status || 'PROCESSING').toUpperCase();
                return (s === 'READY' || s === 'DONE' || s === 'COMPLETED') ? 'DONE' : s === 'FAILED' ? 'FAILED' : 'PROCESSING';
              })(),
              storageKey: c.storageKey || c.key || c.storage_key,
              bucket: c.bucket,
            };
          })
          .filter((c: any) => c !== null);

        useVideoFactoryStore.setState((s) => {
          const state = s.videoFactoryState;
          if (!state) return s;

          const existingClips = state.generatedClips || [];
          const now = Date.now();
          const pollingDataTimestamp = state.pollingDataTimestamp;
          const hasPlaceholdersLocal = existingClips.some((c: any) => c.isPlaceholder);

          // ✅ CUT STEP FIX: Prefer polling over SSE ONLY if we are already finalized.
          if (
            pollingDataTimestamp &&
            (now - pollingDataTimestamp) < 5000 &&
            state.currentStep === 'postprocess' &&
            !hasPlaceholdersLocal
          ) {
            return s;
          }

          let mergedClips = clips;
          // If in postprocess, we ONLY fill in placeholders. We don't overwrite existing REAL clips.
          if (state.currentStep === 'postprocess' && hasPlaceholdersLocal) {
            const newClipsMap = new Map<number, any>();
            clips.forEach((c: any) => {
              const idx = Number(c.index ?? -1);
              if (idx !== -1) newClipsMap.set(idx, c);
            });

            mergedClips = existingClips.map((existing: any) => {
              const existingIdx = Number(existing.index ?? -1);
              if (existing.isPlaceholder && existingIdx !== -1 && newClipsMap.has(existingIdx)) {
                return { ...newClipsMap.get(existingIdx)!, isPlaceholder: false };
              }
              return existing;
            });
          } else if (state.currentStep !== 'postprocess') {
            // Normal merge for cut step
            if (isPartial && existingClips.length > 0) {
              const newClipsMap = new Map<number, any>();
              clips.forEach((c: any) => {
                const idx = c.index ?? parseInt(c.id?.replace('clip-', '') || '0', 10);
                newClipsMap.set(idx, c);
              });

              mergedClips = existingClips.map((existing: any) => {
                const existingIdx = existing.index ?? parseInt(existing.id?.replace('clip-', '') || '0', 10);
                const newClip = newClipsMap.get(existingIdx);
                if (existing.isPlaceholder && newClip) return { ...newClip, isPlaceholder: false };
                return newClip || existing;
              });

              clips.forEach((newClip: any) => {
                const newIdx = newClip.index ?? parseInt(newClip.id?.replace('clip-', '') || '0', 10);
                if (!mergedClips.some((c: any) => (c.index ?? parseInt(c.id?.replace('clip-', '') || '0', 10)) === newIdx)) {
                  mergedClips.push({ ...newClip, isPlaceholder: false });
                }
              });
            } else if (clips.length > 0) {
              mergedClips = clips.map((c: any) => ({ ...c, isPlaceholder: false }));
            }
          } else {
            // In postprocess and NO placeholders -> Keep existing
            mergedClips = existingClips;
          }

          mergedClips.sort((a: any, b: any) => (Number(a.index) ?? 0) - (Number(b.index) ?? 0));

          const hasCompletedClip = mergedClips.some((c: any) => c.url && c.url.startsWith('http'));
          const shouldTransition = hasCompletedClip && state.currentStep === 'processing';

          return {
            videoFactoryState: {
              ...state,
              generatedClips: mergedClips,
              processingProgress: data.progress ?? state.processingProgress,
              processingMessage: data.progressMessage || state.processingMessage,
              currentStep: shouldTransition ? 'postprocess' : state.currentStep,
              pollingDataTimestamp: undefined,
            }
          };
        });
      }
    }
    else if (data.step === 'postprocess' && (data.postprocess || data.output)) {
      // ✅ POSTPROCESS STEP: Chỉ cập nhật history entry đúng jobId (skeleton → real theo từng clip).
      const history = currentStateStep.postProcessHistory || [];
      const isJobInHistory = history.some((h: any) => h.jobId === data.jobId);
      if (!isJobInHistory) return;

      const clipsArray = data.postprocess?.clips ?? data.output?.clips ?? data.output?.segments ?? [];
      const { updatePostProcessJob } = useVideoFactoryStore.getState();

      const mappedClips = clipsArray.map((c: any, idx: number) => {
        const clipUrl = c.publicUrl || c.url;
        const rawStatus = (c.clipStatus || c.status || (clipUrl ? 'DONE' : 'PROCESSING')).toString().toUpperCase();
        return {
          id: c.id || `post-clip-${idx}`,
          index: c.index ?? idx,
          url: clipUrl,
          finalVideoUrl: clipUrl,
          thumbnailUrl: c.thumbnailUrl || c.thumbnail || '',
          status: rawStatus,
          clipStatus: (rawStatus === 'FAILED' ? 'FAILED' : rawStatus === 'READY' || rawStatus === 'DONE' || rawStatus === 'COMPLETED' ? 'DONE' : 'PROCESSING') as 'PROCESSING' | 'READY' | 'FAILED' | 'DONE',
          originalClipId: c.originalClipId || c.id,
          createdAt: new Date().toISOString(),
          storageKey: c.storageKey || c.key || '',
          key: c.key || c.storageKey || '',
          ...(rawStatus === 'FAILED' && c.error ? { error: c.error } : {}),
        };
      });

      updatePostProcessJob(data.jobId, {
        status: data.status,
        progress: data.progress,
        progressMessage: data.progressMessage,
        clips: mappedClips
      });

      useVideoFactoryStore.setState((s) => ({
        videoFactoryState: s.videoFactoryState ? {
          ...s.videoFactoryState,
          postProdProgress: data.progress ?? s.videoFactoryState.postProdProgress,
          postProdMessage: data.progressMessage || s.videoFactoryState.postProdMessage,
          postProdStatus: data.status,
        } : s.videoFactoryState
      }));
    } else {
      // ✅ CRITICAL FIX: Handle failed status for any step (especially postprocess)
      const isFailedLike = data.status === 'failed' || data.status === 'cancelled' || data.status === 'abandoned';

      if (isFailedLike) {
        useVideoFactoryStore.setState((s) => {
          if (!s.videoFactoryState) return s;

          const isCutPhase = data.step === 'cut' || data.step === 'ingest' || data.step === 'audio_extract' || data.step === 'transcribe';
          const isPostProdPhase = data.step === 'postprocess' || data.step === 'broll_mux' || data.step === 'burn_captions' || data.step === 'concat';

          const nextState = {
            ...s.videoFactoryState,
            currentStep: 'postprocess' as const,
            cutStatus: isCutPhase ? ('failed' as const) : s.videoFactoryState.cutStatus,
            postProdStatus: isPostProdPhase ? ('failed' as const) : s.videoFactoryState.postProdStatus,
            processingProgress: data.progress ?? s.videoFactoryState.processingProgress,
            processingMessage: data.progressMessage || data.error?.message || s.videoFactoryState.processingMessage,
            lastErrorMessage: data.progressMessage || data.error?.message || s.videoFactoryState.lastErrorMessage,
          };

          try {
            const { toast } = require('sonner') as typeof import('sonner');
            toast.error(nextState.lastErrorMessage || 'Có lỗi khi xử lý video.');
          } catch {
            // ignore
          }

          return { videoFactoryState: nextState };
        });
      } else {
        // Update progress for other steps (non-failed)
        useVideoFactoryStore.setState((s) => {
          if (!s.videoFactoryState) return s;

          const isCutPhase = data.step === 'cut' || data.step === 'ingest' || data.step === 'audio_extract' || data.step === 'transcribe';
          const isPostProdPhase = data.step === 'postprocess' || data.step === 'broll_mux' || data.step === 'burn_captions' || data.step === 'concat';

          return {
            videoFactoryState: {
              ...s.videoFactoryState,
              cutProgress: isCutPhase ? (data.progress ?? s.videoFactoryState.cutProgress) : s.videoFactoryState.cutProgress,
              cutMessage: isCutPhase ? (data.progressMessage || s.videoFactoryState.cutMessage) : s.videoFactoryState.cutMessage,
              postProdProgress: isPostProdPhase ? (data.progress ?? s.videoFactoryState.postProdProgress) : s.videoFactoryState.postProdProgress,
              postProdMessage: isPostProdPhase ? (data.progressMessage || s.videoFactoryState.postProdMessage) : s.videoFactoryState.postProdMessage,
              processingProgress: data.progress ?? s.videoFactoryState.processingProgress,
              processingMessage: data.progressMessage || s.videoFactoryState.processingMessage,
            },
          };
        });
      }
    }
  }, []);


  const handleProgress = useCallback((data: any) => {
    // ✅ CRITICAL FIX #1 (Hidden Issue): Update timestamp when SSE message arrives
    // This ensures stuck state detection tracks BOTH polling AND SSE activity
    lastProgressUpdateRef.current = Date.now();
    setIsStuckState(false); // Clear stuck state on any SSE message

    // Progress update - update store
    const state = useVideoFactoryStore.getState().videoFactoryState;
    if (!state) return;

    // ✅ CRITICAL FIX: Verify jobId match to prevent processing events from different jobs
    const eventJobId = data.jobId || data.job_id || data.id;
    const currentJobId = state.jobId;
    if (eventJobId && currentJobId && eventJobId !== currentJobId) {
      devWarn('[VideoFactoryModal][handleProgress] Ignoring progress update from different job', {
        eventJobId,
        currentJobId,
        progress: data.progress,
        hint: 'This prevents mixing progress from different jobs',
      });
      return; // Ignore events from different job
    }

    if (data.progress !== undefined) {
      useVideoFactoryStore.setState(s => ({
        videoFactoryState: s.videoFactoryState ? {
          ...s.videoFactoryState,
          processingProgress: data.progress ?? s.videoFactoryState.processingProgress,
          processingMessage: data.progressMessage || s.videoFactoryState.processingMessage,
        } : s.videoFactoryState
      }));
    }
  }, []);

  const handleJobUpdate = useCallback(async (data: any) => {
    // ✅ TRẠNG THÁI HIỆN TẠI
    const stateSnapshot = useVideoFactoryStore.getState().videoFactoryState;
    if (!stateSnapshot) return;

    // ✅ KIỂM TRA JOB ID
    const eventJobId = data.jobId || data.job_id || data.id;
    const currentJobId = stateSnapshot.jobId;
    if (eventJobId && currentJobId && eventJobId !== currentJobId) {
      devWarn('[VideoFactoryModal][handleJobUpdate] Ignoring job update from different job', {
        eventJobId, currentJobId,
      });
      return;
    }

    devLog('[VideoFactoryModal][handleJobUpdate] Job update received', {
      status: data.status,
      jobId: data.jobId,
      hasProject: !!data.project,
    });

    if (data.status === 'completed') {
      let clipsArray: any[] = [];
      // Ưu tiên các nguồn clips từ SSE event
      if (data.project?.outputClips) clipsArray = data.project.outputClips;
      else if (data.outputData?.outputClips) clipsArray = data.outputData.outputClips;
      else if (data.outputData?.clips) clipsArray = data.outputData.clips;
      else if (data.steps?.cut?.output?.clips) clipsArray = data.steps.cut.output.clips;

      // ✅ Nếu không có clips trong SSE -> Fetch từ API
      const jobIdToFetch = stateSnapshot.postProcessJobId || currentJobId;
      if (clipsArray.length === 0 && jobIdToFetch) {
        devLog('[VideoFactoryModal][handleJobUpdate] Fetching job details as fallback', { jobId: jobIdToFetch });
        try {
          const { data: { session } } = await supabaseClient.auth.getSession();
          const accessToken = session?.access_token;
          if (accessToken) {
            const apiUrl = `/api/video-factory/jobs/${jobIdToFetch}`;
            const res = await fetch(apiUrl, {
              headers: { Authorization: `Bearer ${accessToken}` },
              credentials: 'include',
            });
            const json = await res.json();
            if (res.ok && json?.success && json?.data) {
              const responseData = json.data;
              clipsArray = responseData?.project?.outputClips || responseData?.project?.output_clips || responseData?.clips || [];
            }
          }
        } catch (fetchError) {
          // ignore
        }
      }

      // Map clips to frontend format
      const mappedClips = clipsArray.map((c: any, idx: number) => {
        const clipUrl = c.publicUrl || c.url;
        const startTime = c.startTime ?? c.start ?? c.start_time ?? 0;
        const endTime = c.endTime ?? c.end ?? c.end_time ?? 0;
        const durationSeconds = c.duration ?? (endTime > startTime ? endTime - startTime : 0);
        return {
          id: c.id || `clip-${c.index ?? idx}`,
          index: c.index ?? idx,
          thumbnail: c.thumbnailUrl || c.thumbnail || '',
          duration: durationSeconds > 0 ? `${Math.round(durationSeconds)}s` : '',
          title: c.title || `Clip ${(c.index ?? idx) + 1}`,
          startTime,
          endTime,
          url: clipUrl,
          status: (() => {
            const s = (c.clipStatus || c.status_clip || c.status || 'PROCESSING').toUpperCase();
            return (s === 'READY' || s === 'DONE' || s === 'COMPLETED') ? 'DONE' : s === 'FAILED' ? 'FAILED' : 'PROCESSING';
          })(),
          storageKey: c.storageKey || c.key || c.storage_key,
          bucket: c.bucket,
          metadata: c.metadata,
        };
      });

      // ✅ PHÂN BIỆT POSTPROCESS JOB VÀ CUT JOB
      const isPostprocessJob = 
        stateSnapshot.postProcessJobId === currentJobId ||
        data.step === 'postprocess' ||
        !!data.steps?.postprocess ||
        clipsArray.some((c: any) => c.metadata?.step === 'postprocess');

      if (isPostprocessJob) {
        // ✅ XỬ LÝ POSTPROCESS JOB COMPLETION
        const postprocessClips = mappedClips.filter((c: any) => {
          const m = c.metadata || {};
          return m.step === 'postprocess' || m.jobType === 'postprocess' || m.source === 'postprocess' || m.source === 'broll_mux' || m.source === 'burn_captions';
        });

        // Nếu filter quá tag -> dùng hết (fallback)
        const finalClips = postprocessClips.length > 0 ? postprocessClips : mappedClips;
        
        const history = stateSnapshot.postProcessHistory || [];
        const existingEntry = history.find((h: any) => h.jobId === currentJobId);
        
        let updatedHistory;
        const newHistoryClips = finalClips.map((c: any) => ({
          id: c.id,
          index: c.index,
          url: c.url,
          thumbnailUrl: c.thumbnail,
          status: c.status,
          createdAt: new Date().toISOString(),
        }));

        if (existingEntry) {
          updatedHistory = history.map((h: any) => h.jobId === currentJobId ? { ...h, status: 'completed', clips: newHistoryClips } : h);
        } else {
          updatedHistory = [{
            jobId: currentJobId || `post-${Date.now()}`,
            createdAt: new Date().toISOString(),
            status: 'completed',
            clips: newHistoryClips,
            config: {}, // Placeholder
            selectedClipKeys: stateSnapshot.selectedClipKeys || [],
          }, ...history];
        }

        useVideoFactoryStore.setState((s: any) => ({
          videoFactoryState: s.videoFactoryState ? {
            ...s.videoFactoryState,
            postProcessHistory: updatedHistory,
            processingProgress: 100,
            processingMessage: 'Đã hoàn thành video hậu kỳ!',
            currentStep: 'postprocess',
          } : s.videoFactoryState
        }));

        toast.success('Đã hoàn thành video hậu kỳ! Kiểm tra trong Kho thành phẩm.');
      } else {
        // ✅ XỬ LÝ CUT JOB COMPLETION
        // Ở postprocess step: KHÔNG update cut clips nữa (đã finalized)
        if (stateSnapshot.currentStep === 'postprocess') {
          devLog('[VideoFactoryModal][handleJobUpdate] Cut job completed while in postprocess - skipping update', { jobId: currentJobId });
          return;
        }

        // Chỉ lấy cut clips (không lấy postprocess clips nếu có lẫn lộn)
        const cutClipsOnly = mappedClips.filter((c: any) => !c.metadata || c.metadata.step !== 'postprocess');

        useVideoFactoryStore.setState((s: any) => ({
          videoFactoryState: s.videoFactoryState ? {
            ...s.videoFactoryState,
            generatedClips: cutClipsOnly.length > 0 ? cutClipsOnly : mappedClips,
            currentStep: 'postprocess', // Auto transition
            processingProgress: 100,
            processingMessage: 'Đã hoàn thành',
          } : s.videoFactoryState
        }));

        // Dispatch reload event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('videoFactoryJobCompleted', { detail: { jobId: currentJobId } }));
        }
      }
    } else {
      // Phản hồi các trạng thái lỗi
      const isFailedLike = data.status === 'failed' || data.status === 'cancelled' || data.status === 'abandoned';
      if (isFailedLike) {
        useVideoFactoryStore.setState((s: any) => {
          if (!s.videoFactoryState) return s;
          const nextState = {
            ...s.videoFactoryState,
            currentStep: 'postprocess',
            processingProgress: data.progress ?? s.videoFactoryState.processingProgress,
            processingMessage: data.progressMessage || data.error?.message || 'Có lỗi xảy ra',
            lastErrorMessage: data.progressMessage || data.error?.message || s.videoFactoryState.lastErrorMessage,
          };
          try {
            toast.error(nextState.lastErrorMessage || 'Có lỗi khi xử lý video.');
          } catch { /* ignore */ }
          return { videoFactoryState: nextState };
        });
      }
    }
  }, []);


  const handleError = useCallback((error: Error) => {
    // SILENCED: console.error('[VideoFactoryModal] SSE error:', error);
    // Fallback to polling if SSE fails
    // Note: This is a temporary fallback, should be removed once SSE is stable
  }, []);

  const [showJobDetail, setShowJobDetail] = useState(false);
  // ✅ NEW: Track trạng thái preview video full-screen ở Step 3 để ẩn/hiện card Ước tính Credit
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  // ✅ SPLIT-SCREEN MODAL: Use store state instead of local state
  const isMainModalVisible = videoFactoryState?.isMainModalVisible ?? true;
  const isResultModalVisible = videoFactoryState?.isResultModalVisible ?? false;

  // ✅ CRITICAL FIX: handleForceRefresh với useCallback để tránh re-render và reset SSE hook
  // Must be defined BEFORE sseOptions so it can be used in the dependency array
  const handleForceRefresh = useCallback(async (jobId: string) => {
    if (!jobId) return;
    try {
      // ✅ NEW: Set pollingDataTimestamp trước khi update để ưu tiên polling data
      const pollingDataTimestamp = Date.now();
      useVideoFactoryStore.setState((s) => {
        if (s.videoFactoryState?.jobId === jobId) {
          return {
            videoFactoryState: {
              ...s.videoFactoryState,
              pollingDataTimestamp, // ✅ Mark that polling data is being updated
            },
          };
        }
        return s;
      });

      // ✅ OPTIMIZATION: Use the central store function to fetch and parse data
      // Avoid doing a manual fetch here then calling openVideoFactoryWithJob again
      const store = useVideoFactoryStore.getState();
      await store.openVideoFactoryWithJob(jobId, false);
    } catch (err) {
      // SILENCED: console.error("[Force Refresh] Error:", err);
    }
  }, []); // Empty dependency array - function never changes

  // Use SSE for realtime updates (replaces polling)
  // ✅ OPTIMIZATION: Only enable SSE khi modal mở VÀ job còn đang chạy
  // ✅ CRITICAL: KHÔNG stop SSE khi bước postprocess còn clip PROCESSING – phải nhận events để update từng clip DONE/FAILED
  // Chỉ disable SSE khi:
  // - job final (completed/failed/cancelled/abandoned) HOẶC
  // - tất cả clips hậu kỳ (postprocess) đã ở trạng thái DONE/FAILED/FAILED_PERMANENT
  // ✅ OPTIMIZATION: Use custom hooks for cleaner code
  const jobId = useCurrentJobId();
  const isCompleted = useIsCompleted();
  const isProcessing = useIsProcessing();
  const isPostprocess = useIsPostprocess();

  // ✅ PERFORMANCE FIX: Memoize computed values from generatedClips to prevent re-render loop
  // These values are used in multiple places (SSE control, polling logic, rendering)
  const clipsStatus = useMemo(() => {
    const expectedClipCount = useVideoFactoryStore.getState().videoFactoryState?.expectedClipCount || 0;
    const hasAllExpectedClips = expectedClipCount > 0 && generatedClips.length >= expectedClipCount;
    const hasProcessingClips = generatedClips.some((c: any) =>
      !c.status || c.status === 'PROCESSING' || c.status === 'PENDING'
    );
    const allClipsReady = hasAllExpectedClips && !hasProcessingClips;

    return {
      expectedClipCount,
      hasAllExpectedClips,
      hasProcessingClips,
      allClipsReady,
      clipsCount: generatedClips.length,
    };
  }, [generatedClips, generatedClips.length]); // ✅ Memoize based on clips array

  // ✅ Destructure for backward compatibility with existing code
  const { expectedClipCount, hasAllExpectedClips, hasProcessingClips, allClipsReady } = clipsStatus;

  // ✅ NEW: Tính trạng thái "final" cho hậu kỳ dựa trên postProcessHistory trong store
  // - Một run hậu kỳ được coi là final khi TẤT CẢ clips của run hiện tại đều DONE/FAILED/FAILED_PERMANENT
  // ⚠️ NOTE: Dùng tên biến khác (`videoFactoryStateForPostprocess`) để tránh trùng với destructured `videoFactoryState` phía trên
  const videoFactoryStateForPostprocess = useVideoFactoryStore((state) => state.videoFactoryState);
  const allPostprocessClipsFinal = useMemo(() => {
    if (!videoFactoryStateForPostprocess) return false;
    const history = videoFactoryStateForPostprocess.postProcessHistory || [];
    const currentPostJobId = videoFactoryStateForPostprocess.postProcessJobId;
    if (!currentPostJobId || history.length === 0) return false;
    const currentRun = history.find((h) => h.jobId === currentPostJobId);
    if (!currentRun || !currentRun.clips || currentRun.clips.length === 0) return false;
    return currentRun.clips.every((c: any) => {
      const raw = (c.clipStatus || c.status || c.status_clip || '').toUpperCase();
      return raw === 'DONE' || raw === 'FAILED' || raw === 'FAILED_PERMANENT';
    });
  }, [videoFactoryStateForPostprocess?.postProcessHistory, videoFactoryStateForPostprocess?.postProcessJobId]);

  // PHASED SSE GATING:
  // - CUT PHASE: SSE chạy cho tới khi cut clips READY (allClipsReady) → sau đó stop (không cần SSE/polling nữa).
  // - POSTPROCESS PHASE: Khi user start hậu kỳ → jobId chuyển sang postprocess job, isPostprocess === true,
  //   SSE chạy lại CHỈ cho hậu kỳ cho tới khi tất cả clips hậu kỳ final (DONE/FAILED/FAILED_PERMANENT).
  // - Ở cả 2 phase, nếu job completed/failed/cancelled hoặc không có jobId → stop SSE.

  const cutPhaseFinal = (!isPostprocess) && (
    isCompleted || // job-level final (safety)
    !jobId ||
    allClipsReady // tất cả cut clips READY
  );

  const postprocessPhaseFinal = isPostprocess && (
    isCompleted || // job-level final
    !jobId ||
    allPostprocessClipsFinal // tất cả hậu kỳ clips DONE/FAILED/FAILED_PERMANENT
  );

  const isJobFinal = cutPhaseFinal || postprocessPhaseFinal;

  // ✅ Enable SSE:
  // - Ở CUT PHASE: khi đang processing và chưa allClipsReady.
  // - Ở POSTPROCESS PHASE: khi isPostprocess và còn clip hậu kỳ chưa final.
  const shouldUseSSE = Boolean(
    isVideoFactoryOpen &&
    !isJobFinal &&
    jobId &&
    (
      (!isPostprocess && isProcessing && !allClipsReady) || // Cut phase
      (isPostprocess && !allPostprocessClipsFinal)          // Postprocess phase
    )
  );

  // ✅ CRITICAL FIX: Memoize SSE options để tránh hook bị re-run logic connect
  // Must be defined AFTER handleForceRefresh and shouldUseSSE so they can be used in the dependency array
  const sseOptions = useMemo(() => ({
    enabled: shouldUseSSE,
    onSnapshot: handleSnapshot,
    onStepUpdate: handleStepUpdate,
    onProgress: handleProgress,
    onJobUpdate: handleJobUpdate,
    onError: handleError,
    onForceRefresh: handleForceRefresh,
  }), [
    shouldUseSSE,
    handleSnapshot,
    handleStepUpdate,
    handleProgress,
    handleJobUpdate,
    handleError,
    handleForceRefresh,
  ]);

  // ✅ CRITICAL FIX: Use undefined instead of null for consistency with type system
  // Hook SSE accepts string | null | undefined, but we use undefined for consistency
  // ✅ CRITICAL FIX #1 (Hidden Issue): Get lastMessageAt from SSE hook for stuck state detection
  const { isConnected, error: sseError, lastMessageAt } = useVideoFactorySSE(
    shouldUseSSE ? jobId : undefined,
    sseOptions
  );

  // ✅ CRITICAL FIX: Smart Polling với initial delay và polling interval hợp lý
  // Chỉ chạy khi đang ở bước "processing" và chưa có clip
  // ✅ OPTIMIZATION: Dùng ref để track polling state và tránh reset timer khi re-render
  const pollingStartedRef = useRef<string | null>(null); // Track jobId đã start polling
  const pollingJobIdRef = useRef<string | null>(null); // Track jobId hiện tại đang poll
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ CRITICAL FIX #3: UI Timeout - Track last progress update to detect stuck state
  // If no progress for 60s, show "Refresh" button to user
  const lastProgressUpdateRef = useRef<number>(Date.now());
  const stuckStateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isStuckState, setIsStuckState] = useState(false);

  // ✅ CRITICAL FIX #1 (Hidden Issue): START stuck state timeout when job is processing
  // This detects when BOTH polling AND SSE are silent for 60s (true stuck state)
  // Distinguishes between "stuck connection" (no messages) vs "long running step" (messages still coming)
  useEffect(() => {
    // Clear any existing timeout
    if (stuckStateTimeoutRef.current) {
      clearTimeout(stuckStateTimeoutRef.current);
      stuckStateTimeoutRef.current = null;
    }

    // Reset stuck state when job changes or completes
    setIsStuckState(false);

    // Only start timeout when job is actively processing
    if (isProcessing && jobId) {
      const STUCK_TIMEOUT = 60000; // 60 seconds

      const checkStuckState = () => {
        const now = Date.now();
        const timeSinceLastPoll = now - lastProgressUpdateRef.current;
        const timeSinceLastSSE = lastMessageAt ? now - lastMessageAt : Infinity;
        const timeSinceLastActivity = Math.min(timeSinceLastPoll, timeSinceLastSSE);

        devLog('[VideoFactory] Checking stuck state', {
          timeSinceLastPoll: Math.round(timeSinceLastPoll / 1000) + 's',
          timeSinceLastSSE: timeSinceLastSSE === Infinity ? 'never' : Math.round(timeSinceLastSSE / 1000) + 's',
          timeSinceLastActivity: Math.round(timeSinceLastActivity / 1000) + 's',
          threshold: Math.round(STUCK_TIMEOUT / 1000) + 's',
          jobId,
        });

        // Only set stuck if BOTH polling AND SSE are silent for 60s
        if (timeSinceLastActivity >= STUCK_TIMEOUT) {
          devWarn('[VideoFactory] Stuck state detected - no activity from polling OR SSE', {
            timeSinceLastPoll: Math.round(timeSinceLastPoll / 1000) + 's',
            timeSinceLastSSE: timeSinceLastSSE === Infinity ? 'never' : Math.round(timeSinceLastSSE / 1000) + 's',
            jobId,
            hint: 'User may need to refresh or check connection',
          });
          setIsStuckState(true);
        } else {
          // Activity detected, reschedule check
          devLog('[VideoFactory] Activity detected, rescheduling stuck check', {
            nextCheckIn: Math.round(STUCK_TIMEOUT / 1000) + 's',
          });
          // Reschedule check
          stuckStateTimeoutRef.current = setTimeout(checkStuckState, STUCK_TIMEOUT);
        }
      };

      // Start initial check
      stuckStateTimeoutRef.current = setTimeout(checkStuckState, STUCK_TIMEOUT);

      devLog('[VideoFactory] Stuck state detection started', {
        jobId,
        timeout: Math.round(STUCK_TIMEOUT / 1000) + 's',
        hint: 'Will check if BOTH polling AND SSE are silent',
      });
    }

    return () => {
      if (stuckStateTimeoutRef.current) {
        clearTimeout(stuckStateTimeoutRef.current);
        stuckStateTimeoutRef.current = null;
      }
    };
  }, [isProcessing, jobId, lastMessageAt]);

  useEffect(() => {
    // ✅ OPTIMIZATION: Use custom hooks for cleaner code
    // Note: We still need videoFactoryState for null check, but use jobId from hook for consistency
    const currentJobId = jobId;

    // ✅ CRITICAL FIX: Cleanup nếu jobId thay đổi hoặc không có jobId
    if (pollingJobIdRef.current && pollingJobIdRef.current !== currentJobId) {
      devLog("🛑 Smart Polling: JobId changed, cleaning up old polling...", {
        oldJobId: pollingJobIdRef.current,
        newJobId: currentJobId,
      });
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      pollingStartedRef.current = null;
      pollingJobIdRef.current = null;
    }

    if (!currentJobId) {
      return;
    }

    // ✅ CRITICAL FIX: Simplified polling logic - ALWAYS poll after 2 minutes, regardless of SSE
    // This ensures FE gets data even if SSE events are missed
    const hasProcessingClips = generatedClips.some((c: any) =>
      !c.status || c.status === 'PROCESSING' || c.status === 'PENDING'
    );
    const expectedClipCount = useVideoFactoryStore.getState().videoFactoryState?.expectedClipCount || 0;
    const hasAllExpectedClips = expectedClipCount > 0 && generatedClips.length >= expectedClipCount;
    const allClipsReady = hasAllExpectedClips && !hasProcessingClips;
    const generatedClipsCount = generatedClips.length;

    // ✅ NEW: Check jobCreatedAt để tính thời gian đã trôi qua
    const jobCreatedAt = useVideoFactoryStore.getState().videoFactoryState?.jobCreatedAt;
    const now = Date.now();
    const timeSinceJobCreation = jobCreatedAt ? now - jobCreatedAt : 0;
    const INITIAL_DELAY_MS = 120000; // 2 minutes
    // ✅ CRITICAL FIX: If jobCreatedAt is missing OR SSE is disconnected, start polling immediately (don't wait 2 mins)
    const shouldStartPolling = !isConnected || !jobCreatedAt || timeSinceJobCreation >= INITIAL_DELAY_MS;

    // ✅ CRITICAL FIX: Polling logic - ALWAYS poll if:
    // 1. No clips at all (generatedClipsCount === 0) - BẮT BUỘC phải poll để fetch clips (IGNORE 2-minute delay and SSE connection)
    // 2. OR: 2 minutes passed AND not all clips ready - poll để update status
    // This ensures FE always gets data, regardless of SSE connection status
    // ✅ FIX: generatedClipsCount === 0 should ALWAYS trigger polling, even if SSE is connected or 2 minutes haven't passed
    const shouldPoll = (
      generatedClipsCount === 0 || // ✅ CRITICAL: Always poll if no clips (safety net) - IGNORE 2-minute delay and SSE connection
      (shouldStartPolling && !allClipsReady) // OR: 2 minutes passed AND not all clips ready
    );

    devLog("🔍 Polling decision", {
      jobId: currentJobId,
      jobCreatedAt,
      timeSinceJobCreation: timeSinceJobCreation ? `${Math.round(timeSinceJobCreation / 1000)}s` : 'N/A',
      shouldStartPolling,
      isConnected,
      allClipsReady,
      hasAllExpectedClips,
      expectedClipCount,
      generatedClipsCount: generatedClips.length,
      hasProcessingClips,
      isProcessing,
      isPostprocess,
      shouldPoll,
      hint: generatedClipsCount === 0
        ? '✅ CRITICAL: No clips yet - ALWAYS poll regardless of SSE connection or 2-minute delay (safety net)'
        : shouldStartPolling
          ? '2 minutes passed since job creation - will poll to get latest data from Server B (regardless of SSE connection)'
          : `Waiting for ${Math.round((INITIAL_DELAY_MS - timeSinceJobCreation) / 1000)}s before polling (but will poll immediately if clips are missing)`,
    });

    // ✅ CRITICAL FIX: Nếu đã có clips READY hết HOẶC SSE đang connected → cleanup và return
    // ✅ CRITICAL FIX: Dừng polling khi:
    // 1. Tất cả clips READY, HOẶC
    // 2. Job/Step đã failed (có lastErrorMessage) - để tránh polling ghi đè failed state
    const currentState = useVideoFactoryStore.getState().videoFactoryState;
    const hasFailed = currentState?.lastErrorMessage &&
      (currentState?.currentStep === 'postprocess' || currentState?.currentStep === 'postprod');

    if (!shouldPoll || allClipsReady || hasFailed) {
      if (pollingJobIdRef.current === currentJobId) {
        // Đang poll job này nhưng không cần poll nữa → cleanup
        const stopReason = hasFailed
          ? 'Job/Step failed - stop polling to prevent overwriting failed state'
          : allClipsReady
            ? 'All clips ready'
            : 'Should not poll';
        /* SILENCED
        devLog("✅ Smart Polling: Stopping polling...", {
          jobId: currentJobId,
          hasClips: generatedClips.length > 0,
          currentStep: currentStep,
          isConnected,
          allClipsReady,
          hasFailed,
          lastErrorMessage: currentState?.lastErrorMessage,
          stopReason,
          hint: hasFailed
  
            ?'Job/Step failed - polling stopped to prevent overwriting failed state with processing state'
            : 'Polling stopped because all clips are ready (not because SSE is connected)',
        });         */
        if (pollingTimeoutRef.current) {
          clearTimeout(pollingTimeoutRef.current);
          pollingTimeoutRef.current = null;
        }
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        pollingStartedRef.current = null;
        pollingJobIdRef.current = null;
      }
      return;
    }

    // ✅ CRITICAL FIX: Chỉ start polling một lần cho mỗi jobId
    // Tránh reset timer khi component re-render
    if (pollingStartedRef.current === currentJobId && pollingJobIdRef.current === currentJobId) {
      // Đã start polling cho jobId này rồi → không làm gì
      return;
    }

    // ✅ NEW: Polling LUÔN chạy sau 2 phút từ jobCreatedAt, KHÔNG phụ thuộc SSE
    // Polling lấy trực tiếp thông tin mới nhất từ Server B/worker
    // ✅ CRITICAL FIX: Polling interval - 15 seconds (hybrid polling with SSE)
    // Polling chạy song song với SSE để đảm bảo không bỏ sót updates
    const POLL_INTERVAL_MS = 15000; // 15 seconds - hybrid polling with SSE

    // ✅ NEW: Calculate remaining delay (if job was created less than 2 minutes ago)
    // ✅ CRITICAL FIX: Use jobCreatedAt and timeSinceJobCreation from earlier calculation
    const remainingDelay = jobCreatedAt && timeSinceJobCreation < INITIAL_DELAY_MS
      ? INITIAL_DELAY_MS - timeSinceJobCreation
      : 0;

    /* SILENCED
    devLog("🚀 Smart Polling: Starting polling...", {
      jobId: currentJobId,
      jobCreatedAt,
      timeSinceJobCreation: timeSinceJobCreation ? `${Math.round(timeSinceJobCreation / 1000)}s` : 'N/A',
      remainingDelay: remainingDelay ? `${Math.round(remainingDelay / 1000)}s` : '0s',
      hint: remainingDelay > 0
        ? `Will start polling after ${Math.round(remainingDelay / 1000)}s (2 minutes from job creation)`
        : 'Starting polling immediately (2 minutes already passed)',
    });
    */

    // ✅ NEW: Gọi ngay nếu đã qua 2 phút, nếu không thì chờ
    if (remainingDelay === 0) {
      // Đã qua 2 phút → gọi ngay
      handleForceRefresh(currentJobId);
    }

    // ✅ CRITICAL FIX: Use remainingDelay instead of INITIAL_DELAY_MS
    // If job was created more than 2 minutes ago, remainingDelay = 0 → start immediately
    // If job was created less than 2 minutes ago, remainingDelay = time left → wait for remaining time
    pollingTimeoutRef.current = setTimeout(() => {
      // ✅ CRITICAL FIX: Check jobId vẫn còn đúng trước khi start interval
      if (pollingJobIdRef.current !== currentJobId) {
        // SILENCED: devLog("🛑 Smart Polling: JobId changed during delay, skipping interval setup");
        return;
      }

      /* SILENCED
      devLog("⏰ Initial delay expired. Starting periodic status checks...", {
        hint: 'Polling will run every 15s as fallback, even if SSE is connected',
      });
      */

      // ✅ CRITICAL FIX: Polling interval - 15s (hybrid polling with SSE)
      // Polling chạy song song với SSE để đảm bảo không bỏ sót updates
      const getPollInterval = (): number => {
        return 15000; // 15 seconds - hybrid polling with SSE
      };

      // Thiết lập vòng lặp kiểm tra định kỳ với adaptive interval (recursive setTimeout)
      const pollOnce = () => {
        // ✅ CRITICAL FIX: Check if polling was cancelled before executing
        if (pollingJobIdRef.current !== currentJobId) {
          // SILENCED: devLog("🛑 Smart Polling: JobId changed, stopping polling");
          return;
        }

        const currentState = useVideoFactoryStore.getState().videoFactoryState;
        const currentPollingJobId = pollingJobIdRef.current;

        // ✅ CRITICAL FIX: Check jobId và điều kiện polling trước khi gọi API
        // ✅ FIX: Polling cũng cần chạy khi ở postprocess step để update clips status
        // ✅ NEW: Polling LUÔN chạy sau 2 phút từ jobCreatedAt, KHÔNG phụ thuộc SSE
        const hasClips = (currentState?.generatedClips?.length || 0) > 0;
        const expectedClipCount = currentState?.expectedClipCount || 0;
        const hasProcessingClips = hasClips && (currentState?.generatedClips || []).some((c: any) =>
          !c.status || c.status === 'PROCESSING' || c.status === 'PENDING'
        );

        // ✅ CRITICAL FIX: Check expectedClipCount - don't stop polling if we haven't received all clips yet
        // Even if we have some clips, we should continue polling if:
        // 1. We haven't received expectedClipCount clips yet, OR
        // 2. Any clip is still PROCESSING/PENDING
        const hasAllExpectedClips = expectedClipCount > 0 && hasClips && (currentState?.generatedClips?.length || 0) >= expectedClipCount;
        const allClipsReady = hasAllExpectedClips && !hasProcessingClips;

        // ✅ NEW: Check jobCreatedAt để đảm bảo đã qua 2 phút
        const jobCreatedAt = currentState?.jobCreatedAt;
        const now = Date.now();
        const timeSinceJobCreation = jobCreatedAt ? now - jobCreatedAt : 0;
        const INITIAL_DELAY_MS = 120000; // 2 minutes
        // ✅ CRITICAL FIX: If jobCreatedAt is missing, start polling immediately (job may be old)
        const shouldStartPolling = !jobCreatedAt || timeSinceJobCreation >= INITIAL_DELAY_MS;

        // ✅ CRITICAL FIX: Polling LUÔN chạy sau 2 phút từ jobCreatedAt, KHÔNG phụ thuộc SSE
        // Polling lấy trực tiếp thông tin mới nhất từ Server B/worker
        // ✅ CRITICAL: Always poll if no clips (generatedClipsCount === 0) - BẮT BUỘC phải poll để fetch clips (IGNORE 2-minute delay and SSE connection)
        // OR: 2 minutes passed AND not all clips ready - poll để update status
        // ✅ CRITICAL: Dừng polling khi đủ clips (allClipsReady = true)
        const generatedClipsCount = (currentState?.generatedClips?.length || 0);
        // ✅ FIX: generatedClipsCount === 0 should ALWAYS trigger polling, even if SSE is connected or 2 minutes haven't passed
        const shouldContinuePolling = (
          generatedClipsCount === 0 || // ✅ CRITICAL: Always poll if no clips (safety net) - IGNORE 2-minute delay and SSE connection
          (shouldStartPolling && !allClipsReady) // OR: 2 minutes passed AND not all clips ready
        );

        // ✅ CRITICAL FIX: Hybrid Polling - Polling chạy song song với SSE
        // KHÔNG dừng polling chỉ vì SSE connected - polling là fallback quan trọng
        // Use isConnected from hook (passed via closure) instead of reading from store
        // This ensures we get the latest connection state
        const currentIsConnected = isConnected;

        // devLog("🔄 Polling interval check (Hybrid Polling)", {
        //   currentPollingJobId,
        //   jobCreatedAt: currentState?.jobCreatedAt,
        //   timeSinceJobCreation: jobCreatedAt ? `${Math.round((now - jobCreatedAt) / 1000)}s` : 'N/A',
        //   shouldStartPolling,
        //   isConnected: currentIsConnected,
        //   hasClips,
        //   hasAllExpectedClips,
        //   expectedClipCount,
        //   hasProcessingClips,
        //   allClipsReady,
        //   shouldContinuePolling,
        //   hint: currentIsConnected
        //     ? 'SSE is connected - polling continues as fallback (hybrid mode)'
        //     : shouldStartPolling
        //       ? '2 minutes passed - polling gets latest data directly from Server B/worker'
        //       : `Waiting for ${Math.round((INITIAL_DELAY_MS - timeSinceJobCreation) / 1000)}s before polling`,
        // });

        // ✅ CRITICAL FIX: Dừng polling khi:
        // 1. Tất cả clips READY, HOẶC
        // 2. Job/Step đã failed (có lastErrorMessage) - để tránh polling ghi đè failed state
        const hasFailed = currentState?.lastErrorMessage &&
          (currentState?.currentStep === 'postprocess' || currentState?.currentStep === 'postprod');

        if (allClipsReady || hasFailed) {
          const stopReason = allClipsReady
            ? 'All clips are READY - no need to poll anymore'
            : 'Job/Step failed - stop polling to prevent overwriting failed state';

          // devLog("✅ Smart Polling: Stopping polling", {
          //   currentPollingJobId,
          //   allClipsReady,
          //   hasFailed,
          //   lastErrorMessage: currentState?.lastErrorMessage,
          //   currentStep: currentState?.currentStep,
          //   stopReason,
          //   hint: hasFailed
          //     ? 'Job/Step failed - polling stopped to prevent overwriting failed state with processing state'
          //     : 'All clips are READY - no need to poll anymore',
          // });

          // Stop polling when all clips ready OR job failed
          if (pollingIntervalRef.current) {
            clearTimeout(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          pollingStartedRef.current = null;
          pollingJobIdRef.current = null;
          return;
        }

        if (currentPollingJobId &&
          currentState?.jobId === currentPollingJobId &&
          shouldContinuePolling) {
          // devLog("🔄 Smart Polling: Checking job status...", {
          //   currentStep: currentState?.currentStep,
          //   hasClips,
          //   hasAllExpectedClips,
          //   expectedClipCount,
          //   hasProcessingClips,
          //   allClipsReady,
          //   hint: 'Polling to update clips status or fetch new clips',
          // });

          // ✅ CRITICAL FIX #3: Update last progress timestamp
          // This resets the stuck state timer
          lastProgressUpdateRef.current = Date.now();
          setIsStuckState(false); // Clear stuck state when polling succeeds

          handleForceRefresh(currentPollingJobId);

          // ✅ CRITICAL FIX: Schedule next poll with adaptive interval
          // This allows interval to change dynamically based on clips count
          const nextInterval = getPollInterval();
          pollingIntervalRef.current = setTimeout(pollOnce, nextInterval) as any;
        } else {
          // ✅ CRITICAL: Đã có đủ clips READY → dừng polling ngay lập tức
          // Hoặc chuyển step hoặc jobId thay đổi → dừng polling
          // HOẶC job/step đã failed → dừng polling để tránh ghi đè failed state
          const hasFailed = currentState?.lastErrorMessage &&
            (currentState?.currentStep === 'postprocess' || currentState?.currentStep === 'postprod');

          const stopReason = hasFailed
            ? 'Job/Step failed - stop polling to prevent overwriting failed state'
            : allClipsReady
              ? 'All clips are READY - no need to poll anymore'
              : currentState?.jobId !== currentPollingJobId
                ? 'JobId changed'
                : 'Step changed or other condition';

          // devLog("✅ Smart Polling: Stopping polling", {
          //   stopReason,
          //   hasFailed,
          //   lastErrorMessage: currentState?.lastErrorMessage,
          //   hasClips,
          //   hasAllExpectedClips,
          //   expectedClipCount,
          //   hasProcessingClips,
          //   allClipsReady,
          //   currentStep: currentState?.currentStep,
          //   jobIdMatch: currentState?.jobId === currentPollingJobId,
          //   hint: hasFailed
          //     ? 'Job/Step failed - polling stopped to prevent overwriting failed state with processing state'
          //     : allClipsReady
          //       ? 'All expected clips are READY - polling stopped. Will rely on SSE for future updates.'
          //       : 'Step changed or jobId changed - no need to poll',
          // });

          // ✅ CRITICAL: Clear polling interval/timeout to stop polling
          if (pollingIntervalRef.current) {
            clearTimeout(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          pollingStartedRef.current = null;
          pollingJobIdRef.current = null;
        }
      };

      // Start first poll immediately, then schedule next with adaptive interval
      pollOnce();

    }, remainingDelay > 0 ? remainingDelay : 0); // ✅ CRITICAL FIX: Use remainingDelay, not INITIAL_DELAY_MS

    // Mark đã start polling cho jobId này
    pollingStartedRef.current = currentJobId;
    pollingJobIdRef.current = currentJobId;

    // ✅ CRITICAL FIX: Cleanup polling timers on unmount or jobId change
    return () => {
      // devLog("🧹 Smart Polling: Cleanup triggered", {
      //   jobId: currentJobId,
      //   hasTimeout: !!pollingTimeoutRef.current,
      //   hasInterval: !!pollingIntervalRef.current,
      //   hint: 'Cleaning up polling timers to prevent memory leak',
      // });

      // Clear timeout (initial delay before polling starts)
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }

      // Clear interval (recurring polling)
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      // ✅ CRITICAL FIX #3: Clear stuck state timeout
      if (stuckStateTimeoutRef.current) {
        clearTimeout(stuckStateTimeoutRef.current);
        stuckStateTimeoutRef.current = null;
      }

      // Reset polling state
      // Note: Don't reset pollingStartedRef/pollingJobIdRef here
      // They're reset at the start of useEffect when jobId changes
    };
  }, [
    currentStep,
    jobId,
    isConnected, // ✅ CRITICAL FIX: Add isConnected to deps to stop polling when SSE connects
    // ✅ CRITICAL FIX: KHÔNG include generatedClips.length trong deps
    // Vì nó sẽ trigger re-run mỗi khi clips thay đổi → reset timer
    // Thay vào đó, check clips.length bên trong interval callback và ở đầu effect
    handleForceRefresh,
  ]);

  // ✅ CRITICAL FIX: Reset state and cleanup polling when modal opens (if starting new job)
  // This ensures old jobId, clips, and polling are cleared when user opens modal for new job
  // Use ref to track if we've already reset to prevent infinite loops
  const hasResetOnOpenRef = useRef(false);

  useEffect(() => {
    if (isVideoFactoryOpen && videoFactoryState) {
      const currentJobId = videoFactoryState.jobId;
      const currentStep = videoFactoryState.currentStep;

      // ✅ CRITICAL: Reset if modal just opened and we haven't reset yet
      // Only reset if:
      // 1. Modal just opened (hasResetOnOpenRef.current === false)
      // 2. AND (no jobId AND no clips AND step is input/config - meaning user is starting fresh)
      // This prevents resetting when user reopens modal to check progress of active job
      // ✅ CRITICAL FIX: Also check for generatedClips to prevent reset when SSE cleanup happens
      // If user has clips or is in postprocess/completed state, don't reset even if jobId is undefined
      const hasClips = videoFactoryState.generatedClips && videoFactoryState.generatedClips.length > 0;
      const isInProgressState = currentStep === 'postprocess' ||
        currentStep === 'postprod' ||
        currentStep === 'completed' ||
        currentStep === 'processing';

      // ✅ CRITICAL FIX #3 (Hidden Issue): Fetch fresh job status when modal reopens with active job
      // This handles case where user missed SSE events while modal was closed
      // Scenario: User closes modal → job completes → SSE event missed → user reopens → sees stale "processing" state
      // Solution: Force refresh immediately on mount if we have an active job
      // ✅ OPTIMIZATION: Skip force refresh if job is completed and all clips are ready
      const hasActiveJob = Boolean(currentJobId && (isInProgressState || hasClips));
      const allClipsReady = hasClips && videoFactoryState.generatedClips?.every((c: any) => c.status === 'READY');
      const isJobCompleted = currentStep === 'postprocess' && allClipsReady;

      if (!hasResetOnOpenRef.current && hasActiveJob && !isJobCompleted) {
        // devLog('[VideoFactory] Modal opened with active job - fetching fresh status', {
        //   currentJobId,
        //   currentStep,
        //   clipsCount: videoFactoryState.generatedClips?.length || 0,
        //   allClipsReady,
        //   hint: isJobCompleted
        //     ? 'Job completed with all clips ready - skipping force refresh'
        //     : 'Ensures we have latest status (in case we missed SSE events while modal closed)',
        // });

        // ✅ Force refresh immediately on mount to get latest job state
        // This prevents showing stale "processing" state when job actually completed while modal was closed
        // ✅ OPTIMIZATION: Skip if job is completed and all clips are ready
        if (currentJobId) {
          handleForceRefresh(currentJobId);
        }

        hasResetOnOpenRef.current = true; // Mark as reset to prevent running again
      } else if (!hasResetOnOpenRef.current &&
        (!currentJobId &&
          !hasClips &&
          !isInProgressState)) {
        // ✅ ORIGINAL LOGIC: Reset state when starting fresh (no active job)
        // devLog('[VideoFactoryModal] Modal opened, resetting state for new job', {
        //   currentJobId,
        //   currentStep,
        //   hint: 'Resetting to ensure clean state for new job - old jobId, clips, and polling will be cleared',
        // });

        // ✅ CRITICAL: Cleanup polling immediately to prevent using old jobId
        if (pollingTimeoutRef.current) {
          clearTimeout(pollingTimeoutRef.current);
          pollingTimeoutRef.current = null;
        }
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        pollingStartedRef.current = null;
        pollingJobIdRef.current = null;

        // Reset to initial state but keep configs if they exist
        const initialState = {
          ...createInitialVideoFactoryState(),
          // Keep configs if they exist (user might have configured before)
          sourceConfig: videoFactoryState.sourceConfig,
          cutConfig: videoFactoryState.cutConfig,
          postProdConfig: videoFactoryState.postProdConfig,
          // ✅ CRITICAL: Clear job-related fields to disconnect SSE and clear old clips
          jobId: undefined,
          cutJobId: undefined,
          postProcessJobId: undefined,
          generatedClips: [],
          selectedClipKeys: [],
          expectedClipCount: undefined,
        };

        useVideoFactoryStore.setState({
          videoFactoryState: initialState,
        });

        hasResetOnOpenRef.current = true;
      }
    } else if (!isVideoFactoryOpen) {
      // Reset flag when modal closes
      hasResetOnOpenRef.current = false;

      // ✅ CRITICAL: Cleanup polling when modal closes
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      pollingStartedRef.current = null;
      pollingJobIdRef.current = null;
    }
  }, [isVideoFactoryOpen, videoFactoryState, handleForceRefresh]); // Run when modal opens/closes or state changes

  // ✅ Scroll về đầu form khi step quay lại 'postprocess' và có lỗi lần chạy trước
  useEffect(() => {
    if (currentStep === 'postprocess' && videoFactoryState?.lastErrorMessage) {
      try {
        // Ưu tiên scroll container nội bộ của modal nếu cần; tạm thời scroll window cho đơn giản
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        // Ignore scrolling errors (SSR / non-browser env)
      }
    }
  }, [currentStep, videoFactoryState?.lastErrorMessage]);

  const handleClose = () => {
    // ✅ CRITICAL FIX: Khi đóng modal step hậu kỳ, chỉ đóng Main Modal, không đóng "Kho thành phẩm"
    // Nếu đang ở step postprocess và có Result Modal đang mở, chỉ đóng Main Modal
    if (currentStep === 'postprocess' && isResultModalVisible) {
      // Chỉ đóng Main Modal, giữ nguyên "Kho thành phẩm"
      toggleMainModal(false);
    } else {
      // Các trường hợp khác: reset toàn bộ (bao gồm cả Result Modal)
      resetVideoFactory();
    }
  };

  // ✅ OPTIMIZATION: Memoize handlers to prevent unnecessary re-renders of PostprocessedClipsListModal
  const handleResultModalClose = useCallback(() => {
    toggleResultModal(false);
    toggleMainModal(true); // Hiện lại Main Modal khi đóng Result Modal
  }, [toggleResultModal, toggleMainModal]);

  const handleResultModalToggleMain = useCallback(() => {
    // ✅ NEW: Toggle back to main modal when clicking "Mở lại Config" button
    toggleResultModal(false);
    toggleMainModal(true);
  }, [toggleResultModal, toggleMainModal]);

  // ✅ SPLIT-SCREEN MODAL: Calculate layout based on modal visibility
  // If both modals are visible, Main Modal (Panel A) should be on the left, Result Modal (Panel B) on the right
  const isSplitScreen = isMainModalVisible && isResultModalVisible;
  const mainModalClassName = isSplitScreen
    ? "max-w-[calc(100%-400px)] left-0" // Panel A: Left side when split-screen
    : "max-w-3xl"; // Normal size when alone

  // Always render Dialog to ensure hooks are called consistently
  // Dialog component handles the open/close state internally
  return (
    <>
      {/* ✅ SPLIT-SCREEN MODAL: Main Modal (Panel A) - Config/Cut */}
      <Dialog open={isVideoFactoryOpen && !!videoFactoryState && isMainModalVisible} onOpenChange={(open: boolean) => !open && handleClose()}>
        {videoFactoryState && (
          <DialogContent className={`${mainModalClassName} max-h-[85vh] overflow-hidden bg-[#0A0118] border-[#E33265]/50 p-0 mx-4 ${isSplitScreen ? 'fixed' : ''}`}>
            <JobErrorBoundary>
              {/* Header */}
              <div className="sticky top-0 z-10 bg-[#0A0118]/95 backdrop-blur-sm border-b border-[#E33265]/30 p-4 sm:p-6 pb-3 sm:pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">✂️</span>
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-xl font-bold text-white truncate">Video Factory</h2>
                      <p className="text-xs sm:text-sm text-white/60 truncate">Cắt video dài thành ngắn</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Nút mở JobDetailPage khi đã có jobId và đang processing/completed */}
                    {videoFactoryState.jobId && (videoFactoryState.currentStep === 'processing' || videoFactoryState.currentStep === 'completed') && (
                      <button
                        type="button"
                        onClick={() => setShowJobDetail(true)}
                        className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-blue-500/20 text-blue-200 hover:bg-blue-500/30 border border-blue-500/40 transition-colors"
                      >
                        Xem chi tiết job
                      </button>
                    )}
                    <button
                      onClick={handleClose}
                      className="w-10 h-10 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-white/60 hover:text-white flex-shrink-0 -mr-2"
                      aria-label="Đóng"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Progress Steps */}
                {videoFactoryState.currentStep !== 'processing' && videoFactoryState.currentStep !== 'completed' && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    {['input', 'config', 'postprod'].map((step, index) => (
                      <div key={step} className="flex items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${videoFactoryState.currentStep === step
                            ? 'bg-blue-500 text-white'
                            : index < ['input', 'config', 'postprod'].indexOf(videoFactoryState.currentStep)
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-700 text-white/40'
                            }`}
                        >
                          {index + 1}
                        </div>
                        {index < 2 && (
                          <div
                            className={`w-12 h-0.5 mx-1 ${index < ['input', 'config', 'postprod'].indexOf(videoFactoryState.currentStep)
                              ? 'bg-green-500'
                              : 'bg-gray-700'
                              }`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6 pt-3 sm:pt-4 overflow-y-auto max-h-[calc(85vh-120px)]">
                {/* ✅ CRITICAL FIX: Khi có clips HOẶC đang ở postprocess step, ưu tiên hiển thị ProcessingStage/PostprocessSelectionStage 
                thay vì JobDetailPage để user thấy clips ngay thay cho loading */}
                {/* ✅ FIX: Cho phép mở JobDetailPage cả khi đang loading (processing, chưa có clips)
                - Chỉ chặn JobDetail khi đã có clips để không che danh sách clips */}
                {/* ✅ OPTIMIZATION: Use custom hooks for cleaner code */}
                {showJobDetail && jobId &&
                  !generatedClips.length &&
                  !isPostprocess ? (
                  <div className="bg-[#050014] rounded-lg border border-white/10 p-3 sm:p-4">
                    <JobDetailPage
                      jobId={jobId || ''} // ✅ CRITICAL FIX: Use fallback
                      onClose={() => setShowJobDetail(false)}
                    />
                  </div>
                ) : (() => {
                  // ✅ CRITICAL FIX: Check null trước khi destructure để tránh crash
                  if (!videoFactoryState) {
                    return <div className="text-white">Đang tải...</div>;
                  }
                  // ✅ OPTIMIZATION: Use custom hooks instead of destructuring from videoFactoryState
                  // currentStep, generatedClips, processingProgress, processingMessage, jobId are already available from hooks above

                  // ✅ DEBUG: Log current state for debugging
                  // devLog('[VideoFactoryModal] Rendering', {
                  //   currentStep,
                  //   generatedClipsCount: generatedClips?.length || 0,
                  //   showJobDetail,
                  //   hasJobId: !!jobId,
                  //   lastErrorMessage: videoFactoryState.lastErrorMessage,
                  // });
                  switch (currentStep) {
                    case 'input':
                      return (
                        <InputStage
                          onNext={(config) => {
                            updateVideoFactorySource(config);
                            setVideoFactoryStep('config');
                          }}
                        />
                      );
                    case 'config':
                      return (
                        <ConfigStage
                          sourceConfig={sourceConfig} // ✅ CRITICAL FIX: Use sourceConfig from hook, not cutConfig
                          initialConfig={liveCutConfig || cutConfig || null}
                          onNext={(config) => {
                            updateVideoFactoryCut(config);
                            setLiveCutConfig(config);
                            setVideoFactoryStep('postprod');
                          }}
                          onBack={() => setVideoFactoryStep('input')}
                          onConfigChange={handleCutConfigChange}
                          // ✅ NEW: Callback để trigger cut directly (bypass summary step)
                          onCutVideo={async () => {
                            // ✅ FE CREDIT CHECK: Cut phase
                            if (creditsRemaining < estimatedCreditsSide) {
                              openLimitModal(
                                'insufficient_credits',
                                `Bạn cần ${estimatedCreditsSide} credits để bắt đầu cắt video này, nhưng hiện chỉ còn ${creditsRemaining} credits.`,
                                { creditsRemaining, currentPlan }
                              );
                              return;
                            }

                            // Update cut config trước
                            const config = liveCutConfig || cutConfig;
                            if (config) {
                              updateVideoFactoryCut(config);
                            }
                            // Gọi startVideoFactoryProcessing với mode='cut_only'
                            await startVideoFactoryProcessing();
                          }}
                        />
                      );
                    case 'postprod':
                      return (
                        <PostProdStage
                          cutConfig={liveCutConfig || cutConfig}
                          initialPostConfig={livePostProdConfig || postProdConfig || null}
                          onConfigChange={handlePostProdConfigChange}
                          onNext={(config) => {
                            updateVideoFactoryPostProd(config);
                            setLivePostProdConfig(config);
                            setVideoFactoryStep('summary');
                          }}
                          onBack={() => setVideoFactoryStep('config')}
                        />
                      );
                    case 'postprocess':
                      return (
                        <>
                          {/* ✅ ENHANCED: Error banner with better UX (icon + retry hint) */}
                          {videoFactoryState.lastErrorMessage && (
                            <div className="mb-3 rounded-md border border-red-500/50 bg-red-500/10 px-4 py-3">
                              <div className="flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <div className="font-semibold text-sm text-red-200 mb-1">
                                    {videoFactoryState.cutStatus === 'failed' ? 'Cắt clip thất bại' : 'Hậu kỳ thất bại'}
                                  </div>
                                  <div className="text-xs text-red-300 mb-2">
                                    {videoFactoryState.cutStatus === 'failed'
                                      ? VIDEO_ERRORS.CUT_FAILED(videoFactoryState.lastErrorMessage)
                                      : VIDEO_ERRORS.POSTPROCESS_FAILED(videoFactoryState.lastErrorMessage)}
                                  </div>
                                  <div className="text-xs text-red-400/80">
                                    {videoFactoryState.cutStatus === 'failed'
                                      ? '💡 Vui lòng kiểm tra lại nguồn video hoặc thử lại sau.'
                                      : '💡 Kiểm tra lại cấu hình (B-roll query, phụ đề,...) rồi chọn clips và bấm "Bắt đầu hậu kỳ" để thử lại.'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          <PostprocessSelectionStage
                            clips={generatedClips || []}
                            autoCaptionsEnabled={postProdConfig?.autoCaptions}
                            onBack={() => setVideoFactoryStep('config')} // ✅ NEW: Quay lại config thay vì summary
                            onStartPostprocess={async (keys, config, ids) => {
                              // ✅ FE CREDIT CHECK: Postprocess phase
                              if (creditsRemaining < estimatedCreditsSide) {
                                openLimitModal(
                                  'insufficient_credits',
                                  `Bạn cần ${estimatedCreditsSide} credits để thực hiện hậu kỳ cho các clip đã chọn, nhưng hiện chỉ còn ${creditsRemaining} credits.`,
                                  { creditsRemaining, currentPlan }
                                );
                                return;
                              }

                              // ✅ CRITICAL FIX #3: Accept config parameter from child component
                              // This eliminates race condition by passing fresh config directly to API
                              /* SILENCED
                              console.log('[VideoFactoryModal] onStartPostprocess called', {
                                keys,
                                config,
                                idsCount: ids?.length,
                                hasConfig: !!config,
                                actionType: 'VIDEO_PROCESSING',
                                estimatedCost: estimatedCreditsSide,
                              });
                              */

                              if (config) {
                                updateVideoFactoryPostProd(config);
                              }
                              if (keys && keys.length > 0) {
                                updateSelectedClipKeys(keys);
                              }
                              // Khởi chạy postprocess job
                              await startVideoFactoryPostProcess(keys, config, ids);
                            }}
                            onToggleMainModal={() => toggleMainModal()}
                          />
                        </>
                      );
                    case 'summary':
                      return (
                        <SummaryStage
                          state={videoFactoryState}
                          onBack={() => setVideoFactoryStep('postprod')}
                          onStart={() => startVideoFactoryProcessing()}
                        />
                      );
                    case 'processing':
                    case 'postprocess':
                    case 'completed':
                      // ✅ STABLE WORKSPACE: All these stages render the split-view (Hình 1 - Hình 4)
                      // No more "Hình 5" (centralized processing stage) after starting.
                      return (
                        <PostprocessSelectionStage
                          clips={generatedClips || []}
                          autoCaptionsEnabled={videoFactoryState.postProdConfig?.autoCaptions}
                          onBack={() => setVideoFactoryStep('config')}
                          onStartPostprocess={(keys, config, ids) => {
                            // ✅ CRITICAL FIX: Direct config pass to avoid race conditions
                            startVideoFactoryPostProcess(keys, config, ids);
                          }}
                          onToggleMainModal={() => {
                            // Split-screen mode: Opens/Toggles "Kho thành phẩm" side-panel
                            const currentState = useVideoFactoryStore.getState();
                            if (!currentState.isVideoFactoryOpen) {
                              useVideoFactoryStore.setState({ isVideoFactoryOpen: true });
                            }
                            toggleResultModal(true);
                          }}
                          onPreviewOpenChange={(open) => setIsPreviewOpen(open)}
                        />
                      );
                    default:
                      return null;
                  }
                })()}
              </div>
            </JobErrorBoundary>
          </DialogContent>
        )}
      </Dialog>

      {/* ✅ SPLIT-SCREEN MODAL: Result Modal (Panel B) - Postprocessed Clips List */}
      {/* ✅ NEW: Always show modal when isResultModalVisible is true, even if no projectId/postProcessJobId yet */}
      {/* Modal will show "Chưa có phiên bản nào" if no postprocess jobs exist */}
      {/* ✅ CRITICAL FIX: Use jobId as fallback for cutJobId if cutJobId is not available */}
      {/* ✅ DEBUG: Log modal render condition */}
      {(() => {
        const shouldRender = isResultModalVisible && (videoFactoryState?.projectId || videoFactoryState?.cutJobId || videoFactoryState?.jobId);
        /* SILENCED
        console.log('[VideoFactoryModal] PostprocessedClipsListModal render check', {
          isResultModalVisible,
          hasProjectId: !!videoFactoryState?.projectId,
          hasCutJobId: !!videoFactoryState?.cutJobId,
          hasJobId: !!videoFactoryState?.jobId,
          shouldRender,
          projectId: videoFactoryState?.projectId,
          cutJobId: videoFactoryState?.cutJobId,
          jobId: videoFactoryState?.jobId,
          timestamp: new Date().toISOString(),
        });
        */
        return shouldRender;
      })() && (
          <PostprocessedClipsListModal
            projectId={videoFactoryState?.projectId} // ✅ PROJECT-CENTRIC: Use projectId (preferred)
            jobId={videoFactoryState?.postProcessJobId || videoFactoryState?.cutJobId || videoFactoryState?.jobId} // ✅ Use postProcessJobId for SSE/polling, fallback to cutJobId or jobId
            cutJobId={videoFactoryState?.cutJobId || videoFactoryState?.jobId} // ✅ Use cutJobId for reference, fallback to jobId
            isOpen={isResultModalVisible}
            onClose={handleResultModalClose}
            onToggleMainModal={handleResultModalToggleMain}
            processingStartedAt={undefined} // ✅ SPLIT-SCREEN MODAL: Will be tracked in store via postProcessHistory
          />
        )}

      {/* Floating Credit Estimator positioned to the right of the main modal */}
      {/* ✅ Luôn hiển thị estimator để user thấy ước tính credit cho cả cut và hậu kỳ.
          Các overlay video (Media Library / Step 3 preview) đã được set z-index = 110,
          cao hơn card này (z-80) và Dialog (z-50), nên sẽ không còn bị đè lên video nữa. */}
      {/* ✅ FIX: Ẩn card Ước tính Credit khi đang xem preview video full-screen ở Step 3 */}
      {/* ✅ SPLIT-SCREEN MODAL: Ẩn card khi Result Modal mở (split-screen mode) */}
      {isVideoFactoryOpen && videoFactoryState && !isPreviewOpen && isMainModalVisible && (
        <div className="fixed top-24 right-6 w-80 z-[80] hidden xl:block">
          <Card className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/40 shadow-lg shadow-orange-500/20 backdrop-blur-md">
            <div className="p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-500/20 text-orange-300 flex items-center justify-center flex-shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-white font-semibold">Ước tính Credit</h4>
                  <span className="text-xs text-white/60">
                    {videoFactoryState.currentStep === 'input' ? 'Chọn nguồn'
                      : videoFactoryState.currentStep === 'config' ? 'Cấu hình cắt'
                        : videoFactoryState.currentStep === 'postprocess' || videoFactoryState.currentStep === 'postprod' ? 'Hậu kỳ'
                          : 'Xem lại'}
                  </span>
                </div>
                <div className="mt-2 text-2xl font-bold text-orange-400">
                  {estimatedCreditsSide > 0 ? `${estimatedCreditsSide} Credits` : 'Chờ bạn cấu hình'}
                </div>
                <div className="mt-3 space-y-1 text-sm text-white/70">
                  {/* ✅ Step 'config': Chỉ hiển thị thông tin cut */}
                  {videoFactoryState.currentStep === 'config' ? (
                    <>
                      <p>
                        Clip: {liveCutConfig?.method === 'auto' && liveCutConfig.autoCutConfig
                          ? `${liveCutConfig.autoCutConfig.clipCount} x ${liveCutConfig.autoCutConfig.clipDuration}`
                          : liveCutConfig?.method === 'manual' && liveCutConfig.manualSelections?.length
                            ? `${liveCutConfig.manualSelections.length} đoạn`
                            : 'Chưa chọn'}
                      </p>
                      <p className="text-xs text-orange-300/80">💡 Chỉ tính credit cho việc cắt clips</p>
                    </>
                  ) : (videoFactoryState.currentStep === 'postprocess' || videoFactoryState.currentStep === 'postprod') ? (
                    <>
                      {/* ✅ Step 'postprocess': Chỉ hiển thị thông tin hậu kỳ */}
                      {(() => {
                        // ✅ CRITICAL FIX: Use store config for postprocess step
                        const post = videoFactoryState.currentStep === 'postprocess' ? postProdConfig : livePostProdConfig;
                        const selectedCount = selectedClipKeys.length; // ✅ Use reactive value from hook

                        return (
                          <>
                            <p>
                              Clips đã chọn: {selectedCount}
                            </p>
                            <p>
                              B-roll: {post?.bRollInsertion
                                ? `Bật (${post.bRollDensity === 'low' ? 'Ít' : post.bRollDensity === 'medium' ? 'Vừa' : 'Dày đặc'})`
                                : 'Tắt'}
                            </p>
                            <p>Phụ đề: {post?.autoCaptions ? 'Bật' : 'Tắt'}</p>
                            <p className="text-xs text-orange-300/80">💡 Chỉ tính credit cho hậu kỳ (b-roll + phụ đề)</p>
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      {/* ✅ Các step khác: Hiển thị tổng */}
                      <p>
                        Clip: {liveCutConfig?.method === 'auto' && liveCutConfig.autoCutConfig
                          ? `${liveCutConfig.autoCutConfig.clipCount} x ${liveCutConfig.autoCutConfig.clipDuration}`
                          : 'Chưa chọn'}
                      </p>
                      <p>
                        B-roll: {livePostProdConfig?.bRollInsertion
                          ? `Bật (${livePostProdConfig.bRollDensity === 'low' ? 'Ít' : livePostProdConfig.bRollDensity === 'medium' ? 'Vừa' : 'Dày đặc'})`
                          : 'Tắt'}
                      </p>
                      <p>Phụ đề: {livePostProdConfig?.autoCaptions ? 'Bật' : 'Tắt'}</p>
                    </>
                  )}
                  <p className="text-xs text-white/50">Credit sẽ trừ khi job hoàn thành</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
