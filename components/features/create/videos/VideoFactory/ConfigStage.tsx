"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, MousePointer, Loader2, Info, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { VideoCutConfig, AutoCutConfig, ManualCutSelection, ClipDuration, ContentTheme, VideoSourceConfig, TranscriptSegment } from "@/lib/types/video";
import { CLIP_DURATION_OPTIONS, CONTENT_THEME_OPTIONS } from "@/lib/constants/video";
import { toast } from "sonner";
import { VIDEO_ERRORS } from "@/lib/messages/errors";
import { supabaseClient } from "@/lib/supabaseClient";
import { splitVideoFactoryCredits } from "@/lib/utils/videoUtils";
import { useVideoFactoryStore } from "@/store";

// Global cache to prevent duplicate "no transcript" toasts across StrictMode double-mounts
const noTranscriptToastShownForSource = new Set<string>();

// Global cache để tránh gọi trùng /api/video-factory/transcript nhiều lần cho cùng một source (đặc biệt do StrictMode)
const transcriptRequestedForSource = new Set<string>();

interface ConfigStageProps {
  sourceConfig: VideoSourceConfig | undefined; // ✅ CRITICAL FIX: Allow undefined to prevent crash
  onNext: (config: VideoCutConfig) => void;
  onBack: () => void;
  onConfigChange?: (config: VideoCutConfig) => void;
  initialConfig?: VideoCutConfig | null;
  // ✅ NEW: Callback để trigger cut directly (bypass summary step)
  onCutVideo?: () => void;
}

