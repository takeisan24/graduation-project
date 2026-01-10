/**
 * Videos Page - Video Factory Store
 * 
 * Manages video factory wizard state and actions
 */

import { create } from 'zustand';
import { toast } from 'sonner';
import { createInitialVideoFactoryState } from '../shared/utils';
import { VIDEO_ERRORS, GENERIC_ERRORS, CREDIT_ERRORS } from '@/lib/messages/errors';
import type { VideoFactoryState as VideoFactoryStateType, VideoFactoryStep, VideoSourceConfig, VideoCutConfig, PostProductionConfig, VideoProject, VideoFactoryClipDTO } from '../shared/types';
import type { GeneratedVideoClip } from '@/lib/types/video';
import { supabaseClient } from '@/lib/supabaseClient';
import { handleUnauthorizedOnClient } from '@/lib/utils/authClient';
import { useVideoProjectsStore } from './videosPageStore';
import { useCreditsStore } from '../shared/credits';
import { useLimitExceededModalStore } from '../shared/limitExceededModal';
import { splitVideoFactoryCredits } from '@/lib/utils/videoUtils';
import { saveToLocalStorage, getVideoProjectsKey } from '@/lib/utils/storage';

// ✅ Helper function for development-only logging
// ✅ Helper function for development-only logging
const devLog = (...args: any[]) => {
  // SILENCED: if (process.env.NODE_ENV === 'development') { console.log(...args); }
};

const devWarn = (...args: any[]) => {
  // SILENCED: if (process.env.NODE_ENV === 'development') { console.warn(...args); }
};

// ✅ REMOVED: fetchThumbnailPresignedUrl helper function
// Server B now bulk signs URLs and returns them in API response
// FE uses thumbnailUrl and url directly from API, no need to fetch presigned URLs individually

interface VideoFactoryModalState {
  // State
  isVideoFactoryOpen: boolean;
  videoFactoryState: VideoFactoryStateType | null;

  // Actions
  openVideoFactory: () => void;
  /**
   * ✅ PROJECT-CENTRIC: Open Video Factory Modal với project data
   * - Accepts projectId (preferred) or jobId (legacy)
   * - Fetch project details từ API (includes cut job, postprocess jobs, outputs)
   * - Extract generatedClips từ project response
   * - Set currentStep = 'postprocess' để hiển thị danh sách clips và tùy chọn hậu kỳ
   */
  openVideoFactoryWithJob: (projectIdOrJobId: string, isProjectId?: boolean) => Promise<void>;
  closeVideoFactory: () => void;
  setVideoFactoryStep: (step: VideoFactoryStep) => void;
  updateVideoFactorySource: (config: VideoSourceConfig) => void;
  updateVideoFactoryCut: (config: VideoCutConfig) => void;
  updateVideoFactoryPostProd: (config: PostProductionConfig) => void;
  updateSelectedClipKeys: (keys: string[]) => void;
  startVideoFactoryProcessing: () => Promise<void>;
  startVideoFactoryPostProcess: (selectedClipKeys: string[], config?: PostProductionConfig, selectedCutClipIds?: string[]) => Promise<void>;
  /**
   * Background polling API cho Video Factory job.
   * - Trả về isFinal + nextPollAfterSec để caller tự điều chỉnh nhịp poll và dừng đúng lúc.
   */
  pollVideoFactoryStatus: () => Promise<{ isFinal: boolean; nextPollAfterSec: number }>;
  connectSSE: (jobId: string) => () => void; // Connect to SSE stream, returns disconnect function
  resetVideoFactory: () => void;
  // ✅ SPLIT-SCREEN MODAL: Modal visibility actions
  toggleMainModal: (visible?: boolean) => void;
  toggleResultModal: (visible?: boolean) => void;
  // ✅ SPLIT-SCREEN MODAL: Add new postprocess job to history
  addPostProcessJob: (jobId: string, timestamp: string, selectedClipKeys: string[], config?: PostProductionConfig, selectedCutClipIds?: string[]) => void;
  // ✅ SPLIT-SCREEN MODAL: Update postprocess job in history
  updatePostProcessJob: (jobId: string, updates: Partial<{
    status: 'processing' | 'completed' | 'failed';
    clips: Array<{
      id: string;
      title?: string;
      name?: string;
      url?: string;
      thumbnailUrl?: string;
      duration?: number;
      startTime?: number;
      endTime?: number;
      clipStatus?: 'PROCESSING' | 'READY' | 'FAILED' | 'DONE';
      /** BE trả về clipStatus + status; FE dùng clipStatus */
      status?: string;
      /** BE trả về finalVideoUrl; FE dùng url */
      finalVideoUrl?: string;
      createdAt?: string;
      originalClipId?: string;
      originalClipKey?: string;
      /** BE trả về index để ghép đúng slot skeleton (postprocess) */
      index?: number;
    }>;
    progress?: number;
    progressMessage?: string;
    jobId?: string;        // ✅ NEW: Allow updating jobId (for retry with new job)
    errorMessage?: string; // ✅ NEW: Error message for failed jobs
    errorCode?: string;    // ✅ NEW: Error code for specific handling
  }>) => void;
  // ✅ NEW: Safety net polling
  pollMediaAssetsFallback: () => Promise<void>;
}

// Helper function to simulate processing
async function simulateProcessing(
  onProgress: (progress: number, message: string) => void,
  messages: string[],
  totalDuration: number
) {
  const steps = messages.length;
  const stepDuration = totalDuration / steps;

  for (let i = 0; i < steps; i++) {
    await new Promise(resolve => setTimeout(resolve, stepDuration));
    const progress = Math.round(((i + 1) / steps) * 100);
    onProgress(progress, messages[i]);
  }
}

