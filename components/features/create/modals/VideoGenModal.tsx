// FINAL REFACTORED VERSION - components/create/modals/VideoGenModal.tsx

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles as SparklesIcon } from "lucide-react";
import {
  useVideoGenModalStore,
  useCreatePostsStore,
  useCreateMediaStore,
} from "@/store";
import { useTranslations } from "next-intl";

export default function VideoGenModal() {
  const t = useTranslations("CreatePage.createSection.videoGenModal");
  // Lấy state và action một cách an toàn
  const {
    isVideoGenModalOpen: isOpen,
    isGeneratingMedia: isGenerating,
    setIsVideoGenModalOpen,
    generateVideo,
  } = useVideoGenModalStore();
  const selectedPostId = useCreatePostsStore((state) => state.selectedPostId);
  const postContents = useCreatePostsStore((state) => state.postContents);
  const mediaStore = useCreateMediaStore();

  const closeModal = useCallback(() => {
    setIsVideoGenModalOpen(false);
  }, [setIsVideoGenModalOpen]);

  // SỬA ĐỔI: Sử dụng lại state `videoPrompt` như yêu cầu
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoNegativePrompt, setVideoNegativePrompt] = useState("");
  const [videoAspectRatio, setVideoAspectRatio] = useState<"16:9" | "9:16">(
    "16:9",
  );
  const [videoResolution, setVideoResolution] = useState<
    "720p" | "1080p" | "4K"
  >("1080p");
  const [isSubmitting, setIsSubmitting] = useState(false); // Local state để prevent double click

  // useEffect vẫn giữ nguyên logic, chỉ đổi tên hàm setter
  useEffect(() => {
    if (isOpen) {
      setVideoPrompt(postContents[selectedPostId] || "");
      setIsSubmitting(false); // Reset khi modal mở lại
    }
  }, [isOpen, selectedPostId, postContents]);

  const handleGenerateClick = async () => {
    // Prevent double click: check cả local state và store state
    if (!videoPrompt.trim() || isGenerating || isSubmitting) return;

    // Set local state ngay để prevent double click
    setIsSubmitting(true);

    // Đóng modal ngay lập tức trước khi gọi API
    setIsVideoGenModalOpen(false);

    try {
      await generateVideo(
        videoPrompt,
        videoNegativePrompt,
        videoAspectRatio,
        videoResolution,
        selectedPostId,
        (postId, media) => {
          const existing = mediaStore.getPostMedia(postId);
          mediaStore.setPostMedia(postId, [...existing, ...media]);
        },
      );
    } finally {
      // Reset local state sau khi hoàn thành (dù success hay error)
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={closeModal}
    >
      <div
        className="bg-card border border-border rounded-xl w-full lg:w-[600px] max-w-full max-h-[90vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 lg:px-6 py-3 lg:py-4 border-b border-border bg-gradient-to-r from-accent/5 to-transparent">
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <SparklesIcon className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-accent" />
            </div>
            <h2 className="text-base lg:text-lg font-semibold text-foreground">
              {t("title")}{" "}
              <span className="text-sm text-accent">(Veo3)</span>
            </h2>
          </div>
        </div>
        <div
          className="px-4 lg:px-6 py-4 lg:py-5 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
          style={{ maxHeight: "60vh" }}
        >
          <div className="space-y-5">
            <div>
              <label className="block text-foreground/90 mb-2 text-sm font-medium">
                {t("promptLabel")}
              </label>
              <Textarea
                placeholder={t("promptPlaceholder")}
                className="bg-background border-border text-foreground h-32 resize-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1.5">{t("promptHint")}</p>
            </div>
            <div>
              <label className="block text-foreground/90 mb-2 text-sm font-medium">
                {t("negativePromptLabel")}
              </label>
              <Input
                placeholder={t("negativePromptPlaceholder")}
                className="bg-background border-border text-foreground focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                value={videoNegativePrompt}
                onChange={(e) => setVideoNegativePrompt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                {t("negativePromptHint")}
              </p>
            </div>
            <div>
              <label className="block text-foreground/90 mb-2 text-sm font-medium">
                {t("aspectRatioLabel")}
              </label>
              <select
                value={videoAspectRatio}
                onChange={(e) =>
                  setVideoAspectRatio(e.target.value as typeof videoAspectRatio)
                }
                className="w-full bg-background border border-border text-foreground rounded-lg p-3 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
              >
                <option value="16:9">{t("ratio16_9")}</option>
                <option value="9:16">{t("ratio9_16")}</option>
              </select>
            </div>
            <div>
              <label className="block text-foreground/90 mb-2 text-sm font-medium">
                {t("resolutionLabel")}
              </label>
              <select
                value={videoResolution}
                onChange={(e) =>
                  setVideoResolution(e.target.value as typeof videoResolution)
                }
                className="w-full bg-background border border-border text-foreground rounded-lg p-3 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
              >
                <option value="720p">{t("resolution720p")}</option>
                <option value="1080p">{t("resolution1080p")}</option>
                <option value="4K">{t("resolution4K")}</option>
              </select>
            </div>
            {/* Person Generation - Temporarily Commented */}
            {/* <div>
                  <label className="block text-foreground mb-2 text-sm font-medium">{t('safetyLabel')}</label>
                  <select
                    value={videoPersonGeneration}
                    onChange={(e) => setVideoPersonGeneration(e.target.value as typeof videoPersonGeneration)}
                    className="w-full bg-background border border-border text-foreground rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="allow_adult">{t('safetyAllowAdult')}</option>
                    <option value="allow_all">{t('safetyAllowAll')}</option>
                    <option value="dont_allow">{t('safetyDontAllow')}</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">{t('safetyHint')}</p>
                </div> */}
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-3.5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-accent font-semibold">
                  {t("note")}
                </strong>{" "}
                {t("noteText")}
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-background/30">
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              Chi phí dự tính
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-accent font-bold text-lg">20</span>
              <span className="text-muted-foreground text-sm">Credits</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="border-border text-foreground hover:bg-secondary hover:border-border transition-colors"
              onClick={closeModal}
            >
              {t("cancel")}
            </Button>
            <Button
              className="bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20 transition-all"
              onClick={handleGenerateClick}
              disabled={!videoPrompt.trim() || isGenerating || isSubmitting}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  {t("generating")}
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4 mr-2" />
                  {t("generate")}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