export function ConfigStage({ sourceConfig, onNext, onBack, onConfigChange, initialConfig, onCutVideo }: ConfigStageProps) {
  const t = useTranslations('CreatePage.videoFactory');

  // ✅ CRITICAL FIX: Early return if sourceConfig is undefined to prevent crash
  if (!sourceConfig) {
    return (
      <div className="text-white p-4">
        <p>Đang tải cấu hình nguồn...</p>
      </div>
    );
  }

  const [method, setMethod] = useState<'auto' | 'manual'>(initialConfig?.method || 'auto');

  // Helper: format seconds -> m:ss (ví dụ: 0:06, 1:23)
  const formatTime = (seconds: number) => {
    const total = Math.max(0, Math.floor(seconds));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Auto config
  const [clipCount, setClipCount] = useState(
    initialConfig?.method === 'auto' && initialConfig.autoCutConfig ? initialConfig.autoCutConfig.clipCount : 3
  );
  const [clipDuration, setClipDuration] = useState<ClipDuration>(
    initialConfig?.method === 'auto' && initialConfig.autoCutConfig ? initialConfig.autoCutConfig.clipDuration : '60-90s'
  );
  const [contentTheme, setContentTheme] = useState<ContentTheme>(
    initialConfig?.method === 'auto' && initialConfig.autoCutConfig ? initialConfig.autoCutConfig.contentTheme || 'all' : 'all'
  );

  // Manual config
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [selectedRanges, setSelectedRanges] = useState<ManualCutSelection[]>([]);
  const [showManualTimeInput, setShowManualTimeInput] = useState(false);
  const [manualStartTime, setManualStartTime] = useState('');
  const [manualEndTime, setManualEndTime] = useState('');
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const [selectionPopup, setSelectionPopup] = useState<{
    text: string;
    start: number;
    end: number;
    top: number;
    left: number;
  } | null>(null);
  const [hasFetchedTranscript, setHasFetchedTranscript] = useState(false);
  // Track when user explicitly clicks "Thử lại" để hiển thị toast kết quả một lần
  const userTriggeredFetch = useRef(false);
  // Async transcription job tracking
  const [transcriptJobId, setTranscriptJobId] = useState<string | null>(null);
  const [transcriptProgress, setTranscriptProgress] = useState<{ progress: number; message?: string } | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Track initial delay timeout

  // Helper: emit config ra ngoài ngay lập tức khi state thay đổi
  const emitConfig = useCallback(() => {
    const config: VideoCutConfig =
      method === 'auto'
        ? {
          method: 'auto',
          autoCutConfig: {
            clipCount,
            clipDuration,
            contentTheme,
          },
        }
        : {
          method: 'manual',
          manualSelections: selectedRanges,
        };

    if (onConfigChange) {
      onConfigChange(config);
    }
  }, [method, clipCount, clipDuration, contentTheme, selectedRanges, onConfigChange]);

  // Emit config ra ngoài mỗi khi user thay đổi setup (auto / manual)
  useEffect(() => {
    emitConfig();
  }, [emitConfig]);

  // Poll transcript job status
  const pollTranscriptStatus = async (jobId: string, accessToken: string) => {
    try {
      const res = await fetch(`/api/video-factory/transcript-status?jobId=${encodeURIComponent(jobId)}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });

      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Không thể lấy trạng thái transcription');
      }

      const status = json.data?.status;
      const progress = json.data?.progress || 0;
      const progressMessage = json.data?.progress_message;

      setTranscriptProgress({ progress, message: progressMessage });

      if (status === 'completed') {
        // Clear polling timeout and interval
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }

        const segments = json.data?.segments || [];

        // ✅ Fallback: nếu job báo completed nhưng segments rỗng, thử refetch lại qua /api/video-factory/transcript
        // để sync với transcript mới nhất trong DB trước khi kết luận là "không có transcript"
        if (segments.length === 0) {
          try {
            // Không coi như user chủ động, tránh spam toast; chỉ muốn sync lại state
            userTriggeredFetch.current = false;
            await fetchTranscript();
            return;
          } catch (refetchErr) {
            // SILENCED: console.error('Fallback refetch transcript after completed job failed:', refetchErr);
          }
        }

        setTranscript(segments);
        setTranscriptError(null);
        setTranscriptJobId(null);
        setTranscriptProgress(null);
        setLoadingTranscript(false);

        if (segments.length === 0) {
          const errorMsg = 'Video không có audio hoặc không thể transcribe được.';
          setTranscriptError(errorMsg);
          toast.warning(errorMsg + ' Bạn có thể chọn phương thức "Tự động" hoặc nhập thời gian thủ công.');
        } else {
          toast.success('Đã lấy transcript thành công');
        }
      } else if (status === 'failed') {
        // Clear polling timeout and interval
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }

        const errorMsg = json.data?.error || 'Transcription thất bại';
        setTranscriptError(errorMsg);
        setTranscriptJobId(null);
        setTranscriptProgress(null);
        setLoadingTranscript(false);
        toast.error(errorMsg);
      }
      // If status is 'queued' or 'processing', continue polling
    } catch (error: any) {
      // SILENCED: console.error('Poll transcript status error:', error);
      // Don't stop polling on network errors, just log
    }
  };

  const fetchTranscript = useCallback(async () => {
    // Copy flag và reset ngay để tránh lặp
    const isUserTriggered = userTriggeredFetch.current;
    userTriggeredFetch.current = false;
    setLoadingTranscript(true);
    setTranscriptError(null);
    setTranscriptProgress(null);

    // Clear any existing polling and timeout
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        toast.error('Vui lòng đăng nhập lại');
        setLoadingTranscript(false);
        return;
      }

      const sourceType = sourceConfig.type;
      const params = new URLSearchParams({
        sourceType,
        ...(sourceType === 'youtube'
          ? { youtubeUrl: sourceConfig.youtubeUrl || '' }
          : {
            uploadUrl: (sourceConfig as any).uploadUrl || '',
            // ✅ CRITICAL: Send mediaAssetId for Priority 1 lookup (most reliable)
            // This enables Server A to directly query by stable ID instead of parsing URL
            ...(sourceConfig.media_asset_id ? { mediaAssetId: sourceConfig.media_asset_id } : {})
          }
        ),
      });

      const res = await fetch(`/api/video-factory/transcript?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });

      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Không thể lấy transcript');
      }

      // Check if response is async (has job_id) or sync (has segments)
      if (json.data?.job_id) {
        // Async job - start polling after 2 minutes (job cannot complete immediately)
        const jobId = json.data.job_id;
        setTranscriptJobId(jobId);
        setTranscriptProgress({ progress: 0, message: 'Đang tạo job transcription...' });

        // Wait 2 minutes before first poll (transcription jobs take time to process)
        pollTimeoutRef.current = setTimeout(() => {
          // First poll after 2 minutes
          pollTranscriptStatus(jobId, accessToken);

          // Then start polling every 90 seconds (optimized to reduce API calls)
          pollIntervalRef.current = setInterval(() => {
            pollTranscriptStatus(jobId, accessToken);
          }, 90000);
        }, 120000); // 2 minutes = 120000ms

        toast.info('Đang xử lý transcription, vui lòng chờ...');
      } else {
        // Synchronous response (YouTube transcript or immediate result)
        const segments = json.data?.segments || [];
        const warning = json.data?.warning;
        setTranscript(segments);
        setTranscriptError(null);
        setLoadingTranscript(false);

        if (segments.length === 0) {
          const errorMsg = warning || 'Video không có transcript hoặc không thể lấy được transcript.';
          setTranscriptError(errorMsg);
          const sourceKey =
            sourceType === 'youtube'
              ? (sourceConfig.youtubeUrl || '')
              : ((sourceConfig as any).uploadUrl || '');
          // Nếu user chủ động bấm "Thử lại" thì luôn báo; auto-fetch thì tránh spam toast lặp
          if (isUserTriggered || (sourceKey && !noTranscriptToastShownForSource.has(sourceKey))) {
            if (sourceKey) {
              noTranscriptToastShownForSource.add(sourceKey);
            }
            toast.warning(errorMsg + ' Bạn có thể chọn phương thức "Tự động" hoặc nhập thời gian thủ công.');
          }
        } else if (warning) {
          toast.info(warning);
        } else if (isUserTriggered) {
          // Chỉ báo thành công khi user tự bấm "Thử lại" để tránh spam toast tự động
          toast.success('Đã lấy transcript thành công');
        }
      }
    } catch (error: any) {
      // SILENCED: console.error('Transcript fetch error:', error);
      const errorMessage = error.message || 'Không thể lấy transcript. Video có thể không có phụ đề hoặc audio không rõ.';
      setTranscriptError(errorMessage);
      setLoadingTranscript(false);
      setTranscriptJobId(null);
      setTranscriptProgress(null);

      // Clear polling timeout and interval if exists
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      toast.error(errorMessage);
    }
  }, [sourceConfig?.type, sourceConfig?.youtubeUrl, (sourceConfig as any)?.uploadUrl]); // ✅ CRITICAL FIX: Use optional chaining

  // Fetch transcript (chỉ 1 lần cho mỗi source):
  // - Khi user chọn "Thủ công (Transcript)" hoặc nguồn là YouTube
  // - Dùng transcriptRequestedForSource để tránh gọi lặp (StrictMode mount 2 lần)
  useEffect(() => {
    // ✅ CRITICAL FIX: Early return if sourceConfig is undefined
    if (!sourceConfig) return;

    const sourceType = sourceConfig.type;
    const sourceKey =
      sourceType === 'youtube'
        ? (sourceConfig.youtubeUrl || '')
        : ((sourceConfig as any).uploadUrl || '');

    const shouldFetch =
      !hasFetchedTranscript &&
      !!sourceKey &&
      !transcriptRequestedForSource.has(sourceKey) &&
      (method === 'manual' || sourceType === 'youtube') &&
      transcript.length === 0 &&
      !loadingTranscript;

    if (shouldFetch) {
      setHasFetchedTranscript(true);
      transcriptRequestedForSource.add(sourceKey);
      fetchTranscript();
    }
  }, [
    method,
    sourceConfig?.type, // ✅ CRITICAL FIX: Use optional chaining (early return ensures sourceConfig exists, but safe for dependency array)
    (sourceConfig as any)?.uploadUrl, // ✅ CRITICAL FIX: Use optional chaining
    sourceConfig?.youtubeUrl, // ✅ CRITICAL FIX: Use optional chaining
    hasFetchedTranscript,
    transcript.length,
    loadingTranscript,
    fetchTranscript,
  ]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  const handleAddManualTimeRange = () => {
    const start = parseFloat(manualStartTime);
    const end = parseFloat(manualEndTime);

    if (isNaN(start) || isNaN(end) || start < 0 || end <= start) {
      toast.error('Vui lòng nhập thời gian hợp lệ (giây)');
      return;
    }

    const newSelection: ManualCutSelection = {
      startTime: start,
      endTime: end,
      text: `Đoạn ${selectedRanges.length + 1} (${manualStartTime}s - ${manualEndTime}s)`
    };

    const updatedRanges = [...selectedRanges, newSelection];
    setSelectedRanges(updatedRanges);
    setManualStartTime('');
    setManualEndTime('');
    setShowManualTimeInput(false);
    toast.success('Đã thêm đoạn clip');

    // Emit config ngay lập tức để update credit estimate
    if (onConfigChange) {
      onConfigChange({
        method: 'manual',
        manualSelections: updatedRanges,
      });
    }
  };

  const handleTranscriptSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || transcript.length === 0) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const range = selection.getRangeAt(0);
    const startSpan = range.startContainer.parentElement?.closest('[data-seg-start]');
    const endSpan = range.endContainer.parentElement?.closest('[data-seg-start]');
    if (!startSpan || !endSpan) return;

    const startSegStart = parseFloat(startSpan.getAttribute('data-seg-start') || '0');
    const startSegEnd = parseFloat(startSpan.getAttribute('data-seg-end') || '0');
    const startSegText = startSpan.getAttribute('data-seg-text') || '';

    const endSegStart = parseFloat(endSpan.getAttribute('data-seg-start') || '0');
    const endSegEnd = parseFloat(endSpan.getAttribute('data-seg-end') || '0');
    const endSegText = endSpan.getAttribute('data-seg-text') || '';

    // Approximate start/end time based on character offsets within segment text
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;
    const safeStartLen = Math.max(1, startSegText.length);
    const safeEndLen = Math.max(1, endSegText.length);

    const approxStart = startSegStart + ((startSegEnd - startSegStart) * Math.min(Math.max(startOffset, 0), safeStartLen) / safeStartLen);
    const approxEnd = endSegStart + ((endSegEnd - endSegStart) * Math.min(Math.max(endOffset, 0), safeEndLen) / safeEndLen);

    const finalStart = Math.max(0, Math.min(approxStart, approxEnd));
    const finalEnd = Math.max(finalStart + 0.1, Math.max(approxStart, approxEnd)); // ensure >0.1s

    const containerRect = transcriptRef.current?.getBoundingClientRect();
    const selectionRect = range.getBoundingClientRect();
    if (!containerRect || !selectionRect) return;

    const top = selectionRect.top - containerRect.top + transcriptRef.current!.scrollTop - 32; // place above selection
    const left = selectionRect.left - containerRect.left + transcriptRef.current!.scrollLeft;

    setSelectionPopup({
      text: selectedText,
      start: finalStart,
      end: finalEnd,
      top: Math.max(0, top),
      left: Math.max(0, left),
    });
  };

  const handleAddFromPopup = () => {
    if (!selectionPopup) return;
    const newSelection: ManualCutSelection = {
      startTime: selectionPopup.start,
      endTime: selectionPopup.end,
      text: selectionPopup.text,
    };
    const updatedRanges = [...selectedRanges, newSelection];
    setSelectedRanges(updatedRanges);
    setSelectionPopup(null);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    toast.success(t('clipAdded') || 'Đã thêm đoạn clip');

    // Emit config ngay lập tức để update credit estimate
    if (onConfigChange) {
      onConfigChange({
        method: 'manual',
        manualSelections: updatedRanges,
      });
    }
  };

  const removeSelection = (index: number) => {
    const updatedRanges = selectedRanges.filter((_, i: number) => i !== index);
    setSelectedRanges(updatedRanges);

    // Emit config ngay lập tức để update credit estimate
    if (onConfigChange) {
      onConfigChange({
        method: 'manual',
        manualSelections: updatedRanges,
      });
    }
  };

  // ✅ NEW: State để track khi đang cắt video
  const [isCutting, setIsCutting] = useState(false);
  const { startVideoFactoryProcessing, updateVideoFactoryCut } = useVideoFactoryStore();

  // ✅ NEW: Tính credit chỉ cho cut phase (không tính hậu kỳ)
  const cutCredits = useMemo(() => {
    let effectiveClipCount = 0;
    let effectiveClipDuration: '<60s' | '60-90s' | '>90s' = '60-90s';

    if (method === 'auto') {
      effectiveClipCount = clipCount;
      effectiveClipDuration = clipDuration;
    } else if (method === 'manual' && selectedRanges.length > 0) {
      effectiveClipCount = selectedRanges.length;
      effectiveClipDuration = '<60s'; // Manual selections thường ngắn
    }

    if (effectiveClipCount <= 0) return 0;

    const credits = splitVideoFactoryCredits({
      clipCount: effectiveClipCount,
      clipDuration: effectiveClipDuration,
      bRollInsertion: false, // ✅ Chỉ tính cut, không tính hậu kỳ
      autoCaptions: false,  // ✅ Chỉ tính cut, không tính hậu kỳ
    });

    return credits.cutCredits;
  }, [method, clipCount, clipDuration, selectedRanges.length]);

  // ✅ NEW: Handle "Cut video" button click
  const handleCutVideo = async () => {
    // Validate config
    if (method === 'auto') {
      if (!clipCount || clipCount <= 0) {
        toast.warning('Vui lòng chọn số lượng clip');
        return;
      }
    } else {
      if (selectedRanges.length === 0) {
        if (transcriptError || transcript.length === 0) {
          toast.warning('Vui lòng nhập ít nhất một đoạn thời gian thủ công hoặc chuyển sang phương thức "Tự động"');
        } else {
          toast.warning(VIDEO_ERRORS.SELECT_AT_LEAST_ONE_SEGMENT);
        }
        return;
      }
    }

    // Build config
    const config: VideoCutConfig = method === 'auto'
      ? {
        method: 'auto',
        autoCutConfig: {
          clipCount,
          clipDuration,
          contentTheme,
        },
      }
      : {
        method: 'manual',
        manualSelections: selectedRanges,
      };

    // Update store với config
    updateVideoFactoryCut(config);

    // Nếu có callback onCutVideo, gọi nó (VideoFactoryModal sẽ xử lý)
    if (onCutVideo) {
      setIsCutting(true);
      try {
        await onCutVideo();
      } catch (error) {
        // SILENCED: console.error('[ConfigStage] Cut video error:', error);
        toast.error('Không thể bắt đầu cắt video. Vui lòng thử lại.');
      } finally {
        setIsCutting(false);
      }
    } else {
      // Fallback: gọi onNext như cũ (backward compatibility)
      onNext(config);
    }
  };

  const handleNext = () => {
    if (method === 'auto') {
      const autoCutConfig: AutoCutConfig = {
        clipCount,
        clipDuration,
        contentTheme
      };
      onNext({
        method: 'auto',
        autoCutConfig
      });
    } else {
      if (selectedRanges.length === 0) {
        if (transcriptError || transcript.length === 0) {
          toast.warning('Vui lòng nhập ít nhất một đoạn thời gian thủ công hoặc chuyển sang phương thức "Tự động"');
        } else {
          toast.warning(VIDEO_ERRORS.SELECT_AT_LEAST_ONE_SEGMENT);
        }
        return;
      }
      onNext({
        method: 'manual',
        manualSelections: selectedRanges
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">{t('configStageTitle') || 'Cấu hình cắt Video'}</h2>
        <p className="text-white/70">{t('configStageDesc') || 'Chọn phương thức cắt video'}</p>
      </div>

      {/* Method Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Auto Method Card */}
        <Card
          onClick={() => setMethod('auto')}
          className={`p-6 cursor-pointer transition-all ${method === 'auto'
            ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500 shadow-lg shadow-purple-500/20'
            : 'bg-[#180F2E] border-[#E33265]/50 hover:border-purple-500/50'
            }`}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">{t('autoMethod') || 'Tự động (AI Magic)'}</h3>
              <p className="text-sm text-white/60">{t('autoMethodDesc') || 'AI tự động tìm khoảnh khắc viral'}</p>
            </div>
            {method === 'auto' && (
              <Badge className="bg-purple-500 text-white">{t('selected') || 'Đã chọn'}</Badge>
            )}
          </div>
        </Card>

        {/* Manual Method Card */}
        <Card
          onClick={() => setMethod('manual')}
          className={`p-6 cursor-pointer transition-all ${method === 'manual'
            ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500 shadow-lg shadow-blue-500/20'
            : 'bg-[#180F2E] border-[#E33265]/50 hover:border-blue-500/50'
            }`}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center">
              <MousePointer className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">{t('manualMethod') || 'Thủ công (Transcript)'}</h3>
              <p className="text-sm text-white/60">{t('manualMethodDesc') || 'Chọn đoạn văn bản bạn muốn'}</p>
            </div>
            {method === 'manual' && (
              <Badge className="bg-blue-500 text-white">{t('selected') || 'Đã chọn'}</Badge>
            )}
          </div>
        </Card>
      </div>

      {/* Auto Method Configuration */}
      {method === 'auto' && (
        <Card className="bg-[#180F2E] border-[#E33265]/50 p-6 space-y-6">
          {/* Clip Count Slider */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-white flex items-center justify-between">
              <span>{t('clipCount') || 'Số lượng clip muốn tạo'}</span>
              <span className="text-purple-400 font-bold">{clipCount}</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={clipCount}
              onChange={(e) => {
                const newValue = Number(e.target.value);
                setClipCount(newValue);
                // Emit config ngay lập tức khi slider thay đổi để credit estimate update real-time
                if (onConfigChange && method === 'auto') {
                  onConfigChange({
                    method: 'auto',
                    autoCutConfig: {
                      clipCount: newValue,
                      clipDuration,
                      contentTheme,
                    },
                  });
                }
              }}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <div className="flex justify-between text-xs text-white/40">
              <span>1</span>
              <span>10</span>
            </div>
          </div>

          {/* Clip Duration */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-white">{t('clipDuration') || 'Độ dài mỗi clip'}</label>
            <div className="grid grid-cols-3 gap-2">
              {CLIP_DURATION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setClipDuration(option.value);
                    // Emit config ngay lập tức khi duration thay đổi để credit estimate update real-time
                    if (onConfigChange && method === 'auto') {
                      onConfigChange({
                        method: 'auto',
                        autoCutConfig: {
                          clipCount,
                          clipDuration: option.value,
                          contentTheme,
                        },
                      });
                    }
                  }}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${clipDuration === option.value
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-800/50 text-white/60 hover:bg-gray-800 hover:text-white'
                    }`}
                >
                  {option.labelVi}
                </button>
              ))}
            </div>
          </div>

          {/* Content Theme Filter */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-white">{t('contentTheme') || 'Chủ đề ưu tiên (Tùy chọn)'}</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {CONTENT_THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setContentTheme(option.value);
                    // Emit config ngay lập tức khi theme thay đổi (để nhất quán với các tùy chọn khác)
                    if (onConfigChange && method === 'auto') {
                      onConfigChange({
                        method: 'auto',
                        autoCutConfig: {
                          clipCount,
                          clipDuration,
                          contentTheme: option.value,
                        },
                      });
                    }
                  }}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${contentTheme === option.value
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-800/50 text-white/60 hover:bg-gray-800 hover:text-white'
                    }`}
                >
                  <span>{option.icon}</span>
                  <span>{option.labelVi}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Legacy Credit Estimator (Cắt video) - Đã chuyển sang panel bên phải, giữ lại để tham khảo */}
          {false && (
            <Card className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-orange-500/30 p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-orange-300 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-white mb-1">Ước tính Credit (Cắt video)</h4>
                  <p className="text-sm text-white/70 mb-2">
                    Cắt {clipCount} clip ({clipDuration === '<60s' ? 'Dưới 60s' : clipDuration === '60-90s' ? '60-90s' : 'Trên 90s'}) sẽ tiêu tốn khoảng
                  </p>
                  <div className="text-2xl font-bold text-orange-400">
                    {Math.ceil(clipCount * 5 * (clipDuration === '<60s' ? 1.0 : clipDuration === '60-90s' ? 1.5 : 2.0))} Credits
                  </div>
                  <p className="text-xs text-white/50 mt-1">
                    * Credit cho hậu kỳ (B-roll, phụ đề) sẽ được tính ở bước tiếp theo
                  </p>
                </div>
              </div>
            </Card>
          )}
        </Card>
      )}

      {/* Manual Method - Transcript Selection */}
      {method === 'manual' && (
        <div className="space-y-4">
          <Card className="bg-[#180F2E] border-[#E33265]/50 p-6">
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-300">
                💡 {t('transcriptHint') || 'Bôi đen đoạn văn bản bạn muốn tạo clip, sau đó nhấn nút "Tạo clip từ đoạn này"'}
              </p>
            </div>

            {/* Fixed action button: xuất hiện ngay dưới hint khi có selectionPopup */}
            {selectionPopup && (
              <div className="mb-3">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddFromPopup}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg"
                >
                  Tạo clip từ đoạn này
                </Button>
              </div>
            )}

            {loadingTranscript ? (
              <div className="max-h-96 overflow-y-auto p-8 bg-gray-900/50 rounded-lg flex items-center justify-center">
                <div className="text-center w-full max-w-md">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-4" />
                  <p className="text-white/60 font-medium mb-2">
                    {transcriptJobId ? 'Đang xử lý transcription...' : 'Đang lấy transcript...'}
                  </p>
                  {transcriptProgress && (
                    <div className="mt-4 space-y-2">
                      <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full transition-all duration-300"
                          style={{ width: `${transcriptProgress.progress}%` }}
                        />
                      </div>
                      {transcriptProgress.message && (
                        <p className="text-white/50 text-sm">{transcriptProgress.message}</p>
                      )}
                      <p className="text-white/40 text-xs mt-1">
                        {transcriptProgress.progress < 100 ? 'Vui lòng chờ, quá trình này có thể mất vài phút...' : 'Hoàn tất!'}
                      </p>
                    </div>
                  )}
                  {!transcriptProgress && (
                    <p className="text-white/40 text-sm mt-2">Vui lòng chờ trong giây lát</p>
                  )}
                </div>
              </div>
            ) : transcriptError || transcript.length === 0 ? (
              <div className="max-h-96 overflow-y-auto p-8 bg-gray-900/50 rounded-lg">
                <div className="text-center mb-4">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <span className="text-2xl">⚠️</span>
                  </div>
                  <p className="text-white/80 font-medium mb-2">Không thể lấy transcript</p>
                  <p className="text-white/60 text-sm mb-4">{transcriptError || 'Video không có transcript hoặc không thể lấy được.'}</p>

                  <div className="flex flex-col gap-2 items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMethod('auto');
                        setTranscriptError(null);
                      }}
                      className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                    >
                      Chuyển sang "Tự động (AI Magic)"
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        userTriggeredFetch.current = true; // Ghi nhận user chủ động "Thử lại"
                        fetchTranscript();
                      }}
                      className="border-white/20 text-white/60 hover:bg-white/10"
                    >
                      Thử lại
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowManualTimeInput(!showManualTimeInput)}
                      className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                    >
                      {showManualTimeInput ? 'Hủy' : 'Nhập thời gian thủ công'}
                    </Button>
                  </div>
                </div>

                {/* Manual time input */}
                {showManualTimeInput && (
                  <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-sm text-blue-300 mb-3">Nhập thời gian bắt đầu và kết thúc (giây):</p>
                    <div className="flex gap-3 items-center">
                      <div className="flex-1">
                        <label className="text-xs text-white/60 mb-1 block">Bắt đầu (giây)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={manualStartTime}
                          onChange={(e) => setManualStartTime(e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 bg-gray-800/50 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-white/60 mb-1 block">Kết thúc (giây)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={manualEndTime}
                          onChange={(e) => setManualEndTime(e.target.value)}
                          placeholder="60"
                          className="w-full px-3 py-2 bg-gray-800/50 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <Button
                        onClick={handleAddManualTimeRange}
                        size="sm"
                        className="bg-green-500 hover:bg-green-600 mt-6"
                      >
                        Thêm
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                ref={transcriptRef}
                className="relative max-h-96 overflow-y-auto p-4 bg-gray-900/50 rounded-lg space-y-3 select-text"
                onMouseUp={handleTranscriptSelection}
              >
                {transcript.map((segment: TranscriptSegment, index: number) => (
                  <p
                    key={`transcript-${segment.startTime}-${segment.endTime}-${index}`}
                    className="text-white/80 leading-relaxed"
                    // Gắn metadata segment lên toàn bộ dòng để selection ở đâu trong dòng cũng bắt được
                    data-seg-start={segment.startTime}
                    data-seg-end={segment.endTime}
                    data-seg-text={segment.text}
                  >
                    <span className="text-white/40 text-xs mr-2">
                      [{formatTime(segment.startTime)}] - [{formatTime(segment.endTime)}]
                    </span>
                    <span>
                      {segment.text}
                    </span>
                  </p>
                ))}
              </div>
            )}
          </Card>

          {/* Selected Ranges */}
          {selectedRanges.length > 0 && (
            <Card className="bg-[#180F2E] border-[#E33265]/50 p-6">
              <h3 className="text-sm font-medium text-white mb-3">
                {t('selectedClips') || 'Các đoạn đã chọn'} ({selectedRanges.length})
              </h3>
              <div className="space-y-2">
                {selectedRanges.map((range: ManualCutSelection, index: number) => (
                  <div key={`range-${range.startTime}-${range.endTime}-${index}`} className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start justify-between gap-3">
                    <p className="text-sm text-white/80 flex-1 line-clamp-2">{range.text}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSelection(index)}
                      className="text-red-400 hover:text-red-300 flex-shrink-0"
                    >
                      {t('remove') || 'Xóa'}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          onClick={onBack}
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10"
          disabled={isCutting}
        >
          ← {t('back') || 'Quay lại'}
        </Button>
        {/* ✅ NEW: Hiển thị nút "Cut video" nếu có onCutVideo callback, ngược lại giữ nút "Tiếp tục" */}
        {onCutVideo ? (
          <Button
            onClick={handleCutVideo}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-8"
            size="lg"
            disabled={isCutting}
          >
            {isCutting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang cắt video...
              </>
            ) : (
              <>
                Cut video <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-8"
            size="lg"
          >
            {t('next') || 'Tiếp tục'} →
          </Button>
        )}
      </div>
    </div>
  );
}