export const useVideoFactoryStore = create<VideoFactoryModalState>((set, get) => ({
  // Initial state
  isVideoFactoryOpen: false,
  videoFactoryState: null,

  openVideoFactory: () => set({
    isVideoFactoryOpen: true,
    videoFactoryState: {
      ...createInitialVideoFactoryState(),
      warnings: [],
      lastErrorMessage: undefined,
      // ✅ IDEMPOTENCY: Generate unique requestId to prevent orphaned jobs from network errors
      requestId: crypto.randomUUID(),
    }
  }),

  /**
   * ✅ PROJECT-CENTRIC: Open Video Factory Modal với project data
   * - Accepts projectId (preferred) or jobId (legacy)
   * - Fetch project details từ API (includes cut job, postprocess jobs, outputs)
   * - Extract generatedClips từ project response
   * - Set currentStep = 'postprocess' để hiển thị danh sách clips và tùy chọn hậu kỳ
   */
  openVideoFactoryWithJob: async (projectIdOrJobId: string, isProjectId: boolean = false) => {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Unauthorized');
      }

      // ✅ PROJECT-CENTRIC: Determine if we should use project endpoint or job endpoint
      const cacheBuster = `_t=${Date.now()}`;
      let res: Response;
      let json: any;

      if (isProjectId) {
        // ✅ NEW: Use project endpoint to get comprehensive project details
        devLog('[openVideoFactoryWithJob] Fetching project details', {
          projectId: projectIdOrJobId,
          timestamp: Date.now(),
          caller: 'openVideoFactoryWithJob'
        });
        res = await fetch(`/api/video-factory/projects/${projectIdOrJobId}?${cacheBuster}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: 'include',
        });
      } else {
        // ✅ LEGACY: Use job endpoint (backward compatibility)
        devLog('[openVideoFactoryWithJob] Fetching job details (legacy)', {
          jobId: projectIdOrJobId,
          timestamp: Date.now(),
          caller: 'openVideoFactoryWithJob'
        });
        res = await fetch(`/api/video-factory/jobs/${projectIdOrJobId}?${cacheBuster}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: 'include',
        });
      }

      // ✅ CRITICAL FIX: Better error handling for JSON parsing
      try {
        json = await res.json();
      } catch (parseError) {
        /* SILENCED
        console.error('[openVideoFactoryWithJob] Failed to parse JSON response', {
          status: res.status,
          statusText: res.statusText,
          parseError,
        });
        */
        throw new Error(`Failed to parse response: ${res.status} ${res.statusText}`);
      }

      // ✅ DEBUG: Log response structure
      devLog('[openVideoFactoryWithJob] API response', {
        status: res.status,
        ok: res.ok,
        hasSuccess: !!json?.success,
        hasData: !!json?.data,
        dataKeys: json?.data ? Object.keys(json.data) : [],
        jobKeys: json?.data?.job ? Object.keys(json.data.job) : [],
        // ✅ DEBUG: Log full response structure
        jsonStructure: JSON.stringify(json, null, 2).substring(0, 2000), // First 2000 chars
      });

      if (!res.ok) {
        const errorMsg = json?.error || json?.message || `HTTP ${res.status}: ${res.statusText}`;
        /* SILENCED
        console.error('[openVideoFactoryWithJob] API error', {
          status: res.status,
          error: errorMsg,
          json,
        });
        */
        throw new Error(errorMsg);
      }

      if (!json?.success) {
        const errorMsg = json?.error || json?.message || 'API returned success=false';
        /* SILENCED
        console.error('[openVideoFactoryWithJob] API returned success=false', {
          error: errorMsg,
          json,
        });
        */
        throw new Error(errorMsg);
      }

      // ✅ PROJECT-CENTRIC: Parse response structure correctly
      // Project endpoint returns: { success: true, data: { project: {...}, cutJob: {...}, postprocessJobs: [...], postprocessOutputs: [...] } }
      // Job endpoint returns: { success: true, data: { job: {...}, steps: [...], project: {...}, clips: [...] } }
      const responseData = json?.data || json || {}; // ✅ FIX: Ensure responseData is never null

      let job: any;
      let steps: any[] = [];
      let project: any;
      // ✅ DATA SEPARATION (CRITICAL):
      // - Project endpoint may include `data.clips` for *postprocess outputs* (not cut clips).
      // - Job endpoint (cut job) historically uses `data.clips` for cut clips.
      // So for project view, NEVER trust `data.clips` as cut clips.
      let topLevelClips: any[] = isProjectId
        ? (responseData?.outputClips || responseData?.output_clips || [])
        : (responseData?.clips || responseData?.outputClips || responseData?.output_clips || []);
      let actualJobId: string | undefined;
      let cutJob: any; // ✅ FIX: Declare cutJob in outer scope
      let historyData: any[] = []; // ✅ FIX: Declare historyData in outer scope
      let activeJob: any = null; // ✅ BACKGROUND PROCESSING: Declare activeJob in outer scope for recovery logic

      // ✅ CRITICAL FIX: Get existing jobId from state BEFORE processing API response
      // This prevents losing jobId when API returns null (race condition: worker hasn't updated currentCutJobId yet)
      // ✅ FIX: Declare existingJobId in outer scope so it's accessible in both if/else branches
      const existingState = get().videoFactoryState;
      const existingJobId = existingState?.jobId; // ✅ Preserve existing jobId

      if (isProjectId) {
        // ✅ PROJECT-CENTRIC: Parse project endpoint response
        project = responseData?.project || responseData;
        cutJob = responseData?.cutJob || null; // ✅ FIX: Explicitly set to null if not found
        job = cutJob || null; // ✅ FIX: Use cutJob, but handle null case

        // ✅ BACKGROUND PROCESSING: Check for activeJob (current processing job) for auto-recovery
        activeJob = responseData?.activeJob || null;
        if (activeJob && (activeJob.status === 'processing' || activeJob.status === 'queued')) {
          // Active job found - use it for SSE connection
          devLog('[openVideoFactoryWithJob] Found active processing job - auto-recovering', {
            activeJobId: activeJob.id,
            status: activeJob.status,
            progress: activeJob.progress,
            currentStep: activeJob.currentStep,
            jobSubtype: activeJob.jobSubtype,
            hint: 'User closed browser/tab - auto-recovering to active job',
          });

          // Use activeJob for SSE connection
          actualJobId = activeJob.id;

          // Update job reference to activeJob
          job = {
            id: activeJob.id,
            status: activeJob.status,
            progress: activeJob.progress,
            progress_message: activeJob.progressMessage,
          };
        } else {
          // ✅ CRITICAL FIX: actualJobId should be cutJob.id or project.current_cut_job_id, NEVER projectIdOrJobId (project ID)
          // ✅ CRITICAL FIX: If API returns null (race condition), preserve existing jobId to prevent SSE disconnection
          const apiCutJobId = cutJob?.id || project?.current_cut_job_id || project?.currentCutJobId || null;
          actualJobId = apiCutJobId || existingJobId || undefined; // ✅ Preserve existing jobId if API returns null

          // ✅ DEBUG: Log if we're preserving existing jobId due to API returning null
          if (!apiCutJobId && existingJobId) {
            devLog('[openVideoFactoryWithJob] API returned null currentCutJobId - preserving existing jobId', {
              projectId: projectIdOrJobId,
              existingJobId,
              apiCutJobId: null,
              cutJobId: cutJob?.id,
              currentCutJobId: project?.current_cut_job_id || project?.currentCutJobId,
              hint: 'Race condition: Worker may not have updated currentCutJobId yet. Preserving existing jobId to maintain SSE connection.',
            });
          }
        }

        // ✅ CRITICAL FIX: Verify actualJobId is not the project ID (defense-in-depth)
        if (actualJobId === projectIdOrJobId && projectIdOrJobId) {
          console.warn('[openVideoFactoryWithJob] actualJobId matches projectId - this should not happen', {
            projectId: projectIdOrJobId,
            actualJobId,
            cutJobId: cutJob?.id,
            currentCutJobId: project?.current_cut_job_id || project?.currentCutJobId,
            hint: 'actualJobId should be cut job ID, not project ID. Setting to undefined to prevent errors.',
          });
          actualJobId = undefined; // ✅ Prevent using project ID as job ID
        }

        // Extract clips from top-level response or project sub-object
        // ✅ CRITICAL FIX: In handleProjectDetails API, clips are at TOP LEVEL (responseData.clips), NOT inside project object
        // We already initialized topLevelClips above from responseData.clips
        const projectOutputClips = topLevelClips.length > 0 ? topLevelClips : (project?.outputClips || project?.output_clips || []);
        topLevelClips = Array.isArray(projectOutputClips) ? projectOutputClips : [];

        // ✅ CRITICAL FIX: Extract steps from cutJob.steps SAFELY
        // Backend can return:
        // - Array: [{ name, status, output, ... }, ...]
        // - Object: { cut: { status, output }, ingest: { status, output }, ... }
        // Note: Arrays are also typeof 'object', so we MUST check Array.isArray first.
        if (Array.isArray(cutJob?.steps)) {
          steps = cutJob.steps;
        } else if (cutJob?.steps && typeof cutJob.steps === 'object') {
          steps = Object.entries(cutJob.steps).map(([stepName, stepState]: [string, any]) => ({
            name: stepName,
            status: stepState?.status || 'pending',
            output: stepState?.output || null,
          }));
        } else if (cutJob && Array.isArray(responseData?.steps)) {
          // ✅ FALLBACK: If cutJob exists but steps is not in cutJob.steps, try responseData.steps
          steps = responseData.steps;
        }

        if (!project) {
          // SILENCED: console.error('[openVideoFactoryWithJob] No project found in response', { json });
          throw new Error('Project không tồn tại trong response');
        }

        // ✅ FIX: Handle case where cutJob is null (project exists but no cut job yet)
        if (!cutJob) {
          // SILENCED: console.warn('[openVideoFactoryWithJob] Project found but no cut job yet', {
          //   projectId: project.id,
          //   currentCutJobId: project.current_cut_job_id,
          //   actualJobId,
          //   hint: 'Project exists but cut job may not be created yet or is still processing',
          // });
        }

        // ✅ DATA SEPARATION: Use structured history from backend
        // Backend now returns structured postprocessHistory: Array<{ jobId, status, clips: [...], config, createdAt }>
        // This is the authoritative source for "Kho Thành Phẩm" (Panel B)
        const rawHistory = responseData.postprocessHistory || [];
        const rawOutputs = responseData.postprocessOutputs || responseData.outputs || [];

        /**
         * ✅ CRITICAL: Normalize & dedupe postprocess clips from backend.
         *
         * Backend can transiently return duplicated clip IDs / wrong `index` due to race conditions
         * when it merges Media Library assets + output rows. FE must be defensive.
         *
         * FE invariants (per postprocess job):
         * - Each clip slot (clipIndex) must be unique.
         * - Prefer the best record (has video URL + thumbnail) for the same slot.
         */
        const getStablePostprocessClipIndex = (c: any, fallback: number): number => {
          const meta = c?.metadata || {};
          const raw =
            c?.clipIndex ??
            c?.clip_index ??
            c?.index ??
            meta?.clipIndex ??
            meta?.clip_index ??
            meta?.index;

          if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
          if (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))) return Number(raw);
          return fallback;
        };

        const dedupePostprocessClipsByIndex = (clips: any[]): any[] => {
          const score = (clip: any): number => {
            const hasVideo = !!clip?.url;
            const hasThumb = !!(clip?.thumbnailUrl || clip?.thumbnail);
            const status = String(clip?.status || '').toUpperCase();
            return (hasVideo ? 10 : 0) + (hasThumb ? 5 : 0) + (status === 'DONE' ? 3 : status === 'FAILED' ? 2 : 0);
          };

          const bestByIndex = new Map<number, any>();
          for (const clip of clips || []) {
            const idx = getStablePostprocessClipIndex(clip, -1);
            const prev = bestByIndex.get(idx);
            if (!prev || score(clip) > score(prev)) bestByIndex.set(idx, clip);
          }

          return Array.from(bestByIndex.entries())
            .filter(([idx]) => idx >= 0)
            .sort(([a], [b]) => a - b)
            .map(([, clip]) => clip);
        };

        // Initialize history map from rawHistory
        const historyMap = new Map<string, any>();
        const oldHistory = existingState?.postProcessHistory || [];

        rawHistory.forEach((h: any) => {
          const jobId = h.id || h.jobId;
          const oldJob = oldHistory.find(oh => oh.jobId === jobId);

          // ✅ PRESERVE METADATA: If backend is missing fields, keep what we have locally
          const selectedClipKeys = h.selectedClipKeys || h.selected_clip_keys || oldJob?.selectedClipKeys || [];
          const config = h.config || h.postprod_config || oldJob?.config;

          const backendClips = (h.clips || []).map((c: any, idx: number) => {
            const url = c.url;
            const thumb = c.thumbnailUrl || c.thumbnail;
            const hasVideo = !!url;
            const hasThumb = !!thumb;
            const rawStatus = (c.clipStatus || c.status_clip || c.status || 'PROCESSING').toUpperCase();

            // ✅ INVARIANT: Clip chỉ DONE khi có cả video + thumbnail
            let mappedStatus: 'DONE' | 'PROCESSING' | 'FAILED';
            if (rawStatus === 'FAILED') {
              mappedStatus = 'FAILED';
            } else if (hasVideo && hasThumb && (rawStatus === 'READY' || rawStatus === 'DONE' || rawStatus === 'COMPLETED' || !rawStatus)) {
              mappedStatus = 'DONE';
            } else {
              mappedStatus = 'PROCESSING';
            }

            return {
              id: c.id,
              title: c.title,
              index: getStablePostprocessClipIndex(c, c.index ?? idx),
              url,
              thumbnailUrl: thumb,
              duration: c.duration,
              status: mappedStatus,
              createdAt: c.createdAt,
              metadata: c.metadata,
              originalClipId: c.originalClipId || c.id, 
              originalClipKey: c.originalClipKey || c.storageKey || c.key,
            };
          });

          // ✅ CRITICAL MERGE: If backend returns 0 clips (e.g. job just started), keep placeholders from local state
          const mergedClips = dedupePostprocessClipsByIndex([
            ...(oldJob?.clips || []).filter(c => !c.url), // Keep local skeletons
            ...backendClips                              // Add backend data (replaces skeletons via dedupe)
          ]);

          historyMap.set(jobId, {
            jobId: jobId,
            createdAt: h.createdAt || h.created_at || oldJob?.createdAt,
            status: h.status === 'completed' ? 'completed' : (h.status === 'failed' ? 'failed' : 'processing'),
            clips: mergedClips,
            config,
            selectedClipKeys
          });
        });

        // ✅ CRITICAL FIX: Merge rawOutputs into history
        // This handles 3 cases:
        // 1. History exists but clips are missing (data integrity issue or different API response format)
        // 2. History missing (fallback mode)
        // 3. New outputs that aren't yet in history (race condition)
        if (Array.isArray(rawOutputs) && rawOutputs.length > 0) {
          devLog('[openVideoFactoryWithJob] Merging postprocessOutputs into history', {
            historyCount: historyMap.size,
            outputsCount: rawOutputs.length,
          });

          rawOutputs.forEach((output: any) => {
            // Determine which job this output belongs to
            // Priority: postprocessJobId > metadata.postprocessJobId > jobId
            let targetJobId = output.postprocessJobId ||
              output.postprocess_job_id ||
              output.metadata?.postprocessJobId ||
              output.jobId ||
              output.job_id;

            // Heuristic: If we have exactly one history item and targetJobId is null/missing,
            // assume this output belongs to that history item
            if (!targetJobId && historyMap.size === 1) {
              targetJobId = historyMap.keys().next().value;
              devLog('[openVideoFactoryWithJob] precise linking failed, using heuristic linking', {
                targetJobId,
                outputId: output.id
              });
            } else if (!targetJobId) {
              targetJobId = 'legacy-group';
            }

            // Get or create history entry
            if (!historyMap.has(targetJobId)) {
              // Create new entry (fallback for missing history)
              const createdAt = output.createdAt || output.created_at || new Date().toISOString();
              // Try to find config from project if this is a legacy group
              const config = targetJobId === 'legacy-group'
                ? (project?.postprod_config || project?.postprodConfig)
                : undefined;

              historyMap.set(targetJobId, {
                jobId: targetJobId === 'legacy-group' ? `legacy-${Date.now()}` : targetJobId,
                createdAt: createdAt,
                status: 'completed', // Assume completed if we have output
                clips: [],
                config: config,
                selectedClipKeys: []
              });
            }

            const historyItem = historyMap.get(targetJobId);

            // Deduplicate: Check if clip already exists in this history item
            // Check by ID or URL
            const exists = historyItem.clips.some((c: any) =>
              c.id === output.id ||
              (c.url && output.finalVideoUrl && c.url === output.finalVideoUrl)
            );

            if (!exists) {
              const clipUrl = output.finalVideoUrl || output.url || output.public_url || output.final_video_url; // Handle various casings
              const clipThumb = output.thumbnailUrl || output.thumbnail_url || output.thumbnail;
              const hasVideo = !!clipUrl;
              const hasThumb = !!clipThumb;
              const rawStatus = (output.clipStatus || output.status_clip || output.status || 'PROCESSING').toUpperCase();

              // ✅ INVARIANT: Clip chỉ DONE khi có cả video + thumbnail
              let mappedStatus: 'DONE' | 'PROCESSING' | 'FAILED';
              if (rawStatus === 'FAILED') {
                mappedStatus = 'FAILED';
              } else if (hasVideo && hasThumb && (rawStatus === 'READY' || rawStatus === 'DONE' || rawStatus === 'COMPLETED' || !rawStatus)) {
                mappedStatus = 'DONE';
              } else {
                mappedStatus = 'PROCESSING';
              }

              historyItem.clips.push({
                id: output.id,
                title: output.title,
                index: output.index,
                url: clipUrl,
                thumbnailUrl: clipThumb,
                duration: output.duration,
                status: mappedStatus,
                createdAt: output.createdAt || output.created_at
              });
            }
          });
        }

        // Convert map back to array
        historyData = Array.from(historyMap.values());

        // Sort history entries by createdAt desc
        historyData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        devLog('[openVideoFactoryWithJob] Finalized history data', {
          count: historyData.length,
          totalClips: historyData.reduce((acc, h) => acc + h.clips.length, 0),
          firstJobId: historyData[0]?.jobId,
        });
      } else {
        // ✅ LEGACY: Parse job endpoint response
        job = responseData?.job || responseData;
        steps = responseData?.steps || []; // ✅ CRITICAL: steps is an array, not job.steps
        project = responseData?.project;
        topLevelClips = responseData?.clips || [];
        actualJobId = projectIdOrJobId;

        if (!job) {
          // SILENCED: console.error('[openVideoFactoryWithJob] No job found in response', { json });
          throw new Error('Job không tồn tại trong response');
        }

        // ✅ CRITICAL FIX: Verify jobId match (defense-in-depth)
        // Backend should return job with matching id, but we verify to prevent bugs
        const responseJobId = job.id || job.jobId || job.job_id;
        if (responseJobId && responseJobId !== actualJobId) {
          /* SILENCED
          console.error('[openVideoFactoryWithJob] JobId mismatch - backend returned wrong job', {
            requestedJobId: actualJobId,
            responseJobId,
            jobIdFromJob: job.id,
            jobIdFromJobId: job.jobId,
            jobIdFromJob_id: job.job_id,
            hint: 'This is a backend bug - jobId in response does not match requested jobId',
          });
          */
          throw new Error(`JobId mismatch: requested ${actualJobId}, got ${responseJobId}`);
        }
      }

      // ✅ CRITICAL FIX: Find cut step before using it (only if steps array is not empty)
      const cutStep = Array.isArray(steps) && steps.length > 0
        ? steps.find((s: any) => s.name === 'cut')
        : null;

      // ✅ PRODUCTION FIX: Extract expectedClipCount from API response
      // Backend returns expectedClipCount to indicate how many clips user originally selected
      // FE MUST render based on expectedClipCount (slot-based), not clips.length
      // ✅ CRITICAL: expectedClipCount should reflect CUT clips (source clips), not postprocess outputs.
      const expectedClipCount = responseData?.expectedClipCount ||
        (cutStep?.output as any)?.expectedClipCount ||
        // Project config (source of truth for how many clips user requested)
        (project?.cutConfig?.auto?.clip_count ?? project?.cutConfig?.auto?.clipCount) ||
        // Fallback to cut step clips length if present
        (((cutStep?.output as any)?.clips || (cutStep?.output as any)?.segments || [])?.length ?? 0) ||
        // Job endpoint only (non-project): may still provide top-level cut clips
        (!isProjectId ? topLevelClips.length : 0) ||
        0;

      // ✅ CRITICAL DEBUG: Log response structure with detailed clips info
      const topLevelClipsIndices = Array.isArray(topLevelClips)
        ? topLevelClips.map((c: any) => c.index).filter((idx: any) => idx !== undefined && idx !== null)
        : [];
      // ✅ FIX: Support both camelCase and snake_case
      const projectOutputClips = project?.outputClips || project?.output_clips || [];
      const projectClipsIndices = Array.isArray(projectOutputClips) && projectOutputClips.length > 0
        ? projectOutputClips.map((c: any) => c.index).filter((idx: any) => idx !== undefined && idx !== null)
        : [];
      const topLevelClipsDetails = Array.isArray(topLevelClips) && topLevelClips.length > 0
        ? topLevelClips.map((c: any) => ({
          index: c.index,
          id: c.id,
          clipId: c.clipId,
          status: c.status,
          hasStorageKey: !!(c.storageKey || c.key),
          hasUrl: !!(c.publicUrl || c.url),
        }))
        : [];
      const projectClipsDetails = Array.isArray(projectOutputClips) && projectOutputClips.length > 0
        ? projectOutputClips.map((c: any) => ({
          index: c.index,
          id: c.id,
          clipId: c.clipId,
          status: c.status,
          hasStorageKey: !!(c.storageKey || c.key),
          hasUrl: !!(c.publicUrl || c.url),
        }))
        : [];

      devLog('[openVideoFactoryWithJob] Response structure (FE receiving data from API)', {
        projectId: projectIdOrJobId, // ✅ Log projectId for debugging
        isProjectId, // ✅ Log whether this is a project ID
        jobId: job?.id || actualJobId || undefined, // ✅ FIX: Use optional chaining and fallback to undefined
        hasJob: !!job, // ✅ Log whether job exists
        hasCutJob: !!cutJob, // ✅ Log whether cutJob exists
        actualJobId: actualJobId || undefined, // ✅ Log actualJobId (should be cut job ID, not project ID)
        hasSteps: Array.isArray(steps) && steps.length > 0,
        stepsCount: steps.length,
        stepNames: steps.map((s: any) => s.name),
        hasProject: !!project,
        hasTopLevelClips: Array.isArray(topLevelClips) && topLevelClips.length > 0,
        topLevelClipsCount: topLevelClips.length,
        topLevelClipsIndices,
        topLevelClipsDetails,
        projectClipsCount: (project?.outputClips || project?.output_clips || [])?.length || 0, // ✅ FIX: Support both camelCase and snake_case
        projectClipsIndices,
        projectClipsDetails,
        expectedClipCount, // ✅ PRODUCTION FIX: Log expectedClipCount
        match: (topLevelClips.length === expectedClipCount || projectClipsDetails.length === expectedClipCount),
        hint: (topLevelClips.length !== expectedClipCount && projectClipsDetails.length !== expectedClipCount)
          ? `WARNING: Received ${topLevelClips.length || projectClipsDetails.length} clips but expected ${expectedClipCount}. Check API response.`
          : `Received ${topLevelClips.length || projectClipsDetails.length} clips (matches expected ${expectedClipCount}).`,
        // ✅ DEBUG: Log full response structure for debugging
        responseDataKeys: Object.keys(responseData || {}),
        jobKeys: job ? Object.keys(job) : [], // ✅ FIX: Handle null job
        cutJobKeys: cutJob ? Object.keys(cutJob) : [], // ✅ NEW: Log cutJob keys
        stepsIsArray: Array.isArray(steps),
        stepsFirstItem: steps[0],
      });

      // ✅ CRITICAL FIX: Extract generatedClips (CUT clips) with strict separation.
      // IMPORTANT:
      // - `generatedClips` = CUT clips (Nguyên liệu) only.
      // - Postprocess outputs belong to `postProcessHistory` (Kho thành phẩm), NOT here.
      let clipsArray: any[] = [];

      // ✅ Priority 1: Cut step output.clips (authoritative for cut clips)
      const cutOutput = cutStep?.output as any;
      const cutOutputClipsArray = Array.isArray(cutOutput?.clips)
        ? cutOutput.clips
        : Array.isArray(cutOutput?.segments)
          ? cutOutput.segments
          : [];

      // ✅ Priority 2: cut_state.clips (physical cut files) if available
      const cutStateClips = project?.cut_state?.clips || cutJob?.cut_state?.clips || [];
      // ✅ Priority 3: cutJob.outputClips (legacy)
      const cutJobOutputClipsArray = cutJob?.outputClips || cutJob?.output_clips || [];

      // ✅ Priority 4: top-level clips ONLY for Job endpoint (cut job view)
      const canUseTopLevelClipsAsCut = !isProjectId && Array.isArray(topLevelClips) && topLevelClips.length > 0;

      if (Array.isArray(cutOutputClipsArray) && cutOutputClipsArray.length > 0) {
        clipsArray = cutOutputClipsArray;
        devLog('[openVideoFactoryWithJob] ✅ Using cut step output.clips (PRIORITY 1)', {
          count: clipsArray.length,
          hint: 'Using cut step output as authoritative cut clips list',
        });
      } else if (Array.isArray(cutStateClips) && cutStateClips.length > 0) {
        clipsArray = cutStateClips;
        devLog('[openVideoFactoryWithJob] ✅ Using cut_state.clips (PRIORITY 2 - physical files)', {
          count: clipsArray.length,
          hint: 'Using physical cut clips (Source-Based Rendering)',
        });
      } else if (Array.isArray(cutJobOutputClipsArray) && cutJobOutputClipsArray.length > 0) {
        clipsArray = cutJobOutputClipsArray;
        devLog('[openVideoFactoryWithJob] Using cutJob.outputClips (PRIORITY 3 - legacy)', {
          count: clipsArray.length,
        });
      } else if (canUseTopLevelClipsAsCut) {
        clipsArray = topLevelClips;
        devLog('[openVideoFactoryWithJob] Using top-level clips (PRIORITY 4 - job endpoint only)', {
          count: clipsArray.length,
        });
      } else {
        // No clips found - log warning but continue
        devLog('[openVideoFactoryWithJob] ⚠️ No clips found in any source', {
          hasProject: !!project,
          hasCutJob: !!cutJob,
          cutJobOutputClipsCount: cutJobOutputClipsArray.length,
          hasTopLevelClips: Array.isArray(topLevelClips) && topLevelClips.length > 0,
          hasCutStep: !!cutStep,
          hint: 'No clips found - project may not have cut job yet or clips are still processing',
        });
        clipsArray = [];
      }

      // ✅ CRITICAL DEBUG: Log clips extraction with detailed info
      const clipsArrayIndices = clipsArray.map((c: any) => c.index).filter((idx: any) => idx !== undefined && idx !== null);
      const clipsArrayDetails = clipsArray.map((c: any) => ({
        index: c.index,
        id: c.id,
        clipId: c.clipId,
        status: c.status,
        hasStorageKey: !!(c.storageKey || c.key),
        hasUrl: !!(c.publicUrl || c.url),
        hasThumbnail: !!(c.thumbnailUrl || c.thumbnail),
        storageKey: c.storageKey || c.key || null,
      }));

      devLog('[openVideoFactoryWithJob] Extracting clips (FE processing API response)', {
        requestedJobId: actualJobId, // ✅ FIX: Use actualJobId instead of undefined jobId
        clipsArrayLength: clipsArray.length,
        clipsArrayIndices,
        clipsArrayDetails,
        expectedClipCount,
        match: clipsArray.length === expectedClipCount,
        hint: clipsArray.length !== expectedClipCount
          ? `WARNING: Extracted ${clipsArray.length} clips but expected ${expectedClipCount}. Check API response and extraction logic.`
          : `Extracted ${clipsArray.length} clips (matches expected ${expectedClipCount}).`,
      });

      // ✅ CRITICAL FIX: Filter clips by jobId to prevent mixing clips from different jobs
      // Backend should only return clips for the requested jobId, but we add defense-in-depth validation
      // ✅ RELAXED FILTER for Project View: 
      // If we are viewing a Project (isProjectId=true), we want to see the project's clips 
      // regardless of whether they match the "current" cut job ID.
      // This handles cases where:
      // 1. Clips are from an older successful job (Job A), but currentCutJobId is a new failed/processing job (Job B).
      // 2. We want to show the current valid assets of the project.
      //
      // ✅ CRITICAL (Bug Fix):
      // When we "force refresh" after a POSTPROCESS SSE step completes, FE may call this function with a *postprocess jobId*.
      // In that case `actualJobId` can refer to the postprocess job, but `generatedClips` must still be the CUT clips.
      // So we derive a cutJobId candidate from the project/job and use it for filtering cut clips.
      const existingCutJobId = (existingState as any)?.cutJobId as string | undefined;
      const cutJobIdForCutList: string | undefined =
        // Project always knows its cut job (source of truth)
        (project as any)?.current_cut_job_id ||
        (project as any)?.currentCutJobId ||
        // Some job payloads include it in input_data
        (job as any)?.inputData?.cutJobId ||
        (job as any)?.input_data?.cutJobId ||
        (job as any)?.inputData?.cut_job_id ||
        (job as any)?.input_data?.cut_job_id ||
        (job as any)?.inputData?.sourceJobId ||
        (job as any)?.input_data?.sourceJobId ||
        existingCutJobId ||
        actualJobId; // last resort (legacy)

      const filteredClipsArray = clipsArray.filter((c: any) => {
          const clipJobId = c.jobId || c.job_id;

          // If clip has a jobId, it must match the requested jobId
          // If clip doesn't have a jobId, we assume it belongs to the requested job (backward compatibility)
          // ✅ STRICT SEPARATION: generatedClips must ONLY contain CUT clips (source for post-processing)
          // Post-processed clips belong in postProcessHistory ("Kho thành phẩm")
          // STRICTLY EXCLUDE any clip that looks like a post-process output
          const isPostProcess = c.metadata?.step === 'postprocess' ||
            c.metadata?.source === 'broll_mux' ||
            c.metadata?.jobType === 'broll_mux' ||
            c.metadata?.postprocessJobId ||
            c.postprocessJobId ||
            c.postprocess_job_id;

          if (isPostProcess) {
            devLog('[openVideoFactoryWithJob] Excluding post-process clip from Cut list', {
              clipId: c.id,
              type: c.metadata?.source || c.metadata?.step,
              clipJobId,
              cutJobId: cutJobIdForCutList
            });
            return false;
          }

          // ✅ CUT LIST INVARIANT:
          // If the clip carries a jobId, it MUST match the CUT jobId (not the postprocess jobId).
          if (cutJobIdForCutList && clipJobId && clipJobId !== cutJobIdForCutList) {
            devWarn('[openVideoFactoryWithJob] Filtering out clip from different job', {
              requestedJobId: cutJobIdForCutList,
              clipJobId,
              clipId: c.id,
              clipIndex: c.index,
              hint: 'This clip belongs to a different job and will be excluded',
            });
            return false;
          }
          return true;
        });

      if (filteredClipsArray.length !== clipsArray.length) {
        devWarn('[openVideoFactoryWithJob] Filtered clips by jobId', {
          requestedJobId: actualJobId, // ✅ FIX: Use actualJobId instead of undefined jobId
          originalCount: clipsArray.length,
          filteredCount: filteredClipsArray.length,
          filteredOut: clipsArray.length - filteredClipsArray.length,
          hint: 'Some clips were filtered out because they belong to a different job',
        });
      }

      // map clips từ backend format sang FE format using Standardized DTO
      const generatedClips = (filteredClipsArray as unknown as VideoFactoryClipDTO[]).map((c: VideoFactoryClipDTO, idx: number) => {
        // ✅ CRITICAL FIX: Prioritize videoUrl (from cut_state) then publicUrl/url
        const clipUrl = c.videoUrl || c.publicUrl || c.url || undefined;

        // ✅ BUG B FIX: Extract thumbnailKey with strict validation - NEVER allow .mp4
        // Helper to derive thumbnail key from video key
        const deriveThumbnailKeyFromVideoKey = (videoKey: string): string => {
          // Pattern: video_16x9_0.mp4 → video_16x9_0_thumb.0000001.jpg
          // ✅ FIX: Use _thumb.0000001.jpg to match MediaConvert defaults
          return videoKey.replace(/\.(mp4|webm|mov|avi|mkv)$/i, '_thumb.0000001.jpg');
        };

        // ✅ BUG B FIX: Get thumbnail key with strict validation
        let thumbnailKey: string | undefined = undefined;

        // Priority 1: Use thumbnailKey from backend if it's a valid image key
        const candidateKey = c.thumbnailKey || c.thumbnail_key;
        if (candidateKey && candidateKey.match(/\.(jpg|jpeg|png|webp)$/i)) {
          thumbnailKey = candidateKey;
        } else {
          // ❌ BUG B: Backend sent invalid thumbnailKey (e.g., .mp4) - derive from video key instead
          devWarn('[openVideoFactoryWithJob] Invalid thumbnailKey from backend (not image extension)', {
            invalidThumbnailKey: candidateKey,
            clipIndex: c.index ?? idx,
            hint: 'Backend sent thumbnailKey that is not an image. Deriving from video key instead.',
          });
        }

        // Priority 2: Derive from storageKey (video key) if thumbnailKey is invalid or missing
        // ✅ FIX: Check also videoKey (from cut_state)
        const videoKey = c.videoKey || c.storageKey || c.key || c.storage_key;
        if (!thumbnailKey && videoKey && videoKey.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
          thumbnailKey = deriveThumbnailKeyFromVideoKey(videoKey);
        }

        // ✅ OPTIMIZATION: Use thumbnailUrl directly from API (Server B bulk signs URLs)
        // Server B now returns thumbnailUrl pre-signed, so we use it directly instead of Asset Gateway
        // Fallback to Asset Gateway only if thumbnailUrl is missing
        const thumbnailUrl = c.thumbnailUrl || c.thumbnail_url || c.thumbnail || undefined;
        const startTime = c.startTime ?? c.start ?? c.start_time ?? 0;
        const endTime = c.endTime ?? c.end ?? c.end_time ?? 0;
        const durationSeconds = c.duration ?? (endTime > startTime ? endTime - startTime : 0);
        const durationFormatted = durationSeconds > 0 ? `${Math.round(durationSeconds)}s` : '';

        // ✅ CRITICAL FIX: Extract asset IDs for Asset Gateway pattern
        // Backend now sends thumbnailAssetId and videoAssetId, but we can derive them if missing
        // Use actualJobId from function scope (reliable source) instead of c.jobId (may be missing)
        const clipJobId = c.jobId || actualJobId; // Prefer c.jobId, fallback to actualJobId
        const clipIndex = c.index ?? idx;

        // ✅ FUTURE-PROOF FIX: Support both new format (clipId UUID) and old format (jobId-index)
        // Backend sends assetId in new format: clip-thumb:{clipId} (UUID)
        // But we also support old format: clip-thumb:{jobId}-{index} for backward compatibility
        const clipId = c.id || c.clipId; // ✅ NEW: Use id (UUID from cut_state) or clipId
        const hasThumbnailKey = !!(c.thumbnailKey || c.thumbnail_key || thumbnailKey);
        // ✅ FIX: Check videoKey too
        const hasVideoUrl = !!(clipUrl || c.videoKey || c.storageKey || c.key || c.storage_key);

        // Priority 1: Use assetId from backend (if provided)
        // Priority 2: Derive from clipId (UUID) - new format preferred
        // Priority 3: Derive from jobId-index - old format (backward compatibility)
        const thumbnailAssetId = c.thumbnailAssetId || c.thumbnail_asset_id ||
          (clipId && hasThumbnailKey ? `clip-thumb:${clipId}` : undefined) || // ✅ NEW: Use clipId (UUID)
          (clipJobId && clipIndex !== undefined && hasThumbnailKey ? `clip-thumb:${clipJobId}-${clipIndex}` : undefined); // ✅ LEGACY: Fallback to old format

        const videoAssetId = c.videoAssetId || c.video_asset_id ||
          (clipId && hasVideoUrl ? `clip-video:${clipId}` : undefined) || // ✅ NEW: Use clipId (UUID)
          (clipJobId && clipIndex !== undefined && hasVideoUrl ? `clip-video:${clipJobId}-${clipIndex}` : undefined); // ✅ LEGACY: Fallback to old format

        // ✅ PRODUCTION FIX: Extract status from backend - FE MUST check this before rendering
        // Status: 'READY' = file verified on S3 and ready for playback (FE can render)
        // Status: 'PROCESSING' = file may not exist yet (FE must show loading state)
        // Status: 'FAILED' = file verification failed after max retries (FE must show error state, no retry)
        // ✅ CRITICAL FIX: If clip has storageKey/key, it's likely READY (even if url is missing)
        // Backend may not always send publicUrl, but storageKey indicates the file exists on S3
        // ✅ CRITICAL FIX: Check tất cả các field có thể có (camelCase, snake_case, key, videoKey)
        const hasStorageKey = !!(c.videoKey || c.storageKey || c.key || c.storage_key);
        // ✅ CRITICAL FIX: Nếu status từ API là READY, luôn trust status đó (không override)
        // Chỉ fallback sang READY nếu không có status nhưng có storageKey/url
        // ✅ NEW: Check clipStatus first
        const clipStatusRaw = c.clipStatus || c.status || (clipUrl || hasStorageKey ? 'READY' : 'PROCESSING');
        // ✅ CRITICAL FIX: Normalize status to union type for TypeScript compatibility
        // TypeScript needs explicit type assertion to infer literal union type instead of string
        const normalizedStatus: 'READY' | 'PROCESSING' | 'FAILED' | 'RETRYING' | 'DONE' =
          clipStatusRaw.toUpperCase() === 'READY' ? 'READY' :
            clipStatusRaw.toUpperCase() === 'DONE' ? 'DONE' :
              clipStatusRaw.toUpperCase() === 'FAILED' ? 'FAILED' :
                clipStatusRaw.toUpperCase() === 'RETRYING' ? 'RETRYING' :
                  'PROCESSING';

        return {
          id: c.id || `clip-${c.index ?? idx}`,
          index: c.index ?? idx,
          // ✅ FUTURE-PROOF: Store clipId (UUID) for assetId derivation
          // clipId is the UUID from backend, used for new format assetId: clip-thumb:{clipId}
          clipId: clipId || undefined, // ✅ Store clipId for assetId derivation
          parentCutClipId: c.parentCutClipId || c.parent_cut_clip_id, // ✅ NEW: Store parentCutClipId
          // ✅ FIX: Allow selection for all ready clips
          // ✅ FIX: Allow selection ONLY for ready/done clips
          selectable: (() => {
            const s = (c.clipStatus || c.status_clip || c.status || 'PROCESSING').toUpperCase();
            return (s === 'READY' || s === 'DONE' || s === 'COMPLETED');
          })(),
          canSelect: (() => {
            const s = (c.clipStatus || c.status_clip || c.status || 'PROCESSING').toUpperCase();
            return (s === 'READY' || s === 'DONE' || s === 'COMPLETED');
          })(),
          readyForPostprocess: (() => {
            const s = (c.clipStatus || c.status_clip || c.status || 'PROCESSING').toUpperCase();
            return (s === 'READY' || s === 'DONE' || s === 'COMPLETED');
          })(),
          // ✅ OPTIMIZATION: Use thumbnailUrl directly from API (Server B bulk signs URLs)
          // Server B now returns thumbnailUrl pre-signed, so we use it directly instead of Asset Gateway
          // Fallback to Asset Gateway only if thumbnailUrl is missing
          thumbnail: thumbnailUrl || '', // ✅ PRIMARY: Use URL from API (bulk signed by Server B)
          thumbnailUrl: thumbnailUrl || undefined, // ✅ NEW: Store thumbnailUrl for direct use in components
          thumbnailKey: thumbnailKey || undefined, // ✅ FALLBACK: Used only if thumbnailUrl is missing
          thumbnailAssetId: thumbnailAssetId, // ✅ FALLBACK: Asset ID for Asset Gateway (if thumbnailUrl missing)
          videoAssetId: videoAssetId, // ✅ FALLBACK: Asset ID for Asset Gateway (if url missing)
          duration: durationFormatted,
          title: c.title || `Clip ${c.index !== undefined ? c.index + 1 : idx + 1}`,
          startTime,
          endTime,
          // Construct URL from storageKey if API returns null
          // This ensures playback works immediately for polling updates
          // Use /api/assets/ pattern which works with session cookies
          url: clipUrl || (hasStorageKey ? `/api/assets/${c.videoKey || c.storageKey || c.key || c.storage_key}` : undefined), // ✅ PRIMARY: Use URL from API or construct one
          videoUrl: clipUrl || undefined, // ✅ Explicit videoUrl
          // ✅ CONTRACT FIX: Status field - FE MUST check this before rendering
          status: (() => {
            const s = (c.clipStatus || (c as any).status_clip || c.status || 'PROCESSING').toUpperCase();
            return ((s === 'READY' || s === 'DONE' || s === 'COMPLETED') ? 'READY' : s === 'FAILED' ? 'FAILED' : 'PROCESSING') as any;
          })(), // 'READY' | 'PROCESSING' | 'FAILED'
          clipStatus: (() => {
            const s = (c.clipStatus || (c as any).status_clip || c.status || 'PROCESSING').toUpperCase();
            return ((s === 'READY' || s === 'DONE' || s === 'COMPLETED') ? 'READY' : s === 'FAILED' ? 'FAILED' : 'PROCESSING') as any;
          })(), // ✅ NEW: Explicit clip status
          // Map storageKey với priority order - đảm bảo bắt được mọi case từ API
          // API có thể trả về: storageKey (camelCase), key, hoặc storage_key (snake_case) hoặc video_s3_key (DB format)
          storageKey: c.videoKey ?? c.storageKey ?? c.key ?? c.storage_key ?? c.video_s3_key ?? c.videoS3Key ?? undefined,
          // ✅ CRITICAL FIX: Cũng map key field để đảm bảo backward compatibility
          key: c.videoKey ?? c.key ?? c.storageKey ?? c.storage_key ?? c.video_s3_key ?? c.videoS3Key ?? undefined,
          bucket: c.bucket,
        };
      }).filter((c: any) => c !== null);

      // ✅ DEBUG: Log mapped clips với storageKey info để debug
      devLog('[openVideoFactoryWithJob] Mapped clips', {
        requestedJobId: actualJobId, // ✅ FIX: Use actualJobId instead of undefined jobId
        count: generatedClips.length,
        expectedClipCount,
        clipsWithUrl: generatedClips.filter((c: any) => c.url).length,
        clipsWithStorageKey: generatedClips.filter((c: any) => c.storageKey || (c as any).key).length,
        clipsPreview: generatedClips.slice(0, 2).map((c: any) => ({
          id: c.id,
          index: c.index,
          clipId: (c as any).clipId,
          thumbnailAssetId: (c as any).thumbnailAssetId,
          videoAssetId: (c as any).videoAssetId,
          url: c.url,
          thumbnail: c.thumbnail,
          status: c.status,
          storageKey: c.storageKey || (c as any).key || null, // ✅ DEBUG: Log storageKey để verify mapping
          hasStorageKey: !!(c.storageKey || (c as any).key),
        })),
        hint: generatedClips.length !== expectedClipCount
          ? `WARNING: Clip count (${generatedClips.length}) does not match expectedClipCount (${expectedClipCount})`
          : 'Clip count matches expectedClipCount',
      });

      // ✅ PROJECT-CENTRIC: Extract projectId from response (project endpoint or job endpoint)
      const projectId = project?.id || responseData?.project?.id || job?.project_id || job?.projectId;

      // ✅ PROJECT-CENTRIC: Determine cutJobId correctly
      // - For project endpoint: cutJobId is from project.currentCutJobId or cutJob.id (NOT project ID)
      // - For job endpoint: cutJobId is actualJobId (the job being opened)
      // ✅ CRITICAL FIX: Never use project ID as cutJobId - if cut job not found, cutJobId should be undefined
      let cutJobId: string | undefined;
      if (isProjectId) {
        // ✅ Project endpoint: Use cutJob.id or project.current_cut_job_id (never project ID)
        cutJobId = cutJob?.id || project?.current_cut_job_id || project?.currentCutJobId || undefined;

        // ✅ CRITICAL FIX: Verify cutJobId is not the project ID (defense-in-depth)
        if (cutJobId === projectIdOrJobId && projectIdOrJobId) {
          console.warn('[openVideoFactoryWithJob] cutJobId matches projectId - this should not happen', {
            projectId: projectIdOrJobId,
            cutJobId,
            cutJobIdFromCutJob: cutJob?.id,
            currentCutJobId: project?.current_cut_job_id || project?.currentCutJobId,
            hint: 'cutJobId should be cut job ID, not project ID. Setting to undefined to prevent errors.',
          });
          cutJobId = undefined; // ✅ Prevent using project ID as cutJobId
        } else {
          // ✅ CRITICAL FIX: If cutJobId is still undefined, try to extract from clip storage keys
          // Clip keys have format: media/{userId}/video_factory/job_id/{cutJobId}/clip/...
          // This handles cases where project.current_cut_job_id is null but clips exist
          if (!cutJobId && generatedClips.length > 0) {
            const firstClip = generatedClips[0];
            const storageKey = firstClip?.storageKey || firstClip?.key;
            if (storageKey) {
              const jobIdMatch = storageKey.match(/\/job_id\/([a-f0-9-]{36})\//i);
              if (jobIdMatch && jobIdMatch[1]) {
                cutJobId = jobIdMatch[1];
                devLog('[openVideoFactoryWithJob] Extracted cutJobId from clip storage key', {
                  projectId: projectIdOrJobId,
                  cutJobId,
                  storageKey,
                  hint: 'project.current_cut_job_id was null, extracted from clip key as fallback',
                });
              }
            }
          }
        }
      } else {
        // ✅ Job endpoint: actualJobId is the job ID
        // If the opened job is a postprocess job, cutJobIdForCutList is the real cut job id.
        // Fallback to actualJobId for pure cut jobs (legacy).
        cutJobId = cutJobIdForCutList || actualJobId;
      }

      // ✅ BACKGROUND PROCESSING: Determine currentStep based on activeJob status
      // ✅ CRITICAL FIX: When opening a project (isProjectId=true), ALWAYS show postprocess selection if clips exist
      // User requirement: "Khi click vào project ở 'Dự án của bạn' thì phải ở step chọn hậu kỳ + danh sách các clips đã cut"
      let currentStep: VideoFactoryStep = 'postprocess'; // Default to postprocess selection

      if (isProjectId && generatedClips.length > 0) {
        // ✅ CRITICAL FIX: Project view - ALWAYS show postprocess selection if clips exist (even if processing)
        // This ensures user sees clips immediately when opening project from "Dự án của bạn"
        currentStep = 'postprocess';
        devLog('[openVideoFactoryWithJob] Setting currentStep to postprocess (project view with clips)', {
          projectId: projectIdOrJobId,
          clipsCount: generatedClips.length,
          hasReadyClips: generatedClips.some((c: any) => c.status === 'READY'),
          hasProcessingClips: generatedClips.some((c: any) => c.status === 'PROCESSING'),
          hint: 'Project view always shows postprocess selection when clips exist (user requirement)',
        });
      } else if (activeJob && (activeJob.status === 'processing' || activeJob.status === 'queued')) {
        // Active job is processing - show processing stage
        currentStep = 'processing';
        devLog('[openVideoFactoryWithJob] Setting currentStep to processing (activeJob found)', {
          activeJobId: activeJob.id,
          status: activeJob.status,
          currentStep: activeJob.currentStep,
        });
      } else if (generatedClips.length > 0 && generatedClips.some((c: any) => c.status === 'READY')) {
        // Clips are ready - show postprocess selection
        currentStep = 'postprocess';
      } else if (job?.status === 'processing' || cutJob?.status === 'processing') {
        // Job is processing but no activeJob - show processing stage
        currentStep = 'processing';
      }

      // ✅ CRITICAL FIX: Extract selectedClipKeys from generatedClips
      // When opening a project after cut completion, we need to populate selectedClipKeys
      // so the UI shows "Clips đã chọn: X" instead of "Clips đã chọn: 0"
      const selectedClipKeys = generatedClips
        .filter((c: any) => c.status === 'READY') // Only include ready clips
        .map((c: any) => c.storageKey || c.key) // Extract storage key
        .filter((key: string | undefined) => !!key); // Remove undefined/null keys

      devLog('[openVideoFactoryWithJob] Extracted selectedClipKeys from generatedClips', {
        generatedClipsCount: generatedClips.length,
        readyClipsCount: generatedClips.filter((c: any) => c.status === 'READY').length,
        selectedClipKeysCount: selectedClipKeys.length,
        hint: selectedClipKeys.length > 0
          ? `✅ Found ${selectedClipKeys.length} ready clips - UI will show "Clips đã chọn: ${selectedClipKeys.length}"`
          : '⚠️ No ready clips found - UI will show "Clips đã chọn: 0"',
      });

      // ✅ CRITICAL: Set state với job data và clips
      const initialState = createInitialVideoFactoryState();
      const newState = {
        ...initialState,
        currentStep, // ✅ Set step based on activeJob status or job status
        projectId, // ✅ PROJECT-CENTRIC: Store projectId
        // ✅ BACKGROUND PROCESSING: Use activeJob.id if available, otherwise use cutJobId
        // ✅ CRITICAL FIX: Preserve existing jobId if cutJobId is undefined (race condition: API returned null)
        // If activeJob exists, use it for SSE connection to get real-time updates
        // If cutJobId is undefined but we have existing jobId, preserve it to maintain SSE connection
        jobId: (activeJob && (activeJob.status === 'processing' || activeJob.status === 'queued'))
          ? activeJob.id
          : (cutJobId || existingJobId || undefined), // ✅ CRITICAL: Preserve existing jobId if cutJobId is undefined
        cutJobId: cutJobId || undefined, // ✅ Store cutJobId để dùng cho postprocess (undefined if not found)
        // ✅ NEW: Set jobCreatedAt from job.createdAt (if available) or current time
        jobCreatedAt: job?.createdAt ? new Date(job.createdAt).getTime() : Date.now(),
        pollingDataTimestamp: undefined, // ✅ NEW: Reset polling timestamp when opening job
        generatedClips: generatedClips as GeneratedVideoClip[], // ✅ FIX: Prioritize generatedClips found from logic above
        // ✅ NEW: Set loaded history
        // ✅ CRITICAL FIX: Merge postProcessHistory instead of replacing with empty array.
        // If we are viewing a specific job (not project view), data.historyData is [],
        // but we MUST preserve the history already in state if it belongs to the same project.
        postProcessHistory: (() => {
          const oldHistory = existingState?.postProcessHistory || [];
          if (!isProjectId) return oldHistory; // Keep existing history for job-specific refreshes
          return historyData; // Only use historyData directly for project-centric view
        })(),
        // ✅ CRITICAL FIX: Set selectedClipKeys from generatedClips (fixes "Clips đã chọn: 0" bug)
        selectedClipKeys: selectedClipKeys,

        expectedClipCount: expectedClipCount, // ✅ CRITICAL: Set expectedClipCount from API response

        // ✅ DECOUPLED: Cut Step State
        cutProgress: (() => {
          if (activeJob && (activeJob.jobSubtype === 'cut' || !activeJob.jobSubtype) && (activeJob.status === 'processing' || activeJob.status === 'queued')) {
            return activeJob.progress || 0;
          }
          const cutStepFound = Array.isArray(steps) && steps.length > 0
            ? steps.find((s: any) => s.name === 'cut')
            : null;
          return cutStepFound?.status === 'completed' ? 100 : (job?.progress || cutJob?.progress || 0);
        })(),
        cutMessage: (() => {
          if (activeJob && (activeJob.jobSubtype === 'cut' || !activeJob.jobSubtype) && (activeJob.status === 'processing' || activeJob.status === 'queued')) {
            return activeJob.progressMessage || activeJob.progress_message || 'Đang xử lý cắt...';
          }
          const cutStepFound = Array.isArray(steps) && steps.length > 0
            ? steps.find((s: any) => s.name === 'cut')
            : null;
          return cutStepFound?.status === 'completed'
            ? 'Đã cắt xong clips.'
            : (job?.progressMessage || job?.progress_message || cutJob?.progress_message || 'Đang xử lý cắt...');
        })(),
        cutStatus: (() => {
          const cutStepFound = Array.isArray(steps) && steps.length > 0
            ? steps.find((s: any) => s.name === 'cut')
            : null;
          if (cutStepFound?.status === 'completed') return 'completed' as const;
          if (cutStepFound?.status === 'failed') return 'failed' as const;
          if (activeJob && (activeJob.jobSubtype === 'cut' || !activeJob.jobSubtype)) return 'processing' as const;
          return undefined;
        })(),

        // ✅ DECOUPLED: Post-Production Step State
        postProdProgress: (() => {
          if (activeJob && (activeJob.jobSubtype === 'postprocess' || activeJob.jobSubtype === 'post_prod') && (activeJob.status === 'processing' || activeJob.status === 'queued')) {
            return activeJob.progress || 0;
          }
          return (historyData.length > 0 && historyData[0].status === 'completed') ? 100 : 0;
        })(),
        postProdMessage: (() => {
          if (activeJob && (activeJob.jobSubtype === 'postprocess' || activeJob.jobSubtype === 'post_prod') && (activeJob.status === 'processing' || activeJob.status === 'queued')) {
            return activeJob.progressMessage || activeJob.progress_message || 'Đang xử lý hậu kỳ...';
          }
          return (historyData.length > 0 && historyData[0].status === 'completed') ? 'Đã hoàn thành hậu kỳ.' : '';
        })(),
        postProdStatus: (() => {
          if (activeJob && (activeJob.jobSubtype === 'postprocess' || activeJob.jobSubtype === 'post_prod')) return 'processing' as const;
          if (historyData.length > 0) return historyData[0].status as any;
          return undefined;
        })(),

        // Legacy compatibility
        processingProgress: (() => {
          // ✅ BACKGROUND PROCESSING: Use activeJob progress if available, otherwise use job/cutJob progress
          if (activeJob && (activeJob.status === 'processing' || activeJob.status === 'queued')) {
            return activeJob.progress || 0;
          }
          // ✅ CRITICAL FIX: Find cut step safely (only if steps array exists and is not empty)
          const cutStepFound = Array.isArray(steps) && steps.length > 0
            ? steps.find((s: any) => s.name === 'cut')
            : null;
          return cutStepFound?.status === 'completed' ? 100 : (job?.progress || cutJob?.progress || 0); // ✅ FIX: Use optional chaining and fallback to cutJob
        })(),
        processingMessage: (() => {
          // ✅ BACKGROUND PROCESSING: Use activeJob progressMessage if available
          if (activeJob && (activeJob.status === 'processing' || activeJob.status === 'queued')) {
            return activeJob.progressMessage || activeJob.progress_message || 'Đang xử lý...';
          }
          // ✅ CRITICAL FIX: Find cut step safely (only if steps array exists and is not empty)
          const cutStepFound = Array.isArray(steps) && steps.length > 0
            ? steps.find((s: any) => s.name === 'cut')
            : null;
          return cutStepFound?.status === 'completed'
            ? 'Đã cắt xong clips. Chọn clips để thực hiện hậu kỳ.'
            : (job?.progressMessage || job?.progress_message || cutJob?.progress_message || 'Đang xử lý...'); // ✅ FIX: Use optional chaining and fallback to cutJob
        })(),
        warnings: [],
        lastErrorMessage: undefined,
      };

      // ✅ CRITICAL FIX: Preserve generatedClips and postProcessHistory when in postprocess step
      // Cut clips chỉ thay đổi ở step cut/thumbnail (skeleton/loading). Ở step postprocess tuyệt đối không overwrite cut clips.
      const isInPostprocessStep = existingState?.currentStep === 'postprocess';
      
      if (isInPostprocessStep) {
        /**
         * ✅ CRITICAL FIX (2026-02-05):
         * Force-refresh during postprocess can call `openVideoFactoryWithJob(postprocessJobId, false)`.
         * The *job* endpoint may omit `projectId` in some responses, causing `isSameContext` to be false
         * and accidentally wiping `postProcessHistory` (UI: right column skeleton disappears).
         *
         * If we are refreshing the currently-open context, preserve `projectId` from existing state
         * as a stable anchor for "same context" checks and downstream merging.
         */
        const requestedId = projectIdOrJobId;
        const isRefreshingCurrentJobContext = Boolean(
          !isProjectId &&
          requestedId &&
          (
            existingState?.jobId === requestedId ||
            existingState?.postProcessJobId === requestedId ||
            existingState?.cutJobId === requestedId
          )
        );
        if (isRefreshingCurrentJobContext && existingState?.projectId && !newState.projectId) {
          newState.projectId = existingState.projectId;
        }

        // ✅ SAFETY: Only preserve cut clips when reopening the SAME context.
        // Otherwise, preserving would leak cut clips from a previous project/job into a new one.
        // ✅ CRITICAL (Bug Fix): During postprocess, force-refresh may call `openVideoFactoryWithJob(postprocessJobId)`.
        // In that case, the fetched data can legitimately compute a different `newState.jobId` (cut job id),
        // but the UI context is still the SAME project. We must treat it as the same context to avoid
        // wiping cut clips or flipping SSE jobId unexpectedly.
        const isSameContext = Boolean(
          (existingState?.projectId && newState.projectId && existingState.projectId === newState.projectId) ||
          (isProjectId && existingState?.projectId && newState.projectId && existingState.projectId === newState.projectId) ||
          (!isProjectId && existingState?.jobId && newState.jobId && existingState.jobId === newState.jobId) ||
          // ✅ Additional guard: if we are force-refreshing the currently active postprocess/cut job, treat as same context
          isRefreshingCurrentJobContext
        );

        // ✅ CRITICAL: Preserve current SSE jobId in postprocess context.
        // When force-refreshing via project/job endpoints, we must NOT accidentally flip `jobId`
        // (e.g. postprocess jobId → cut jobId), because it will tear down SSE and can cause UI to "blink" empty.
        // ✅ ENHANCED: Only flip jobId if we are NOT in the middle of a postprocess phase
        // or if the requested jobId is a new postprocess job.
        if (isSameContext && existingState?.jobId) {
          const requestedJobIsPostprocess = responseData?.job?.jobType === 'postprocess' || responseData?.job?.jobSubtype === 'postprocess';
          if (isInPostprocessStep && !requestedJobIsPostprocess) {
            // Keep existing jobId (the postprocess one) even if API returns cut data
            newState.jobId = existingState.jobId;
          } else {
            // Follow the new jobId from API (e.g. we just switched to a different postprocess run)
            newState.jobId = actualJobId || newState.jobId;
          }
        }

        // ✅ USER REQUIREMENT (STRICT):
        // In postprocess step, DO NOT update/refresh/replace cut clips list at all.
        // Keep `generatedClips` exactly as-is so postprocess updates can't accidentally wipe/mutate it.
        if (isSameContext && existingState?.generatedClips) {
          newState.generatedClips = existingState.generatedClips as GeneratedVideoClip[];
          devLog('[openVideoFactoryWithJob] Preserving generatedClips (strict in postprocess step)', {
            preservedClipsCount: existingState.generatedClips.length,
            hint: 'Strict mode: generatedClips is immutable during postprocess step',
          });
        }
        
        // ✅ CRITICAL: ALWAYS preserve postProcessHistory when in postprocess step
        // Postprocess history should NEVER be reset when in postprocess step
        if (existingState?.postProcessHistory) {
          // ✅ Merge postProcessHistory instead of replacing
          // Keep existing history and merge with new historyData if available
          const existingHistory = existingState.postProcessHistory;
          const newHistory = isProjectId ? historyData : [];
          
          // Merge: add new entries that don't exist yet, keep existing ones
          // ✅ CRITICAL: When in postprocess, NEVER overwrite the CURRENT postprocess job entry with API data
          // (e.g. đang chạy hậu kỳ lần 3 → lần 1 và 2 không đổi; lần 3 chỉ nhận update từ SSE/webhook, không từ refetch)
          const currentPostProcessJobId = existingState?.postProcessJobId;
          const mergedHistory = [...existingHistory];
          if (Array.isArray(newHistory) && newHistory.length > 0) {
            newHistory.forEach((newEntry: any) => {
              const exists = mergedHistory.some((e: any) => e.jobId === newEntry.jobId);
              if (!exists) {
                mergedHistory.unshift(newEntry); // Add new entries at the beginning
              } else {
                // ✅ Do NOT overwrite the entry that is the current postprocess job (skeleton/SSE is source of truth)
                if (currentPostProcessJobId && newEntry.jobId === currentPostProcessJobId) {
                  return; // Keep existing entry for current job - only SSE/webhook updates apply
                }
                // Update other entries (lần 1, 2) if new data is better (e.g., completed status)
                const existingIndex = mergedHistory.findIndex((e: any) => e.jobId === newEntry.jobId);
                if (existingIndex >= 0 && newEntry.status === 'completed' && mergedHistory[existingIndex].status !== 'completed') {
                  mergedHistory[existingIndex] = { ...mergedHistory[existingIndex], ...newEntry };
                }
              }
            });
          }
          
          newState.postProcessHistory = mergedHistory;
          devLog('[openVideoFactoryWithJob] Merging postProcessHistory (in postprocess step)', {
            existingHistoryCount: existingHistory.length,
            newHistoryCount: newHistory.length,
            mergedHistoryCount: mergedHistory.length,
            hint: 'Will not reset postprocess history when in postprocess step - history is preserved',
          });
        } else {
          // ✅ Fallback: If no existing history but we're in postprocess step, use newHistory if available
          // This handles edge case where history was cleared but we're still in postprocess step
          if (isProjectId && Array.isArray(historyData) && historyData.length > 0) {
            newState.postProcessHistory = historyData;
            devLog('[openVideoFactoryWithJob] Using new historyData (no existing history in postprocess step)', {
              newHistoryCount: historyData.length,
            });
          }
        }
      }

      // ✅ DEBUG: Log state before setting (including projectId and cutJobId for debugging)
      devLog('[openVideoFactoryWithJob] Setting state', {
        currentStep: newState.currentStep,
        isInPostprocessStep,
        clipsCount: newState.generatedClips?.length || 0,
        expectedClipCount: newState.expectedClipCount,
        postProcessHistoryCount: newState.postProcessHistory?.length || 0,
        projectId: newState.projectId, // ✅ CRITICAL: Log projectId to verify it's set
        jobId: newState.jobId,
        cutJobId: newState.cutJobId, // ✅ CRITICAL: Log cutJobId to verify it's set
        hint: newState.generatedClips?.length !== newState.expectedClipCount
          ? `WARNING: Clips count (${newState.generatedClips?.length}) does not match expectedClipCount (${newState.expectedClipCount})`
          : 'Clips count matches expectedClipCount',
      });

      set({
        isVideoFactoryOpen: true,
        videoFactoryState: newState,
      });

      devLog('[openVideoFactoryWithJob] Successfully opened Video Factory', {
        projectIdOrJobId,
        isProjectId,
        actualJobId,
        projectId: newState.projectId,
        clipsCount: generatedClips.length,
        currentStep: 'postprocess',
      });

      toast.success(`Đã tải ${isProjectId ? 'project' : 'job'} "${projectIdOrJobId}". Chọn clips để thực hiện hậu kỳ.`);
    } catch (error: any) {
      // ✅ CRITICAL FIX: Better error logging
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : JSON.stringify(error);

      console.error('[openVideoFactoryWithJob] Error:', {
        projectIdOrJobId,
        isProjectId,
        error,
        errorMessage,
        errorType: typeof error,
        errorString: String(error),
      });

      toast.error(errorMessage || `Không thể mở Video Factory với ${isProjectId ? 'project' : 'job'} này.`);
    }
  },

  closeVideoFactory: () => {
    const state = get().videoFactoryState;
    const oldJobId = state?.jobId;

    if (oldJobId) {
      devLog('[closeVideoFactory] Closing video factory modal', {
        oldJobId,
        hint: 'Resetting jobId to disconnect SSE connection when modal closes',
      });
    }

    // ✅ CRITICAL FIX: Reset job-related fields khi đóng modal để đảm bảo SSE disconnect
    // Giữ lại state khác (config, clips) để user có thể mở lại và tiếp tục
    // ✅ SAFE: Shallow copy để tránh mutation
    set(s => ({
      isVideoFactoryOpen: false,
      videoFactoryState: s.videoFactoryState ? {
        ...s.videoFactoryState, // ✅ Shallow copy state hiện tại
        // ✅ CRITICAL: Clear job-related fields để SSE disconnect và tránh stale data
        jobId: undefined, // ✅ CRITICAL: Reset jobId để SSE disconnect (compatible với type)
        cutJobId: undefined, // ✅ CRITICAL: Clear cutJobId
        postProcessJobId: undefined, // ✅ CRITICAL: Clear postProcessJobId
        projectId: undefined, // ✅ PROJECT-CENTRIC: Clear projectId
        // ✅ NOTE: Giữ lại config, clips, selectedClipKeys để user có thể mở lại và tiếp tục
      } : s.videoFactoryState // ✅ FALLBACK: Nếu không có state, giữ nguyên
    }));
  },

  setVideoFactoryStep: (step) => set(state => {
    if (!state.videoFactoryState) return {};
    return {
      videoFactoryState: {
        ...state.videoFactoryState,
        currentStep: step
      }
    };
  }),

  updateVideoFactorySource: (config) => set(state => {
    if (!state.videoFactoryState) return {};
    return {
      videoFactoryState: { ...state.videoFactoryState, sourceConfig: config }
    };
  }),

  updateVideoFactoryCut: (config) => set(state => {
    if (!state.videoFactoryState) return {};
    return {
      videoFactoryState: { ...state.videoFactoryState, cutConfig: config }
    };
  }),

  updateVideoFactoryPostProd: (config) => set(state => {
    if (!state.videoFactoryState) return {};

    // ✅ CRITICAL FIX: Chỉ update nếu config thực sự thay đổi để tránh infinite loop
    const currentConfig = state.videoFactoryState.postProdConfig;
    if (currentConfig &&
      currentConfig.autoCaptions === config.autoCaptions &&
      currentConfig.bRollInsertion === config.bRollInsertion &&
      currentConfig.backgroundMusic === config.backgroundMusic &&
      currentConfig.transitions === config.transitions &&
      currentConfig.autoCaption?.language === config.autoCaption?.language &&
      currentConfig.autoCaption?.style === config.autoCaption?.style &&
      currentConfig.bRollDensity === config.bRollDensity) {
      return {}; // Không thay đổi gì → không trigger re-render
    }

    return {
      videoFactoryState: { ...state.videoFactoryState, postProdConfig: config }
    };
  }),

  updateSelectedClipKeys: (keys) => set(state => {
    if (!state.videoFactoryState) return {};

    // ✅ CRITICAL FIX: Chỉ update nếu keys thực sự thay đổi để tránh infinite loop
    const currentKeys = state.videoFactoryState.selectedClipKeys || [];
    const keysChanged = currentKeys.length !== keys.length ||
      currentKeys.some((key, idx) => key !== keys[idx]);

    if (!keysChanged) {
      return {}; // Không thay đổi gì → không trigger re-render
    }

    return {
      videoFactoryState: {
        ...state.videoFactoryState,
        selectedClipKeys: [...keys],
      },
    };
  }),

  startVideoFactoryProcessing: async () => {
    const state = get().videoFactoryState;
    if (!state?.sourceConfig || !state?.cutConfig) {
      toast.error(VIDEO_ERRORS.INVALID_FILE || 'Thiếu cấu hình nguồn / cắt');
      return;
    }

    // ✅ CRITICAL FIX: ALWAYS reset jobId và clips cũ trước khi tạo job mới
    // Điều này đảm bảo FE không "nhớ dai" job cũ và SSE connection cũ được disconnect
    // ✅ IMPORTANT: Reset ngay cả khi không có oldJobId để đảm bảo state sạch
    const oldJobId = state.jobId;
    if (oldJobId) {
      devLog('[startVideoFactoryProcessing] Resetting old jobId before creating new job', {
        oldJobId,
        hint: 'This ensures FE does not "remember" old job and old SSE connection is disconnected',
      });
    } else {
      devLog('[startVideoFactoryProcessing] Resetting state before creating new job (no old jobId)', {
        hint: 'Clearing any stale clips or state to ensure clean start',
      });
    }

    // ✅ OPTIMIZATION: Calculate expected clip count BEFORE reset (needed for placeholder clips)
    let expectedClipCount = 0;
    if (state.cutConfig.method === 'auto' && state.cutConfig.autoCutConfig) {
      expectedClipCount = state.cutConfig.autoCutConfig.clipCount || 0;
    } else if (state.cutConfig.method === 'manual' && state.cutConfig.manualSelections?.length) {
      expectedClipCount = state.cutConfig.manualSelections.length;
    }

    // ✅ OPTIMIZATION: Create placeholder clips IMMEDIATELY for instant UI feedback
    // These will be replaced by real clips when SSE/Polling receives actual data
    const placeholderClips: GeneratedVideoClip[] = expectedClipCount > 0
      ? Array.from({ length: expectedClipCount }, (_, index) => ({
        id: `placeholder-${Date.now()}-${index}`, // ✅ Temporary ID (will be replaced when real clips arrive)
        thumbnail: '', // ✅ Required: thumbnail field (empty for placeholder)
        duration: '0s', // ✅ Required: duration field (string format)
        title: `Clip ${index + 1}`, // ✅ Required: title field
        startTime: 0, // ✅ Required: startTime field
        endTime: 0, // ✅ Required: endTime field
        index: index, // ✅ Optional: clip index for slot-based rendering
        status: 'PROCESSING' as const, // ✅ Placeholder status
        isPlaceholder: true, // ✅ Flag to identify placeholder clips
        // Optional fields (undefined for placeholder)
        url: undefined,
        storageKey: undefined,
        selectable: false, // ✅ Placeholder clips are not selectable
        canSelect: false,
        readyForPostprocess: false,
      }))
      : [];

    // ✅ SAFE RESET: Reset về initial state nhưng giữ lại config (sourceConfig, cutConfig)
    // jobId: undefined để đảm bảo SSE connection cũ được disconnect (hook SSE checks for undefined/null)
    // generatedClips: placeholderClips để UI hiển thị loading clips ngay lập tức
    // ✅ CRITICAL: Tạo initial state mới (không có tham chiếu bộ nhớ) và merge config an toàn
    const initialState = createInitialVideoFactoryState(); // ✅ Tạo object mới mỗi lần (tránh tham chiếu bộ nhớ)
    set(s => ({
      videoFactoryState: s.videoFactoryState ? {
        ...initialState, // ✅ AN TOÀN: Reset về initial state thay vì null (object mới, không có tham chiếu)
        // ✅ GIỮ LẠI: User config (shallow copy để tránh mutation)
        sourceConfig: s.videoFactoryState.sourceConfig ? { ...s.videoFactoryState.sourceConfig } : undefined,
        cutConfig: s.videoFactoryState.cutConfig ? { ...s.videoFactoryState.cutConfig } : undefined,
        postProdConfig: s.videoFactoryState.postProdConfig ? { ...s.videoFactoryState.postProdConfig } : undefined,
        // ✅ CRITICAL: Reset job-related fields để SSE disconnect và clear clips cũ
        jobId: undefined, // ✅ CRITICAL: undefined để SSE disconnect (compatible với type string | undefined)
        cutJobId: undefined, // ✅ CRITICAL: Clear cutJobId
        postProcessJobId: undefined, // ✅ CRITICAL: Clear postProcessJobId
        generatedClips: placeholderClips, // ✅ OPTIMIZATION: Show placeholder clips immediately for instant feedback
        selectedClipKeys: [], // ✅ CRITICAL: Clear selected clips (mảng mới, không có tham chiếu)
        expectedClipCount: expectedClipCount > 0 ? expectedClipCount : undefined, // ✅ Store expected count
        // ✅ UX: Chuyển sang postprocess stage ngay để hiển thị placeholder clips (hình 1)
        currentStep: 'postprocess', // ✅ UX: Hiển thị PostprocessSelectionStage với placeholder clips ngay
        cutProgress: 0, // ✅ DECOUPLED: Reset cut progress
        cutMessage: 'Đang khởi tạo job...', // ✅ DECOUPLED: Set initial cut message
        cutStatus: 'processing' as const,
        processingProgress: 0, // ✅ UX: Reset progress
        processingMessage: 'Đang khởi tạo job...', // ✅ UX: Set initial message
      } : initialState // ✅ FALLBACK: Nếu không có state cũ, dùng initial state
    }));

    // ✅ CRITICAL: Wait a bit to ensure SSE cleanup completes before creating new job
    // This prevents race condition where old SSE events arrive after new jobId is set
    // Increased delay to 500ms to ensure SSE connection is fully closed and old events are cleared
    await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay to ensure cleanup

    // ✅ NEW: Calculate estimated credits CHỈ cho cut phase (không tính hậu kỳ)
    let estimatedCredits = 0;
    try {
      const cutConfig = state.cutConfig;

      let clipCount = 0;
      let clipDuration: '<60s' | '60-90s' | '>90s' = '60-90s';

      if (cutConfig.method === 'auto' && cutConfig.autoCutConfig) {
        clipCount = cutConfig.autoCutConfig.clipCount;
        clipDuration = cutConfig.autoCutConfig.clipDuration;
      } else if (cutConfig.method === 'manual' && cutConfig.manualSelections?.length) {
        clipCount = cutConfig.manualSelections.length;
        // Manual selections thường là các đoạn ngắn <60s
        clipDuration = '<60s';
      }

      if (clipCount > 0) {
        // ✅ CHỈ tính credit cho cut phase (không tính hậu kỳ)
        const credits = splitVideoFactoryCredits({
          clipCount,
          clipDuration,
          bRollInsertion: false, // ✅ Chỉ tính cut
          autoCaptions: false,   // ✅ Chỉ tính cut
        });
        estimatedCredits = credits.cutCredits;
      }
    } catch (creditCalcError) {
      console.error('[startVideoFactoryProcessing] Credit calculation error:', creditCalcError);
      // Không block nếu tính credit lỗi, để BE validate
    }

    // ✅ NEW: Refresh credits before checking to ensure accurate data
    const creditsStore = useCreditsStore.getState();
    await creditsStore.refreshCredits(true);
    const creditsRemaining = creditsStore.creditsRemaining;

    // Check credits BEFORE making API call (FE validation)
    if (estimatedCredits > 0 && creditsRemaining < estimatedCredits) {
      const errorMessage = CREDIT_ERRORS.INSUFFICIENT_CREDITS_VIDEO_FACTORY_CUT(estimatedCredits, creditsRemaining);

      // ✅ NEW: Open limit exceeded modal instead of just toast
      useLimitExceededModalStore.getState().openModal('insufficient_credits', errorMessage, {
        profileUsage: creditsStore.profileLimits,
        postUsage: creditsStore.postLimits,
        creditsRemaining,
        currentPlan: creditsStore.currentPlan,
      });

      set(s => ({
        videoFactoryState: s.videoFactoryState ? {
          ...s.videoFactoryState,
          currentStep: 'config', // ✅ NEW: Quay lại config step thay vì summary
          processingMessage: errorMessage,
          // âœ… CRITICAL FIX: Generate new requestId for next operation
          requestId: crypto.randomUUID()
        } : s.videoFactoryState
      }));
      return;
    }

    set(s => ({
      videoFactoryState: s.videoFactoryState ? {
        ...s.videoFactoryState,
        currentStep: 'postprocess', // ✅ UX: Hiển thị PostprocessSelectionStage với placeholder clips
        cutProgress: 5,
        cutMessage: 'Đang khởi tạo job...',
        cutStatus: 'processing' as const,
        processingProgress: 5,
        processingMessage: 'Đang khởi tạo job...',
        warnings: [],
        lastErrorMessage: undefined,
      } : s.videoFactoryState
    }));

    try {
      // ✅ CRITICAL FIX: Get cutConfig from state (already validated above)
      const cutConfig = state.cutConfig;

      // Prepare payload for Server A
      const payload = {
        source: state.sourceConfig.type === 'youtube'
          ? {
            type: 'youtube',
            youtube_url: state.sourceConfig.youtubeUrl,
            duration_seconds: state.sourceConfig.videoDuration ? Number(state.sourceConfig.videoDuration) : undefined,
            // ✅ CRITICAL FIX: Read media_asset_id (snake_case) from VideoSourceConfig
            media_asset_id: state.sourceConfig.media_asset_id || undefined,
          }
          : {
            type: 'upload',
            upload_url: (state.sourceConfig as any).uploadUrl, // expect UI to set uploadUrl after upload
            duration_seconds: state.sourceConfig.videoDuration ? Number(state.sourceConfig.videoDuration) : undefined,
            // ✅ CRITICAL FIX: Read media_asset_id (snake_case) from VideoSourceConfig
            media_asset_id: state.sourceConfig.media_asset_id || undefined,
          },
        // ✅ NEW: Luôn dùng mode='cut_only' để chỉ chạy cut phase
        // User sẽ chọn clips và chạy hậu kỳ sau khi cut completed
        mode: 'cut_only',
        cut: state.cutConfig.method === 'auto'
          ? {
            method: 'auto',
            auto: {
              clip_count: state.cutConfig.autoCutConfig?.clipCount || 3,
              clip_duration_preference: state.cutConfig.autoCutConfig?.clipDuration || '60-90s',
              contentTheme: state.cutConfig.autoCutConfig?.contentTheme, // align with BE naming
            }
          }
          : {
            method: 'manual',
            manual: state.cutConfig.manualSelections?.map(sel => ({
              start_time: sel.startTime,
              end_time: sel.endTime,
              label: sel.text,
            })) || [],
          },
        // ✅ NOTE: Không gửi postprod khi mode='cut_only' vì backend sẽ ignore nó
        // Postprod config sẽ được gửi riêng khi user chọn clips và chạy hậu kỳ
        // Giữ undefined để rõ ràng và tránh confusion
        postprod: undefined,
        // ✅ NEW: Send estimatedCredits from FE to ensure BE uses exact value shown to user
        estimatedCredits: estimatedCredits,
        // ✅ IDEMPOTENCY: Send requestId to prevent orphaned jobs from network errors
        requestId: state.requestId,
      };

      const { data: { session } } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Unauthorized');
      }

      const res = await fetch('/api/video-factory/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      // Xử lý trường hợp không đủ credit (402) rõ ràng cho user
      if (res.status === 402) {
        const rawError = json?.error || json?.message;
        const msg =
          typeof rawError === 'string'
            ? rawError
            : rawError?.message ||
            'Bạn không đủ credit để chạy Video Factory. Vui lòng nạp thêm credit hoặc giảm cấu hình.';
        toast.error(msg);
        set(s => ({
          videoFactoryState: s.videoFactoryState ? {
            ...s.videoFactoryState,
            currentStep: 'summary',
            processingMessage: msg,
          } : s.videoFactoryState
        }));
        return;
      }

      if (!res.ok || !json?.success) {
        if (res.status === 401) {
          await handleUnauthorizedOnClient('videoFactoryStart');
        }
        throw new Error(json?.error || 'Không thể tạo job Video Factory');
      }

      const jobId = json.data?.job_id || json.data?.jobId || json.data?.id;
      // ✅ PROJECT-CENTRIC: Extract projectId from API response
      const projectId = json.data?.project_id || json.data?.projectId;
      const creditsRemaining = json.data?.creditsRemaining;

      // ✅ INSTANT UPDATE: Use updateCredits() for synchronous UI update (matching Text-to-Video and Image Gen)
      if (creditsRemaining !== undefined) {
        useCreditsStore.getState().updateCredits(creditsRemaining);
      }

      // ✅ CRITICAL FIX: Verify jobId is valid before setting
      if (!jobId) {
        throw new Error('Job ID không tồn tại trong response');
      }

      // ✅ CRITICAL FIX: Update jobId and projectId while preserving placeholder clips
      // Placeholder clips were already created before API call, now we just update jobId
      // ✅ NEW: Set jobCreatedAt timestamp for polling (always poll after 2 minutes from job creation)
      const jobCreatedAt = Date.now();

      // ✅ OPTIMIZATION: Update placeholder clips with real jobId (for better tracking)
      // Keep existing placeholder clips but update their IDs to include jobId
      const currentClips = get().videoFactoryState?.generatedClips || [];
      const updatedPlaceholderClips: GeneratedVideoClip[] = currentClips.map((clip, index) => {
        if (clip.isPlaceholder) {
          return {
            ...clip,
            id: `placeholder-${jobId}-${index}`, // ✅ Update with real jobId
          };
        }
        return clip;
      });

      set(s => ({
        videoFactoryState: s.videoFactoryState ? {
          ...s.videoFactoryState,
          projectId, // ✅ PROJECT-CENTRIC: Store projectId
          jobId,
          cutJobId: jobId,
          generatedClips: updatedPlaceholderClips.length > 0 ? updatedPlaceholderClips : s.videoFactoryState.generatedClips, // ✅ Keep placeholder clips or existing clips
          selectedClipKeys: [], // ✅ CRITICAL: Clear selected clips
          jobCreatedAt, // ✅ NEW: Track job creation time for polling
          pollingDataTimestamp: undefined, // ✅ NEW: Reset polling timestamp when creating new job
          cutProgress: 10,
          cutMessage: 'Đã khởi tạo job, đang xử lý...',
          cutStatus: 'processing' as const,
          processingProgress: 10,
          processingMessage: 'Đã khởi tạo job, đang xử lý...',
          warnings: [],
          lastErrorMessage: undefined,
          // ✅ CRITICAL FIX: Generate new requestId for next operation (prevents zombie requestId)
          requestId: crypto.randomUUID(),
        } : s.videoFactoryState
      }));

      // ✅ PROJECT-CENTRIC: Create VideoProject in list for progress tracking
      const videoProjectsStore = useVideoProjectsStore.getState();
      const sourceTitle = state.sourceConfig.type === 'youtube'
        ? `Video Factory: ${state.sourceConfig.youtubeTitle || state.sourceConfig.youtubeUrl?.slice(0, 50) || 'YouTube video'}`
        : `Video Factory: ${(state.sourceConfig as any).uploadUrl?.split('/').pop() || 'Uploaded video'}`;

      // ✅ PROJECT-CENTRIC: Use backend projectId if available, otherwise generate frontend projectId
      const frontendProjectId = projectId || `vf-${jobId}`;

      // ✅ CRITICAL FIX: Không tạo trùng project cho cùng một projectId / jobId / id
      const existingIndex = videoProjectsStore.videoProjects.findIndex(
        (p) => p.id === frontendProjectId || p.projectId === projectId || p.jobId === jobId,
      );

      const baseProject = {
        id: frontendProjectId,
        title: sourceTitle,
        thumbnail: '',
        duration: state.sourceConfig.videoDuration ? `${state.sourceConfig.videoDuration}s` : '0:00',
        createdAt: new Date().toISOString(),
        status: 'processing' as const,
        type: 'factory' as const,
        projectId, // ✅ PROJECT-CENTRIC: Store backend projectId
        jobId, // ✅ LEGACY: Keep jobId for backward compatibility
        progress: 10,
        progressMessage: 'Đã khởi tạo job, đang xử lý...',
      };

      if (existingIndex >= 0) {
        const updated = [...videoProjectsStore.videoProjects];
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...baseProject,
        };
        videoProjectsStore.videoProjects = updated;
        // ✅ CRITICAL FIX: Safely exclude originalFile (optional property) when saving to localStorage
        saveToLocalStorage(getVideoProjectsKey(), updated.map((project) => {
          const { originalFile, ...rest } = project;
          return rest;
        }));
      } else {
        const updated: VideoProject[] = [...videoProjectsStore.videoProjects, baseProject as VideoProject];
        videoProjectsStore.videoProjects = updated;
        // ✅ CRITICAL FIX: Safely exclude originalFile (optional property) when saving to localStorage
        saveToLocalStorage(getVideoProjectsKey(), updated.map((project) => {
          const { originalFile, ...rest } = project;
          return rest;
        }));
      }

      toast.success('Đã khởi tạo job Video Factory!');
    } catch (error) {
      console.error('[startVideoFactoryProcessing] Error:', error);
      set(s => ({
        videoFactoryState: s.videoFactoryState ? {
          ...s.videoFactoryState,
          currentStep: 'config', // ✅ NEW: Quay lại config step thay vì postprod
          processingMessage: 'Đã xảy ra lỗi. Vui lòng thử lại từ bước trước.'
        } : s.videoFactoryState
      }));
      toast.error(VIDEO_ERRORS.FACTORY_COMPLETE_FAILED);
    }
  },

  // Start post-process (concat + captions) using selected clips from cut job
  // Start post-process (concat + captions) using selected clips from cut job
  startVideoFactoryPostProcess: async (selectedClipKeys: string[], configOverride?: PostProductionConfig, selectedCutClipIdsOverride?: string[]) => {
    devLog('[startVideoFactoryPostProcess] Called with:', {
      selectedClipKeys,
      selectedClipKeysLength: selectedClipKeys.length,
      configOverride,
      hasConfigOverride: !!configOverride,
      hasIdsOverride: !!selectedCutClipIdsOverride,
      idsOverrideCount: selectedCutClipIdsOverride?.length,
      hint: 'If configOverride provided, will use it instead of state.postProdConfig (prevents race condition)',
    });

    const state = get().videoFactoryState;
    if (!state) {
      console.error('[startVideoFactoryPostProcess] No active state');
      return;
    }

    // ... (validation logs) ...

    // ... (credits check) ...

    try {
      // ✅ CRITICAL FIX: Define config variables (previously undefined)
      const postProdConfig = configOverride || state?.postProdConfig;
      const autoCaptions = postProdConfig?.autoCaptions || false;
      const bRollInsertion = postProdConfig?.bRollInsertion || false;

      // ✅ CRITICAL FIX: Get access token
      const { data: { session } } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        await handleUnauthorizedOnClient('videoFactoryPostProcess');
        throw new Error('Unauthorized');
      }


      // ... (auth check) ...

      // ... (config setup) ...

      // ✅ NEW: Map selectedClipKeys to selected_cut_clip_ids (UUIDs) for Priority 1 backend logic
      // If override provided (e.g. from UI or Retry), use it. Otherwise derive from generatedClips.
      let selectedCutClipIds: string[] = [];

      if (selectedCutClipIdsOverride && selectedCutClipIdsOverride.length > 0) {
        selectedCutClipIds = selectedCutClipIdsOverride;
        devLog('[startVideoFactoryPostProcess] Using provided UUIDs override:', {
          count: selectedCutClipIds.length,
          uuids: selectedCutClipIds,
        });
      } else {
        const generatedClips = state?.generatedClips || [];
        selectedClipKeys.forEach(key => {
          // Find clip with matching key/storageKey
          const clip = generatedClips.find(c =>
            c.storageKey === key ||
            (c as any).key === key ||
            c.storageKey?.endsWith(key) ||
            c.url === key // Fallback for edge cases
          );
          if (clip && (clip as any).clipId) {
            selectedCutClipIds.push((clip as any).clipId);
          }
        });
        devLog('[startVideoFactoryPostProcess] Derived UUIDs from store:', {
          selectedKeysCount: selectedClipKeys.length,
          mappedUUIDsCount: selectedCutClipIds.length,
          uuids: selectedCutClipIds,
        });
      }

      const payload: {
        project_id?: string;
        cut_job_id?: string;
        selected_clip_keys: string[];
        selected_cut_clip_ids?: string[];
        postprod_config: {
          auto_captions: boolean;
          caption_language?: string;
          caption_style?: string;
          broll: boolean;
          broll_density?: 'low' | 'medium' | 'high';
        };
        requestId?: string;
      } = {
        project_id: state.projectId,
        cut_job_id: state.jobId || state.cutJobId,
        selected_clip_keys: selectedClipKeys,
        selected_cut_clip_ids: selectedCutClipIds.length > 0 ? selectedCutClipIds : undefined,

        // ✅ STANDARD CONFIG STRUCTURE (Snake Case + Nested)
        postprod_config: {
          auto_captions: autoCaptions,
          caption_language: postProdConfig?.autoCaption?.language || 'vi',
          caption_style: postProdConfig?.autoCaption?.style || 'default',
          broll: bRollInsertion,
          broll_density: bRollInsertion ? postProdConfig?.bRollDensity : undefined,
        },

        requestId: state.requestId,
      };
      const requestId = state.requestId;

      // ✅ OPTIMISTIC UI: Generate temporary ID and timestamp
      const optimisticJobId = `temp-${crypto.randomUUID()}`;
      const timestamp = new Date().toISOString();

      // ✅ CRITICAL FIX: Construct config object matching PostProductionConfig interface
      const historyConfig: PostProductionConfig = {
        autoCaptions: autoCaptions,
        autoCaption: {
          language: (postProdConfig as any)?.captionLanguage || postProdConfig?.autoCaption?.language || 'vi',
          style: (postProdConfig as any)?.captionStyle || postProdConfig?.autoCaption?.style || 'default',
        },
        bRollInsertion: bRollInsertion,
        bRollDensity: postProdConfig?.bRollDensity,
        backgroundMusic: postProdConfig?.backgroundMusic ?? false,
        transitions: postProdConfig?.transitions ?? false,
      };

      // ✅ OPTIMISTIC UI: Add job to history IMMEDIATELY (before API call)
      // This triggers immediate skeleton loading and auto-scroll
      get().addPostProcessJob(
        optimisticJobId,
        timestamp,
        selectedClipKeys,
        historyConfig,
        selectedCutClipIds // ✅ NEW: Pass UUIDs for retry logic
      );

      devLog('[startVideoFactoryPostProcess] Optimistic job added', {
        optimisticJobId,
        selectedKeysCount: selectedClipKeys.length,
        hint: 'UI should show skeleton loading immediately'
      });

      // ✅ CRITICAL FIX: Log payload trước khi gửi để verify
      devLog('[startVideoFactoryPostProcess] Payload before sending:', {
        project_id: payload.project_id,
        cut_job_id: payload.cut_job_id,
        selected_clip_keys_count: payload.selected_clip_keys.length,
        auto_captions: payload.postprod_config.auto_captions,
        broll: payload.postprod_config.broll, // ✅ CRITICAL: Verify broll value
        broll_density: payload.postprod_config.broll_density,
      });

      // ✅ CRITICAL FIX: Always send project_id and cut_job_id if available
      // Ensure both are set to prevent undefined values in payload
      if (state.projectId) {
        payload.project_id = state.projectId;
      }
      if (state.cutJobId) {
        payload.cut_job_id = state.cutJobId;
      }

      // ✅ CRITICAL FIX: Validate payload before sending
      if (!payload.project_id && !payload.cut_job_id) {
        console.error('[startVideoFactoryPostProcess] Missing both project_id and cut_job_id', {
          stateProjectId: state?.projectId,
          stateCutJobId: state?.cutJobId,
          hint: 'Both project_id and cut_job_id are undefined - cannot proceed with post-processing',
        });
        toast.error('Lỗi: Không tìm thấy project ID hoặc cut job ID. Vui lòng thử lại từ đầu.');
        return;
      }

      // ✅ CRITICAL FIX: Log final payload to verify values are set
      devLog('[startVideoFactoryPostProcess] Final payload before sending:', {
        project_id: payload.project_id,
        cut_job_id: payload.cut_job_id,
        selected_clip_keys_count: payload.selected_clip_keys.length,
        auto_captions: payload.postprod_config.auto_captions,
        broll: payload.postprod_config.broll,
        broll_density: payload.postprod_config.broll_density,
      });

      if (state.projectId) {
        payload.project_id = state.projectId;
      }

      // ✅ CRITICAL FIX: Always send cut_job_id if available (for fallback and backward compatibility)
      if (state.cutJobId) {
        payload.cut_job_id = state.cutJobId;
      }

      // ✅ CRITICAL FIX: Validate that we have at least one identifier
      if (!payload.project_id && !payload.cut_job_id) {
        const errorMsg = 'Lỗi: Không tìm thấy project ID hoặc cut job ID. Vui lòng thử lại từ đầu.';
        console.error('[startVideoFactoryPostProcess] Validation failed: No project_id or cut_job_id', {
          hasProjectId: !!state?.projectId,
          hasCutJobId: !!state?.cutJobId,
          errorMsg,
        });
        toast.error(errorMsg);
        return;
      }

      // ✅ CRITICAL FIX: KHÔNG set currentStep để giữ nguyên modal (PostprocessSelectionStage)
      // User sẽ thấy skeleton loading trong cột phải (Thành phẩm) thay vì chuyển sang ProcessingStage
      set(s => ({
        videoFactoryState: s.videoFactoryState ? {
          ...s.videoFactoryState,
          // currentStep: 'processing', // ❌ REMOVED: Không chuyển step
          postProdProgress: 5,
          postProdMessage: 'Đang gửi job hậu kỳ...',
          postProdStatus: 'processing' as const,
          processingProgress: 5,
          processingMessage: 'Đang gửi job hậu kỳ...',
          warnings: [],
          lastErrorMessage: undefined,
          // ✅ OPTIMISTIC: Track temporary job ID if needed, but mainly history handles it
          postProcessJobId: optimisticJobId,
        } : s.videoFactoryState
      }));

      // ✅ DEBUG: Log payload verification
      console.log('[VideoFactory] startVideoFactoryPostProcess payload:', payload);

      const res = await fetch('/api/video-factory/postprocess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      // Helper: chuẩn hoá message từ JSON (có thể là string hoặc object { code, message })
      const normalizeErrorMessage = (payload: any, fallback: string) => {
        const raw = payload?.error ?? payload?.message ?? payload;
        if (typeof raw === "string") return raw;
        if (raw && typeof raw === "object") {
          if (typeof raw.message === "string") return raw.message;
          if (typeof raw.code === "string") return `${raw.code}`;
        }
        return fallback;
      };

      // Không đủ credit cho hậu kỳ
      if (res.status === 402) {
        const msg = normalizeErrorMessage(
          json,
          "Bạn không đủ credit để chạy hậu kỳ. Vui lòng nạp thêm credit hoặc giảm số clip / tuỳ chọn."
        );
        toast.error(msg);

        // Relvert optimistic update on 402? Or mark as failed?
        // Mark as failed is better so user sees why it failed
        get().updatePostProcessJob(optimisticJobId, {
          status: 'failed',
          errorMessage: msg
        });

        set(s => ({
          videoFactoryState: s.videoFactoryState ? {
            ...s.videoFactoryState,
            currentStep: 'postprocess',
            processingMessage: msg,
          } : s.videoFactoryState
        }));
        return;
      }

      if (!res.ok || !json?.success) {
        if (res.status === 401) {
          await handleUnauthorizedOnClient('videoFactoryPostProcess');
        }
        console.error('[startVideoFactoryPostProcess] API Error:', res.status, JSON.stringify(json, null, 2)); // ✅ DEBUG: Log full error
        const msg = normalizeErrorMessage(json, "Không thể khởi chạy hậu kỳ");

        // Mark optimistic job as failed
        get().updatePostProcessJob(optimisticJobId, {
          status: 'failed',
          errorMessage: msg
        });

        throw new Error(msg);
      }

      const postJobId = json.data?.job_id || json.data?.jobId || json.data?.id;
      // ✅ PROJECT-CENTRIC: Extract projectId from postprocess response (should be same as cut job's projectId)
      const postProjectId = json.data?.project_id || json.data?.projectId || state.projectId;

      // ✅ CRITICAL: Verify postJobId is valid
      if (!postJobId) {
        throw new Error('Postprocess job ID không tồn tại trong response');
      }

      // ✅ OPTIMISTIC UI: Update temporary job with REAL ID
      devLog('[startVideoFactoryPostProcess] Swapping optimistic ID with real ID', {
        optimisticJobId,
        realJobId: postJobId,
        hint: 'History item will be updated with real ID to match SSE events'
      });

      get().updatePostProcessJob(optimisticJobId, {
        jobId: postJobId, // ✅ CRITICAL: This updates the ID in the history item
        status: 'processing', // Ensure status is processing
        // We can also update other fields if backend returned them
      });

      // ✅ SPLIT-SCREEN MODAL: Toggle modals - Ẩn Main Modal (Panel A), Hiện Result Modal (Panel B)
      // This creates a smooth transition: user sees "Đang xử lý..." immediately in Result Modal
      // ✅ CRITICAL FIX: Log before setting jobId to debug "lost jobId" issue
      devLog('[startVideoFactoryPostProcess] Setting jobId in store', {
        postJobId,
        postProjectId,
        currentJobId: get().videoFactoryState?.jobId,
        currentProjectId: get().videoFactoryState?.projectId,
        hint: 'This should update jobId for SSE connection',
      });

      set(s => ({
        videoFactoryState: s.videoFactoryState ? {
          ...s.videoFactoryState,
          projectId: postProjectId || s.videoFactoryState.projectId, // ✅ PROJECT-CENTRIC: Preserve/update projectId
          jobId: postJobId, // ✅ CRITICAL: Switch SSE channel to postprocess job
          postProcessJobId: postJobId,
          // ✅ CRITICAL FIX (2026-02-05): Set currentStep to 'postprocess' so SSE gating logic
          // in VideoFactoryModal knows we're in postprocess phase.
          // Without this, shouldUseSSE evaluates:
          //   - isPostprocess = false (currentStep still 'processing')
          //   - cutPhaseFinal = true (cut clips are READY, allClipsReady = true)
          //   - isJobFinal = true → shouldUseSSE = false → SSE immediately killed!
          // This caused FE to never receive postprocess SSE events (skeleton loading forever).
          currentStep: 'postprocess',
          jobCreatedAt: Date.now(), // ✅ CRITICAL FIX: Update timestamp to restart polling logic for new job
          // ✅ CRITICAL FIX: KEEP generatedClips to show Cut clips in LEFT column
          // generatedClips contains Cut job's clips (READY status) - these should remain visible
          // RIGHT column (Thành phẩm) will show postProcessHistory with PROCESSING placeholders
          // DO NOT reset generatedClips here - it causes LEFT column to show skeleton loading
          postProdProgress: 10,
          postProdMessage: 'Đã khởi chạy hậu kỳ, đang xử lý...',
          postProdStatus: 'processing' as const,
          processingProgress: 10,
          processingMessage: 'Đã khởi chạy hậu kỳ, đang xử lý...',
          warnings: [],
          lastErrorMessage: undefined,
          // ✅ CRITICAL FIX: Generate new requestId for next operation (prevents zombie requestId)
          requestId: crypto.randomUUID(),
          // ✅ CRITICAL FIX: GIỮ NGUYÊN modal thay vì chuyển sang Panel B
          // UI sẽ hiển thị skeleton loading trong khung đỏ (Thành phẩm) - KHÔNG đóng/chuyển modal
          // PostprocessSelectionStage vẫn hiển thị với 2 cột: Nguyên liệu (trái) + Thành phẩm (phải)
          // KHÔNG thay đổi isMainModalVisible và isResultModalVisible để giữ nguyên UI
        } : s.videoFactoryState
      }));

      // ✅ CRITICAL FIX: Verify jobId was set correctly
      const newState = get().videoFactoryState;
      devLog('[startVideoFactoryPostProcess] jobId set successfully', {
        newJobId: newState?.jobId,
        newProjectId: newState?.projectId,
        newPostProcessJobId: newState?.postProcessJobId,
        isMainModalVisible: newState?.isMainModalVisible,
        isResultModalVisible: newState?.isResultModalVisible,
        hint: 'If jobId is undefined here, there is a state management issue',
      });

      // REMOVED: Old addPostProcessJob call (moved to top for optimistic update)

      toast.success('Đã gửi job hậu kỳ!');
    } catch (error) {
      console.error('[startVideoFactoryPostProcess] Error:', error);

      const errorMessage = error instanceof Error ? error.message : 'Không thể khởi chạy hậu kỳ';
      toast.error(`${errorMessage}. Vui lòng thử lại.`);

      // ✅ CRITICAL FIX: Update phantom job status to 'failed' if API call fails
      // Prevents infinite loading spinner for failed jobs
      const store = get();
      // Ensure we have a valid jobId to update (might be undefined if error happened before creation)
      if (store.videoFactoryState?.postProcessJobId) {
        store.updatePostProcessJob(store.videoFactoryState.postProcessJobId, {
          status: 'failed',
          errorMessage: errorMessage,
        });

        devLog('[startVideoFactoryPostProcess] Updated phantom job to failed', {
          jobId: store.videoFactoryState.postProcessJobId,
          error: errorMessage,
          originalError: error, // ✅ DEBUG: Log original error
          hint: 'UI should show error state instead of loading',
        });
        console.error('[startVideoFactoryPostProcess] Detailed error:', error); // ✅ DEBUG: Force log error
      }

      set(s => ({
        videoFactoryState: s.videoFactoryState ? {
          ...s.videoFactoryState,
          currentStep: 'postprocess', // Keep on postprocess step
          processingMessage: `Gửi job thất bại: ${errorMessage}`,
          warnings: s.videoFactoryState.warnings || [],
          jobId: undefined, // Clear jobId to allow retry? Maybe keep for context?
          // Don't clear postProcessJobId so user can see the failed job in history
        } : s.videoFactoryState
      }));
    }
  },

  // Connect to SSE stream for realtime updates (replaces polling)
  connectSSE: (jobId: string) => {
    // This function will be called by components using useVideoFactorySSE hook
    // It returns a disconnect function
    let disconnectFn: (() => void) | null = null;

    // ✅ EXPOSE: Helper to update state from SSE event (can be called from external callbacks)
    const updateStateFromSSE = (event: any) => {
      const state = get().videoFactoryState;
      /**
       * ✅ CRITICAL FIX (SSE context guard):
       * `connectSSE(jobId)` is called with a specific jobId, but our store state may temporarily
       * hold a different identifier in `videoFactoryState.jobId` during force-refresh / project-centric views.
       *
       * If we hard-require `state.jobId === jobId`, we can accidentally DROP valid SSE events,
       * leaving the UI stuck on skeleton even though SSE already delivered cut clips.
       *
       * Accept events if they match any of the active job identifiers we track.
       */
      const matchesSseContext = Boolean(
        state &&
        (
          state.jobId === jobId ||
          state.cutJobId === jobId ||
          state.postProcessJobId === jobId
        )
      );
      if (!state || !matchesSseContext) return;

      // ✅ DEBUG: Log mọi SSE event đi vào store để dễ theo dõi
      devLog('[VideoFactory][SSE] Incoming event', {
        jobId,
        eventType: event.event,
        step: event.step,
        status: event.status,
        progress: event.progress,
        hasOutput: !!event.output,
        isStepEvent: !!event.step,
      });

      // Normalize job-level status from SSE event.
      // Backend có thể gửi status chi tiết hơn, nhưng ở đây ta chỉ cần 3 trạng thái cho list view.
      const eventStatus = event.status as string | undefined;
      const status: 'processing' | 'completed' | 'failed' =
        eventStatus === 'completed'
          ? 'completed'
          : eventStatus === 'failed'
            ? 'failed'
            : 'processing';

      const progress = event.progress ?? state.processingProgress ?? 0;
      const progressMessage = event.progressMessage || state.processingMessage || '';
      const cutCompleted =
        (event.step === 'cut' && event.status === 'completed') ||
        (event.steps?.cut && event.steps.cut.status === 'completed');
      const isCompleted = status === 'completed' || cutCompleted;
      const finalProgress = isCompleted ? 100 : Math.min(99, progress);
      const finalStatus = isCompleted ? 'completed' : status;

      // ✅ DECOUPLED: Route update to correct stage bucket based on event.step
      // thumbnail step thuộc cut phase (BE gửi step.completed thumbnail với output.clips = cut clips)
      const isCutPhase = event.step === 'cut' || event.step === 'thumbnail' || event.step === 'ingest' || event.step === 'audio_extract' || event.step === 'transcribe';
      const isPostProdPhase = event.step === 'postprocess' || event.step === 'broll_mux' || event.step === 'burn_captions' || event.step === 'concat';

      if (isCutPhase) {
        set(s => ({
          videoFactoryState: s.videoFactoryState ? {
            ...s.videoFactoryState,
            cutProgress: finalProgress,
            cutMessage: progressMessage,
            cutStatus: finalStatus as any,
            // keep for backward compatibility
            processingProgress: finalProgress,
            processingMessage: progressMessage,
          } : s.videoFactoryState
        }));
      } else if (isPostProdPhase) {
        set(s => ({
          videoFactoryState: s.videoFactoryState ? {
            ...s.videoFactoryState,
            postProdProgress: finalProgress,
            postProdMessage: progressMessage,
            postProdStatus: finalStatus as any,
            // keep for backward compatibility
            processingProgress: finalProgress,
            processingMessage: progressMessage,
          } : s.videoFactoryState
        }));
      } else {
        // Fallback for general updates
        set(s => ({
          videoFactoryState: s.videoFactoryState ? {
            ...s.videoFactoryState,
            processingProgress: finalProgress,
            processingMessage: progressMessage,
          } : s.videoFactoryState
        }));
      }

      // ✅ CRITICAL FIX: Handle step updates with outputs for immediate FE display
      // Cut/thumbnail: event.output.clips. Postprocess: event.postprocess.clips (BE gửi riêng để phân biệt).
      if (event.step) {
        const stepOutput = event.output || (event.steps?.[event.step] as any)?.output;
        // ✅ Postprocess step: BE gửi clips trong event.postprocess.clips (không dùng event.output.clips)
        const effectiveOutput =
          event.step === 'postprocess' && (event as any).postprocess?.clips != null
            ? { ...stepOutput, clips: (event as any).postprocess.clips }
            : stepOutput;

        // ✅ DEBUG: Log riêng cho cut/thumbnail step để xem clips / isPartial (BE gửi output.clips cho cả hai)
        if (event.step === 'cut' || event.step === 'thumbnail') {
          devLog('[VideoFactory][SSE] Cut/thumbnail step update', {
            jobId,
            status: event.status,
            isPartial: effectiveOutput?.isPartial,
            completedCount: effectiveOutput?.completedCount,
            totalCount: effectiveOutput?.totalCount,
            clipsPreview: Array.isArray(effectiveOutput?.clips)
              ? effectiveOutput.clips.map((c: any, idx: number) => ({
                idx,
                index: c.index,
                hasUrl: !!c.publicUrl,
                url: c.publicUrl,
                start: c.start ?? c.startTime,
                end: c.end ?? c.endTime,
                duration: c.duration,
                status: c.status,
              }))
              : null,
          });
        }

        // ✅ CRITICAL FIX: Handle both completed and partial updates (incremental clips)
        // Backend sends partial updates with status 'waiting' or 'running' when clips complete incrementally
        // Check for isPartial flag in output to detect incremental updates
        const isPartial = effectiveOutput?.isPartial === true;
        // ✅ CRITICAL FIX: Process output khi completed HOẶC khi có clips (kể cả partial)
        // Đảm bảo clips được update ngay cả khi status là 'waiting' hoặc 'running'
        // ✅ FIX: Bỏ điều kiện status === 'completed' - chỉ cần có clips là hiển thị ngay
        const hasClips = Array.isArray(effectiveOutput?.clips) && effectiveOutput.clips.length > 0;
        const shouldProcessOutput = effectiveOutput && (
          event.status === 'completed' || // Full completion
          (isPartial && (event.step === 'cut' || event.step === 'thumbnail')) || // Partial completion for cut/thumbnail
          hasClips // ✅ CRITICAL FIX: Process khi có clips (BẤT KỂ status nào - waiting/running/completed)
        );

        // ✅ DEBUG: Log để verify logic xử lý partial updates
        if (event.step === 'cut' || event.step === 'thumbnail') {
          devLog('[VideoFactory][SSE] Cut/thumbnail step output processing decision', {
            jobId,
            status: event.status,
            isPartial,
            hasClips,
            clipsCount: effectiveOutput?.clips?.length || 0,
            shouldProcessOutput,
            hint: shouldProcessOutput
              ? 'Will process clips and update UI immediately'
              : 'Will skip processing (no clips or invalid output)',
          });
        }

        if (shouldProcessOutput) {
          // Handle different step types with their outputs
          // ✅ BE gửi step cut và step thumbnail đều có data.output.clips (cut clips) - dùng chung logic
          if (event.step === 'cut' || event.step === 'thumbnail') {
            // ✅ CRITICAL FIX: Cut/thumbnail completed or partially completed - read clips from event.output (data.output.clips)
            // Priority 1: output.clips (primary source from backend)
            // Priority 2: output.segments (legacy fallback)
            const clipsArray = effectiveOutput.clips || effectiveOutput.segments || [];
            const clips = clipsArray.map((c: any, idx: number) => {
              // ✅ CRITICAL FIX: Use standardized publicUrl field (backend always sends this)
              // Backend normalizes all URLs to publicUrl (standardized) + keeps legacy fields for backward compatibility
              // Frontend should use publicUrl (standardized) as primary field
              // ✅ IMPORTANT:
              // - In some SSE payloads, backend may still send only `key` without a computed `publicUrl`.
              // - FE should NOT block rendering of cut clips just because `publicUrl` is missing.
              // - We can still render via Asset Gateway using `videoAssetId` / `thumbnailAssetId` derived from clip UUID.
              const clipUrl =
                c.publicUrl ||
                c.public_url ||
                c.url ||
                c.finalVideoUrl ||
                c.final_video_url ||
                null;
              // ✅ BUG A FIX: Asset Gateway ONLY - NO presigned URLs
              // Architectural fix: Presigned URL + FE direct load = kiến trúc sai
              // Backend SSE sends thumbnailKey (for Asset Gateway resolution) and thumbnailAssetId (primary)
              // Backend GET /api/v1/video-factory/jobs/:id may send thumbnailUrl (LEGACY, not used)
              // FE ONLY uses Asset Gateway: /api/assets/{assetId}

              // ✅ BUG B FIX: Extract thumbnailKey with strict validation - NEVER allow .mp4
              const deriveThumbnailKeyFromVideoKey = (videoKey: string): string => {
                return videoKey.replace(/\.(mp4|webm|mov|avi|mkv)$/i, '_thumb.jpg');
              };

              let thumbnailKey: string | null = null;
              // Priority 1: Use thumbnailKey from backend if it's a valid image key
              if (c.thumbnailKey || c.thumbnail_key) {
                const candidateKey = c.thumbnailKey || c.thumbnail_key;
                if (candidateKey.match(/\.(jpg|jpeg|png|webp)$/i)) {
                  thumbnailKey = candidateKey;
                } else {
                  // ❌ BUG B: Backend sent invalid thumbnailKey (e.g., .mp4) - derive from video key instead
                  devWarn('[connectSSE] Invalid thumbnailKey from backend (not image extension)', {
                    invalidThumbnailKey: candidateKey,
                    clipIndex: c.index ?? idx,
                    hint: 'Backend sent thumbnailKey that is not an image. Deriving from video key instead.',
                  });
                }
              }
              // Priority 2: Derive from storageKey if thumbnailKey is invalid or missing
              if (!thumbnailKey && (c.storageKey || c.key || c.storage_key)) {
                const videoKey = c.storageKey || c.key || c.storage_key;
                if (videoKey.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
                  thumbnailKey = deriveThumbnailKeyFromVideoKey(videoKey);
                }
              }

              // ❌ DEPRECATED: thumbnailUrl is LEGACY - NOT USED anymore (Asset Gateway only)
              const thumbnailUrl = c.thumbnailUrl || c.thumbnail_url || c.thumbnail || null;

              // ✅ FUTURE-PROOF: Extract asset IDs for Asset Gateway pattern
              // Backend now sends thumbnailAssetId and videoAssetId (primary)
              // ✅ NEW: Backend uses clipId (UUID) for assetId: clip-thumb:{clipId}, clip-video:{clipId}
              // ✅ FALLBACK: If missing, derive from clipId (UUID) or fallback to old format (jobId-index) for backward compatibility
              const clipId = c.clipId || c.id; // ✅ FUTURE-PROOF: Use clipId (UUID) if available
              const thumbnailAssetId = c.thumbnailAssetId || c.thumbnail_asset_id ||
                (clipId ? `clip-thumb:${clipId}` : undefined) || // ✅ NEW: Prefer UUID-based asset id (no dependency on thumbnailKey)
                (thumbnailKey ? `clip-thumb:${jobId}-${c.index ?? idx}` : undefined); // ✅ LEGACY: Fallback to old format (key-derived)
              const videoAssetId = c.videoAssetId || c.video_asset_id ||
                (clipId ? `clip-video:${clipId}` : undefined) || // ✅ NEW: Prefer UUID-based asset id (no dependency on publicUrl)
                (clipUrl ? `clip-video:${jobId}-${c.index ?? idx}` : undefined); // ✅ LEGACY: Fallback to old format (url-derived)

              // ✅ CRITICAL FIX: Validate URL format (must be https://, not s3://)
              if (clipUrl && clipUrl.startsWith('s3://')) {
                devWarn('[VideoFactory] Received S3 URI instead of public URL, skipping clip', {
                  clipIndex: idx,
                  url: clipUrl,
                  hint: 'Backend should send public URL (https://), not S3 URI (s3://)',
                });
                return null; // Skip invalid clip
              }

              // ✅ CRITICAL FIX: Map backend format (start/end) to FE format (startTime/endTime)
              const startTime = c.startTime ?? c.start ?? c.start_time ?? 0;
              const endTime = c.endTime ?? c.end ?? c.end_time ?? 0;

              // ✅ CRITICAL FIX: Calculate duration from start/end if backend doesn't provide it
              // Backend should send duration, but fallback to calculating from startTime/endTime
              const durationSeconds = c.duration ?? (endTime > startTime ? endTime - startTime : 0);
              const durationFormatted = durationSeconds > 0 ? `${Math.round(durationSeconds)}s` : '';

              const clip = {
                id: c.clipId || c.id || `clip-${c.index ?? idx}`, // ✅ FUTURE-PROOF: Use clipId (UUID) if available, fallback to generated ID
                clipId: c.clipId || c.id, // ✅ FUTURE-PROOF: Store clipId (UUID) for Asset Gateway
                index: c.index ?? idx, // ✅ LEGACY: Store index for backward compatibility and UI ordering
                // ✅ BUG A FIX: thumbnail and thumbnailKey are LEGACY - NOT USED anymore
                // Architectural fix: We ONLY use Asset Gateway (/api/assets/{assetId})
                thumbnail: thumbnailUrl || '', // ❌ DEPRECATED: Not used (Asset Gateway only)
                thumbnailKey: thumbnailKey || undefined, // ❌ DEPRECATED: Not used (Asset Gateway only)
                thumbnailAssetId: thumbnailAssetId, // ✅ PRIMARY: Asset ID for Asset Gateway
                videoAssetId: videoAssetId, // ✅ PRIMARY: Asset ID for Asset Gateway
                duration: durationFormatted, // ✅ Format: "75s" or "" if no duration
                title: c.title || `Clip ${(c.index ?? idx) + 1}`,
                startTime,
                endTime,
                url: clipUrl, // ✅ Legacy: Public URL (fallback for backward compatibility)
                // ✅ PRODUCTION FIX: Extract status from backend - FE MUST check this before rendering
                // Status: 'READY' = file verified on S3 and ready for playback (FE can render)
                // Status: 'PROCESSING' = file may not exist yet (FE must show loading state)
                // Status: 'FAILED' = file verification failed after max retries (FE must show error state, no retry)
                // ✅ RENAME: Check clipStatus (standard), status_clip (legacy fallback), and status (deprecated)
                // ✅ PRODUCTION: Normalize to 'DONE' (FE expectation) from backend formats ('READY', 'DONE', 'COMPLETED')
                status: (() => {
                  const raw = (c.clipStatus || (c as any).status_clip || c.status || '').toString().toUpperCase();

                  // ✅ Heuristic: if backend did not include status, but we DO have a storageKey,
                  // treat it as DONE to unblock UI (cut clips exist on S3 at this point).
                  // This is safe because we still rely on Asset Gateway for playback; missing assets will just show fallback.
                  const hasStorageKey = !!(c.storageKey ?? c.key ?? c.storage_key);
                  const inferredDone = hasStorageKey && (event.status === 'completed' || event.event === 'step.completed');

                  const s = raw || (inferredDone ? 'READY' : 'PROCESSING');
                  return ((s === 'READY' || s === 'DONE' || s === 'COMPLETED') ? 'DONE' : s === 'FAILED' ? 'FAILED' : 'PROCESSING') as 'DONE' | 'PROCESSING' | 'FAILED';
                })(),
                // ✅ FUTURE-PROOF: Extract failureReason and failureMessage for better UX
                failureReason: c.failureReason || c.failure_message || undefined, // 'VERIFY_TIMEOUT' | 'UPLOAD_FAILED' | 'MEDIACONVERT_ERROR' | undefined
                failureMessage: c.failureMessage || c.failure_message || undefined, // Human-readable error message
                // ✅ FUTURE-PROOF: Extract updatedAt timestamp for PROCESSING timeout calculation (server time)
                updatedAt: c.updatedAt || c.updated_at || undefined, // ISO timestamp - FE uses this for timeout (server time, not client mount time)
                // ✅ OPTIMIZED FIX: Use nullish coalescing (??) to preserve null values
                // Placeholder clips (PROCESSING) will have storageKey = null, completed clips (READY) will have storageKey = <s3-key>
                // ?? operator only treats null/undefined as falsy, preserves null values (unlike || operator)
                storageKey: c.storageKey ?? c.key ?? c.storage_key ?? null,
                key: c.key ?? c.storageKey ?? c.storage_key ?? null,
                bucket: c.bucket, // S3 bucket for reference
              };

              // ✅ DEBUG: Log clip mapping to verify thumbnailKey is included
              devLog('[VideoFactory][SSE] Mapped clip with thumbnail info', {
                jobId,
                step: event.step,
                clipId: clip.id,
                index: clip.index,
                hasThumbnailKey: !!clip.thumbnailKey,
                thumbnailKey: clip.thumbnailKey,
                hasThumbnail: !!clip.thumbnail,
                thumbnail: clip.thumbnail?.substring(0, 50) || '',
                hint: 'If thumbnailKey exists but thumbnail is empty, FE will fetch presigned URL',
              });

              // ✅ DEBUG: Log từng clip đã map để kiểm tra duration/url
              devLog('[VideoFactory][SSE] Mapped clip', {
                jobId,
                step: event.step,
                index: clip.index,
                url: clip.url,
                duration: clip.duration,
                startTime: clip.startTime,
                endTime: clip.endTime,
                status: clip.status,
              });

              return clip;
            }).filter((c: any) => c !== null); // Filter out invalid clips

            // ✅ CRITICAL FIX: Merge new clips with existing clips for incremental updates
            // For partial updates, merge by index to preserve completed clips and update new ones
            const existingClips = state.generatedClips || [];
            let mergedClips = clips;

            if (isPartial && existingClips.length > 0) {
              // ✅ CRITICAL FIX: Merge by index (backend sends index in clips array)
              // Create map of new clips by index
              const newClipsMap = new Map<number, any>();
              clips.forEach((c: any) => {
                const idx = c.index ?? parseInt(c.id?.replace('clip-', '') || '0', 10);
                newClipsMap.set(idx, c);
              });

              // ✅ PRODUCTION FIX: SSE sequencing guard - ignore PROCESSING if already READY
              // SSE events may arrive out of order, so we should never downgrade from READY to PROCESSING
              // Merge: use new clips if available, otherwise keep existing
              mergedClips = existingClips.map((existing: any) => {
                const existingIdx = existing.index ?? parseInt(existing.id?.replace('clip-', '') || '0', 10);
                const newClip = newClipsMap.get(existingIdx);
                // ✅ CRITICAL FIX: Prefer clip with URL (completed) over placeholder (processing)
                // If new clip has URL, use it (completed)
                // If new clip doesn't have URL but existing has URL, keep existing (don't downgrade)
                // If both don't have URL, use new clip (may have updated metadata)
                // ✅ CRITICAL FIX: Don't overwrite presigned thumbnail URL with stale/expired URL from SSE
                // If existing has presigned thumbnail URL, keep it (don't overwrite with empty/stale URL from SSE)
                if (newClip) {
                  // ✅ PRODUCTION FIX: SSE sequencing guard - never downgrade from DONE to PROCESSING
                  const existingStatus = (existing.status || 'PROCESSING').toUpperCase();
                  const newStatus = (newClip.status || 'PROCESSING').toUpperCase();

                  // If existing is DONE and new is PROCESSING, ignore the new status (SSE out of order)
                  const isExistingDone = existingStatus === 'READY' || existingStatus === 'DONE' || existingStatus === 'COMPLETED';
                  const finalStatus = (isExistingDone && newStatus === 'PROCESSING')
                    ? 'DONE'
                    : newStatus;

                  const newClipHasUrl = !!(newClip.url && newClip.url.startsWith('http'));
                  const existingHasUrl = !!(existing.url && existing.url.startsWith('http'));

                  if (newClipHasUrl) {
                    // New clip is completed - use it, but preserve existing presigned thumbnail URL if new clip doesn't have one
                    return {
                      ...newClip,
                      // ✅ PRODUCTION FIX: Use finalStatus (with sequencing guard)
                      status: finalStatus,
                      thumbnail: newClip.thumbnail || existing.thumbnail || '', // Preserve existing presigned URL
                    };
                  } else if (existingHasUrl) {
                    // Existing clip is completed, new clip is placeholder - keep existing (don't downgrade)
                    return existing;
                  } else {
                    // Both are placeholders - use new clip (may have updated metadata), but preserve existing presigned thumbnail URL
                    return {
                      ...newClip,
                      thumbnail: newClip.thumbnail || existing.thumbnail || '', // Preserve existing presigned URL
                    };
                  }
                }
                return existing; // No new clip - keep existing
              });

              // ✅ CRITICAL FIX: Add any new clips that don't exist in existing (for first partial update)
              clips.forEach((newClip: any) => {
                const newIdx = newClip.index ?? parseInt(newClip.id?.replace('clip-', '') || '0', 10);
                const exists = mergedClips.some((c: any) => {
                  const cIdx = c.index ?? parseInt(c.id?.replace('clip-', '') || '0', 10);
                  return cIdx === newIdx;
                });
                if (!exists) {
                  mergedClips.push(newClip);
                }
              });

              // ✅ CRITICAL FIX: Sort by index to maintain order
              mergedClips.sort((a: any, b: any) => {
                const aIdx = a.index ?? parseInt(a.id?.replace('clip-', '') || '0', 10);
                const bIdx = b.index ?? parseInt(b.id?.replace('clip-', '') || '0', 10);
                return aIdx - bIdx;
              });

              devLog('[VideoFactory] Merged clips (partial update)', {
                existingCount: existingClips.length,
                newCount: clips.length,
                mergedCount: mergedClips.length,
                isPartial,
                hint: 'Clips merged by index for incremental updates',
              });
            } else if (!isPartial && clips.length > 0) {
              // ✅ CRITICAL FIX: Full completion - replace all clips
              devLog('[VideoFactory] Full completion - replacing all clips', {
                clipCount: clips.length,
                hint: 'All clips completed - replacing existing clips',
              });
            }

            set(s => {
              // ✅ PRODUCTION FIX: Extract expectedClipCount from step output (SSE event) FIRST
              // Preserve existing expectedClipCount if SSE doesn't provide it (backward compatibility)
              // Must be calculated BEFORE shouldTransitionToPostprocess to use in condition
              const sseExpectedClipCount = stepOutput?.expectedClipCount || stepOutput?.totalCount;
              const finalExpectedClipCount = sseExpectedClipCount || s.videoFactoryState?.expectedClipCount;

              // ✅ CRITICAL FIX: Determine if we should transition to postprocess
              // Transition when:
              // 1. We have at least 1 clip (even if PROCESSING - user can see progress)
              // 2. AND we're currently in 'processing' step (not already in postprocess)
              // 3. AND (cut step is completed OR at least 1 clip has a valid URL OR we have expectedClipCount clips)
              // ✅ USER REQUIREMENT: Hiển thị clips ngay khi cut completed, kể cả khi một số vẫn PROCESSING
              // User cần thấy danh sách clips để chọn làm hậu kỳ ngay khi cut step completed
              const hasClips = mergedClips.length > 0;
              const isCutOrThumbnailStep = event.step === 'cut' || event.step === 'thumbnail';
              const isCurrentlyProcessing = s.videoFactoryState?.currentStep === 'processing';
              const cutCompleted = event.status === 'completed';
              const hasCompletedClip = mergedClips.some((c: any) => c.url && c.url.startsWith('http'));
              // ✅ CRITICAL FIX: Calculate hasExpectedClipCount AFTER finalExpectedClipCount is determined
              const hasExpectedClipCount = finalExpectedClipCount > 0 && mergedClips.length >= finalExpectedClipCount;

              // ✅ CRITICAL FIX: Transition when cut/thumbnail step completed OR we have all expected clips (even if some are PROCESSING)
              const shouldTransitionToPostprocess = hasClips &&
                isCutOrThumbnailStep &&
                isCurrentlyProcessing &&
                (cutCompleted || hasCompletedClip || hasExpectedClipCount);

              // ✅ DEBUG: Log transition decision
              devLog('[VideoFactory][SSE] Transition decision', {
                jobId,
                hasClips,
                isCutOrThumbnailStep,
                isCurrentlyProcessing,
                cutCompleted,
                hasCompletedClip,
                hasExpectedClipCount,
                mergedClipsCount: mergedClips.length,
                finalExpectedClipCount,
                shouldTransitionToPostprocess,
                currentStep: s.videoFactoryState?.currentStep,
                clipsWithUrl: mergedClips.filter((c: any) => c.url && c.url.startsWith('http')).length,
                clipsWithStatus: mergedClips.map((c: any) => ({
                  index: c.index,
                  status: c.status,
                  hasUrl: !!(c.url && c.url.startsWith('http')),
                })),
                sseExpectedClipCount,
                existingExpectedClipCount: s.videoFactoryState?.expectedClipCount,
                hint: 'Transition to postprocess when cut completed OR has completed clips OR has all expected clips',
              });

              // ✅ HARD GUARD: In postprocess step, NEVER overwrite cut clips (`generatedClips`).
              // We allow cut clips to be set during cut/thumbnail phase only.
              const alreadyPostprocess = s.videoFactoryState?.currentStep === 'postprocess';
              const shouldPreserveGeneratedClips = alreadyPostprocess;
              return {
                videoFactoryState: s.videoFactoryState ? {
                  ...s.videoFactoryState,
                  generatedClips: shouldPreserveGeneratedClips
                    ? s.videoFactoryState.generatedClips
                    : (mergedClips.length ? mergedClips : s.videoFactoryState?.generatedClips),
                  expectedClipCount: finalExpectedClipCount,
                  processingProgress: finalProgress,
                  processingMessage: progressMessage,
                  currentStep: shouldTransitionToPostprocess ? 'postprocess' : s.videoFactoryState.currentStep,
                } : s.videoFactoryState
              };
            });
          } else if (event.step === 'transcribe' && stepOutput.transcript) {
            // ✅ CRITICAL FIX: Transcribe completed - save transcript for reuse
            // Transcript is stored in project, but we can also store in state for immediate display
            set(s => ({
              videoFactoryState: s.videoFactoryState ? {
                ...s.videoFactoryState,
                transcript: stepOutput.transcript,
                processingProgress: finalProgress,
                processingMessage: progressMessage,
              } : s.videoFactoryState
            }));
          } else if (event.step === 'postprocess') {
            // ✅ CRITICAL FIX: Postprocess completed - handle different postprocess types
            // postprocess can be: concat (final video), burn_captions (subtitles), broll_insertion (B-roll)
            // ✅ IMPORTANT: BE gửi clips hậu kỳ trong `event.postprocess.clips` (wired into effectiveOutput.clips)
            const ppOutput: any = effectiveOutput || stepOutput || {};
            const updates: any = {
              processingProgress: finalProgress,
              processingMessage: progressMessage,
            };

            // Final video (concat)
            if (ppOutput.finalUrl || ppOutput.final_url) {
              updates.finalUrl = ppOutput.finalUrl || ppOutput.final_url;
            }

            // B-roll inserted clips
            if (ppOutput.brollInsertedUrls || ppOutput.brollInsertedKeys) {
              const brollUrls = ppOutput.brollInsertedUrls || [];
              const brollKeys = ppOutput.brollInsertedKeys || [];
              // Update existing clips with B-roll versions if available
              updates.brollClips = brollUrls.map((url: string, idx: number) => ({
                id: `broll-${idx}`,
                url,
                storageKey: brollKeys[idx],
              }));
            }

            // Subtitles (burn_captions) - final video with captions
            if (ppOutput.burnedUrl || ppOutput.burnedKey) {
              updates.finalUrl = ppOutput.burnedUrl || ppOutput.finalUrl;
              updates.hasSubtitles = true;
            }

            // ✅ SPLIT-SCREEN MODAL: Update postProcessHistory when postprocess step completes
            // Extract clips from stepOutput (individual clips or final video)
            const postprocessClips: Array<{
              id: string;
              url?: string;
              thumbnailUrl?: string;
              duration?: number;
              startTime?: number;
              endTime?: number;
              clipStatus?: 'PROCESSING' | 'READY' | 'FAILED';
              createdAt?: string;
            }> = [];

            // Individual clips (from brollInsertedUrls or clips array)
            if (ppOutput.clips && Array.isArray(ppOutput.clips)) {
              postprocessClips.push(...ppOutput.clips.map((c: any, idx: number) => {
                const url = c.url || c.publicUrl;
                const thumb = c.thumbnailUrl || c.thumbnail;
                const hasVideo = !!url;
                const hasThumb = !!thumb;
                const rawStatus = (c.status || '').toUpperCase();

                // ✅ INVARIANT: Clip chỉ DONE khi có cả video + thumbnail
                let clipStatus: 'PROCESSING' | 'READY' | 'FAILED';
                if (rawStatus === 'FAILED') {
                  clipStatus = 'FAILED';
                } else if (hasVideo && hasThumb && (rawStatus === 'READY' || rawStatus === 'DONE' || rawStatus === 'COMPLETED' || !rawStatus)) {
                  // NOTE: Chúng ta vẫn dùng 'READY' ở đây vì history mapping phía trên sẽ convert READY → DONE
                  clipStatus = 'READY';
                } else {
                  clipStatus = 'PROCESSING';
                }

                return {
                  id: c.id || c.clipId || `clip-${idx}`,
                  // ✅ CRITICAL: index dùng để ghép đúng slot skeleton (placeholder) cho jobId hiện tại
                  // (đặc biệt khi incoming không có originalClipId/key)
                  index: c.index ?? idx,
                  title: c.title, // ✅ Map title from SSE
                  url,
                  thumbnailUrl: thumb,
                  duration: c.duration,
                  startTime: c.startTime || c.start,
                  endTime: c.endTime || c.end,
                  clipStatus,
                  // ✅ Best-effort stable IDs (nếu BE có gửi) để matching an toàn hơn index
                  originalClipId: c.originalClipId,
                  originalClipKey: c.originalClipKey,
                  createdAt: c.createdAt || new Date().toISOString(),
                };
              }));
            } else if (ppOutput.brollInsertedUrls && Array.isArray(ppOutput.brollInsertedUrls)) {
              // B-roll inserted clips
              postprocessClips.push(...ppOutput.brollInsertedUrls.map((url: string, idx: number) => ({
                id: `broll-clip-${idx}`,
                url,
                thumbnailUrl: ppOutput.brollInsertedThumbnails?.[idx],
                clipStatus: 'READY' as const,
                createdAt: new Date().toISOString(),
                index: idx,
              })));
            }

            // Update postProcessHistory if we have clips and jobId
            if (postprocessClips.length > 0 && jobId) {
              get().updatePostProcessJob(jobId, {
                status: event.status === 'completed' ? 'completed' : event.status === 'failed' ? 'failed' : 'processing',
                clips: postprocessClips,
              });
            }

            set(s => ({
              videoFactoryState: s.videoFactoryState ? {
                ...s.videoFactoryState,
                ...updates,
              } : s.videoFactoryState
            }));
          }
        }
      }

      // ✅ CRITICAL FIX: Also handle snapshot events with all step outputs
      if (event.event === 'snapshot' && event.steps) {
        // Process all completed steps from snapshot
        Object.entries(event.steps).forEach(([stepName, stepState]: [string, any]) => {
          if (stepState.status === 'completed' && stepState.output) {
            if (stepName === 'cut' && stepState.output) {
              // ✅ OPTIMIZATION: Only use clips field (outputs is deprecated)
              const clipsArray = stepState.output.clips || stepState.output.segments || [];
              const clips = clipsArray.map((c: any, idx: number) => {
                // ✅ CRITICAL FIX: Use standardized publicUrl field (backend always sends this)
                // Backend normalizes all URLs to publicUrl (standardized) + keeps legacy fields for backward compatibility
                // Frontend should use publicUrl (standardized) as primary field
                const clipUrl = c.publicUrl; // ✅ CRITICAL: Use standardized field (primary)
                // ✅ CRITICAL FIX: Extract thumbnail from multiple possible fields (backend may send thumbnailUrl, thumbnail_url, or thumbnail)
                const thumbnailUrl = c.thumbnailUrl || c.thumbnail_url || c.thumbnail || ''; // ✅ CRITICAL: Use standardized field (primary) with fallback

                // ✅ CRITICAL FIX: Validate URL format (must be https://, not s3://)
                if (clipUrl && clipUrl.startsWith('s3://')) {
                  devWarn('[VideoFactory] Received S3 URI instead of public URL in snapshot, skipping clip', {
                    clipIndex: idx,
                    url: clipUrl,
                    hint: 'Backend should send public URL (https://), not S3 URI (s3://)',
                  });
                  return null; // Skip invalid clip
                }

                return {
                  id: c.id || `clip-${idx}`,
                  thumbnail: thumbnailUrl, // ✅ Public URL to thumbnail (can be empty if no thumbnail)
                  duration: c.duration ? `${Math.round(c.duration)}s` : '',
                  title: c.title || `Clip ${idx + 1}`,
                  startTime: c.startTime ?? c.start ?? c.start_time ?? 0,
                  endTime: c.endTime ?? c.end ?? c.end_time ?? 0,
                  url: clipUrl, // ✅ Public URL (https://bucket.s3.region.amazonaws.com/key) - standardized field
                  storageKey: c.storageKey || c.key || c.storage_key, // ✅ Use standardized field (primary)
                  bucket: c.bucket, // S3 bucket for reference
                  // ✅ PRODUCTION: Normalize to 'DONE' (FE expectation) from backend formats ('READY', 'DONE', 'COMPLETED')
                  status: (() => {
                    const s = (c.clipStatus || (c as any).status_clip || c.status || 'PROCESSING').toUpperCase();
                    return ((s === 'READY' || s === 'DONE' || s === 'COMPLETED') ? 'DONE' : s === 'FAILED' ? 'FAILED' : 'PROCESSING') as 'DONE' | 'PROCESSING' | 'FAILED';
                  })(),
                };
              }).filter((c: any) => c !== null); // Filter out invalid clips

              // ✅ PRODUCTION FIX: Extract expectedClipCount from snapshot step output
              // Preserve existing expectedClipCount if snapshot doesn't provide it
              const snapshotExpectedClipCount = stepState.output?.expectedClipCount || stepState.output?.totalCount;

              set(s => {
                const finalSnapshotExpectedClipCount = snapshotExpectedClipCount || s.videoFactoryState?.expectedClipCount;
                // ✅ HARD GUARD: In postprocess step, NEVER overwrite cut clips (`generatedClips`) from snapshots.
                const alreadyPostprocess = s.videoFactoryState?.currentStep === 'postprocess';
                const shouldPreserveGeneratedClips = alreadyPostprocess;
                return {
                  videoFactoryState: s.videoFactoryState ? {
                    ...s.videoFactoryState,
                    generatedClips: shouldPreserveGeneratedClips
                      ? s.videoFactoryState.generatedClips
                      : (clips.length ? clips : s.videoFactoryState?.generatedClips),
                    expectedClipCount: finalSnapshotExpectedClipCount,
                  } : s.videoFactoryState
                };
              });
            } else if (stepName === 'transcribe' && stepState.output?.transcript) {
              set(s => ({
                videoFactoryState: s.videoFactoryState ? {
                  ...s.videoFactoryState,
                  transcript: stepState.output.transcript,
                } : s.videoFactoryState
              }));
            } else if (stepName === 'postprocess' && stepState.output) {
              // ✅ CRITICAL FIX: Handle all postprocess outputs (concat, burn_captions, broll_insertion)
              const updates: any = {};

              // Final video (concat)
              if (stepState.output.finalUrl || stepState.output.final_url) {
                updates.finalUrl = stepState.output.finalUrl || stepState.output.final_url;
              }

              // B-roll inserted clips
              if (stepState.output.brollInsertedUrls || stepState.output.brollInsertedKeys) {
                const brollUrls = stepState.output.brollInsertedUrls || [];
                const brollKeys = stepState.output.brollInsertedKeys || [];
                updates.brollClips = brollUrls.map((url: string, idx: number) => ({
                  id: `broll-${idx}`,
                  url,
                  storageKey: brollKeys[idx],
                }));
              }

              // Subtitles (burn_captions)
              if (stepState.output.burnedUrl || stepState.output.burnedKey) {
                updates.finalUrl = stepState.output.burnedUrl || updates.finalUrl;
                updates.hasSubtitles = true;
              }

              if (Object.keys(updates).length > 0) {
                set(s => ({
                  videoFactoryState: s.videoFactoryState ? {
                    ...s.videoFactoryState,
                    ...updates,
                  } : s.videoFactoryState
                }));
              }

              // ✅ CRITICAL FIX (2026-02-13): Update postProcessHistory with clips from snapshot.
              // On SSE reconnect, the snapshot contains completed postprocess data in
              // steps.postprocess.output.clips (or steps.postprocess.postprocess.clips).
              // Without this, postProcessHistory clips remain as skeleton/PROCESSING forever.
              const ppClips = stepState.postprocess?.clips || stepState.output?.clips || [];
              if (Array.isArray(ppClips) && ppClips.length > 0) {
                const currentJobId = get().videoFactoryState?.jobId || get().videoFactoryState?.postProcessJobId;
                if (currentJobId) {
                  const mappedPpClips = ppClips.map((c: any, idx: number) => {
                    const clipUrl = c.publicUrl || c.url;
                    const rawStatus = (c.clipStatus || c.status || (clipUrl ? 'DONE' : 'PROCESSING')).toString().toUpperCase();
                    const clipStatus = (rawStatus === 'FAILED' ? 'FAILED'
                      : rawStatus === 'READY' || rawStatus === 'DONE' || rawStatus === 'COMPLETED' ? 'DONE'
                      : 'PROCESSING') as 'PROCESSING' | 'READY' | 'FAILED' | 'DONE';
                    return {
                      id: c.id || `post-clip-${idx}`,
                      index: c.index ?? idx,
                      url: clipUrl,
                      finalVideoUrl: clipUrl,
                      thumbnailUrl: c.thumbnailUrl || c.thumbnail || '',
                      status: rawStatus,
                      clipStatus,
                      originalClipId: c.originalClipId || c.id,
                      storageKey: c.storageKey || c.key || '',
                      key: c.key || c.storageKey || '',
                      createdAt: c.createdAt || new Date().toISOString(),
                    };
                  });
                  get().updatePostProcessJob(currentJobId, {
                    status: stepState.status === 'completed' ? 'completed' : 'processing',
                    clips: mappedPpClips,
                  });
                  console.log('[SSE Snapshot] Updated postProcessHistory clips from snapshot', {
                    jobId: currentJobId,
                    clipsCount: mappedPpClips.length,
                  });
                }
              }
            }
          }
        });
      }

      // Update progress
      set(s => ({
        videoFactoryState: s.videoFactoryState ? {
          ...s.videoFactoryState,
          processingProgress: finalProgress,
          processingMessage: progressMessage,
          currentStep: status === 'failed'
            ? 'postprod'
            : s.videoFactoryState.currentStep,
        } : s.videoFactoryState
      }));

      // ✅ PROJECT-CENTRIC: Sync progress to VideoProject list using projectId (preferred) or jobId (legacy)
      const videoProjectsStore = useVideoProjectsStore.getState();
      const currentState = get().videoFactoryState; // ✅ FIX: Use different variable name to avoid redeclaration
      const projectIndex = videoProjectsStore.videoProjects.findIndex(p =>
        (currentState?.projectId && p.projectId === currentState.projectId) ||
        (jobId && p.jobId === jobId)
      );
      if (projectIndex >= 0) {
        const updatedProjects = [...videoProjectsStore.videoProjects];
        updatedProjects[projectIndex] = {
          ...updatedProjects[projectIndex],
          status: finalStatus as 'processing' | 'completed' | 'failed',
          progress: finalProgress,
          progressMessage,
        };
        videoProjectsStore.videoProjects = updatedProjects;
        // ✅ CRITICAL FIX: Safely exclude originalFile (optional property) when saving to localStorage
        saveToLocalStorage(getVideoProjectsKey(), updatedProjects.map((project) => {
          const { originalFile, ...rest } = project;
          return rest;
        }));
      }
    };

    // Return disconnect function (will be set by hook)
    return () => {
      if (disconnectFn) {
        disconnectFn();
        disconnectFn = null;
      }
    };
  },

  /**
   * Poll job status from Server A (proxy to Server B).
   *
   * NOTE:
   * - Kept for background compatibility (list view, etc.).
   * - Uses lightweight status endpoint that exposes `isFinal` and `nextPollAfterSec`.
   * - SSE vẫn là cơ chế chính cho realtime trong các view chi tiết.
   *
   * @returns {Promise<{ isFinal: boolean; nextPollAfterSec: number }>}
   *          isFinal: true nếu job ở trạng thái cuối (FE nên dừng poll).
   *          nextPollAfterSec: gợi ý khoảng poll tiếp theo (giây), đã có default.
   */
  pollVideoFactoryStatus: async (): Promise<{ isFinal: boolean; nextPollAfterSec: number }> => {
    const state = get().videoFactoryState;
    // ✅ OPTIMIZATION: Only use jobId for polling (job endpoint already returns project data)
    const jobId = state?.jobId || state?.cutJobId;
    if (!jobId) {
      // Nếu không có jobId, coi như đã final và không cần poll nữa.
      return { isFinal: true, nextPollAfterSec: 0 };
    }

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        await handleUnauthorizedOnClient('videoFactoryPoll');
        return { isFinal: true, nextPollAfterSec: 60 };
      }

      // ✅ OPTIMIZATION: Always use job endpoint (it returns project data with outputClips)
      // Server B's GET /jobs/:id endpoint already includes project.outputClips in the response
      // This prevents redundant polling of both project and job endpoints
      const apiUrl = `/api/video-factory/jobs/${jobId}`;

      const res = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        if (res.status === 401) {
          await handleUnauthorizedOnClient('videoFactoryPoll');
        }
        throw new Error(json?.error || 'Không thể lấy trạng thái job');
      }

      // ✅ CRITICAL: Parse response structure correctly
      // Job endpoint returns: { success: true, data: { job: {...}, project: {...}, ... } }
      // Server B returns: { data: { job: {...}, project: {...}, ... } }
      const data = json.data || json;

      // ✅ OPTIMIZATION: Job endpoint response includes both job and project data
      // Use job for status, project for clips (project.outputClips)
      const job = data.job || data.cutJob || data;
      const project = data.project || null;

      // ✅ CRITICAL FIX: Handle case where job is null (project exists but no cut job yet)
      if (!job) {
        devLog('[pollVideoFactoryStatus] Job is null - project may not have cut job yet', {
          jobId,
          hasProject: !!project,
          hasJob: !!data.job,
          hasCutJob: !!data.cutJob,
          hint: 'Job may not be created yet or is still processing',
        });
        // Return as if job is still processing (not final) - allow polling to continue
        return { isFinal: false, nextPollAfterSec: 60 };
      }

      const status = job?.status as string | undefined; // ✅ FIX: Use optional chaining (defensive)

      // ✅ CRITICAL: Parse isFinal correctly - this is the KEY to stop infinite polling
      // isFinal should be at job level, not nested
      const isFinalFromApi: boolean =
        typeof job?.isFinal === 'boolean'
          ? job.isFinal
          : Boolean(data.isFinal); // ✅ FIX: Use optional chaining, fallback to data level if not at job level

      const nextPollAfterSecFromApi: number =
        typeof job?.nextPollAfterSec === 'number'
          ? job.nextPollAfterSec
          : typeof data.nextPollAfterSec === 'number'
            ? data.nextPollAfterSec
            : 60; // ✅ FIX: Use optional chaining

      // ✅ DEBUG: Log isFinal to verify it's being parsed correctly
      if (isFinalFromApi) {
        devLog('[pollVideoFactoryStatus] Job is FINAL - polling will stop', {
          projectId: state.projectId,
          jobId: state.jobId,
          status,
          isFinalFromApi,
          nextPollAfterSecFromApi,
        });
      }

      const progress = job?.progress ?? state.processingProgress ?? 0; // ✅ FIX: Use optional chaining
      const progressMessage =
        job?.progressMessage ||
        job?.progress_message ||
        state.processingMessage ||
        ''; // ✅ FIX: Use optional chaining

      // ✅ CRITICAL: Final state semantics - trust isFinal from API FIRST, then fallback to status
      // ✅ UX REQUEST: Consider job "done" on FE once CUT step is completed (even if postprocess still running)
      const FINAL_STATES = ['completed', 'failed', 'cancelled', 'abandoned'];
      const cutDone =
        (job?.steps && job.steps.cut && job.steps.cut.status === 'completed') ||
        (job?.steps && job.steps.cut && job.steps.cut.status === 'waiting' && job.steps.cut.isPartial === false); // ✅ FIX: Use optional chaining
      const isFinalComputed =
        isFinalFromApi || cutDone || (status ? FINAL_STATES.includes(status) : false);

      // ✅ CRITICAL: If isFinal is true, nextPollAfterSec MUST be 0 to stop polling immediately
      // If isFinal is false, use the recommended interval from BE (minimum 30s to reduce load)
      const finalNextPollAfterSec = isFinalComputed ? 0 : nextPollAfterSecFromApi;

      const finalProgress = isFinalComputed ? 100 : Math.min(99, progress ?? 0);
      const finalStatus: 'processing' | 'completed' | 'failed' =
        status === 'completed'
          ? 'completed'
          : status === 'failed'
            ? 'failed'
            : 'processing';

      /**
       * ✅ CUT CLIPS MAPPING (Polling)
       *
       * Why:
       * - This poll endpoint is primarily for job progress.
       * - But for robustness (SSE disconnect / late hydration), we still map CUT clips from `output_clips`.
       *
       * Invariants:
       * - These are CUT clips only.
       * - Postprocess MUST NOT use / fall back to `output_clips` for postprocess history.
       */
      const projectCutClips = (project as any)?.output_clips || (job as any)?.output_clips || []; // snake_case from BE
      const mappedCutClips: GeneratedVideoClip[] = Array.isArray(projectCutClips)
        ? projectCutClips.map((c: any, idx: number) => {
          const clipUrl =
            c.publicUrl ||
            c.public_url ||
            c.url ||
            c.finalVideoUrl ||
            c.final_video_url ||
            '';
          const thumbnailUrl =
            c.thumbnailUrl ||
            c.thumbnail_url ||
            c.thumbnail ||
            '';

          const startTime = c.startTime ?? c.start ?? c.start_time ?? 0;
          const endTime = c.endTime ?? c.end ?? c.end_time ?? 0;

          const statusUpper = (c.clipStatus || c.status_clip || c.status || 'PROCESSING').toString().toUpperCase();
          const normalizedStatus = (statusUpper === 'FAILED')
            ? 'FAILED'
            : (statusUpper === 'READY' || statusUpper === 'DONE' || statusUpper === 'COMPLETED')
              ? 'DONE'
              : 'PROCESSING';

          return {
            id: c.clipId || c.id || `clip-${idx}`,
            thumbnail: thumbnailUrl,
            duration: c.duration ? `${Math.round(Number(c.duration))}s` : '',
            title: c.title || `Clip ${idx + 1}`,
            startTime,
            endTime,
            url: clipUrl,
            storageKey: c.storageKey || c.key || c.storage_key,
            bucket: c.bucket,
            status: normalizedStatus as any,
          };
        })
        : [];

      // ✅ DECOUPLED: Route update to correct stage bucket
      const isPostProdJob = job?.jobSubtype === 'postprocess' || job?.jobSubtype === 'post_prod' || job?.type === 'postprocess';

      if (!isPostProdJob) {
        // Cut Phase
        set(s => {
          if (!s.videoFactoryState) return s;
          // ✅ HARD GUARD: In postprocess step, NEVER overwrite cut clips (`generatedClips`) from polling.
          const inPostprocess = s.videoFactoryState.currentStep === 'postprocess';
          const shouldPreserveGeneratedClips = inPostprocess;
          return {
            videoFactoryState: {
              ...s.videoFactoryState,
              cutProgress: finalProgress,
              cutMessage: progressMessage || (status === 'failed' ? (job?.errorMessage || job?.error_message || 'Cắt clip thất bại.') : s.videoFactoryState.cutMessage || ''),
              cutStatus: finalStatus,
              processingProgress: finalProgress,
              processingMessage: progressMessage || s.videoFactoryState.processingMessage,
              currentStep: s.videoFactoryState.currentStep,
              generatedClips: shouldPreserveGeneratedClips
                ? s.videoFactoryState.generatedClips
                : (mappedCutClips.length > 0 ? mappedCutClips : s.videoFactoryState.generatedClips),
            }
          };
        });
      } else {
        // Post-Prod Phase
        set(s => ({
          videoFactoryState: s.videoFactoryState ? {
            ...s.videoFactoryState,
            postProdProgress: finalProgress,
            postProdMessage: progressMessage || (status === 'failed' ? (job?.errorMessage || job?.error_message || 'Hậu kỳ thất bại.') : s.videoFactoryState.postProdMessage || ''),
            postProdStatus: finalStatus,
            // Legacy
            processingProgress: finalProgress,
            processingMessage: progressMessage || s.videoFactoryState.processingMessage,
            currentStep: s.videoFactoryState.currentStep,
          } : s.videoFactoryState
        }));
      }

      // ✅ PROJECT-CENTRIC: Sync progress to VideoProject list using projectId (preferred) or jobId (legacy)
      const videoProjectsStore = useVideoProjectsStore.getState();
      const projectIndex = videoProjectsStore.videoProjects.findIndex(p =>
        (state.projectId && p.projectId === state.projectId) ||
        (state.jobId && p.jobId === state.jobId)
      );
      if (projectIndex >= 0) {
        const updatedProjects = [...videoProjectsStore.videoProjects];
        updatedProjects[projectIndex] = {
          ...updatedProjects[projectIndex],
          status: finalStatus as 'processing' | 'completed' | 'failed',
          progress: finalProgress,
          progressMessage,
        };
        videoProjectsStore.videoProjects = updatedProjects;
        // ✅ CRITICAL FIX: Safely exclude originalFile (optional property) when saving to localStorage
        saveToLocalStorage(getVideoProjectsKey(), updatedProjects.map((project) => {
          const { originalFile, ...rest } = project;
          return rest;
        }));
      }
      // ✅ CRITICAL FIX: Sync postProcessHistory clips from polling input (only for THIS jobId)
      // Only update the postprocess entry that matches current jobId - never touch cut clips.
      //
      // ✅ DATA SEPARATION:
      // - NEVER fall back to `project.output_clips` here (that is CUT clips).
      // - Use `data.postprocessOutputs` (outputs table/media_assets hydration) OR `project.postprocess_output_clips` (atomic worker writes).
      const postprocessOutputs =
        (data as any)?.postprocessOutputs ||
        (data as any)?.postprocess_outputs ||
        (project as any)?.postprocessOutputs ||
        (project as any)?.postprocess_outputs ||
        [];

      const projectPostprocessClips =
        (project as any)?.postprocess_output_clips ||
        (job as any)?.postprocess_output_clips ||
        [];

      const rawClips = (Array.isArray(postprocessOutputs) && postprocessOutputs.length > 0)
        ? postprocessOutputs
        : (Array.isArray(projectPostprocessClips) ? projectPostprocessClips : []);

      // ✅ If we are using postprocessOutputs (outputs table), enforce jobId match strictly.
      // If we are using project.postprocess_output_clips, it represents the current postprocess run state, so include all.
      const isFromOutputsRepo = Array.isArray(postprocessOutputs) && postprocessOutputs.length > 0;
      const clipsForThisJob = isFromOutputsRepo
        ? rawClips.filter((c: any) => {
          const clipJobId =
            c.postprocess_job_id ??
            c.postprocessJobId ??
            c.metadata?.postprocessJobId ??
            c.job_id ??
            c.jobId;
          return clipJobId === jobId;
        })
        : rawClips;

      // Map to FE format
      const mappedPostprocessClips = clipsForThisJob.map((c: any, idx: number) => {
        // ✅ CRITICAL FIX: Try to parse index from filename/key if missing from metadata
        // Backend output list is often reverse chronological, so array index is unreliable
        // Key format: ...source_16x9_0_clip0_broll_visual_clip_0_...
        let parsedIndex =
          c.index ??
          c.clipIndex ??
          c.metadata?.clipIndex ??
          c.metadata?.index;
        if (parsedIndex === undefined && (c.finalVideoKey || c.key || c.storageKey || c.finalVideoUrl || c.url)) {
          const keyInfo = c.finalVideoKey || c.key || c.storageKey || c.finalVideoUrl || c.url;
          const match = keyInfo.match(/_clip(\d+)_/i) || keyInfo.match(/_(\d+)\./);
          if (match && match[1]) {
            parsedIndex = parseInt(match[1], 10);
          }
        }

        const clipUrl = c.finalVideoUrl || c.url || c.public_url || c.publicUrl;
        const clipThumb = c.thumbnailUrl || c.thumbnail_url || c.thumbnail;
        const hasVideo = !!clipUrl;
        const hasThumb = !!clipThumb;
        const rawStatus = (c.clipStatus || c.status_clip || c.status || 'PROCESSING').toUpperCase();

        // ✅ INVARIANT: Clip chỉ DONE khi có cả video + thumbnail
        let mappedStatus: 'DONE' | 'PROCESSING' | 'FAILED';
        if (rawStatus === 'FAILED') {
          mappedStatus = 'FAILED';
        } else if (hasVideo && hasThumb && (rawStatus === 'READY' || rawStatus === 'DONE' || rawStatus === 'COMPLETED' || !rawStatus)) {
          mappedStatus = 'DONE';
        } else {
          mappedStatus = 'PROCESSING';
        }

        // ✅ Stable matching link (preferred): originalClipId/originalClipKey provided by BE
        // - For postprocess_output_clips: originalClipId = cut clip UUID
        // - For outputs repo: metadata.clipIndex is more reliable; original clip linkage may not exist
        const originalClipId =
          c.originalClipId ??
          c.original_clip_id ??
          c.metadata?.originalClipId ??
          c.metadata?.original_clip_id ??
          c.parentCutClipId ??
          c.parent_cut_clip_id ??
          undefined;

        const originalClipKey =
          c.originalClipKey ??
          c.original_clip_key ??
          c.metadata?.originalClipKey ??
          c.metadata?.original_clip_key ??
          undefined;

        return {
          id: c.id,
          // Match ID logic in addPostProcessJob/updatePostProcessJob
          originalClipId,
          originalClipKey,
          index: parsedIndex !== undefined ? parsedIndex : idx, // Fallback to idx if parsing fails
          clipStatus: mappedStatus,
          url: clipUrl,
          thumbnailUrl: clipThumb,
          failureReason: c.failureReason || c.failure_reason,
          // Add other fields as needed for updatePostProcessJob compatibility
        };
      });

      // ✅ Only update postprocess history when we're polling a postprocess job (not cut job)
      // This way we only update the skeleton for THIS run, never overwrite other runs (lần 1, 2)
      if (mappedPostprocessClips.length > 0 && jobId && isPostProdJob) {
        get().updatePostProcessJob(jobId, {
          status: finalStatus,
          clips: mappedPostprocessClips,
          jobId: jobId
        });

        if (job?.status === 'failed' || job?.status === 'completed') {
          devLog('[pollVideoFactoryStatus] Synced postprocess history from polling (this job only)', {
            jobId,
            status: finalStatus,
            clipsCount: mappedPostprocessClips.length
          });
        }
      }

      // ✅ CRITICAL: Return isFinal and nextPollAfterSec to stop infinite polling
      // If isFinal is true, nextPollAfterSec MUST be 0 (polling stops immediately)
      // If isFinal is false, use recommended interval (minimum 30s to reduce load)
      return {
        isFinal: isFinalComputed,
        nextPollAfterSec: isFinalComputed ? 0 : Math.max(nextPollAfterSecFromApi || 60, 30),
      };
    } catch (error) {
      console.error('[pollVideoFactoryStatus] Error:', error);
      // Trong trường hợp lỗi, không dừng hẳn loop nhưng dùng fallback delay an toàn.
      return { isFinal: false, nextPollAfterSec: 60 };
    }
  },

  /**
   * ✅ NEW: Safety Net Polling - Scan Media Library for completed clips
   * Fallback mechanism if SSE and regular polling both fail to update status.
   * Fetches latest 50 video assets and matches them to current job.
   */
  pollMediaAssetsFallback: async () => {
    const state = get().videoFactoryState;
    const jobId = state?.jobId || state?.cutJobId;
    const projectId = state?.projectId;

    if (!jobId && !projectId) return;

    try {
      devLog('[pollMediaAssetsFallback] Checking Media Library for missing clips', { jobId, projectId });

      const { data: { session } } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) return;

      // Fetch latest 50 video assets
      const res = await fetch('/api/media-assets?limit=50&type=video', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!res.ok) return;

      const json = await res.json();
      const assets = json.data?.assets || [];

      if (!Array.isArray(assets) || assets.length === 0) return;

      // 1. Check for CUT clips (Cut Step)
      const newCutClips: GeneratedVideoClip[] = [];
      const currentClips = state?.generatedClips || [];

      assets.forEach((asset: any) => {
        const metadata = asset.metadata || {};
        // Match by cutJobId or simply by jobId if step is 'cut'
        const isCutClip = metadata.step === 'cut' && (
          metadata.cutJobId === jobId ||
          metadata.jobId === jobId ||
          metadata.projectId === projectId
        );

        if (isCutClip) {
          // Check if this clip is already READY in our store
          // We match by storageKey (most reliable) or clipId
          const assetKey = asset.storage_key || asset.key;
          const existingClip = currentClips.find(c =>
            c.storageKey === assetKey ||
            (c as any).key === assetKey
          );

          // If clip doesn't exist OR is not READY yet, we should update it
          const isStoreReady = existingClip && ((existingClip as any).clipStatus === 'DONE' || (existingClip as any).clipStatus === 'READY');

          if (!isStoreReady) {
            // Map asset to GeneratedVideoClip format
            const newClip: GeneratedVideoClip = {
              id: asset.id,
              index: metadata.index ?? metadata.clipIndex ?? 0,
              url: asset.public_url || asset.url,
              title: metadata.title || asset.filename || `Clip ${metadata.index ?? 0}`,
              thumbnail: asset.thumbnail_url || '',
              thumbnailUrl: asset.thumbnail_url || undefined,
              duration: asset.duration ? `${Math.round(asset.duration)}s` : '',
              startTime: metadata.startTime ?? metadata.start ?? 0,
              endTime: metadata.endTime ?? metadata.end ?? 0,
              clipStatus: 'DONE', // If it's in media library, it's DONE
              storageKey: assetKey,
              clipId: asset.id,
              // Add other required fields with defaults
              bucket: asset.storage_bucket,
            };
            newCutClips.push(newClip);
          }
        }
      });

      // Update store if we found new ready cut clips
      // ✅ CRITICAL FIX: Only update generatedClips if NOT in postprocess step
      // When in postprocess step, cut clips are already finalized and should not be changed
      const currentStep = state?.currentStep;
      const isInPostprocessStep = currentStep === 'postprocess';

      if (newCutClips.length > 0) {
        if (isInPostprocessStep) {
          devLog('[pollMediaAssetsFallback] Skipping cut clips update - already in postprocess step', {
            newCutClipsCount: newCutClips.length,
            currentStep,
            hint: 'Cut clips are already finalized - will not update generatedClips when in postprocess step',
          });
        } else {
          devLog('[pollMediaAssetsFallback] Found new READY cut clips in Media Library', {
            count: newCutClips.length,
            clips: newCutClips.map(c => c.index),
            currentStep,
            hint: 'Will update generatedClips (not in postprocess step)',
          });

          set(s => {
            if (!s.videoFactoryState) return s;

            // ✅ DOUBLE CHECK: Ensure we're still not in postprocess step (race condition protection)
            if (s.videoFactoryState.currentStep === 'postprocess') {
              devLog('[pollMediaAssetsFallback] Skipping generatedClips update - now in postprocess step', {
                hint: 'Race condition: step changed to postprocess while processing',
              });
              return s;
            }

            // Merge logic: Replace placeholder/processing clips with new READY clips
            const updatedClips = [...(s.videoFactoryState.generatedClips || [])];
            let hasChanges = false;

            newCutClips.forEach(newClip => {
              const idx = newClip.index ?? 0;
              // Find placeholder at this index
              const placeholderIdx = updatedClips.findIndex(c => (c.index ?? 0) === idx);

              if (placeholderIdx >= 0) {
                const currentClip = updatedClips[placeholderIdx];
                // ✅ CRITICAL FIX: Only update if current clip is PROCESSING (don't touch DONE/READY/FAILED/COMPLETED)
                // This ensures we don't overwrite user playback OR error states
                const shouldSkip = ['DONE', 'READY', 'FAILED', 'COMPLETED'].includes(currentClip.clipStatus || '');

                if (!shouldSkip) {
                  // Update existing placeholder
                  updatedClips[placeholderIdx] = {
                    ...updatedClips[placeholderIdx],
                    ...newClip,
                    clipStatus: 'DONE'
                  };
                  hasChanges = true;
                }
              } else {
                // Add new clip if not found (unexpected but safe)
                updatedClips.push(newClip);
                hasChanges = true;
              }
            });

            if (!hasChanges) return s;

            return {
              videoFactoryState: {
                ...s.videoFactoryState,
                // ✅ HARD GUARD: Media-assets fallback không được overwrite cut clips khi đang ở postprocess step và đã có dữ liệu thật.
                generatedClips: (() => {
                  // NOTE: currentStep type union differs across legacy branches; cast to keep strict guard without TS false-positive.
                  const inPostprocess = (s.videoFactoryState.currentStep as any) === 'postprocess';
                  // ✅ Hard guard: once in postprocess, cut clips must be immutable.
                  const shouldPreserveGeneratedClips = inPostprocess;
                  if (shouldPreserveGeneratedClips) return s.videoFactoryState.generatedClips;
                  return updatedClips.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
                })()
              }
            };
          });
        }
      }

      // 2. Check for POSTPROCESS clips (Post Step)
      // Group assets by postprocessJobId
      const postProcessGroups = new Map<string, any[]>();

      assets.forEach((asset: any) => {
        const metadata = asset.metadata || {};
        const isPostprocessStep = metadata.step === 'postprocess' || metadata.step === 'post_process';
        const isPostprocessOutputKind = metadata.kind === 'output_clips';
        const ppJobId = metadata.postprocessJobId || metadata.jobId || metadata.job_id;

        // ✅ FLEXIBLE FILTER:
        // - Accept both explicit postprocess step OR kind === 'output_clips'
        // - Require some job identifier so we can group by postprocessJobId
        if ((isPostprocessStep || isPostprocessOutputKind) && ppJobId) {
          if (!postProcessGroups.has(ppJobId)) {
            postProcessGroups.set(ppJobId, []);
          }
          postProcessGroups.get(ppJobId)?.push(asset);
        }
      });

      // Update postProcessHistory for each group
      // ✅ CRITICAL FIX: Only update clips that are currently PROCESSING
      const currentHistory = get().videoFactoryState?.postProcessHistory || [];

      postProcessGroups.forEach((groupAssets, ppJobId) => {
        // Find existing job
        const existingJob = currentHistory.find(h => h.jobId === ppJobId);
        const existingClips = existingJob?.clips || [];

        // Filter assets: Only keep those that correspond to a PROCESSNG placeholder
        // Strict safety check: Don't touch clips that are already DONE/READY
        const assetsToUpdate = groupAssets.filter(asset => {
          const assetId = asset.id;
          const assetIndex = asset.metadata?.index ?? -1;
          const rawStatus = (asset.status || '').toUpperCase();

          // Simpler check: Is there ANY clip at this index/ID that is ALREADY DONE/FAILED/COMPLETED?
          // Since we merge by index in updatePostProcessJob, let's check by index.
          if (assetIndex >= 0 && existingClips[assetIndex]) {
            const current = existingClips[assetIndex];
            const shouldSkip = ['DONE', 'READY', 'FAILED', 'COMPLETED'].includes(current.clipStatus || '');
            if (shouldSkip) return false; // Already finalized, exclude from update
          }

          // Also check by ID if possible
          const matchById = existingClips.find(c => c.id === assetId);
          if (matchById) {
            const shouldSkip = ['DONE', 'READY', 'FAILED', 'COMPLETED'].includes(matchById.clipStatus || '');
            if (shouldSkip) return false;
          }

          // ✅ Edge case: FAILED assets should still be surfaced so UI can show error instead of skeleton
          if (rawStatus === 'FAILED') {
            return true;
          }

          // ✅ INVARIANT: Only treat asset as "ready" if it has both video + thumbnail
          const hasVideo = !!(asset.public_url || asset.url);
          const hasThumb = !!asset.thumbnail_url;
          if (!hasVideo || !hasThumb) {
            // Keep placeholder as PROCESSING until thumbnail + video are both available
            return false;
          }

          return true; // Safe to update (is missing or processing, and has video + thumbnail or explicit FAILED)
        });

        if (assetsToUpdate.length === 0) return;

        // Map assets to FE clips format
        const readyClips = assetsToUpdate.map(asset => {
          const idx = asset.metadata?.index ?? 0;
          // ✅ CRITICAL FIX: Look up existing placeholder to get originalClipKey
          // This ensures updatePostProcessJob can match by ID (Strategy 1) instead of just Index
          const placeholder = existingClips[idx];
          const rawStatus = (asset.status || '').toUpperCase();
          const hasVideo = !!(asset.public_url || asset.url);
          const hasThumb = !!asset.thumbnail_url;

          let clipStatus: 'DONE' | 'FAILED';
          if (rawStatus === 'FAILED') {
            clipStatus = 'FAILED';
          } else {
            // At this point we already enforced hasVideo && hasThumb in filter above
            clipStatus = 'DONE';
          }

          return {
            id: asset.id, // Use asset ID
            title: asset.title, // ✅ Map title from fallback polling
            index: idx,
            originalClipId: placeholder?.originalClipKey, // ✅ Helper for robust matching
            url: asset.public_url || asset.url,
            thumbnailUrl: asset.thumbnail_url,
            duration: asset.duration,
            startTime: asset.metadata?.startTime,
            endTime: asset.metadata?.endTime,
            // ✅ INVARIANT: Mark as DONE only when has video + thumbnail (already enforced in filter)
            // and allow FAILED to surface error state instead of skeleton
            clipStatus,
            createdAt: asset.created_at
          };
        });

        if (readyClips.length > 0) {
          get().updatePostProcessJob(ppJobId, {
            // status: 'completed', // ❌ REMOVED: Don't force job status, just update specific clips
            clips: readyClips,
            jobId: ppJobId
          });
        }
      });

    } catch (err) {
      console.warn('[pollMediaAssetsFallback] Failed:', err);
    }
  },

  resetVideoFactory: () => {
    const state = get().videoFactoryState;
    const oldJobId = state?.jobId;

    if (oldJobId) {
      devLog('[resetVideoFactory] Resetting video factory state', {
        oldJobId,
        hint: 'This will disconnect SSE connection for old jobId',
      });
    }

    // ✅ CRITICAL FIX: Reset về initial state thay vì null để tránh lỗi "Cannot read properties of null"
    // jobId: undefined để đảm bảo SSE connection cũ được disconnect (hook SSE checks for undefined/null)
    // Component sẽ thấy object rỗng với clips: [] thay vì null, tránh crash
    set({
      isVideoFactoryOpen: false,
      videoFactoryState: {
        ...createInitialVideoFactoryState(),
        jobId: undefined, // ✅ CRITICAL: undefined để SSE disconnect (compatible với type)
        cutJobId: undefined, // ✅ CRITICAL: Clear cutJobId
        postProcessJobId: undefined, // ✅ CRITICAL: Clear postProcessJobId
        projectId: undefined, // ✅ PROJECT-CENTRIC: Clear projectId
      }
    });
  },

  // ✅ SPLIT-SCREEN MODAL: Toggle main modal (Panel A) visibility
  toggleMainModal: (visible?: boolean) => {
    set(s => {
      if (!s.videoFactoryState) return s;
      const newVisible = visible !== undefined ? visible : !s.videoFactoryState.isMainModalVisible;
      return {
        videoFactoryState: {
          ...s.videoFactoryState,
          isMainModalVisible: newVisible,
        }
      };
    });
  },

  // ✅ SPLIT-SCREEN MODAL: Toggle result modal (Panel B) visibility
  toggleResultModal: (visible?: boolean) => {
    set(s => {
      if (!s.videoFactoryState) {
        console.warn('[videoFactoryStore] toggleResultModal: videoFactoryState is null', { visible });
        return s;
      }
      const newVisible = visible !== undefined ? visible : !s.videoFactoryState.isResultModalVisible;

      // ✅ DEBUG: Log state change
      devLog('[videoFactoryStore] toggleResultModal called', {
        visible,
        currentVisible: s.videoFactoryState.isResultModalVisible,
        newVisible,
        hasProjectId: !!s.videoFactoryState.projectId,
        hasCutJobId: !!s.videoFactoryState.cutJobId,
        hasJobId: !!s.videoFactoryState.jobId,
        timestamp: new Date().toISOString(),
      });

      return {
        videoFactoryState: {
          ...s.videoFactoryState,
          isResultModalVisible: newVisible,
        }
      };
    });
  },

  // ✅ SPLIT-SCREEN MODAL: Add new postprocess job to history
  addPostProcessJob: (jobId: string, timestamp: string, selectedClipKeys: string[], config?: PostProductionConfig, selectedCutClipIds?: string[]) => {
    set(s => {
      if (!s.videoFactoryState) return s;
      const history = s.videoFactoryState.postProcessHistory || [];
      // Check if job already exists (prevent duplicate)
      const existingIndex = history.findIndex(h => h.jobId === jobId);
      if (existingIndex >= 0) {
        devLog('[addPostProcessJob] Job already exists in history, skipping', { jobId });
        return s;
      }

      // ✅ UX OPTIMIZATION: Lấy generatedClips để copy duration từ clip gốc sang placeholder
      // Khi user thấy skeleton loading, duration sẽ hiển thị thật (01:30) thay vì 00:00
      const generatedClips = s.videoFactoryState.generatedClips || [];

      // ✅ CRITICAL: Extract currentJobId for basename match validation (prevent cross-job false positive)
      // In Project View, generatedClips may contain clips from multiple jobs
      // We need to verify basename matches are from the same job to avoid matching "video.mp4" from Job A with "video.mp4" from Job B
      const currentJobId = s.videoFactoryState.jobId || s.videoFactoryState.cutJobId;

      // ✅ CRITICAL FIX: Tạo placeholder clips tương ứng với số clips được chọn để hậu kỳ
      // UI sẽ hiển thị skeleton loading (số lượng = selectedClipKeys.length) cho "Thành phẩm"
      // Khi từng clip hoàn thành (qua SSE/Polling), replace placeholder bằng clip thực tế
      const placeholderClips = selectedClipKeys.map((key, index) => {
        // ✅ UX OPTIMIZATION: Find original clip to copy duration/timing metadata
        // This makes skeleton loading feel more "real" - user sees actual duration even while loading

        // ✅ DEFENSIVE PROGRAMMING: Normalize S3 keys for robust matching
        // Handles cases where keys may have different prefixes or formats
        const normalizeKey = (k: string | undefined): string => {
          if (!k) return '';
          // Remove leading/trailing slashes and whitespace
          return k.trim().replace(/^\/+|\/+$/g, '').toLowerCase();
        };

        const normalizedKey = normalizeKey(key);

        const originalClip = generatedClips.find(c => {
          const clipKey = c.storageKey || c.key || (c as any).s3_key;
          const normalizedClipKey = normalizeKey(clipKey);

          // ✅ Try multiple matching strategies (most specific to least specific)
          // 1. Exact match (normalized)
          if (normalizedClipKey === normalizedKey) return true;

          // 2. EndsWith match (handles prefix differences)
          // Example: "media/user123/clip.mp4" matches "clip.mp4"
          if (normalizedClipKey && normalizedKey &&
            (normalizedClipKey.endsWith(normalizedKey) || normalizedKey.endsWith(normalizedClipKey))) {
            return true;
          }

          // 3. Basename match (last segment after last slash)
          // ⚠️ CRITICAL: Only use basename match if Level 1 & 2 fail AND clips are from same job
          // Example: "folder/subfolder/clip.mp4" matches "clip.mp4"
          // Edge case: Different jobs can have same filename (Job A: media/jobA/video.mp4, Job B: media/jobB/video.mp4)
          // Solution: Check jobId/cutJobId to prevent false positive match across jobs
          const clipBasename = normalizedClipKey.split('/').pop() || '';
          const keyBasename = normalizedKey.split('/').pop() || '';
          if (clipBasename && keyBasename && clipBasename === keyBasename) {
            // ✅ DEFENSIVE: Verify jobId match to prevent cross-job false positive
            // If clip has jobId, it must match current job to use basename match
            const clipJobId = (c as any).jobId || (c as any).job_id;

            if (clipJobId && currentJobId && clipJobId !== currentJobId) {
              // ❌ Basename matches but different job - reject to prevent false positive
              devLog('[addPostProcessJob] Basename match rejected - different job', {
                clipBasename,
                keyBasename,
                clipJobId,
                currentJobId,
                clipKey: normalizedClipKey,
                selectedKey: normalizedKey,
                hint: 'Same filename but different job - skipping to avoid false positive match',
              });
              return false;
            }

            // ✅ Basename matches AND same job (or no jobId) - accept match
            devLog('[addPostProcessJob] Matched by basename (Level 3)', {
              clipBasename,
              clipJobId,
              currentJobId: currentJobId || 'unknown',
              hint: clipJobId ? 'Verified jobId match' : 'No jobId check (backward compatibility)',
            });
            return true;
          }

          return false;
        });

        // ✅ DEFENSIVE PROGRAMMING: Log warning if clip not found
        if (!originalClip) {
          devWarn('[addPostProcessJob] Could not find original clip for key', {
            key,
            normalizedKey,
            availableKeys: generatedClips.map(c => ({
              storageKey: c.storageKey,
              key: (c as any).key,
              s3_key: (c as any).s3_key,
            })),
            hint: 'Duration will default to 0. This may indicate key format mismatch between selectedClipKeys and generatedClips.',
          });
        }

        // ✅ Parse duration string (format: "MM:SS" or "HH:MM:SS") to seconds
        const parseDuration = (durationStr?: string): number => {
          if (!durationStr) return 0;
          const parts = durationStr.split(':').map(Number);
          if (parts.length === 2) {
            // MM:SS format
            return parts[0] * 60 + parts[1];
          } else if (parts.length === 3) {
            // HH:MM:SS format
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
          }
          return 0;
        };

        // ✅ CRITICAL: Derive original cut-clip index from S3 key so we can match SSE updates reliably.
        // Selected clips can be non-contiguous (e.g., clip_0, clip_1, clip_3) → selection index (0,1,2) != clip index (0,1,3).
        const deriveClipIndexFromKey = (k: string): number | undefined => {
          const m = k.match(/clip_(\d+)/i);
          return m ? Number.parseInt(m[1], 10) : undefined;
        };
        const originalClipIndex = deriveClipIndexFromKey(key);

        return {
          id: `placeholder-postprocess-${jobId}-${index}`, // ✅ Temporary ID
          title: originalClip?.title || `Clip ${index + 1}`, // ✅ UX: Copy real title
          url: undefined, // ✅ undefined để UI render loading state
          thumbnailUrl: undefined,
          duration: originalClip ? parseDuration(originalClip.duration) : 0, // ✅ UX: Copy real duration
          startTime: originalClip?.startTime || 0, // ✅ UX: Copy real timing
          endTime: originalClip?.endTime || 0, // ✅ UX: Copy real timing
          clipStatus: 'PROCESSING' as const, // ✅ Placeholder status
          createdAt: timestamp,
          originalClipKey: key, // ✅ Track original clip key for SSE matching
          // ✅ Matching fields (preferred): if BE sends `index` (original clip index) we can match accurately.
          index: originalClipIndex ?? index,
          // ✅ Matching field (best-effort): UUID of cut clip (if caller provided mapping)
          originalClipId: selectedCutClipIds?.[index],
        };
      });

      // Add new job at the beginning (most recent first)
      const newJob = {
        jobId,
        createdAt: timestamp,
        status: 'processing' as const,
        clips: placeholderClips, // ✅ FIX: Khởi tạo với placeholder clips thay vì array rỗng
        config,
        selectedClipKeys,
        selectedCutClipIds, // ✅ NEW: Save UUIDs for retry logic
      };

      devLog('[addPostProcessJob] Created new postprocess job with placeholder clips', {
        jobId,
        selectedClipsCount: selectedClipKeys.length,
        placeholderClipsCount: placeholderClips.length,
        hint: 'UI will show skeleton loading for each selected clip in "Thành phẩm" section',
      });

      return {
        videoFactoryState: {
          ...s.videoFactoryState,
          postProcessHistory: [newJob, ...history],
        }
      };
    });
  },

  // ✅ SPLIT-SCREEN MODAL: Update postprocess job in history
  updatePostProcessJob: (jobId: string, updates: Partial<{
    status: 'processing' | 'completed' | 'failed';
    clips: Array<{
      id: string;
      title?: string;
      name?: string;
      url?: string;
      thumbnailUrl?: string;
      duration?: number;
      startTime?: number;
      endTime?: number;
      clipStatus?: 'PROCESSING' | 'READY' | 'FAILED' | 'DONE';
      /** BE trả về clipStatus + status; FE dùng clipStatus */
      status?: string;
      /** BE trả về finalVideoUrl; FE dùng url */
      finalVideoUrl?: string;
      createdAt?: string;
      originalClipId?: string;
      originalClipKey?: string;
      /** BE trả về index để ghép đúng slot skeleton (postprocess) */
      index?: number;
    }>;
    progress?: number;
    progressMessage?: string;
    jobId?: string;        // ✅ NEW: Allow updating jobId (for retry with new job)
    errorMessage?: string; // ✅ NEW: Error message for failed jobs
    errorCode?: string;    // ✅ NEW: Error code for specific handling
  }>) => {
    set(s => {
      if (!s.videoFactoryState) return s;
      const history = s.videoFactoryState.postProcessHistory || [];
      const index = history.findIndex(h => h.jobId === jobId);
      if (index < 0) {
        devWarn('[updatePostProcessJob] Job not found in history', { jobId });
        return s;
      }

      const updatedHistory = [...history];
      const existingJob = updatedHistory[index];

      // ✅ CRITICAL FIX: Intelligent merge cho clips array
      // Giữ lại placeholder clips chưa hoàn thành, replace clip đã hoàn thành từ SSE/Polling
      let mergedClips = existingJob.clips || [];

      if (updates.clips !== undefined) {
        const incomingClips = updates.clips;
        
        // ✅ Ở postprocess: chỉ thay thế đúng clip trong danh sách skeleton của jobId khi clip đó ready/done/fail.

          // ✅ CRITICAL FIX: ID-based matching instead of index-based matching
          // This handles race conditions where clips complete out of order
          // Example: Clip C (index 2) completes before Clip A (index 0)
          // SSE sends: [{ originalClipId: 'C_id', ... }] at position 0
          // If we use idx (0), we'd incorrectly update Clip A with Clip C's data!
          // 
          // Solution: Match by originalClipKey (ID) instead of array position
          mergedClips = mergedClips.map((existingClip, existingIndex) => {
            // ✅ Find the best matching update for this specific slot
            const matchingUpdate = incomingClips.find(incoming => {
              // 1. UUID Match (Most reliable)
              const incomingUUID = incoming.originalClipId || incoming.id;
              if (incomingUUID && existingClip.originalClipId && incomingUUID === existingClip.originalClipId) return true;

              // 2. S3 Key Match (Fallback)
              const incomingKey = incoming.originalClipKey || (incoming as any).storageKey || (incoming as any).key;
              if (incomingKey && existingClip.originalClipKey) {
                const normalize = (k: string) => k.replace(/^\/+|\/+$/g, '').toLowerCase();
                if (normalize(incomingKey) === normalize(existingClip.originalClipKey)) return true;
              }

              // 3. Index Match (Standard fallback)
              const incomingIndex = (incoming as any).index;
              const existingClipIndex = (existingClip as any).index ?? existingIndex;
              if (incomingIndex !== undefined && incomingIndex === existingClipIndex) {
                 // Protection: if both have UUIDs but they mismatch, it's not the same clip
                 const incomingUUID = incoming.originalClipId || incoming.id;
                 if (incomingUUID && existingClip.originalClipId && incomingUUID !== existingClip.originalClipId) return false;
                 return true;
              }

              return false;
            });

            if (matchingUpdate) {
              // ✅ Chỉ thay thế skeleton khi clip hậu kỳ ready/done/fail. PROCESSING thì giữ skeleton.
              const incomingStatus = (matchingUpdate.clipStatus || matchingUpdate.status || '').toString().toUpperCase();
              const isFinalStatus = ['READY', 'DONE', 'FAILED', 'COMPLETED'].includes(incomingStatus);
              
              if (!isFinalStatus) {
                return existingClip; // Giữ skeleton cho đến khi có trạng thái cuối hoặc có url
              }

              // ✅ MERGE: Thay thế đúng clip đó trong danh sách skeleton của jobId tương ứng
              return {
                ...existingClip,
                ...matchingUpdate,
                id: existingClip.id, // Preserve temporary UI ID for key stability
                title: existingClip.title || matchingUpdate.title || existingClip.name || matchingUpdate.name,
                name: existingClip.name || matchingUpdate.name,
                duration: existingClip.duration ?? matchingUpdate.duration ?? 0,
                clipStatus: (incomingStatus === 'FAILED' ? 'FAILED' : 'DONE'),
              };
            }

            return existingClip;
          });

        devLog('[updatePostProcessJob] Merged clips intelligently (ID-based matching)', {
          jobId,
          existingClipsCount: existingJob.clips?.length || 0,
          incomingClipsCount: incomingClips.length,
          mergedClipsCount: mergedClips.length,
          placeholderClipsRemaining: mergedClips.filter(c => !c.url).length,
          completedClipsCount: mergedClips.filter(c => c.url).length,
          matchingStrategy: 'ID-first (originalClipKey), fallback to index',
          hint: 'ID-based matching prevents race conditions when clips complete out of order',
        });
      }

      // ✅ CRITICAL FIX: Error Handling - Nếu job failed hoặc completed, xử lý placeholder clips còn lại
      // Để user biết job đã xong và không để skeleton loading mãi mãi
      if (updates.status === 'failed' || updates.status === 'completed') {
        // ✅ Count before updating to track filtered clips
        const remainingProcessingClipsBeforeUpdate = mergedClips.filter(c => !c.url && c.clipStatus === 'PROCESSING').length;

        mergedClips = mergedClips.map(clip => {
          // Nếu clip vẫn còn là placeholder (chưa có url), đánh dấu status tương ứng
          if (!clip.url || clip.clipStatus === 'PROCESSING') {
            return {
              ...clip,
              clipStatus: 'FAILED' as const,
              // ✅ EDGE CASE FIX: Nếu job COMPLETED nhưng clip vẫn PROCESSING
              // → Backend đã lọc bỏ clip này (file lỗi, validation fail, etc.)
              // → Mark as FAILED để không quay mãi mãi
            };
          }
          return clip; // Giữ nguyên clip đã hoàn thành (có url)
        });

        devLog('[updatePostProcessJob] Job finished - marked remaining placeholder clips as FAILED', {
          jobId,
          jobStatus: updates.status,
          totalClips: mergedClips.length,
          failedClips: mergedClips.filter(c => c.clipStatus === 'FAILED').length,
          completedClips: mergedClips.filter(c => c.url).length,
          remainingProcessingClips: remainingProcessingClipsBeforeUpdate,
          hint: updates.status === 'completed' && remainingProcessingClipsBeforeUpdate > 0
            ? '⚠️ Job COMPLETED but some clips never received updates - backend may have filtered them'
            : 'All placeholder clips (no url) are now FAILED to prevent infinite loading',
        });
      }

      updatedHistory[index] = {
        ...existingJob,
        ...updates,
        clips: mergedClips, // ✅ Use merged clips (with FAILED status if job failed)
      };

      return {
        videoFactoryState: {
          ...s.videoFactoryState,
          postProcessHistory: updatedHistory,
        }
      };
    });
  },
}));

