"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

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

/**
 * Hook to get Supabase access token from client-side
 * Used to append token to Asset Gateway URLs for browser image/video tags
 * (Browser doesn't send Authorization header automatically)
 */
function useAssetToken() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchToken() {
      try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) {
          console.error('[useAssetToken] Error getting session:', error);
          setIsLoading(false);
          return;
        }
        if (session?.access_token) {
          setToken(session.access_token);
        }
      } catch (error) {
        console.error('[useAssetToken] Error getting session:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchToken();
  }, []);

  /**
   * Get Asset Gateway URL with token appended
   * ✅ CRITICAL: This function is recreated when token changes, ensuring URLs always have latest token
   */
  const getAssetUrl = (assetId: string): string => {
    if (token) {
      return `/api/assets/${assetId}?token=${encodeURIComponent(token)}`;
    }
    // Fallback: return URL without token (will fail auth but at least won't crash)
    return `/api/assets/${assetId}`;
  };

  return { token, getAssetUrl, isLoading };
}
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchIcon, Sparkles, Youtube, Upload, Play, Download, Loader2, X as CloseIcon, Trash2 } from "lucide-react";
import { useVideoProjectsStore, useTextToVideoModalStore, useVideoFactoryStore } from "@/store";
import { MediaAsset } from "@/store/shared/types";
import { useShallow } from 'zustand/react/shallow';
// ✅ OPTIMIZATION: Use custom hooks for cleaner code and better maintainability
import { useCurrentJobId, useCurrentStep, useIsCompleted } from "@/store/videos/videoFactory.selectors";
import { useTranslations } from 'next-intl';
import { toast } from "sonner";

import { VideoUploadModal } from "./VideoUploadModal";
import { VideoProjectList } from "./VideoProjectList";
import { VideoFactoryModal } from "./VideoFactory/VideoFactoryModal";
import { JobDetailPage } from "./VideoFactory";
import { TextToVideoModal } from "./TextToVideoModal";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VideoPreviewOverlay } from "@/components/shared/VideoPreviewOverlay";



interface VideoFactoryJobSummary {
  id: string;
  status: string;
  progress?: number | null;
  progressMessage?: string | null;
  errorMessage?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  outputsCount?: number;
}

