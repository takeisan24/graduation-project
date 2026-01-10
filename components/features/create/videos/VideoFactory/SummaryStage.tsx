"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { VideoFactoryState } from "@/lib/types/video";
import { splitVideoFactoryCredits } from "@/lib/utils/videoUtils";

interface SummaryStageProps {
  state: VideoFactoryState;
  onBack: () => void;
  onStart: () => void;
}

export function SummaryStage({ state, onBack, onStart }: SummaryStageProps) {
  const t = useTranslations('CreatePage.videoFactory');
  const source = state.sourceConfig;
  const cut = state.cutConfig;
  const post = state.postProdConfig;

  // ✅ NEW: Calculate estimated credits tách riêng
  // Note: SummaryStage không còn được dùng trong flow chính (đã bypass qua cut trực tiếp),
  // nhưng giữ lại để backward compatibility và tính credit đúng nếu có chỗ nào đó vẫn dùng
  const estimatedCredits = useMemo(() => {
    if (!cut || cut.method !== 'auto' || !cut.autoCutConfig) {
      return 0;
    }
    const credits = splitVideoFactoryCredits({
      clipCount: cut.autoCutConfig.clipCount,
      clipDuration: cut.autoCutConfig.clipDuration,
      bRollInsertion: post?.bRollInsertion || false,
      bRollDensity: post?.bRollInsertion ? post.bRollDensity : undefined,
      autoCaptions: post?.autoCaptions || false,
    });
    // ✅ Tính tổng để hiển thị trong summary (backward compatibility)
    return credits.totalCredits;
  }, [cut, post]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">{t('summaryTitle') || 'Tóm tắt cấu hình'}</h2>
        <p className="text-white/70">{t('summaryDesc') || 'Kiểm tra trước khi bắt đầu xử lý'}</p>
      </div>

      <Card className="bg-[#180F2E] border-[#E33265]/50 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-white/80">
          <div>
            <div className="font-semibold text-white mb-1">Nguồn</div>
            <p>Loại: {source?.type === 'youtube' ? 'YouTube' : 'Upload'}</p>
            {source?.youtubeUrl && <p className="truncate">URL: {source.youtubeUrl}</p>}
            {source?.uploadUrl && <p className="truncate">Upload URL: {source.uploadUrl}</p>}
            {source?.videoDuration && <p>Độ dài: {source.videoDuration}</p>}
          </div>
          <div>
            <div className="font-semibold text-white mb-1">Cắt</div>
            <p>Phương thức: {cut?.method === 'auto' ? 'Tự động' : 'Thủ công'}</p>
            {cut?.autoCutConfig && (
              <>
                <p>Clip: {cut.autoCutConfig.clipCount}</p>
                <p>Độ dài: {cut.autoCutConfig.clipDuration}</p>
                {cut.autoCutConfig.contentTheme && <p>Chủ đề: {cut.autoCutConfig.contentTheme}</p>}
              </>
            )}
            {cut?.manualSelections && cut.manualSelections.length > 0 && (
              <p>Tổng đoạn thủ công: {cut.manualSelections.length}</p>
            )}
          </div>
          <div>
            <div className="font-semibold text-white mb-1">Hậu kỳ</div>
            <p>Captions: {post?.autoCaptions ? 'Bật' : 'Tắt'}</p>
            <p>B-roll: {post?.bRollInsertion ? 'Bật' : 'Tắt'}</p>
            <p>Nhạc nền: {post?.backgroundMusic ? 'Bật' : 'Tắt'}</p>
            <p>Transitions: {post?.transitions ? 'Bật' : 'Tắt'}</p>
          </div>
        </div>
      </Card>

      {/* Legacy Credit Estimator (Tổng) - Đã chuyển sang panel bên phải, giữ lại để tham khảo */}
      {false && cut?.method === 'auto' && cut?.autoCutConfig && (
        <Card className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-orange-500/30 p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-orange-300 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-white mb-1">Ước tính Credit (Tổng)</h4>
              <p className="text-sm text-white/70 mb-2">
                Tổng credit cần thiết cho toàn bộ quá trình xử lý
              </p>
              <div className="text-2xl font-bold text-orange-400">{estimatedCredits} Credits</div>
              <p className="text-xs text-white/50 mt-1">
                * Credit sẽ được trừ khi job hoàn thành
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="flex justify-between">
        <Button
          onClick={onBack}
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10"
        >
          {t('back') || 'Quay lại'}
        </Button>
        <Button
          onClick={onStart}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-6"
        >
          {t('startProcessing') || 'Bắt đầu xử lý'}
        </Button>
      </div>
    </div>
  );
}

