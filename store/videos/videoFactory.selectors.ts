/**
 * Video Factory Store Selectors
 * 
 * ✅ OPTIMIZATION: Custom hooks để encapsulate logic lặp lại và tối ưu performance
 * - Tránh lặp lại code selector ở nhiều component
 * - Dễ maintain và refactor sau này
 * - Có thể thêm derived state logic vào đây
 */

import { useShallow } from 'zustand/react/shallow';
import { useVideoFactoryStore } from '@/store';
import type { VideoFactoryState, GeneratedVideoClip } from '@/lib/types/video';

/**
 * Get current job ID from video factory state
 * @returns Current job ID or undefined
 */
export const useCurrentJobId = (): string | undefined => {
  return useVideoFactoryStore((state) => state.videoFactoryState?.jobId);
};

/**
 * Get current cut job ID from video factory state
 * @returns Current cut job ID or undefined
 */
export const useCurrentCutJobId = (): string | undefined => {
  return useVideoFactoryStore((state) => state.videoFactoryState?.cutJobId);
};

/**
 * Get current project ID from video factory state
 * ✅ PROJECT-CENTRIC: Project ID to manage all related jobs
 * @returns Current project ID or undefined
 */
export const useCurrentProjectId = (): string | undefined => {
  return useVideoFactoryStore((state) => state.videoFactoryState?.projectId);
};

/**
 * Get generated clips from video factory state
 * ✅ OPTIMIZATION: Use useShallow to prevent unnecessary re-renders when array reference changes but values don't
 * @returns Array of generated clips (empty array if none)
 */
export const useVideoFactoryClips = (): GeneratedVideoClip[] => {
  return useVideoFactoryStore(
    useShallow((state) => state.videoFactoryState?.generatedClips ?? [])
  );
};

/**
 * Get expected clip count from video factory state
 * @returns Expected clip count or undefined
 */
export const useExpectedClipCount = (): number | undefined => {
  return useVideoFactoryStore((state) => state.videoFactoryState?.expectedClipCount);
};

/**
 * Get current step from video factory state
 * @returns Current step or undefined
 */
export const useCurrentStep = (): VideoFactoryState['currentStep'] | undefined => {
  return useVideoFactoryStore((state) => state.videoFactoryState?.currentStep);
};

/**
 * Get ready clips (clips with storageKey and status !== 'PROCESSING')
 * ✅ OPTIMIZATION: Derived state - tính toán ngay trong selector
 * ✅ CRITICAL: Use useShallow to prevent unnecessary re-renders when array reference changes but values don't
 * @returns Array of ready clips
 */
export const useReadyClips = (): GeneratedVideoClip[] => {
  return useVideoFactoryStore(
    useShallow((state) => {
      const clips = state.videoFactoryState?.generatedClips ?? [];
      return clips.filter(
        (clip) =>
          (clip.storageKey || (clip as any).key) &&
          clip.status !== 'PROCESSING' &&
          clip.status !== 'FAILED'
      );
    })
  );
};

/**
 * Get processing clips (clips with status === 'PROCESSING')
 * ✅ OPTIMIZATION: Derived state
 * ✅ CRITICAL: Use useShallow to prevent unnecessary re-renders when array reference changes but values don't
 * @returns Array of processing clips
 */
export const useProcessingClips = (): GeneratedVideoClip[] => {
  return useVideoFactoryStore(
    useShallow((state) => {
      const clips = state.videoFactoryState?.generatedClips ?? [];
      return clips.filter((clip) => clip.status === 'PROCESSING');
    })
  );
};

/**
 * Get failed clips (clips with status === 'FAILED')
 * ✅ OPTIMIZATION: Derived state
 * ✅ CRITICAL: Use useShallow to prevent unnecessary re-renders when array reference changes but values don't
 * @returns Array of failed clips
 */
export const useFailedClips = (): GeneratedVideoClip[] => {
  return useVideoFactoryStore(
    useShallow((state) => {
      const clips = state.videoFactoryState?.generatedClips ?? [];
      return clips.filter((clip) => clip.status === 'FAILED');
    })
  );
};

/**
 * Get video factory configs (source, cut, postProd)
 * ✅ OPTIMIZATION: Use useShallow to prevent unnecessary re-renders when object reference changes but values don't
 * @returns Object containing all configs
 */
export const useVideoFactoryConfigs = () => {
  return useVideoFactoryStore(
    useShallow((state) => ({
      sourceConfig: state.videoFactoryState?.sourceConfig,
      cutConfig: state.videoFactoryState?.cutConfig,
      postProdConfig: state.videoFactoryState?.postProdConfig,
    }))
  );
};

/**
 * Get selected clip keys from video factory state
 * ✅ OPTIMIZATION: Use useShallow to prevent unnecessary re-renders when array reference changes but values don't
 * @returns Array of selected clip keys
 */
export const useSelectedClipKeys = (): string[] => {
  return useVideoFactoryStore(
    useShallow((state) => state.videoFactoryState?.selectedClipKeys ?? [])
  );
};

/**
 * Check if video factory is in processing state
 * ✅ OPTIMIZATION: Derived state
 * @returns true if current step is 'processing'
 */
export const useIsProcessing = (): boolean => {
  return useVideoFactoryStore((state) => state.videoFactoryState?.currentStep === 'processing');
};

/**
 * Check if video factory is in postprocess state
 * ✅ OPTIMIZATION: Derived state
 * @returns true if current step is 'postprocess'
 */
export const useIsPostprocess = (): boolean => {
  return useVideoFactoryStore((state) => state.videoFactoryState?.currentStep === 'postprocess');
};

/**
 * Check if video factory is completed
 * ✅ OPTIMIZATION: Derived state
 * @returns true if current step is 'completed'
 */
export const useIsCompleted = (): boolean => {
  return useVideoFactoryStore((state) => state.videoFactoryState?.currentStep === 'completed');
};

/**
 * Get final URL from video factory state
 * @returns Final URL or undefined
 */
export const useFinalUrl = (): string | undefined => {
  return useVideoFactoryStore((state) => state.videoFactoryState?.finalUrl);
};

/**
 * Get processing progress and message
 * ✅ OPTIMIZATION: Use useShallow for object return
 * @returns Object containing progress and message
 */
export const useProcessingProgress = () => {
  return useVideoFactoryStore(
    useShallow((state) => ({
      progress: state.videoFactoryState?.processingProgress ?? 0,
      message: state.videoFactoryState?.processingMessage ?? '',
    }))
  );
};

/**
 * Get cut progress and message (Isolated)
 */
export const useCutProgress = () => {
  return useVideoFactoryStore(
    useShallow((state) => ({
      progress: state.videoFactoryState?.cutProgress ?? 0,
      message: state.videoFactoryState?.cutMessage ?? '',
      status: state.videoFactoryState?.cutStatus,
    }))
  );
};

/**
 * Get post-production progress and message (Isolated)
 */
export const usePostProdProgress = () => {
  return useVideoFactoryStore(
    useShallow((state) => ({
      progress: state.videoFactoryState?.postProdProgress ?? 0,
      message: state.videoFactoryState?.postProdMessage ?? '',
      status: state.videoFactoryState?.postProdStatus,
    }))
  );
};

