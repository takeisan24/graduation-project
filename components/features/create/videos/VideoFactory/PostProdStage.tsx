"use client";

import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Subtitles, Film, Music, Sparkles, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { PostProductionConfig, BRollDensity, VideoCutConfig } from "@/lib/types/video";
import { BROLL_DENSITY_OPTIONS, CAPTION_STYLES, TRANSCRIPT_LANGUAGES } from "@/lib/constants/video";
import { splitVideoFactoryCredits } from "@/lib/utils/videoUtils";

interface PostProdStageProps {
  cutConfig?: VideoCutConfig;
  initialPostConfig?: PostProductionConfig | null;
  onNext: (config: PostProductionConfig) => void;
  onBack: () => void;
  onConfigChange?: (config: PostProductionConfig) => void;
}

export function PostProdStage({ cutConfig, initialPostConfig, onNext, onBack, onConfigChange }: PostProdStageProps) {
  const t = useTranslations('CreatePage.videoFactory');
  const [autoCaptions, setAutoCaptions] = useState(initialPostConfig?.autoCaptions ?? true);
  const [captionLanguage, setCaptionLanguage] = useState(initialPostConfig?.autoCaption?.language ?? 'vi');
  const [captionStyle, setCaptionStyle] = useState(initialPostConfig?.autoCaption?.style ?? 'default');
  const [bRollInsertion, setBRollInsertion] = useState(initialPostConfig?.bRollInsertion ?? true);
  const [bRollDensity, setBRollDensity] = useState<BRollDensity>(initialPostConfig?.bRollDensity ?? 'medium');
  const [backgroundMusic, setBackgroundMusic] = useState(initialPostConfig?.backgroundMusic ?? false);
  const [transitions, setTransitions] = useState(initialPostConfig?.transitions ?? true);

  // ✅ NEW: Calculate estimated credits CHỈ cho post-production phase (b-roll + captions)
  // Note: PostProdStage không còn được dùng trong flow chính (đã bypass qua summary),
  // nhưng giữ lại để backward compatibility và tính credit đúng nếu có chỗ nào đó vẫn dùng
  const estimatedCredits = useMemo(() => {
    if (!cutConfig || cutConfig.method !== 'auto' || !cutConfig.autoCutConfig) {
      return 0;
    }
    const credits = splitVideoFactoryCredits({
      clipCount: cutConfig.autoCutConfig.clipCount,
      clipDuration: cutConfig.autoCutConfig.clipDuration,
      bRollInsertion,
      bRollDensity: bRollInsertion ? bRollDensity : undefined,
      autoCaptions,
    });
    // ✅ CHỈ tính credit cho post-production phase (không tính lại cut cost)
    return credits.postProdCredits;
  }, [cutConfig, bRollInsertion, bRollDensity, autoCaptions]);

  // Emit config ra ngoài mỗi khi user thay đổi tuỳ chọn hậu kỳ
  useEffect(() => {
    const config: PostProductionConfig = {
      autoCaptions,
      autoCaption: autoCaptions
        ? {
            language: captionLanguage,
            style: captionStyle,
          }
        : undefined,
      bRollInsertion,
      bRollDensity: bRollInsertion ? bRollDensity : undefined,
      backgroundMusic,
      transitions,
    };

    if (onConfigChange) {
      onConfigChange(config);
    }
  }, [
    autoCaptions,
    captionLanguage,
    captionStyle,
    bRollInsertion,
    bRollDensity,
    backgroundMusic,
    transitions,
    onConfigChange,
  ]);

  const handleNext = () => {
    const config: PostProductionConfig = {
      autoCaptions,
      autoCaption: autoCaptions ? {
        language: captionLanguage,
        style: captionStyle
      } : undefined,
      bRollInsertion,
      bRollDensity: bRollInsertion ? bRollDensity : undefined,
      backgroundMusic,
      transitions
    };
    onNext(config);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">{t('postProdStageTitle') || 'Tùy chọn Hậu kỳ'}</h2>
        <p className="text-white/70">{t('postProdStageDesc') || 'Thêm phụ đề, B-roll và hiệu ứng'}</p>
      </div>

      <div className="space-y-4">
        {/* Auto Captions */}
        <Card className="bg-[#180F2E] border-[#E33265]/50 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 text-orange-300 flex items-center justify-center flex-shrink-0">
              <Subtitles className="w-6 h-6" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{t('autoCaptions') || 'Tự động tạo phụ đề'}</h3>
                    <p className="text-sm text-white/60">{t('autoCaptionsDesc') || 'Thêm phụ đề tự động cho video'}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoCaptions}
                      onChange={(e) => setAutoCaptions(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                  </label>
                </div>

                {autoCaptions && (
                  <div className="mt-4 space-y-3 pl-4 border-l-2 border-orange-500/30">
                    {/* Language Selection */}
                    <div className="space-y-2">
                      <Label className="text-sm text-white/80">{t('captionLanguage') || 'Ngôn ngữ phụ đề'}</Label>
                      <select
                        value={captionLanguage}
                        onChange={(e) => setCaptionLanguage(e.target.value)}
                        className="w-full bg-gray-900/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                      >
                        {TRANSCRIPT_LANGUAGES.map((lang) => (
                          <option key={lang.value} value={lang.value}>
                            {lang.flag} {lang.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Caption Style */}
                    <div className="space-y-2">
                      <Label className="text-sm text-white/80">{t('captionStyle') || 'Phong cách phụ đề'}</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {CAPTION_STYLES.map((style) => (
                          <button
                            key={style.value}
                            onClick={() => setCaptionStyle(style.value)}
                            className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                              captionStyle === style.value
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-800/50 text-white/60 hover:bg-gray-800 hover:text-white'
                            }`}
                          >
                            {style.labelVi}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* B-roll Insertion */}
        <Card className="bg-[#180F2E] border-[#E33265]/50 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center flex-shrink-0">
              <Film className="w-6 h-6" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{t('bRollInsertion') || 'Tự động chèn B-roll'}</h3>
                    <p className="text-sm text-white/60">{t('bRollInsertionDesc') || 'Thêm cảnh minh họa vào video'}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bRollInsertion}
                      onChange={(e) => setBRollInsertion(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                  </label>
                </div>

                {bRollInsertion && (
                  <div className="mt-4 space-y-2 pl-4 border-l-2 border-blue-500/30">
                    <Label className="text-sm text-white/80">{t('bRollDensity') || 'Mật độ B-roll'}</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {BROLL_DENSITY_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setBRollDensity(option.value)}
                          className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                            bRollDensity === option.value
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-800/50 text-white/60 hover:bg-gray-800 hover:text-white'
                          }`}
                        >
                          {option.labelVi}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Background Music */}
        <Card className="bg-[#180F2E] border-[#E33265]/50 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center flex-shrink-0">
              <Music className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{t('backgroundMusic') || 'Nhạc nền'}</h3>
                  <p className="text-sm text-white/60">{t('backgroundMusicDesc') || 'Thêm nhạc nền phù hợp'}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backgroundMusic}
                    onChange={(e) => setBackgroundMusic(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                </label>
              </div>
            </div>
          </div>
        </Card>

        {/* Transitions */}
        <Card className="bg-[#180F2E] border-[#E33265]/50 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-pink-500/20 text-pink-300 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{t('transitions') || 'Hiệu ứng chuyển cảnh'}</h3>
                  <p className="text-sm text-white/60">{t('transitionsDesc') || 'Thêm hiệu ứng mượt mà giữa các cảnh'}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={transitions}
                    onChange={(e) => setTransitions(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
                </label>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Legacy Credit Estimator (Tổng) - Đã chuyển sang panel bên phải, giữ lại để tham khảo */}
      {false && (
        <Card className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-orange-500/30 p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-orange-300 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-white mb-1">Ước tính Credit (Tổng)</h4>
              <p className="text-sm text-white/70 mb-2">
                {/* {cutConfig?.autoCutConfig?.clipCount} clip ({cutConfig?.autoCutConfig?.clipDuration}) */}
                {/* {autoCaptions && ' + Phụ đề'} */}
                {/* {bRollInsertion && ` + B-roll (${bRollDensity})`} */}
                {'Ước tính credit tổng cho toàn bộ quá trình xử lý'}
              </p>
              <div className="text-2xl font-bold text-orange-400">
                {/* {estimatedCredits} Credits */}
                Legacy Credits
              </div>
              <p className="text-xs text-white/50 mt-1">
                * Credit sẽ được trừ khi job hoàn thành
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          onClick={onBack}
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10"
        >
          ← {t('back') || 'Quay lại'}
        </Button>
        <Button
          onClick={handleNext}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-8"
          size="lg"
        >
          {t('startProcessing') || 'Bắt đầu xử lý'} →
        </Button>
      </div>
    </div>
  );
}