export default function VideosSection() {
  const t = useTranslations('CreatePage.videosSection');
  // ✅ CRITICAL FIX: Get token for Asset Gateway URLs (browser doesn't send Authorization header)
  const { getAssetUrl, token: assetToken } = useAssetToken();

  const {
    videoProjects,
    handleVideoUpload,
    handleVideoEdit,
    handleVideoDelete,
    refreshVideoProjects,
  } = useVideoProjectsStore(
    useShallow((state) => ({
      videoProjects: state.videoProjects,
      handleVideoUpload: state.handleVideoUpload,
      handleVideoEdit: state.handleVideoEdit,
      handleVideoDelete: state.handleVideoDelete,
      refreshVideoProjects: state.refreshVideoProjects,
    }))
  );

  const openVideoFactory = useVideoFactoryStore(state => state.openVideoFactory);
  const openTextToVideoModal = useTextToVideoModalStore(state => state.openTextToVideoModal);
  // ✅ OPTIMIZATION: Use custom hooks for cleaner code
  const jobId = useCurrentJobId();
  const currentStep = useCurrentStep();
  const isCompleted = useIsCompleted();

  const { pollVideoFactoryStatus, isVideoFactoryOpen } = useVideoFactoryStore(
    useShallow((state) => ({
      pollVideoFactoryStatus: state.pollVideoFactoryStatus,
      isVideoFactoryOpen: state.isVideoFactoryOpen,
    }))
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);

  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string>('all');
  const [mediaSearch, setMediaSearch] = useState<string>('');
  const [groupMode, setGroupMode] = useState<'date' | 'job'>('date'); // album by date or by project (jobId)
  const lastCompletedJobRef = useRef<string | null>(null);
  const mediaReloadInFlight = useRef(false); // tránh double fetch do StrictMode
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPoster, setPreviewPoster] = useState<string | undefined>(undefined);
  const [downloadingAssetId, setDownloadingAssetId] = useState<string | null>(null); // ✅ NEW: track asset being downloaded

  // ✅ OPTIMIZATION: Prevent duplicate API calls (React Strict Mode)
  const projectsFetchInFlight = useRef(false);

  // Initial load projects from DB
  useEffect(() => {
    if (projectsFetchInFlight.current) return;
    projectsFetchInFlight.current = true;

    refreshVideoProjects().finally(() => {
      projectsFetchInFlight.current = false;
    });
  }, [refreshVideoProjects]);


  // Video Factory job history panel state
  const [jobHistory, setJobHistory] = useState<VideoFactoryJobSummary[]>([]);
  const [jobHistoryLoading, setJobHistoryLoading] = useState(false);
  const [jobHistoryError, setJobHistoryError] = useState<string | null>(null);
  const [jobDetailJobId, setJobDetailJobId] = useState<string | null>(null);
  const jobHistoryFetchInFlight = useRef(false); // ✅ OPTIMIZATION: Prevent duplicate API calls (React Strict Mode)

  const reloadMedia = async () => {
    try {
      setMediaLoading(true);
      setMediaError(null);
      const qs = mediaType && mediaType !== 'all' ? `?type=${encodeURIComponent(mediaType)}` : '';

      // Lấy Supabase access token để gọi API media-assets (yêu cầu Authorization Bearer)
      const { data: { session } } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Unauthorized');
      }

      const res = await fetch(`/api/media-assets${qs}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to load media');
      }
      const assets = (json.data?.assets || []) as MediaAsset[];
      // ✅ DEBUG/OPS: Show ALL assets (including internal kinds) so we can verify
      // classification and detect any duplicated outputs in the Media Library UI.
      // (User request: do not gate this behind an ENV toggle.)
      setMediaAssets(assets);
    } catch (err: any) {
      console.error('Load media assets error:', err);
      setMediaError(err?.message || 'Load media failed');
    } finally {
      setMediaLoading(false);
    }
  };

  /**
   * Delete a media asset from Media Library (DB + S3 via Server B).
   * This keeps S3 and Supabase in sync when user removes an item.
   */
  const handleDeleteMediaAsset = async (asset: MediaAsset) => {
    if (!asset?.id) return;

    const confirmed = window.confirm('Bạn có chắc muốn xóa media này? Thao tác sẽ xóa khỏi Media Library và S3.');
    if (!confirmed) return;

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Unauthorized');
      }

      const res = await fetch(`/api/media-assets?id=${encodeURIComponent(asset.id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Xóa media thất bại');
      }

      toast.success('Đã xóa media khỏi thư viện.');
      // ✅ FIX: Reload media to clear deleted asset (including thumbnail) from state
      await reloadMedia();
    } catch (error: any) {
      console.error('[VideosSection] delete media error:', error);
      toast.error(error?.message || 'Không thể xóa media, vui lòng thử lại.');
    }
  };

  /**
   * ✅ NEW: Safe download handler using fetch + Blob
   * - Tránh lỗi AccessDenied do bucket policy Referer khi mở direct link.
   * - Giữ header Referer từ chính site của bạn, sau đó tạo URL Blob để lưu file.
   */
  const handleDownloadAsset = async (asset: MediaAsset) => {
    if (!asset.public_url) return;
    try {
      setDownloadingAssetId(asset.id);

      // Xác định tên file hợp lý để người dùng tải về
      const filenameBase =
        asset.metadata?.title ||
        asset.metadata?.original_filename ||
        asset.public_url.split('/').pop() ||
        'video';
      const filename = filenameBase.endsWith('.mp4') ? filenameBase : `${filenameBase}.mp4`;

      // 1. Fetch file dưới dạng Blob (request CORS không kèm credentials → tránh xung đột CORS / ORB)
      const response = await fetch(asset.public_url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
      });
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }
      const blob = await response.blob();

      // 2. Tạo URL ảo từ Blob
      const blobUrl = window.URL.createObjectURL(blob);

      // 3. Tạo thẻ a ảo để trigger download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `maiovo-ai-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();

      // 4. Dọn dẹp
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('[VideosSection] download asset error:', error);
      // Fallback: mở trực tiếp URL trong tab mới (không đổi được tên file nhưng vẫn cho tải)
      if (asset.public_url) {
        window.open(asset.public_url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Không thể tải video. Vui lòng thử lại.');
      }
    } finally {
      setDownloadingAssetId(null);
    }
  };

  useEffect(() => {
    if (mediaReloadInFlight.current) return;
    mediaReloadInFlight.current = true;
    reloadMedia().finally(() => {
      mediaReloadInFlight.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaType]);

  // Map jobId -> project title from "Dự án của bạn"
  const projectTitleByJobId = useMemo(() => {
    const map: Record<string, string> = {};
    videoProjects.forEach((p: any) => {
      if ((p as any).jobId) {
        map[(p as any).jobId] = p.title || (p as any).id;
      }
    });
    return map;
  }, [videoProjects]);

  const filteredMedia = mediaAssets.filter((asset) => {
    // ✅ CRITICAL: Only show video assets in the Media Library
    if (asset.asset_type !== 'video') return false;

    if (mediaSearch.trim()) {
      const q = mediaSearch.toLowerCase();
      return (
        asset.public_url?.toLowerCase().includes(q) ||
        asset.metadata?.kind?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group media (album) by date or by job
  const groupedMedia = filteredMedia.reduce((acc: Record<string, MediaAsset[]>, asset) => {
    let key = 'unknown';
    if (groupMode === 'date') {
      const d = asset.created_at ? new Date(asset.created_at) : new Date();
      key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    } else {
      key = asset.job_id || asset.metadata?.job_id || 'no-job';
    }
    acc[key] = acc[key] || [];
    acc[key].push(asset);
    return acc;
  }, {});

  const orderedGroupKeys = Object.keys(groupedMedia).sort((a, b) => (a < b ? 1 : -1)); // desc for date; for job just lexical

  /**
   * Fetch recent Video Factory jobs from Server B via Next.js proxy API.
   * This shows a lightweight Job History panel below "Dự án của bạn".
   * 
   * ✅ OPTIMIZATION: Prevent duplicate API calls (React Strict Mode in development)
   * ✅ NEW: Auto-refresh job history periodically to show latest status
   */
  useEffect(() => {
    // ✅ OPTIMIZATION: Prevent duplicate calls (React Strict Mode calls useEffect twice in dev)
    if (jobHistoryFetchInFlight.current) {
      return;
    }
    jobHistoryFetchInFlight.current = true;

    let cancelled = false;
    let refreshInterval: NodeJS.Timeout | null = null;

    const fetchJobHistory = async () => {
      // Skip if already fetching
      if (jobHistoryFetchInFlight.current && !cancelled) {
        return;
      }
      jobHistoryFetchInFlight.current = true;

      try {
        setJobHistoryLoading(true);
        setJobHistoryError(null);

        // Lấy Supabase access token để gọi API proxy (yêu cầu Authorization Bearer giống các route khác)
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        const accessToken = session?.access_token;
        if (!accessToken) {
          throw new Error("Unauthorized");
        }

        // ✅ CRITICAL FIX: Add cache-busting parameter to bypass server cache
        const cacheBuster = `_t=${Date.now()}`;
        const res = await fetch(`/api/video-factory/jobs?limit=10&${cacheBuster}`, {
          method: "GET",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || "Failed to load job history");
        }

        if (cancelled) return;
        const items: any[] = json.data?.jobs || json.data || [];
        setJobHistory(
          items.map((j) => ({
            id: j.id,
            status: j.status,
            progress: j.progress ?? null,
            progressMessage: j.progressMessage ?? null,
            errorMessage: j.errorMessage ?? null,
            createdAt: j.createdAt ?? j.created_at ?? null,
            updatedAt: j.updatedAt ?? j.updated_at ?? null,
            // ✅ NEW: Get outputs count from API response (if available)
            outputsCount: j.outputs?.length ?? j.outputsCount ?? undefined,
          }))
        );
      } catch (error: any) {
        if (cancelled) return;
        console.error("[VideosSection] load job history error:", error);
        setJobHistoryError(error?.message || "Không tải được lịch sử job.");
      } finally {
        if (!cancelled) {
          setJobHistoryLoading(false);
        }
        // ✅ OPTIMIZATION: Reset flag after fetch completes
        jobHistoryFetchInFlight.current = false;
      }
    };

    // Initial fetch
    fetchJobHistory();

    // ✅ NEW: Auto-refresh job history every 30 seconds to show latest status
    // This ensures job history shows updated status even if user doesn't refresh page
    refreshInterval = setInterval(() => {
      if (!cancelled) {
        devLog('[VideosSection] Auto-refreshing job history...');
        fetchJobHistory();
      }
    }, 30000); // 30 seconds

    return () => {
      cancelled = true;
      // ✅ OPTIMIZATION: Reset flag on cleanup
      jobHistoryFetchInFlight.current = false;
      // ✅ NEW: Clear refresh interval on cleanup
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  /**
   * Format duration in seconds -> XmYs (e.g. 975s -> 16m15s)
   */
  const formatDuration = (seconds?: number | null): string => {
    if (!seconds || seconds <= 0) return '0s';
    const total = Math.round(seconds);
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    if (minutes <= 0) return `${secs}s`;
    return `${minutes}m${secs.toString().padStart(2, '0')}s`;
  };

  /**
   * Global polling cho Video Factory job (background).
   *
   * Quy tắc:
   * - Chỉ chạy khi có jobId và modal không mở (tránh double call).
   * - Tận dụng `isFinal` + `nextPollAfterSec` từ backend để dừng đúng lúc
   *   và điều chỉnh tần suất poll theo gợi ý thay vì interval cố định.
   */
  useEffect(() => {
    // ✅ OPTIMIZATION: Use custom hooks for cleaner code
    if (!jobId) return;
    if (isVideoFactoryOpen) return; // modal đã dùng SSE / polling riêng, tránh double call
    let cancelled = false;
    /**
     * ✅ OPTIMIZATION: Adaptive polling với server-driven hints
     * 
     * Logic:
     * - Gọi pollVideoFactoryStatus() để lấy job state
     * - Nếu isFinal === true → DỪNG NGAY (job đã final: completed/failed/cancelled/abandoned)
     * - Nếu isFinal === false → Ngủ theo nextPollAfterSec từ BE (adaptive)
     * 
     * Adaptive intervals:
     * - queued/running: 30-60s (normal polling)
     * - waiting external (cut): 60-120s (long-running external tasks)
     * - completed/failed: stop (isFinal = true)
     * 
     * Đảm bảo:
     * - FE KHÔNG poll MediaConvert (BE handle)
     * - FE chỉ poll job state (lightweight)
     * - Khi BE fail job (hardCapAt exceeded) → isFinal = true → polling dừng
     * - Respect server hints (nextPollAfterSec) để giảm load
     */
    const loop = async () => {
      // ✅ OPTIMIZATION: Đợi 2 phút trước lần poll đầu tiên (job mới tạo, SSE sẽ handle updates)
      // This reduces initial load when user just created a job
      await new Promise(resolve => setTimeout(resolve, 120_000));
      while (!cancelled) {
        try {
          const { isFinal, nextPollAfterSec } = await pollVideoFactoryStatus();
          if (cancelled) break;

          // ✅ CRITICAL: Stop polling immediately if job is final
          if (isFinal) {
            devLog('[VideosSection] Job is FINAL - stopping background polling', {
              jobId: jobId,
              isFinal,
            });
            break; // Job đã vào trạng thái cuối → dừng loop ngay
          }

          // ✅ OPTIMIZATION: Use nextPollAfterSec from BE (adaptive polling)
          // Server B returns recommended interval based on job state:
          // - queued/running: 30-60s
          // - waiting external: 60-120s
          // - long-running cut: 120-300s
          // Minimum 30s to prevent excessive polling
          const delayMs = nextPollAfterSec && nextPollAfterSec > 0
            ? Math.max(nextPollAfterSec, 30) * 1000
            : 60 * 1000; // Fallback to 60s if invalid

          devLog('[VideosSection] Background polling scheduled', {
            jobId: jobId,
            nextPollAfterSec,
            delayMs,
            hint: 'Respecting server hint to reduce load',
          });

          await new Promise(resolve => setTimeout(resolve, delayMs));
        } catch (error) {
          console.error('[VideosSection] Background polling error', error);
          // On error, wait 60s before retrying (don't spam on errors)
          await new Promise(resolve => setTimeout(resolve, 60_000));
        }
      }
    };

    void loop();

    return () => {
      cancelled = true;
    };
  }, [jobId, pollVideoFactoryStatus, isVideoFactoryOpen]);

  // Auto reload media library when a job completes
  useEffect(() => {
    // ✅ OPTIMIZATION: Use custom hooks for cleaner code
    if (!jobId) return;
    if (!isCompleted) return;
    if (lastCompletedJobRef.current === jobId) return;

    lastCompletedJobRef.current = jobId;
    reloadMedia();
  }, [jobId, isCompleted]);

  // ✅ NEW: Listen for videoFactoryJobCompleted event from VideoFactoryModal
  // This ensures Media Library reloads when job completes via SSE (faster than polling)
  useEffect(() => {
    const handleJobCompleted = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { jobId: completedJobId } = customEvent.detail || {};
      if (completedJobId && lastCompletedJobRef.current !== completedJobId) {
        /* console.log('[VideosSection] Received videoFactoryJobCompleted event, reloading Media Library', {
          jobId: completedJobId,
        }); */
        lastCompletedJobRef.current = completedJobId;
        // Call reloadMedia directly (it's defined in component scope)
        reloadMedia();
      }
    };

    window.addEventListener('videoFactoryJobCompleted', handleJobCompleted);
    return () => {
      window.removeEventListener('videoFactoryJobCompleted', handleJobCompleted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // reloadMedia is stable function, no need to include in deps
  }, []);


  // ✅ NEW: Auto-refresh list if there are active AI Video projects
  // Since AI Video relies on Supabase DB updates (no global SSE for list), we poll when active.
  // This fixes the issue where the list doesn't update progress until manual refresh.
  const hasActiveAiVideoProjects = useMemo(() => {
    return videoProjects.some((p: any) => {
      // Check for AI Video specific statuses (uppercase)
      // We only care about text-to-video type here (Video Factory has its own poller above)
      const s = p.status?.toUpperCase();
      const isAiVideo = p.type === 'text-to-video' || (p.config_data && !p.jobId);

      return isAiVideo &&
        s !== 'DONE' &&
        s !== 'FAILED' &&
        s !== 'COMPLETED';
    });
  }, [videoProjects]);

  useEffect(() => {
    if (!hasActiveAiVideoProjects) return;

    // devLog('[VideosSection] Active AI Video projects detected - starting polling');
    const interval = setInterval(() => {
      // Don't poll if tab is backgrounded to save resources
      if (typeof document !== 'undefined' && document.hidden) return;

      refreshVideoProjects();
    }, 30000); // ✅ OPTIMIZED: Poll every 30 seconds (reduced from 5s to avoid server overload)

    return () => clearInterval(interval);
  }, [hasActiveAiVideoProjects, refreshVideoProjects]);



  return (
    <>
      <div className="w-full h-full max-w-none px-4 py-3 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-3">{t('quickStart')}</h2>

        {/* Main Quick Start Cards - 2 Primary Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Text-to-Video Card */}
          <Card
            className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/50 p-8 flex flex-col items-center justify-center text-center gap-4 hover:from-purple-500/20 hover:to-pink-500/20 hover:border-purple-400 hover:scale-[1.02] transition-all duration-200 cursor-pointer group relative overflow-hidden"
            onClick={openTextToVideoModal}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-pink-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-300 flex items-center justify-center transition-all group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-purple-500/20">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="transition-colors">
                <div className="text-xl font-bold text-white mb-2">{t('textToVideo') || 'Biến ý tưởng thành Video'}</div>
                <div className="text-sm text-white/70 group-hover:text-white/90">{t('textToVideoDesc') || 'Tạo video ngắn từ mô tả văn bản bằng AI'}</div>
              </div>
              <div className="mt-2 px-4 py-1.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-medium group-hover:bg-purple-500/30">
                {t('aiPowered') || 'AI Magic ✨'}
              </div>
            </div>
          </Card>

          {/* Video Factory Card */}
          <Card
            className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/50 p-8 flex flex-col items-center justify-center text-center gap-4 hover:from-blue-500/20 hover:to-cyan-500/20 hover:border-blue-400 hover:scale-[1.02] transition-all duration-200 cursor-pointer group relative overflow-hidden"
            onClick={openVideoFactory}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-cyan-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-300 flex items-center justify-center transition-all group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-blue-500/20">
                <Youtube className="w-8 h-8" />
              </div>
              <div className="transition-colors">
                <div className="text-xl font-bold text-white mb-2">{t('videoFactory') || 'Cắt Video dài thành ngắn'}</div>
                <div className="text-sm text-white/70 group-hover:text-white/90">{t('videoFactoryDesc') || 'Tái sử dụng video dài từ YouTube hoặc file'}</div>
              </div>
              <div className="mt-2 px-4 py-1.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium group-hover:bg-blue-500/30">
                {t('youtubeAndUpload') || 'YouTube / Upload 📤'}
              </div>
            </div>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t('yourProjects')}</h2>
          <div className="relative w-full max-w-xs">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder={t('searchProjects')}
              className="pl-9 bg-gray-900/50 border-white/20 h-9 text-sm focus:border-[#E33265]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <VideoProjectList
          projects={videoProjects}
          searchTerm={searchTerm}
          onEdit={handleVideoEdit}
          onAddNew={() => setShowUploadModal(true)}
          onDelete={handleVideoDelete}
          onPlay={(project) => {
            // ✅ UX FIX: AI Projects should always open the detail modal (dashboard)
            // instead of playing the video directly in the list overlay.
            if (project.type === 'text-to-video') {
              handleVideoEdit(project.id);
              return;
            }

            // ✅ ENHANCEMENT: Use Asset Gateway for project list playback
            // Matches TextToVideoModal logic to ensure correct MIME type and auth
            const gatewayUrl = project.final_video_s3_key || project.id
              ? `/api/assets/ai-project-video:${project.id}${assetToken ? `?token=${encodeURIComponent(assetToken)}` : ''}`
              : project.videoUrl;

            if (gatewayUrl) {
              setPreviewUrl(gatewayUrl);
              setPreviewPoster(project.thumbnail);
            }
          }}
        />
      </div>

      {/* Job History panel for Video Factory jobs */}
      <div className="w-full max-w-none mx-4 mt-6">
        <h2 className="text-lg font-semibold mb-3">Lịch sử Job Video Factory</h2>
        {jobHistoryLoading && (
          <div className="text-sm text-white/70">Đang tải lịch sử job...</div>
        )}
        {jobHistoryError && !jobHistoryLoading && (
          <div className="text-sm text-red-400">{jobHistoryError}</div>
        )}
        {!jobHistoryLoading && !jobHistoryError && jobHistory.length === 0 && (
          <div className="text-sm text-white/70">Chưa có job nào gần đây.</div>
        )}
        {!jobHistoryLoading && jobHistory.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {jobHistory.map((job) => (
              <Card
                key={job.id}
                className="bg-gray-900/50 border-white/10 hover:border-white/20 transition-colors relative"
              >
                <div className="p-3 space-y-1 text-sm text-white/80">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold truncate">Job ID: {job.id}</div>
                    {/* ✅ NEW: Show outputs count badge if available */}
                    {typeof job.outputsCount === 'number' && job.outputsCount > 0 && (
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {job.outputsCount} output{job.outputsCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-white/60">
                    Trạng thái:{" "}
                    <span
                      className={
                        job.status === "completed"
                          ? "text-emerald-400"
                          : job.status === "failed"
                            ? "text-red-400"
                            : "text-yellow-300"
                      }
                    >
                      {job.status}
                    </span>
                  </div>
                  {typeof job.progress === "number" && (
                    <div className="text-xs text-white/60">
                      Tiến độ: {job.progress}%
                      {job.progressMessage ? ` – ${job.progressMessage}` : ""}
                    </div>
                  )}
                  {job.errorMessage && (
                    <div className="text-xs text-red-400 line-clamp-2">
                      Lỗi: {job.errorMessage}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/20 text-white hover:bg-white/10 flex-1"
                      onClick={() => setJobDetailJobId(job.id)}
                    >
                      Xem chi tiết
                    </Button>
                    {/* Nút delete: 
                        - Job completed / processing / abandoned / queued: gọi API delete trên Server B, sau đó remove khỏi UI (xóa hẳn trong DB)
                        - Job failed (hoặc trạng thái khác): chỉ remove khỏi UI, giữ lại trên Server B để điều tra
                        - Job pending: không hiển thị nút delete */}
                    {job.status !== "pending" && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="border-red-500/40 text-red-400 hover:bg-red-500/10 h-8 w-8 flex items-center justify-center"
                        onClick={async () => {
                          try {
                            if (
                              job.status === "completed" ||
                              job.status === "processing" ||
                              job.status === "abandoned" ||
                              job.status === "queued"
                            ) {
                              const confirmed = window.confirm(
                                "Xóa vĩnh viễn job này khỏi server và lịch sử? Hành động không thể hoàn tác."
                              );
                              if (!confirmed) return;

                              // Lấy Supabase access token để auth cho API proxy
                              const {
                                data: { session },
                              } = await supabaseClient.auth.getSession();
                              const accessToken = session?.access_token;
                              if (!accessToken) {
                                throw new Error("Unauthorized");
                              }

                              const res = await fetch(`/api/video-factory/jobs/${job.id}`, {
                                method: "DELETE",
                                credentials: "include",
                                headers: {
                                  Authorization: `Bearer ${accessToken}`,
                                },
                              });
                              const json = await res.json().catch(() => ({}));

                              // Nếu job không tồn tại trên Server B (404) thì coi như đã được xóa trước đó
                              if (res.status === 404) {
                                toast.success("Job đã không còn tồn tại trên server, đã xóa khỏi lịch sử.");
                              } else if (!res.ok || !json?.success) {
                                throw new Error(json?.error || "Xóa job trên server thất bại");
                              } else {
                                toast.success("Đã xóa job trên server và khỏi lịch sử.");
                              }
                            } else {
                              // Job failed / completed khác: chỉ ẩn khỏi UI
                              const confirmed = window.confirm(
                                "Ẩn job này khỏi lịch sử (trên server vẫn giữ lại để điều tra)?"
                              );
                              if (!confirmed) return;
                            }

                            // Cập nhật UI sau khi xử lý
                            setJobHistory((prev) => prev.filter((j) => j.id !== job.id));
                          } catch (error: any) {
                            console.error("[VideosSection] delete job error:", error);
                            // ✅ IMPROVEMENT: Better error message handling
                            const errorMessage = error?.message ||
                              (typeof error === 'string' ? error : 'Không thể xóa job, vui lòng thử lại.');
                            toast.error(errorMessage);
                          }
                        }}
                        aria-label="Xóa job khỏi lịch sử"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <VideoUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleVideoUpload}
      />

      <div className="w-full max-w-none mx-4 mt-8 mb-16">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Media Library</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Select value={mediaType} onValueChange={setMediaType}>
                <SelectTrigger className="h-9 w-28 bg-gray-900/60 border-white/20 text-white">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-white/10 text-white">
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={mediaSearch}
                onChange={(e) => setMediaSearch(e.target.value)}
                placeholder="Tìm media..."
                className="h-9 w-40 bg-gray-900/60 border-white/20 text-sm text-white"
              />
              <Select value={groupMode} onValueChange={(v) => setGroupMode(v as 'date' | 'job')}>
                <SelectTrigger className="h-9 w-28 bg-gray-900/60 border-white/20 text-white">
                  <SelectValue placeholder="Group by" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-white/10 text-white">
                  <SelectItem value="date">Theo ngày</SelectItem>
                  <SelectItem value="job">Theo dự án</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mediaError && <span className="text-xs text-red-400">Không tải được media.</span>}
            <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10" onClick={() => reloadMedia()}>
              Reload
            </Button>
          </div>
        </div>
        {mediaLoading && <div className="text-sm text-white/70">Đang tải media...</div>}
        {!mediaLoading && filteredMedia.length === 0 && (
          <div className="text-sm text-white/70">Chưa có media nào.</div>
        )}
        {!mediaLoading && orderedGroupKeys.map((groupKey) => (
          <div key={groupKey} className="mb-6">
            <div className="text-sm text-white/60 mb-2 flex items-center gap-2">
              <span className="font-semibold text-white">
                {groupMode === 'date'
                  ? groupKey
                  : `Dự án: ${projectTitleByJobId[groupKey] || groupKey}`}
              </span>
              <span className="text-white/40">({groupedMedia[groupKey].length} items)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {groupedMedia[groupKey].map((asset) => (
                <Card key={asset.id} className="bg-gray-900/50 border-white/10 hover:border-white/20 transition-colors">
                  <div className="relative aspect-video bg-black/30">
                    {(() => {
                      // ✅ FIX: Use thumbnail_url directly from API response (like InputStage does)
                      // This avoids Asset Gateway issues and works consistently
                      const thumbnailUrl = asset.thumbnail_url ||
                        (asset.metadata?.thumbnailUrl as string | undefined) ||
                        (asset.metadata?.thumbnail_url as string | undefined) ||
                        null;

                      return thumbnailUrl ? (
                        <img
                          src={thumbnailUrl}
                          alt="thumbnail"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            console.warn('[VideosSection] Thumbnail failed to load', {
                              thumbnailUrl,
                              assetId: asset.id,
                            });
                            img.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900/80 text-white/30 gap-2">
                          <Youtube className="w-8 h-8 opacity-50" />
                          <span className="text-[10px] uppercase tracking-wider font-medium">No Preview</span>
                        </div>
                      );
                    })()}
                    {asset.duration ? (
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                        {formatDuration(asset.duration)}
                      </div>
                    ) : null}
                  </div>
                  <div className="p-3 space-y-1 text-sm text-white/80">
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span>{asset.asset_type}</span>
                      <span>
                        {(() => {
                          const kind = asset.metadata?.kind;
                          if (kind) {
                            if (kind === 'video_factory_input') return 'video_factory_input';
                            if (kind === 'short_cut_clip') return 'short_cut_clip';
                            if (kind === 'output_clip' || kind === 'postprocessed_clip') return 'output_clips';
                            if (kind === 'text-to-video') return 'text-to-video'; // ✅ NEW: Branding
                            return kind;
                          }
                          // Fallback logic for existing assets
                          if (asset.source_type === 'uploaded') return 'video_factory_input';
                          if (asset.source_type === 'processed' || asset.source_type === 'ai_generated') {
                            if (asset.metadata?.step === 'cut') return 'short_cut_clip';
                            if (asset.metadata?.step === 'postprocess' || asset.metadata?.jobType === 'broll_mux') return 'output_clips';
                            // Detect text-to-video from source_type and lack of video factory steps
                            if (asset.source_type === 'ai_generated') return 'text-to-video';
                            return 'output_clips'; // default for processed
                          }
                          return '-';
                        })()}
                      </span>
                    </div>
                    {/* Human-friendly title: editable, defaults to original filename or URL */}
                    <div className="text-xs text-white truncate">
                      {asset.metadata?.title ||
                        asset.metadata?.original_filename ||
                        asset.public_url.split('/').pop()}
                    </div>
                    {Array.isArray(asset.metadata?.warnings) && asset.metadata.warnings.length > 0 && (
                      <div
                        className="text-[11px] text-yellow-300/80 bg-yellow-900/30 border border-yellow-500/40 rounded px-2 py-0.5 line-clamp-2"
                        title={asset.metadata.warnings.join(" | ")}
                      >
                        Có cảnh báo: {asset.metadata.warnings[0]}
                        {asset.metadata.warnings.length > 1 ? ` +${asset.metadata.warnings.length - 1}` : ''}
                      </div>
                    )}
                    <div className="flex gap-2 mt-2 items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-white/20 text-white hover:bg-white/10 px-2 py-1 h-7 w-7 flex items-center justify-center"
                        onClick={() => {
                          setPreviewUrl(getAssetUrl(`media-video:${asset.id}`));
                          setPreviewPoster(asset.thumbnail_url || (asset.metadata?.thumbnailUrl as string));
                        }}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-white/20 text-white hover:bg-white/10 px-2 py-1 h-7 w-7 flex items-center justify-center"
                        onClick={() => handleDownloadAsset(asset)}
                        disabled={!asset.public_url || downloadingAssetId === asset.id}
                        title={asset.public_url ? 'Download' : 'No public URL'}
                      >
                        {downloadingAssetId === asset.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </Button>
                      {(() => {
                        const thumb =
                          asset.thumbnail_url ||
                          (asset.metadata?.thumbnailUrl as string | undefined) ||
                          (asset.metadata?.thumbnail_url as string | undefined) ||
                          null;
                        return (
                          thumb && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-white/20 text-white hover:bg-white/10 ml-auto"
                              onClick={async () => {
                                const currentTitle =
                                  asset.metadata?.title ||
                                  asset.metadata?.original_filename ||
                                  asset.public_url.split('/').pop() ||
                                  '';
                                const nextTitle = window.prompt('Nhập tên mới cho video', currentTitle);
                                if (!nextTitle || nextTitle === currentTitle) return;

                                try {
                                  const { data: { session } } = await supabaseClient.auth.getSession();
                                  const accessToken = session?.access_token;
                                  if (!accessToken) {
                                    throw new Error('Unauthorized');
                                  }

                                  const metadata = {
                                    ...(asset.metadata || {}),
                                    // giữ nguyên kind (vd: video_factory_input), chỉ override title
                                    kind: asset.metadata?.kind,
                                    title: nextTitle,
                                  };

                                  const res = await fetch('/api/media-assets', {
                                    method: 'PATCH',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      Authorization: `Bearer ${accessToken}`,
                                    },
                                    credentials: 'include',
                                    body: JSON.stringify({
                                      id: asset.id,
                                      metadata,
                                    }),
                                  });

                                  const json = await res.json().catch(() => ({}));
                                  if (!res.ok || !json?.success) {
                                    throw new Error(json?.error || 'Cập nhật tên media thất bại');
                                  }

                                  toast.success('Đã cập nhật tên video.');
                                  await reloadMedia();
                                } catch (error: any) {
                                  console.error('[VideosSection] rename media error:', error);
                                  toast.error(error?.message || 'Không thể cập nhật tên video, vui lòng thử lại.');
                                }
                              }}
                            >
                              Edit
                            </Button>
                          )
                        );
                      })()}
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                        onClick={() => handleDeleteMediaAsset(asset)}
                      >
                        Xóa
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <VideoFactoryModal />
      <TextToVideoModal />

      {/* Preview overlay for playing video from Media Library / Projects */}
      {previewUrl && (
        <VideoPreviewOverlay
          src={previewUrl}
          poster={previewPoster}
          onClose={() => setPreviewUrl(null)}
        />
      )}

      {/* Inline overlay for viewing Video Factory Job Detail Page */}
      {jobDetailJobId && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70">
          <div
            className="relative w-full max-w-5xl mx-4 bg-[#050816] rounded-lg border border-white/10 overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-3 z-10 rounded-full bg-black/70 text-white p-1 hover:bg-black/90"
              onClick={() => setJobDetailJobId(null)}
              aria-label="Đóng"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
            <div className="flex-1 min-h-0 overflow-hidden">
              {/* JobDetailPage tự fetch trạng thái job theo id qua proxy API */}
              <JobDetailPage jobId={jobDetailJobId} onClose={() => setJobDetailJobId(null)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}