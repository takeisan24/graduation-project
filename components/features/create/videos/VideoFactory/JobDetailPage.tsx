/**
 * Job Detail Page Component
 * Displays job status, step timeline, and resume/retry actions
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabaseClient } from '@/lib/supabaseClient';
import { useVideoFactorySSE } from '@/lib/hooks/useVideoFactorySSE';
import { StepTimeline } from './StepTimeline';
import { ActionBar } from './ActionBar';
import { JobHeader } from './JobHeader';
import { PostprocessedClipsListModal } from './PostprocessedClipsListModal';

/**
 * Job Step Status
 */
export type StepStatus = 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'skipped';

/**
 * Job Error
 */
export interface JobError {
  code: string;
  message: string;
  retryable: boolean;
  detail?: Record<string, unknown>;
}

/**
 * Job Step
 */
export interface JobStep {
  name: string;
  status: StepStatus;
  attempt: number;
  error?: JobError;
  startedAt?: string;
  completedAt?: string;
  output?: {
    // ✅ OPTIMIZATION: Standardized field names - only use clips (outputs and finalClips are deprecated)
    clips?: OutputClip[]; // Standardized field name for all steps (cut, postprocess, etc.)
    [key: string]: any; // Allow other output fields (finalKey, finalUrl, burnedKey, etc.)
  };
}

/**
 * Job Status
 * 
 * NOTE:
 * - Backend (JQM) can also return 'cancelled' and 'abandoned' for final states.
 * - We include them here so FE can handle all lifecycle states explicitly.
 */
export type JobStatus =
  | 'pending'
  | 'running'
  | 'failed'
  | 'completed'
  | 'paused'
  | 'cancelled'
  | 'abandoned';

/**
 * Job Detail Response
 */
interface OutputClip {
  // ✅ Clips được sinh ra từ Video Factory (cắt từ source)
  id?: string;
  url?: string; // URL video clip có thể play trực tiếp trên web
  public_url?: string; // Fallback nếu backend dùng field này
  thumbnail_url?: string | null;
  thumbnail?: string | null;
  title?: string | null;
  duration?: number | null; // seconds
  startTime?: number | null;
  endTime?: number | null;
  // Cho phép backend đính kèm metadata khác mà không cần FE biết hết
  [key: string]: any;
}

interface JobDetailResponse {
  job: {
    id: string;
    status: JobStatus;
    progress: number;
    progressMessage: string | null;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  };
  steps: JobStep[];
  // ✅ OUTPUT: Danh sách clips đã cắt (nếu backend trả về)
  clips?: OutputClip[] | null;
  // ✅ Fallback: nếu backend gói trong project.output_clips
  project?: {
    output_clips?: OutputClip[] | null;
    [key: string]: any;
  } | null;
}

interface JobDetailPageProps {
  jobId: string;
  onClose?: () => void;
}

