"use client";

import { useTextToVideoModalStore } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, Sparkles, Info, Loader2, CheckCircle2, Play, Download, Share2, Clipboard, FileText, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { TextToVideoDuration, VideoAspectRatio, AiVideoProject } from "@/lib/types/video";
import { TEXT_TO_VIDEO_DURATION_OPTIONS, VIDEO_ASPECT_RATIO_OPTIONS } from "@/lib/constants/video";
import { calculateVideoCredits } from "@/lib/utils/videoUtils";
import { toast } from "sonner";
import { VIDEO_ERRORS } from "@/lib/messages/errors";
import { useAiVideoProjectSSE } from "@/lib/hooks/useAiVideoProjectSSE";
import { useCreditsStore, useLimitExceededModalStore, useVideoProjectsStore } from "@/store";
import { useState, useEffect } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { VideoPreviewOverlay } from '@/components/shared/VideoPreviewOverlay';

export function TextToVideoModal() {
  const t = useTranslations('CreatePage.textToVideo');
  const {
    isTextToVideoModalOpen,
    activeProjectId,
    activeStep,
    setStep,
    closeTextToVideoModal,
    createTextToVideo,
    reset
  } = useTextToVideoModalStore(
    useShallow((state) => ({
      isTextToVideoModalOpen: state.isTextToVideoModalOpen,
      activeProjectId: state.activeProjectId,
      activeStep: state.activeStep,
      setStep: state.setStep,
      closeTextToVideoModal: state.closeTextToVideoModal,
      createTextToVideo: state.createTextToVideo,
      reset: state.reset
    }))
  );

  const retryTextToVideo = useVideoProjectsStore(state => state.retryTextToVideo);

  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [duration, setDuration] = useState<TextToVideoDuration>(15);
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('16:9');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('1080p');

  const { project, isConnected, error: sseError, connect, reconnect } = useAiVideoProjectSSE(activeProjectId);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingScenes, setDownloadingScenes] = useState<Record<string, boolean>>({});
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [activePreviewPoster, setActivePreviewPoster] = useState<string | undefined>(undefined);
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false); // ✅ NEW: Track manual recovery attempt

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => setAuthToken(data.session?.access_token || null));
  }, []);

  // ✅ AUTO-TRANSITION: Move to result step when DONE or when final video URL is available
  useEffect(() => {
    const isFinished = project?.status === 'DONE' || !!project?.final_video_url;

    if (activeStep === 'production' && isFinished) {
      const timer = setTimeout(() => setStep('result'), 1500);
      return () => clearTimeout(timer);
    }

    // ✅ RESUME HANDLER: Clear error state if project is retrying
    // The JQM worker sends 'RESUME_PRODUCTION' message via SSE when retry starts
    if (activeStep === 'production' && project?.status !== 'FAILED' && project?.error_details) {
      // project error_details will be cleared by the snapshot/sse from backend
      // But we can also proactively ensure UI is clean
    }

  }, [project?.status, project?.final_video_url, project?.error_details, activeStep, setStep]);

  const estimatedCredits = calculateVideoCredits(duration);

  const { creditsRemaining, currentPlan } = useCreditsStore();
  const openLimitModal = useLimitExceededModalStore(state => state.openModal);

  const handleDownload = async (customUrl?: string, sceneId?: string) => {
    const url = customUrl || project?.final_video_url;
    if (!url) return;

    if (sceneId) {
      setDownloadingScenes(prev => ({ ...prev, [sceneId]: true }));
    } else {
      setIsDownloading(true);
    }

    try {
      const filename = `maiovo-ai-${Date.now()}.mp4`;

      const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(url, '_blank');
    } finally {
      if (sceneId) {
        setDownloadingScenes(prev => ({ ...prev, [sceneId]: false }));
      } else {
        setIsDownloading(false);
      }
    }
  };

  const handleCreate = () => {

    if (!prompt.trim()) {
      toast.warning(VIDEO_ERRORS.PROMPT_REQUIRED);
      return;
    }

    // ✅ CREDIT CHECK: Ensure user has enough credits before calling API
    if (creditsRemaining < estimatedCredits) {
      openLimitModal(
        'insufficient_credits',
        `Bạn cần ${estimatedCredits} credits để sản xuất video này, nhưng hiện chỉ còn ${creditsRemaining} credits.`,
        { creditsRemaining, currentPlan }
      );
      return;
    }

    createTextToVideo({
      prompt,
      duration,
      aspectRatio,
      resolution,
      estimatedCredits,
      negativePrompt: negativePrompt.trim() || undefined
    });
  };


  const handleResume = async () => {
    if (!activeProjectId) return;
    try {
      await retryTextToVideo(activeProjectId);
    } catch (error) {
      console.error("Resume failed", error);
      throw error;
    }
  };

  const renderForm = () => (
    <>
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-b border-[#E33265]/30 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-purple-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-white truncate">{t('title') || 'Text-to-Video'}</h2>
              <p className="text-xs sm:text-sm text-white/60 truncate">{t('subtitle') || 'Tạo video từ mô tả văn bản'}</p>
            </div>
          </div>
          <button
            onClick={closeTextToVideoModal}
            className="w-10 h-10 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-white/60 hover:text-white flex-shrink-0 -mr-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[70vh] overflow-y-auto">
        <div className="space-y-2">
          <Label className="text-white font-medium flex items-center gap-2">
            Mô tả video của bạn <span className="text-red-400">*</span>
          </Label>
          <Textarea
            placeholder="Ví dụ: Một chú mèo cyberpunk đang nhảy múa dưới ánh đèn neon..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-32 bg-gray-900/50 border-white/20 text-white resize-none"
            maxLength={5000}
          />
        </div>

        {/* Negative Prompt */}
        <div className="space-y-2">
          <Label className="text-white font-medium">Negative Prompt (Không muốn xuất hiện)</Label>
          <Textarea
            placeholder="Ví dụ: mờ, rung, chất lượng thấp, chữ viết..."
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            className="min-h-20 bg-gray-900/50 border-white/20 text-white resize-none text-sm"
            maxLength={300}
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white font-medium">Độ dài video</Label>
            <div className="grid grid-cols-4 gap-2">
              {TEXT_TO_VIDEO_DURATION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDuration(option.value)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${duration === option.value
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                    : 'bg-gray-800/50 text-white/60 hover:bg-gray-800 hover:text-white'
                    }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-white font-medium">Tỷ lệ khung hình</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {VIDEO_ASPECT_RATIO_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setAspectRatio(option.value)}
                  className={`w-full py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all text-center ${aspectRatio === option.value
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                    : 'bg-gray-800/50 text-white/60 hover:bg-gray-800 hover:text-white'
                    }`}
                >
                  {option.labelVi}
                </button>
              ))}
            </div>
          </div>

          {/* <div className="space-y-2">
            <Label className="text-white font-medium">Độ phân giải</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: '720p', label: '720p' },
                { value: '1080p', label: '1080p' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setResolution(opt.value as any)}
                  className={`w-full py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all text-center ${resolution === opt.value
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                    : 'bg-gray-800/50 text-white/60 hover:bg-gray-800 hover:text-white'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div> */}
        </div>

        <Card className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-orange-500/30 p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-orange-300 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-lg font-bold text-orange-400">{estimatedCredits} Credits</div>
              <p className="text-xs text-white/50 mt-1">Ước tính cho video {duration}s</p>
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Button onClick={closeTextToVideoModal} variant="outline" className="border-white/20 text-white">
            Hủy
          </Button>
          <Button onClick={handleCreate} disabled={!prompt.trim()} className="bg-gradient-to-r from-purple-500 to-pink-500 px-8">
            <Sparkles className="w-4 h-4 mr-2" />
            Tạo Video
          </Button>
        </div>
      </div>
    </>
  );

  const renderProduction = () => (
    <div className="p-8 space-y-8 text-center relative">
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={closeTextToVideoModal}
          className="w-10 h-10 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-white/60 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="relative mx-auto w-32 h-32">
        <div className="relative w-full h-full rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          {project?.status === 'FAILED' ? (
            <X className="w-16 h-16 text-white" />
          ) : (
            <Loader2 className="w-16 h-16 text-white" />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">
          {!project
            ? 'Đang tải thông tin...'
            : project.status === 'FAILED'
              ? 'Sản xuất tạm dừng'
              : project.status === 'ANALYZING' || project.status === 'PLANNING'
                ? 'Đang phân tích kịch bản...'
                : project.status === 'GENERATING_CHARACTER'
                  ? 'Đang tạo nhân vật...'
                  : project.status === 'GENERATING_SCENES'
                    ? 'Đang sản xuất phân cảnh...'
                    : project.status === 'STITCHING'
                      ? 'Đang ghép nối video...'
                      : isConnected
                        ? 'Đang sản xuất AI...'
                        : 'Đang xử lý...'}
        </h2>
        <p className="text-white/60">
          {!project
            ? 'Vui lòng đợi trong giây lát.'
            : project.status === 'FAILED'
              ? 'Đã xảy ra lỗi. Bạn có thể thử "Tiếp tục" để chạy lại bước này.'
              : isConnected
                ? 'Vui lòng không đóng cửa sổ này để theo dõi tiến trình.'
                : 'Đang cập nhật tiến độ qua Realtime...'}
        </p>
      </div>

      <div className="max-w-md mx-auto space-y-4">
        <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
            style={{ width: `${project?.progress ?? 0}%` }}
          />
        </div>
        <div className="flex justify-between text-sm font-medium">
          <span className="text-purple-400">
            {project?.status === 'FAILED' ? 'BỊ LỖI' : (project?.status || 'ĐANG TẢI')}
          </span>
          <span className="text-white">{project?.progress ?? 0}%</span>
        </div>
      </div>

      {/* 🎬 Scene Preview Grid - Only show scenes with videoUrl */}
      {project?.config_data?.scenes && project.config_data.scenes.some(s => s.videoUrl) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto py-4">
          {project.config_data.scenes.filter(s => s.videoUrl).map((scene, idx) => {
            // ✅ ENHANCEMENT: Use Asset Gateway for scenes
            // Priority: 1. Specific Asset ID, 2. Dynamic Scene Resolver (Fallback), 3. Direct URL (Legacy)
            const videoSrc = scene.videoAssetId
              ? `/api/assets/media-video:${scene.videoAssetId}${authToken ? `?token=${authToken}` : ''}`
              : scene.videoS3Key
                ? `/api/assets/ai-scene-video:${project.id}-${scene.sceneId}${authToken ? `?token=${authToken}` : ''}`
                : scene.videoUrl;

            return (
              <div
                key={idx}
                className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden border border-white/10 group cursor-pointer hover:border-purple-500/50 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (videoSrc) {
                    setActivePreviewUrl(videoSrc);
                    setActivePreviewPoster(scene.thumbnailUrl || scene.sourceImageUrl || project?.config_data?.characterProfile?.anchorImageUrl);
                  }
                }}
              >
                <video
                  src={videoSrc}
                  poster={scene.thumbnailUrl || scene.sourceImageUrl || project.config_data?.characterProfile?.anchorImageUrl}
                  className="w-full h-full object-cover"
                  preload="metadata"
                  onMouseOver={(e) => e.currentTarget.play()}
                  onMouseOut={(e) => {
                    e.currentTarget.pause();
                    e.currentTarget.currentTime = 0;
                  }}
                  muted
                  loop
                />
                <div className="absolute top-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-[10px] text-white/80">
                  Cảnh {scene.sceneId || idx + 1}
                </div>
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-6 h-6 text-white text-2xl fill-white" />
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* Production Logs */}
      <Card className="bg-black/40 border-white/10 p-4 text-left max-h-48 overflow-y-auto">
        <div className="space-y-3">
          {/* Stage 1: Analyzing */}
          <div className="flex items-center gap-3 text-sm">
            {(project?.progress || 0) >= 20 || project?.status === 'DONE' ? (
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            ) : project?.status === 'FAILED' ? (
              <X className="w-4 h-4 text-red-500" />
            ) : (
              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
            )}
            <span className={(project?.progress || 0) >= 20 || project?.status === 'DONE' ? 'text-white/40' : 'text-white'}>
              {project?.status === 'INIT' ? 'Đang xếp hàng chờ xử lý...' : 'Phân tích kịch bản & Storyboard'}
            </span>
          </div>

          {/* Stage 2: Character Gen */}
          <div className="flex items-center gap-3 text-sm">
            {(project?.progress || 0) >= 40 || project?.status === 'DONE' ? (
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            ) : project?.status === 'FAILED' && (project?.progress || 0) < 40 ? (
              <X className="w-4 h-4 text-red-500" />
            ) : project?.status === 'ANALYZING' || project?.status === 'PLANNING' || project?.status === 'GENERATING_CHARACTER' ? (
              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-white/20" />
            )}
            <span className={(project?.progress || 0) >= 40 || project?.status === 'DONE' ? 'text-white/40' : project?.status === 'PLANNING' || project?.status === 'GENERATING_CHARACTER' ? 'text-white' : 'text-white/20'}>
              Tạo hình nhân vật & Style đồng nhất
            </span>
          </div>

          {/* Stage 3: Scene Gen */}
          <div className="flex items-center gap-3 text-sm">
            {(project?.progress || 0) >= 85 || project?.status === 'DONE' ? (
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            ) : project?.status === 'FAILED' && (project?.progress || 0) < 85 ? (
              <X className="w-4 h-4 text-red-500" />
            ) : project?.status === 'GENERATING_SCENES' ? (
              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-white/20" />
            )}
            <span className={(project?.progress || 0) >= 85 || project?.status === 'DONE' ? 'text-white/40' : project?.status === 'GENERATING_SCENES' ? 'text-white' : 'text-white/20'}>
              Sản xuất các phân cảnh song song ({project?.config_data?.scenes?.filter((s: any) => s.status === 'READY' || s.videoUrl).length || 0}/{project?.config_data?.scenes?.length || 8})
            </span>
          </div>

          {/* Stage 4: Stitching */}
          <div className="flex items-center gap-3 text-sm">
            {project?.status === 'DONE' ? (
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            ) : project?.status === 'FAILED' ? (
              <X className="w-4 h-4 text-red-500" />
            ) : project?.status === 'STITCHING' ? (
              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-white/20" />
            )}
            <span className={project?.status === 'DONE' ? 'text-white/40' : project?.status === 'STITCHING' ? 'text-white' : 'text-white/20'}>
              Ghép nối & Xuất bản video cuối cùng (Giữ âm thanh gốc)
            </span>
          </div>
        </div>
      </Card>


      {/* Done Button (Wait for 100%) */}
      {project?.status === 'DONE' && (
        <Button onClick={() => setStep('result')} className="w-full bg-green-500 hover:bg-green-600 animate-bounce">
          <Play className="w-4 h-4 mr-2" /> Xem kết quả
        </Button>
      )}

      {/* 🔄 RESUME/RECOVERY SECTION: Always show if not DONE */}
      {/* 🔄 RESUME/RECOVERY SECTION: Show if FAILED or if stuck for >12 hours */}
      {project && project.status !== 'DONE' && project.status !== 'INIT' && (
        (() => {
          // Logic: Show if FAILED, or if created > 12h ago and Has Not been updated recently
          const isStuck = (() => {
            if (project.status === 'FAILED') return true;

            if (!project.created_at) return false;
            const now = Date.now();
            const created = new Date(project.created_at).getTime();
            const updated = project.updated_at ? new Date(project.updated_at).getTime() : created;

            const hoursSinceCreated = (now - created) / (1000 * 60 * 60);
            const minutesSinceUpdate = (now - updated) / (1000 * 60);

            // Only show if project is OLD (>12h) AND has been silent for >5 minutes
            // OR if progress is high (>=80% - stitching phase) but silent for >1 minute
            const isHighProgressStuck = (project.progress || 0) >= 80 && minutesSinceUpdate > 1;

            return (hoursSinceCreated > 12 && minutesSinceUpdate > 5) || isHighProgressStuck;
          })();

          if (!isStuck) return null;

          // ✅ NEW: Hide immediately if we are actively recovering
          if (isRecovering) return null;

          return (
            <div className="space-y-4">
              {project.status === 'FAILED' && project.error_details && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-xs text-left max-h-32 overflow-y-auto font-mono">
                  {typeof project.error_details === 'string'
                    ? project.error_details
                    : (project.error_details as any).message || JSON.stringify(project.error_details)}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => {
                    if (!activeProjectId) return;

                    // ✅ CREDIT CHECK: Only force deduction if status is FAILED
                    if (project.status === 'FAILED' && creditsRemaining < estimatedCredits) {
                      openLimitModal(
                        'insufficient_credits',
                        `Bạn cần ${estimatedCredits} credits để tiếp tục sản xuất video này, nhưng hiện chỉ còn ${creditsRemaining} credits.`,
                        { creditsRemaining, currentPlan }
                      );
                      return;
                    }

                    // ✅ NEW: Set recovering state immediately to hide button
                    setIsRecovering(true);

                    // ✅ Use reconnect() — properly tears down FAILED-state SSE before fresh connect
                    // connect() would hit reuse path (open ES still alive for FAILED) and do nothing
                    handleResume()
                      .then(() => {
                        reconnect();
                      })
                      .catch(() => {
                        setIsRecovering(false);
                      });

                  }}
                  className={`w-full ${project.status === 'FAILED' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/30'} gap-2`}
                >
                  <Sparkles className="w-4 h-4" />
                  {project.status === 'FAILED' ? 'Tiếp tục sản xuất' : 'Tiếp tục xử lý'}
                </Button>
                <Button
                  onClick={() => setStep('form')}
                  variant="outline"
                  className="w-full border-white/10 text-white/40 hover:bg-white/5 gap-2"
                >
                  Làm lại từ đầu
                </Button>
              </div>
              {project.status !== 'FAILED' && (
                <p className="text-[10px] text-white/30 italic">
                  * Dự án đang bị treo. Bạn có thể thử tiếp tục.
                </p>
              )}
            </div>
          );
        })()
      )}

      {sseError && <p className="text-red-400 text-sm mt-4">{sseError}</p>}
    </div>
  );

  const renderResult = () => {
    // ✅ ENHANCEMENT: Use Asset Gateway for final video
    const finalVideoSrc = project?.final_video_s3_key
      ? `/api/assets/ai-project-video:${project.id}${authToken ? `?token=${authToken}` : ''}`
      : project?.final_video_url;

    const finalThumbnailSrc = project?.final_thumbnail_s3_key
      ? `/api/assets/media-image:${project.final_thumbnail_s3_key}${authToken ? `?token=${authToken}` : ''}`
      : project?.final_thumbnail_url || project?.config_data?.characterProfile?.anchorImageUrl;

    return (
      <div className="flex flex-col md:grid md:grid-cols-12 h-full max-h-[85vh] overflow-hidden">
        {/* Left Column: Result & Main Video */}
        <div className="md:col-span-12 lg:col-span-7 flex flex-col border-r border-white/5 bg-black/20">
          {/* Result Header */}
          <div className="bg-gradient-to-r from-green-500/10 to-teal-500/10 p-5 flex items-center justify-between border-b border-green-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Sản xuất hoàn tất!
                </h2>
                <p className="text-xs text-white/50">Tác phẩm AI của bạn đã sẵn sàng</p>
              </div>
            </div>
            <button
              onClick={closeTextToVideoModal}
              className="text-white/20 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Video Player */}
          <div className="flex-1 bg-black flex items-center justify-center relative min-h-[400px]">
            {finalVideoSrc ? (
              <video
                src={finalVideoSrc}
                poster={finalThumbnailSrc}
                controls
                loop
                className="w-full h-full max-h-[60vh] object-contain shadow-2xl"
              />
            ) : (
              <div className="flex flex-col items-center gap-4 text-white/20 italic p-12 text-center">
                <Loader2 className="w-10 h-10 animate-spin opacity-20" />
                <p>Đang tải dữ liệu video...</p>
              </div>
            )}
          </div>

          {/* Action Bottom Bar */}
          <div className="p-5 bg-gray-900/40 border-t border-white/5 mt-auto">
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2 transition-all"
                onClick={() => handleDownload()}
                disabled={isDownloading}
              >
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isDownloading ? 'Đang tải...' : 'Tải video chính'}
              </Button>
              <Button
                variant="outline"
                className="bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 text-purple-200 gap-2 transition-all"
                onClick={() => {
                  if (finalVideoSrc) {
                    setActivePreviewUrl(finalVideoSrc);
                    setActivePreviewPoster(project?.final_thumbnail_url || project?.config_data?.characterProfile?.anchorImageUrl);
                  }
                }}
              >
                <Play className="w-4 h-4" /> Xem Full
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Scene List */}
        <div className="md:col-span-12 lg:col-span-5 flex flex-col bg-black/40 h-full max-h-[85vh]">
          <div className="p-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#0A0118] z-10">
            <span className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-purple-400" /> Các phân cảnh
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPromptDialogOpen(true)}
                className="h-6 px-2 text-[10px] text-white/60 hover:text-white hover:bg-white/10 flex items-center gap-1.5 rounded-full border border-white/5"
              >
                <FileText className="w-3 h-3" /> Prompt
              </Button>
              <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-white/40 border border-white/5">
                {project?.config_data?.scenes?.length || 0} Scenes
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {project?.config_data?.scenes?.map((scene, idx) => {
              const videoSrc = scene.videoAssetId
                ? `/api/assets/media-video:${scene.videoAssetId}${authToken ? `?token=${authToken}` : ''}`
                : scene.videoS3Key
                  ? `/api/assets/ai-scene-video:${project.id}-${scene.sceneId}${authToken ? `?token=${authToken}` : ''}`
                  : scene.videoUrl;

              const isSceneLoading = downloadingScenes[scene.sceneId.toString()];

              return (
                <div
                  key={idx}
                  className="bg-gray-900/40 rounded-xl p-3 border border-white/5 hover:border-purple-500/30 transition-all group"
                >
                  <div className="flex gap-3">
                    {/* Scene Thumbnail/Preview */}
                    <div
                      className="w-32 aspect-video bg-black rounded-lg overflow-hidden border border-white/10 relative group-hover:border-purple-500/50 transition-colors cursor-pointer flex-shrink-0"
                      onClick={() => {
                        if (videoSrc) {
                          setActivePreviewUrl(videoSrc);
                          setActivePreviewPoster(scene.thumbnailUrl || scene.sourceImageUrl || project?.config_data?.characterProfile?.anchorImageUrl);
                        }
                      }}
                    >
                      <video
                        src={videoSrc || undefined}
                        poster={scene.thumbnailUrl || scene.sourceImageUrl || project.config_data?.characterProfile?.anchorImageUrl}
                        className="w-full h-full object-cover"
                        preload="metadata"
                        onMouseOver={(e) => e.currentTarget.play()}
                        onMouseOut={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                        muted
                        loop
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-5 h-5 text-white fill-white" />
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-between py-0.5">
                      <div>
                        <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                          Cảnh {scene.sceneId} ({scene.duration}s)
                        </div>
                        <div className="text-[11px] text-white/60 line-clamp-2 mt-1 italic font-light leading-relaxed">
                          "{scene.actionPrompt}"
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 rounded-full p-0 text-white/40 hover:text-white hover:bg-white/10"
                          onClick={() => videoSrc && handleDownload(videoSrc, scene.sceneId.toString())}
                          disabled={isSceneLoading || !videoSrc}
                        >
                          {isSceneLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 rounded-full p-0 text-white/40 hover:text-white hover:bg-white/10"
                          onClick={() => {
                            if (videoSrc) {
                              setActivePreviewUrl(videoSrc);
                              setActivePreviewPoster(scene.thumbnailUrl || scene.sourceImageUrl || project?.config_data?.characterProfile?.anchorImageUrl);
                            }
                          }}
                        >
                          <Play className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isTextToVideoModalOpen} onOpenChange={(open: boolean) => !open && closeTextToVideoModal()}>
      <DialogContent className={`${activeStep === 'result' ? 'max-w-4xl' : 'max-w-xl'} bg-[#0A0118] border-[#E33265]/50 p-0 overflow-hidden transition-all duration-300`}>
        {activeStep === 'form' && renderForm()}
        {activeStep === 'production' && renderProduction()}
        {activeStep === 'result' && renderResult()}

        {/* Shared Preview Overlay (Global for all steps) */}
        {activePreviewUrl && (
          <VideoPreviewOverlay
            src={activePreviewUrl}
            poster={activePreviewPoster}
            onClose={() => setActivePreviewUrl(null)}
          />
        )}

        {/* Prompt View Modal */}
        <Dialog open={isPromptDialogOpen} onOpenChange={setIsPromptDialogOpen}>
          <DialogContent className="max-w-xl bg-[#0A0118] border-[#E33265]/50 p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-purple-300" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Prompt đã sử dụng</h3>
                  <p className="text-sm text-white/50">Thông tin chi tiết về yêu cầu tạo video</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-white/80 text-sm font-medium">Lệnh nhắc (Prompt)</Label>
                  <div className="relative group">
                    <div className="bg-gray-900/50 border border-white/10 rounded-lg p-3 text-sm text-white/80 min-h-[100px] max-h-[300px] overflow-y-auto whitespace-pre-wrap font-mono custom-scrollbar">
                      {project?.config_data?.userInput?.description || "Không có dữ liệu"}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2 h-8 w-8 p-0 bg-white/5 hover:bg-white/20 text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                      onClick={() => {
                        if (project?.config_data?.userInput?.description) {
                          navigator.clipboard.writeText(project.config_data.userInput.description);
                          toast.success("Đã sao chép prompt!");
                        }
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {project?.config_data?.userInput?.negativePrompt && (
                  <div className="space-y-2">
                    <Label className="text-red-300/80 text-sm font-medium">Negative Prompt</Label>
                    <div className="relative group">
                      <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-3 text-sm text-white/80 min-h-[60px] max-h-[150px] overflow-y-auto whitespace-pre-wrap font-mono custom-scrollbar">
                        {project.config_data.userInput.negativePrompt}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2 h-8 w-8 p-0 bg-white/5 hover:bg-white/20 text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                        onClick={() => {
                          navigator.clipboard.writeText(project.config_data?.userInput?.negativePrompt || "");
                          toast.success("Đã sao chép negative prompt!");
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={() => setIsPromptDialogOpen(false)} variant="outline" className="border-white/20 text-white hover:bg-white/10">
                  Đóng
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};
