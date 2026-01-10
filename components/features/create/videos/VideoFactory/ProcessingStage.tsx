"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// ✅ Helper function for development-only logging
const devWarn = (...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.warn(...args);
  }
};

// ✅ BUG A FIX: REMOVED presigned URL helper
// Architectural fix: We ONLY use Asset Gateway pattern (/api/assets/{assetId})
// Presigned URLs are NEVER used directly from FE (eliminates CORS, expiry, auth issues)

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, Download, Eye, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { GeneratedVideoClip } from "@/lib/types/video";
// ✅ OPTIMIZATION: Use custom hooks for cleaner code and better maintainability
import { useCurrentJobId } from "@/store/videos/videoFactory.selectors";
import { toast } from "sonner";

interface ProcessingStageProps {
  progress: number;
  message: string;
  isCompleted: boolean;
  generatedClips?: GeneratedVideoClip[];
  finalUrl?: string;
  onClose: () => void;
  onMinimize?: () => void;
  /**
   * ✅ NEW: Callback để thông báo ra ngoài khi overlay preview video mở / đóng
   * - Dùng để ẩn / hiện card \"Ước tính Credit\" khi play clip full-screen
   */
  onPreviewOpenChange?: (open: boolean) => void;
}

export function ProcessingStage({
  progress,
  message,
  isCompleted,
  generatedClips,
  finalUrl,
  onClose,
  onMinimize,
  onPreviewOpenChange,
}: ProcessingStageProps) {
  const t = useTranslations('CreatePage.videoFactory');
  const [previewClip, setPreviewClip] = useState<GeneratedVideoClip | null>(null);

  // ✅ OPTIMIZATION: Use custom hooks for cleaner code and better maintainability
  // This ensures component re-renders when jobId changes
  const jobId = useCurrentJobId();

  /**
   * ✅ NEW: Retry a single FAILED clip (cut stage) using the batch retry endpoint with a single index.
   * - Reuses Server B logic cho cả batch, nhưng scope theo từng clip.
   * - Không ảnh hưởng tới flow cut completion hiện tại.
   */
  const handleRetryClip = async (clip: GeneratedVideoClip) => {
    try {
      if (!jobId || clip.index === undefined) {
        toast.error("Không thể retry clip: thiếu jobId hoặc clip index");
        return;
      }

      toast.info("Đang retry clip...");

      const res = await fetch(`/api/video-factory/jobs/${jobId}/retry-clips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipIndexes: [clip.index] }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error?.error || "Retry failed");
      }

      toast.success("Đã bắt đầu retry clip. Vui lòng đợi...");
    } catch (error) {
      devWarn("[ProcessingStage] Retry clip failed", {
        error: error instanceof Error ? error.message : String(error),
        jobId,
        clipIndex: clip.index,
      });
      toast.error(error instanceof Error ? error.message : "Retry failed");
    }
  };

  // ✅ BUG A FIX: Asset Gateway ONLY - NO presigned URLs
  // Architectural fix: Presigned URL + FE direct load = kiến trúc sai
  // We ONLY use Asset Gateway pattern: /api/assets/{assetId}

  // ✅ CRITICAL FIX: If clips are available, stop loading and show clips immediately
  // User requirement: "1 clip done là chuyển xuống step hậu kỳ luôn + dừng Loading"
  // This ensures user sees results as soon as FIRST clip completes, without waiting for full job completion
  const hasClips = (generatedClips?.length || 0) > 0;
  // ✅ CRITICAL: Check if ANY clip has completed (has URL) - stop loading immediately
  const hasCompletedClip = hasClips && generatedClips?.some((c: any) => c.url && c.url.startsWith('http'));
  // ✅ CRITICAL FIX: Stop loading when we have clips (even if not all completed) OR when job is completed
  const shouldShowLoading = !isCompleted && !hasClips; // Only show loading if no clips at all

  return (
    <div className="space-y-6">
      {shouldShowLoading ? (
        <>
          {/* Processing Animation - Only show when no clips available yet */}
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
                </div>
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 opacity-20 animate-pulse" />
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-2">{t('processing') || 'Đang xử lý Video'}</h2>
              <p className="text-white/70">{t('processingDesc') || 'Vui lòng chờ trong giây lát...'}</p>
            </div>

            {/* Progress Bar */}
            <div className="max-w-md mx-auto space-y-3">
              <Progress value={progress} className="h-3" />
              <div className="flex justify-between text-sm">
                <span className="text-white/60">{Math.round(progress)}%</span>
                <span className="text-white/60">{t('estimatedTime') || 'Ước tính'}: {Math.max(1, Math.round((100 - progress) / 10))}s</span>
              </div>
            </div>

            {/* Status Messages */}
            <Card className="bg-[#180F2E] border-[#E33265]/50 p-6 max-w-md mx-auto">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <p className="text-white/80 text-left">{message}</p>
              </div>
            </Card>

            {/* Minimize Button */}
            {onMinimize && (
              <Button
                onClick={onMinimize}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                {t('minimize') || 'Thu nhỏ'}
              </Button>
            )}
          </div>
        </>
      ) : hasClips && !isCompleted ? (
        <>
          {/* ✅ CRITICAL FIX: Show clips immediately when available (cut done, but job may still be processing) */}
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-400" />
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-2">{t('clipsReady') || 'Clips đã sẵn sàng!'}</h2>
              <p className="text-white/70">{t('clipsReadyDesc') || 'Các clip đã được cắt thành công. Bạn có thể xem và tải xuống ngay.'}</p>
            </div>

            {/* Generated Clips */}
            {generatedClips && generatedClips.length > 0 && (
              <div className="space-y-4 mt-6">
                <h3 className="text-lg font-semibold text-white text-center">
                  {t('generatedClips') || 'Các clip đã tạo'} ({generatedClips.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {generatedClips.map((clip) => {
                    // ✅ FUTURE-PROOF FIX: FE MUST only render when status === 'READY'
                    const clipStatus = (clip as any).status || 'PROCESSING';
                    const normalizedStatus = clipStatus.toUpperCase();
                    const isReady = normalizedStatus === 'READY' || normalizedStatus === 'DONE';
                    const isFailed = normalizedStatus === 'FAILED';

                    // ✅ FUTURE-PROOF: Show error state for FAILED clips with failureReason
                    if (isFailed) {
                      const failureReason = (clip as any).failureReason;
                      const failureMessage = (clip as any).failureMessage;

                      // Get user-friendly error message based on failureReason
                      let errorMessage = 'Lỗi tạo clip';
                      if (failureMessage) {
                        errorMessage = failureMessage;
                      } else if (failureReason === 'VERIFY_TIMEOUT') {
                        errorMessage = 'Không thể xác minh file trên S3';
                      } else if (failureReason === 'UPLOAD_FAILED') {
                        errorMessage = 'Upload file thất bại';
                      } else if (failureReason === 'MEDIACONVERT_ERROR') {
                        errorMessage = 'Lỗi xử lý video';
                      }

                      const retryCount =
                        (clip as any).retryCount ?? (clip as any).retry_count ?? 0;
                      const maxRetry = 3;

                      return (
                        <Card key={clip.id} className="bg-[#180F2E] border-red-500/50 p-0">
                          <div className="relative mb-3 rounded-lg overflow-hidden group">
                            <div className="w-full aspect-video bg-red-900/20 flex flex-col items-center justify-center text-red-400">
                              <div className="w-8 h-8 mb-2">⚠️</div>
                              <span className="text-sm">{errorMessage}</span>
                              {failureReason && (
                                <span className="text-xs mt-1 text-red-500/60">({failureReason})</span>
                              )}
                              {/* ✅ NEW: Per-clip retry button for FAILED clips (only when retry limit not exceeded) */}
                              {retryCount < maxRetry && (
                                <div className="mt-3">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10 px-3 text-xs"
                                    onClick={() => handleRetryClip(clip)}
                                  >
                                    🔄 Retry
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className="absolute top-2 left-2 bg-red-500/80 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
                              ⚠️ Lỗi
                            </div>
                          </div>
                        </Card>
                      );
                    }

                    // ✅ FUTURE-PROOF: Show loading state when status !== 'READY'
                    // ✅ NEW: Check timeout based on server time (updatedAt) instead of client mount time
                    if (!isReady) {
                      const updatedAt = (clip as any).updatedAt || (clip as any).updated_at;
                      let isTimedOut = false;
                      if (updatedAt) {
                        const serverTime = Date.now(); // Client time (can be improved with server timestamp sync)
                        const processingStartTime = new Date(updatedAt).getTime();
                        const processingDuration = serverTime - processingStartTime;
                        isTimedOut = processingDuration > 60000; // 60 seconds timeout
                      }

                      // ✅ OPTIMIZATION: Check if this is a placeholder clip (optimistic UI)
                      const isPlaceholder = (clip as any).isPlaceholder === true;

                      return (
                        <Card key={clip.id} className={`bg-[#180F2E] border-[#E33265]/50 p-0 ${isPlaceholder ? 'opacity-50' : ''}`}>
                          <div className="relative mb-3 rounded-lg overflow-hidden group">
                            <div className="w-full aspect-video bg-gray-800 flex flex-col items-center justify-center">
                              {isTimedOut ? (
                                <>
                                  <div className="w-8 h-8 mb-2">⏱️</div>
                                  <span className="text-gray-400 text-sm">Đang xử lý quá lâu</span>
                                  <span className="text-gray-500 text-xs mt-1">Vui lòng thử lại sau</span>
                                </>
                              ) : (
                                <>
                                  <Loader2 className="w-8 h-8 text-gray-400 animate-spin mb-2" />
                                  <span className="text-gray-400 text-sm">Đang xử lý...</span>
                                </>
                              )}
                            </div>
                            <div className="absolute top-2 left-2 bg-yellow-500/80 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Đang xử lý
                            </div>
                          </div>
                        </Card>
                      );
                    }

                    // ✅ CONTRACT: Only render when status === 'READY'
                    // ✅ OPTIMIZATION: Use jobId from selector (already defined at component level) instead of getState() in render body
                    // ✅ FUTURE-PROOF: Use clipId (UUID) if available, fallback to old format (jobId-index) for backward compatibility
                    const clipId = (clip as any).clipId || (clip as any).id;
                    const thumbnailAssetId = (clip as any).thumbnailAssetId ||
                      (clipId ? `clip-thumb:${clipId}` : undefined) || // ✅ NEW: Use clipId (UUID)
                      (jobId && clip.index !== undefined ? `clip-thumb:${jobId}-${clip.index}` : undefined); // ✅ LEGACY: Fallback to old format
                    const hasThumbnail = !!thumbnailAssetId;

                    // ✅ CRITICAL: ONLY Asset Gateway - if it fails, show placeholder
                    // NEVER fallback to presigned URLs (architectural fix)
                    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                      const img = e.target as HTMLImageElement;
                      devWarn('[ProcessingStage] Asset Gateway failed - showing placeholder', {
                        thumbnailAssetId,
                        clipId: clip.id,
                        error: 'Asset Gateway returned error - this should not happen in production',
                      });
                      img.style.display = 'none';
                    };

                    return (
                      <Card key={clip.id} className="bg-[#180F2E] border-[#E33265]/50 p-0">
                        <div className="relative mb-3 rounded-lg overflow-hidden group">
                          {/* ✅ FIX: Show thumbnail if available, otherwise show loading spinner */}
                          {hasThumbnail ? (
                            <img
                              src={`/api/assets/${thumbnailAssetId}`}
                              alt={clip.title}
                              className="w-full aspect-video object-cover"
                              onError={handleImageError}
                            />
                          ) : (
                            <div className="w-full aspect-video bg-gray-800 flex items-center justify-center">
                              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                              <span className="ml-2 text-gray-400 text-sm">Đang xử lý...</span>
                            </div>
                          )}
                          {/* ✅ CONTRACT: Only show action buttons if status === 'READY' */}
                          {isReady && (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="bg-white/20 hover:bg-white/30 text-white"
                                onClick={() => {
                                  setPreviewClip(clip);
                                  // ✅ NEW: Ẩn card Ước tính Credit khi preview mở
                                  onPreviewOpenChange?.(true);
                                }}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                {t('preview') || 'Xem'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="bg-white/20 hover:bg-white/30 text-white"
                                onClick={() => clip.url && window.open(clip.url, '_blank', 'noopener,noreferrer')}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                {t('download') || 'Tải'}
                              </Button>
                            </div>
                          )}
                          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                            {clip.duration || (clip.startTime !== undefined && clip.endTime !== undefined ? `${Math.round((clip.endTime - clip.startTime))}s` : '')}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center gap-3">
              <Button
                onClick={onClose}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-8"
                size="lg"
              >
                {t('done') || 'Hoàn tất'}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Completion Screen */}
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-400" />
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-2">{t('processingComplete') || 'Hoàn thành!'}</h2>
              <p className="text-white/70">{t('processingCompleteDesc') || 'Video của bạn đã được xử lý thành công'}</p>
            </div>

            {/* Generated Clips */}
            {finalUrl && (
              <Card className="bg-[#180F2E] border-[#E33265]/50 p-4 text-left">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">{t('finalVideo') || 'Video hoàn chỉnh'}</h3>
                    <p className="text-xs text-white/60 truncate">{finalUrl}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={() => window.open(finalUrl, '_blank', 'noopener,noreferrer')}>
                      {t('preview') || 'Xem'}
                    </Button>
                    <Button size="sm" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600" onClick={() => window.open(finalUrl, '_blank', 'noopener,noreferrer')}>
                      {t('download') || 'Tải'}
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {generatedClips && generatedClips.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">
                  {t('generatedClips') || 'Các clip đã tạo'} ({generatedClips.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {generatedClips.map((clip) => {
                    // ✅ CONTRACT FIX: FE MUST only render when status === 'READY'
                    const clipStatus = (clip as any).status || 'PROCESSING';
                    const isReady = clipStatus.toUpperCase() === 'READY' || clipStatus.toUpperCase() === 'DONE';

                    // ✅ CONTRACT: Show loading state when status !== 'READY'
                    // ✅ OPTIMIZATION: Show placeholder clips with reduced opacity for optimistic UI
                    const isPlaceholder = (clip as any).isPlaceholder === true;
                    if (!isReady) {
                      return (
                        <Card
                          key={clip.id}
                          className={`bg-[#180F2E] border-[#E33265]/50 p-4 ${isPlaceholder ? 'opacity-50' : ''}`}
                        >
                          <div className="relative mb-3 rounded-lg overflow-hidden group">
                            <div className="w-full aspect-video bg-gray-800 flex flex-col items-center justify-center">
                              <Loader2 className="w-8 h-8 text-gray-400 animate-spin mb-2" />
                              <span className="text-gray-400 text-sm">Đang xử lý...</span>
                            </div>
                          </div>
                        </Card>
                      );
                    }

                    // ✅ CONTRACT: Only render when status === 'READY'
                    // ✅ OPTIMIZATION: Use jobId from selector (already defined at component level) instead of getState() in render body
                    // ✅ FUTURE-PROOF: Use clipId (UUID) if available, fallback to old format (jobId-index) for backward compatibility
                    const clipId = (clip as any).clipId || (clip as any).id;
                    const thumbnailAssetId = (clip as any).thumbnailAssetId ||
                      (clipId ? `clip-thumb:${clipId}` : undefined) || // ✅ NEW: Use clipId (UUID)
                      (jobId && clip.index !== undefined ? `clip-thumb:${jobId}-${clip.index}` : undefined); // ✅ LEGACY: Fallback to old format
                    const hasThumbnail = !!thumbnailAssetId;

                    // ✅ CRITICAL: ONLY Asset Gateway - if it fails, show placeholder
                    // NEVER fallback to presigned URLs (architectural fix)
                    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                      const img = e.target as HTMLImageElement;
                      devWarn('[ProcessingStage] Asset Gateway failed - showing placeholder (completed view)', {
                        thumbnailAssetId,
                        clipId: clip.id,
                        error: 'Asset Gateway returned error - this should not happen in production',
                      });
                      img.style.display = 'none';
                    };

                    return (
                      <Card key={clip.id} className="bg-[#180F2E] border-[#E33265]/50 p-4">
                        <div className="relative mb-3 rounded-lg overflow-hidden group">
                          {hasThumbnail ? (
                            <img
                              src={`/api/assets/${thumbnailAssetId}`}
                              alt={clip.title}
                              className="w-full aspect-video object-cover"
                              onError={handleImageError}
                            />
                          ) : (
                            <div className="w-full aspect-video bg-gray-800 flex items-center justify-center text-white/60 text-xs">
                              Không có preview
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="bg-white/20 hover:bg-white/30 text-white"
                              onClick={() => setPreviewClip(clip)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              {t('preview') || 'Xem'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="bg-white/20 hover:bg-white/30 text-white"
                              onClick={() => clip.url && window.open(clip.url, '_blank', 'noopener,noreferrer')}
                            >
                              <Download className="w-4 h-4 mr-1" />
                              {t('download') || 'Tải'}
                            </Button>
                          </div>
                          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                            {clip.duration}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center gap-3">
              <Button
                onClick={onClose}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-8"
                size="lg"
              >
                {t('done') || 'Hoàn tất'}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ✅ CRITICAL FIX: Video preview fullscreen modal (like Media Library) */}
      {/* ✅ CRITICAL FIX: Rendered via Portal to escape Dialog stacking context */}
      {typeof window !== 'undefined' && previewClip && createPortal(
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/90"
          onClick={() => {
            setPreviewClip(null);
            // ✅ NEW: Hiện lại card Ước tính Credit khi đóng preview
            onPreviewOpenChange?.(false);
          }}
        >
          <div
            className="relative w-full max-w-5xl mx-4 bg-black rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-3 z-10 rounded-full bg-black/70 text-white p-2 hover:bg-black/90 transition-colors"
              onClick={() => {
                setPreviewClip(null);
                // ✅ NEW: Hiện lại card Ước tính Credit khi đóng preview
                onPreviewOpenChange?.(false);
              }}
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
            {(() => {
              // ✅ CONTRACT FIX: FE MUST only render video when status === 'READY'
              const clipStatus = (previewClip as any).status || 'PROCESSING';
              const isReady = clipStatus.toUpperCase() === 'READY' || clipStatus.toUpperCase() === 'DONE';

              if (!isReady) {
                // ✅ CONTRACT: Show loading state when status !== 'READY'
                return (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white">
                    <div className="w-12 h-12 border-4 border-white/30 border-t-white/80 rounded-full animate-spin mb-4" />
                    <p className="text-lg">Đang xử lý video...</p>
                    <p className="text-sm text-white/60 mt-2">Vui lòng chờ trong giây lát</p>
                  </div>
                );
              }

              // ✅ CONTRACT: Only render video when status === 'READY'
              // ✅ OPTIMIZATION: Use jobId from selector (already defined at component level) instead of getState() in render body
              // ✅ FUTURE-PROOF: Use clipId (UUID) if available, fallback to old format (jobId-index) for backward compatibility
              const clipId = (previewClip as any).clipId || (previewClip as any).id;
              const videoAssetId = (previewClip as any).videoAssetId ||
                (clipId ? `clip-video:${clipId}` : undefined) || // ✅ NEW: Use clipId (UUID)
                (jobId && previewClip.index !== undefined ? `clip-video:${jobId}-${previewClip.index}` : undefined); // ✅ LEGACY: Fallback to old format

              if (!videoAssetId) {
                return (
                  <div className="w-full aspect-video bg-gray-900 flex items-center justify-center text-white">
                    <p>Video không khả dụng</p>
                  </div>
                );
              }

              return (
                <video
                  src={`/api/assets/${videoAssetId}`}
                  className="w-full h-full max-h-[80vh] object-contain bg-black"
                  controls
                  autoPlay
                  onError={(e) => {
                    const video = e.target as HTMLVideoElement;
                    devWarn('[ProcessingStage] Asset Gateway failed for video - showing error', {
                      videoAssetId,
                      clipId: previewClip.id,
                      error: 'Asset Gateway returned error - this should not happen in production',
                    });

                    // Show error message instead of video
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'w-full h-full flex items-center justify-center text-white bg-black/50';
                    errorDiv.textContent = 'Video không khả dụng';
                    video.parentElement?.appendChild(errorDiv);
                    video.style.display = 'none';
                  }}
                />
              );
            })()}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