export function JobDetailPage({ jobId, onClose }: JobDetailPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobData, setJobData] = useState<JobDetailResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // ✅ NEW: State for multiple outputs from postprocess jobs
  const [outputs, setOutputs] = useState<any[]>([]);
  const [outputsLoading, setOutputsLoading] = useState(false);
  // ✅ NEW: State for PostprocessedClipsListModal
  const [showPostprocessedModal, setShowPostprocessedModal] = useState(false);
  const [hasPostprocessedClips, setHasPostprocessedClips] = useState(false);

  /**
   * Fetch job details
   * Memoized to prevent infinite loops
   */
  const fetchJobDetails = useCallback(async () => {
    try {
      setRefreshing(true);

      // Lấy Supabase access token để gọi API proxy (yêu cầu Authorization Bearer)
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Unauthorized');
      }

      const response = await fetch(`/api/video-factory/jobs/${jobId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const json = await response.json();
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to load job details');
      }
      const jobDataResponse = json.data as JobDetailResponse;
      setJobData(jobDataResponse);
      setError(null);

      // ✅ NEW: If this is a cut job (has cut step completed), fetch outputs and postprocessed clips
      const cutStep = jobDataResponse.steps?.find((s) => s.name === 'cut');
      if (cutStep?.status === 'completed') {
        // This is a cut job - fetch all outputs from postprocess jobs
        try {
          setOutputsLoading(true);
          const outputsResponse = await fetch(`/api/video-factory/jobs/${jobId}/outputs`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          const outputsJson = await outputsResponse.json();
          if (outputsResponse.ok && outputsJson?.success) {
            setOutputs(outputsJson.data?.outputs || []);
          }
        } catch (outputsErr) {
          console.warn('Failed to fetch outputs (non-blocking)', outputsErr);
          // Non-blocking - outputs are optional
        } finally {
          setOutputsLoading(false);
        }

        // ✅ NEW: Check for postprocessed clips
        try {
          const postprocessedResponse = await fetch(`/api/v1/video-factory/jobs/${jobId}/postprocessed-clips`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          const postprocessedJson = await postprocessedResponse.json();
          if (postprocessedResponse.ok && postprocessedJson?.success) {
            const groups = postprocessedJson.data?.groups || [];
            if (groups.length > 0) {
              setHasPostprocessedClips(true);
              // Auto-open modal if there are postprocessed clips
              setShowPostprocessedModal(true);
            }
          }
        } catch (postprocessedErr) {
          console.warn('Failed to fetch postprocessed clips (non-blocking)', postprocessedErr);
          // Non-blocking
        }
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to load job details';
      setError(errorMsg);
      console.error('Failed to fetch job details', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [jobId]);

  // Update state from SSE events instead of refetching (optimization)
  const handleSnapshot = useCallback((data: any) => {
    // Initial snapshot - update full state
    if (data.steps && data.jobId === jobId) {
      setJobData({
        job: {
          id: data.jobId,
          status: data.status || 'running',
          progress: data.progress || 0,
          progressMessage: data.progressMessage || null,
          errorMessage: data.error?.message || null,
          createdAt: jobData?.job.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        steps: Object.entries(data.steps || {}).map(([name, step]: [string, any]) => ({
          name,
          status: step.status,
          attempt: step.attempt || 0,
          error: step.error,
          startedAt: step.startedAt,
          completedAt: step.completedAt,
        })),
      });
      setError(null);
    }
  }, [jobId, jobData?.job.createdAt]);

  // ✅ NEW: Helper function to fetch outputs (reusable)
  const fetchOutputs = useCallback(async () => {
    if (!jobId || !jobData) return;

    const cutStep = jobData.steps.find((s) => s.name === 'cut');
    if (cutStep?.status !== 'completed') return; // Only fetch if cut is done

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) return;

      setOutputsLoading(true);
      const response = await fetch(`/api/video-factory/jobs/${jobId}/outputs`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const json = await response.json();
      if (response.ok && json?.success) {
        setOutputs(json.data?.outputs || []);
      }
    } catch (err) {
      console.warn('Failed to fetch outputs (non-blocking)', err);
    } finally {
      setOutputsLoading(false);
    }
  }, [jobId, jobData]);

  const handleStepUpdate = useCallback((data: any) => {
    // Update step state from SSE event
    if (data.jobId === jobId && data.step && jobData) {
      const wasCutCompleted = jobData.steps.find((s) => s.name === 'cut')?.status === 'completed';
      const isCutNowCompleted = data.step === 'cut' && data.status === 'completed';

      setJobData((prev) => {
        if (!prev) return prev;
        const stepIndex = prev.steps.findIndex((s) => s.name === data.step);
        if (stepIndex >= 0) {
          const updatedSteps = [...prev.steps];
          updatedSteps[stepIndex] = {
            ...updatedSteps[stepIndex],
            status: data.status || updatedSteps[stepIndex].status,
            attempt: data.attempt ?? updatedSteps[stepIndex].attempt,
            error: data.error || updatedSteps[stepIndex].error,
            startedAt: data.startedAt || updatedSteps[stepIndex].startedAt,
            completedAt: data.completedAt || updatedSteps[stepIndex].completedAt,
            // ✅ CRITICAL FIX: Update step output from SSE payload
            // This ensures realtime clips from backend (via project.output_clips) are rendered immediately
            output: data.output || updatedSteps[stepIndex].output,
          };
          return {
            ...prev,
            steps: updatedSteps,
            job: {
              ...prev.job,
              progress: data.progress ?? prev.job.progress,
              progressMessage: data.progressMessage || prev.job.progressMessage,
              updatedAt: new Date().toISOString(),
            },
          };
        }
        return prev;
      });

      // ✅ NEW: If cut step just completed, fetch outputs
      if (!wasCutCompleted && isCutNowCompleted) {
        setTimeout(() => {
          fetchOutputs();
        }, 100);
      }
    }
  }, [jobId, jobData, fetchOutputs]);

  const handleProgress = useCallback((data: any) => {
    // Update progress from SSE event
    if (data.jobId === jobId && jobData) {
      setJobData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          job: {
            ...prev.job,
            progress: data.progress ?? prev.job.progress,
            progressMessage: data.progressMessage || prev.job.progressMessage,
            updatedAt: new Date().toISOString(),
          },
        };
      });
    }
  }, [jobId, jobData]);

  const handleJobUpdate = useCallback((data: any) => {
    // Update job status from SSE event
    if (data.jobId === jobId && jobData) {
      const wasCompleted = jobData.job.status === 'completed';
      const isNowCompleted = data.status === 'completed';

      setJobData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          job: {
            ...prev.job,
            status: data.status || prev.job.status,
            progress: data.progress ?? prev.job.progress,
            progressMessage: data.progressMessage || prev.job.progressMessage,
            errorMessage: data.error?.message || prev.job.errorMessage,
            updatedAt: new Date().toISOString(),
          },
        };
      });

      // ✅ NEW: If job just completed, refresh outputs to show any new postprocess outputs
      if (!wasCompleted && isNowCompleted) {
        setTimeout(() => {
          fetchOutputs();
        }, 100);
      }
    }
  }, [jobId, jobData, fetchOutputs]);

  // Use SSE for realtime updates (replaces polling)
  // OPTIMIZED: Update state directly from SSE events instead of refetching
  const { isConnected } = useVideoFactorySSE(
    jobData &&
      jobData.job.status !== 'completed' &&
      jobData.job.status !== 'failed' &&
      jobData.job.status !== 'cancelled' &&
      jobData.job.status !== 'abandoned'
      ? jobId
      : null,
    {
      enabled:
        !!jobData &&
        jobData.job.status !== 'completed' &&
        jobData.job.status !== 'failed' &&
        jobData.job.status !== 'cancelled' &&
        jobData.job.status !== 'abandoned',
      onSnapshot: handleSnapshot,
      onStepUpdate: handleStepUpdate,
      onProgress: handleProgress,
      onJobUpdate: handleJobUpdate,
    }
  );

  useEffect(() => {
    fetchJobDetails();
  }, [jobId]);

  /**
   * Handle resume job
   */
  const handleResume = async () => {
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Unauthorized');
      }

      const res = await fetch(`/api/video-factory/jobs/${jobId}/resume`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to resume job');
      }
      // Refresh job details
      await fetchJobDetails();
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to resume job';
      setError(errorMsg);
      console.error('Failed to resume job', err);
    }
  };

  /**
   * Handle retry step
   */
  const handleRetryStep = async (stepName: string) => {
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Unauthorized');
      }

      const res = await fetch(`/api/video-factory/jobs/${jobId}/steps/${stepName}/retry`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to retry step');
      }
      // Refresh job details
      await fetchJobDetails();
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to retry step';
      setError(errorMsg);
      console.error('Failed to retry step', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading job details...</div>
      </div>
    );
  }

  if (error && !jobData) {
    return (
      <div className="p-8">
        <div className="text-sm text-destructive">{error}</div>
        <button
          onClick={fetchJobDetails}
          className="mt-4 text-sm text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!jobData) {
    return (
      <div className="p-8">
        <div className="text-sm text-muted-foreground">Job not found</div>
      </div>
    );
  }

  const { job, steps } = jobData;

  // ✅ LOGIC: Xác định trạng thái "hoàn thành" theo business thay vì chỉ nhìn job.status
  // - Nếu backend đã set job.status = completed => dùng luôn
  // - Nếu cut + thumbnail đã completed (đặc biệt cho mode cut_only) => coi như job đã hoàn thành cho FE
  const cutStep = steps.find((s) => s.name === 'cut');
  const thumbnailStep = steps.find((s) => s.name === 'thumbnail');
  const effectiveStatus: JobStatus =
    job.status === 'completed'
      ? 'completed'
      : cutStep?.status === 'completed' && thumbnailStep?.status === 'completed'
        ? 'completed'
        : job.status;

  // ✅ UI-normalized steps:
  // - Cleanup là background step → nếu job được coi là completed theo effectiveStatus,
  //   thì hiển thị cleanup là completed để tránh gây hiểu nhầm "pending mãi"
  const normalizedSteps: JobStep[] = steps.map((step) => {
    if (
      effectiveStatus === 'completed' &&
      step.name === 'cleanup' &&
      step.status !== 'failed'
    ) {
      return {
        ...step,
        status: 'completed',
      };
    }
    return step;
  });
  // ✅ CRITICAL FIX: Read clips from multiple sources with priority order
  // Priority 1: Direct clips array from API response
  // Priority 2: Project output_clips (from video_factory_projects table)
  // Priority 3: Postprocess step output (finalClips or outputs)
  // Priority 4: Cut step output (outputs) - this is the primary source for cut_only mode
  const getClipsFromSteps = (steps: JobStep[]): OutputClip[] => {
    // Try postprocess first (if it has outputs)
    const postprocessStep = steps.find((s) => s.name === 'postprocess');
    if (postprocessStep?.output) {
      // ✅ OPTIMIZATION: Only use clips field (finalClips and outputs are deprecated)
      const postprocessClips = postprocessStep.output.clips;
      if (Array.isArray(postprocessClips) && postprocessClips.length > 0) {
        return postprocessClips;
      }
    }

    // Fallback to cut step outputs (primary source for cut_only mode)
    const cutStep = steps.find((s) => s.name === 'cut');
    if (cutStep?.output) {
      // ✅ OPTIMIZATION: Only use clips field (outputs is deprecated)
      const cutClips = cutStep.output.clips;
      if (Array.isArray(cutClips) && cutClips.length > 0) {
        return cutClips;
      }
    }

    return [];
  };

  const clips: OutputClip[] =
    (jobData.clips as OutputClip[] | undefined) ??
    (jobData.project?.output_clips as OutputClip[] | undefined) ??
    getClipsFromSteps(normalizedSteps) ??
    [];

  // Check if job can be resumed
  const canResume =
    effectiveStatus === 'failed' &&
    normalizedSteps.some((s) => s.status === 'failed' && s.error?.retryable);

  return (
    <div className="space-y-6 p-6">
      {/* Job Header */}
      {/* Dùng effectiveStatus để Header hiển thị Completed ngay khi cut + thumbnail xong */}
      <JobHeader job={{ ...job, status: effectiveStatus }} onClose={onClose} />

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Step Timeline */}
      <StepTimeline steps={normalizedSteps} onRetryStep={handleRetryStep} onResume={handleResume} />

      {/* Clips Output */}
      {/* ✅ CRITICAL FIX: Show clips as soon as cut step is completed, don't wait for job status */}
      {/* For cut_only mode, clips are available immediately after cut step completes */}
      {cutStep?.status === 'completed' && clips && clips.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Generated Clips</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {clips.map((clip, index) => {
              const clipUrl = clip.publicUrl || clip.url || null;
              const thumbnail =
                clip.thumbnailUrl ||
                (typeof (clip as any).thumbnail === 'string' ? (clip as any).thumbnail : null) ||
                (clip as any).thumbnail_url ||
                null;

              // Map start/end to startTime/endTime for compatibility
              const startTime = clip.startTime ?? clip.start;
              const endTime = clip.endTime ?? clip.end;

              const title =
                clip.title ||
                (startTime !== undefined && endTime !== undefined ? `Clip ${index + 1}` : `Clip ${index + 1}`);

              const durationStr =
                startTime !== undefined && endTime !== undefined
                  ? `(${Math.round((endTime - startTime) || 0)}s)`
                  : '';

              return (
                <div
                  key={clip.id || `${clipUrl || 'clip'}-${index}`}
                  className="flex flex-col rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden"
                >
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-b">
                    <span className="font-medium text-sm truncate" title={title}>
                      {title}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">{durationStr}</span>
                  </div>

                  {clipUrl ? (
                    <div className="relative w-full aspect-video bg-black">
                      <video
                        className="h-full w-full object-contain"
                        controls
                        preload="metadata"
                        src={clipUrl}
                        poster={thumbnail || undefined}
                      />
                    </div>
                  ) : (
                    thumbnail && (
                      <div className="relative w-full aspect-video">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumbnail}
                          alt={title || `Clip ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ✅ NEW: Multiple Outputs Section */}
      {/* Show all final video outputs from postprocess jobs linked to this cut job */}
      {cutStep?.status === 'completed' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Video Outputs</h3>
            {outputsLoading && (
              <span className="text-sm text-muted-foreground">Đang tải...</span>
            )}
          </div>

          {outputs.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {outputs.map((output) => {
                const outputUrl = output.finalVideoUrl || output.final_video_url;
                const thumbnailUrl = output.thumbnailUrl || output.thumbnail_url;
                const status = output.status || 'processing';
                const durationSeconds = output.durationSeconds || output.duration_seconds;
                const createdAt = output.createdAt || output.created_at;
                const postprodConfig = output.postprodConfig || output.postprod_config || {};

                // Build description from postprod config
                const features: string[] = [];
                if (postprodConfig.auto_captions) {
                  features.push('Phụ đề');
                }
                if (postprodConfig.broll) {
                  features.push('B-roll');
                }
                const featuresStr = features.length > 0 ? features.join(' + ') : 'Cơ bản';

                return (
                  <div
                    key={output.id}
                    className="flex flex-col rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-b">
                      <span className="font-medium text-sm truncate">
                        Output {new Date(createdAt).toLocaleDateString('vi-VN')}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded ${status === 'completed'
                          ? 'bg-green-500/20 text-green-400'
                          : status === 'failed'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                          }`}
                      >
                        {status === 'completed' ? 'Hoàn thành' : status === 'failed' ? 'Lỗi' : 'Đang xử lý'}
                      </span>
                    </div>

                    {thumbnailUrl ? (
                      <div className="relative w-full aspect-video bg-black">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumbnailUrl}
                          alt="Output thumbnail"
                          className="h-full w-full object-cover"
                        />
                        {outputUrl && status === 'completed' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => window.open(outputUrl, '_blank', 'noopener,noreferrer')}
                              className="px-4 py-2 bg-white text-black rounded-md hover:bg-gray-200 transition-colors"
                            >
                              Xem video
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="relative w-full aspect-video bg-muted flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">Không có thumbnail</span>
                      </div>
                    )}

                    <div className="px-3 py-2 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {featuresStr}
                        {durationSeconds && ` • ${Math.round(durationSeconds)}s`}
                      </p>
                      {outputUrl && status === 'completed' && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => window.open(outputUrl, '_blank', 'noopener,noreferrer')}
                            className="flex-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                          >
                            Xem
                          </button>
                          <button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = outputUrl;
                              link.download = `maiovo-ai-${Date.now()}.mp4`;
                              link.click();
                            }}
                            className="flex-1 px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
                          >
                            Tải
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : !outputsLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Chưa có output nào từ các job hậu kỳ.</p>
              <p className="text-xs mt-1">Tạo job hậu kỳ từ các clips đã cắt để tạo output.</p>
            </div>
          ) : null}
        </div>
      )}

      {/* Action Bar */}
      <ActionBar
        jobStatus={effectiveStatus}
        canResume={canResume}
        onResume={handleResume}
        refreshing={refreshing}
      />

      {/* ✅ NEW: Postprocessed Clips List Modal */}
      {hasPostprocessedClips && (
        <PostprocessedClipsListModal
          jobId={jobId}
          cutJobId={jobId}
          isOpen={showPostprocessedModal}
          onClose={() => setShowPostprocessedModal(false)}
        />
      )}
    </div>
  );
}

