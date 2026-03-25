// components/create/modals/ImageGenModal.tsx

"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles as SparklesIcon } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useImageGenModalStore, useCreatePostsStore, useCreateMediaStore, useCreateLightboxStore } from '@/store';
import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useTranslations } from 'next-intl';
import { CREDIT_COSTS } from '@/lib/usage';

export default function ImageGenModal() {
  const t = useTranslations('CreatePage.createSection.imageGenModal');
  const { isImageGenModalOpen: isOpen, isGeneratingMedia: isGenerating, setIsImageGenModalOpen, generateImage, source } = useImageGenModalStore();
  const { openLightbox } = useCreateLightboxStore();
  const selectedPostId = useCreatePostsStore(state => state.selectedPostId);
  const postContents = useCreatePostsStore(state => state.postContents);
  const mediaStore = useCreateMediaStore();

  const closeModal = useCallback(() => {
    setIsImageGenModalOpen(false);
  }, [setIsImageGenModalOpen]);

  const [imagePrompt, setImagePrompt] = useState("");
  const [imageCount, setImageCount] = useState(1);
  const [imageSize, setImageSize] = useState<"1K" | "2K" | "4K">("1K");
  const [imageAspectRatio, setImageAspectRatio] = useState<"1:1" | "16:9" | "9:16">("1:1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  const sidebarImages = useImageGenModalStore(state => state.sidebarImages);
  const clearSidebarImages = useImageGenModalStore(state => state.clearSidebarImages);

  useEffect(() => {
    if (isOpen) {
      if (source === 'content' && selectedPostId) {
        setImagePrompt(postContents[selectedPostId] || "");
      } else {
        setImagePrompt("");
      }
      setIsSubmitting(false);
      setUseSearch(false);
      setImageSize("1K");
    }
  }, [isOpen, selectedPostId, postContents]);

  const handleGenerateClick = async () => {
    if (!imagePrompt.trim() || isGenerating || isSubmitting) return;

    setIsSubmitting(true);

    const currentSource = source || 'content';
    const currentPostId = selectedPostId || useCreatePostsStore.getState().selectedPostId || 0;

    setIsImageGenModalOpen(false);

    try {
      await generateImage(
        imagePrompt,
        imageCount,
        imageSize,
        imageAspectRatio,
        currentPostId,
        (postId, media) => {
          if (postId > 0) {
            const mStore = useCreateMediaStore.getState();
            const existing = mStore.getPostMedia(postId);
            mStore.setPostMedia(postId, [...existing, ...media]);
          }

          if (media && media.length > 0) {
            useCreateLightboxStore.getState().openLightbox(media[0].preview, 'image');
          }
        },
        currentSource as 'sidebar' | 'content',
        useSearch,
        imageSize
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closeModal}>
      <div className="bg-card border border-border rounded-xl w-full lg:w-[600px] max-w-full max-h-[90vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 lg:px-6 py-3 lg:py-4 border-b border-border bg-gradient-to-r from-accent/5 to-transparent">
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <SparklesIcon className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-accent" />
            </div>
            <h2 className="text-base lg:text-lg font-semibold text-foreground">{t('title')}</h2>
          </div>
        </div>
        <div className="px-4 lg:px-6 py-4 lg:py-5 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent" style={{ maxHeight: "60vh" }}>
          <div className="space-y-5">
            <div>
              <label className="block text-foreground/90 mb-2 text-sm font-medium">{t('promptLabel')}</label>
              <Textarea
                placeholder={t('promptPlaceholder')}
                className="bg-background border-border text-foreground h-32 resize-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1.5">{t('promptHint')}</p>
            </div>
            <div>
              <label className="block text-foreground/90 mb-2 text-sm font-medium">{t('countLabel')}</label>
              <div className="flex items-center gap-3 bg-background border border-border rounded-lg p-2 w-fit">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-foreground hover:bg-secondary disabled:opacity-40" onClick={() => setImageCount(Math.max(1, imageCount - 1))} disabled={imageCount <= 1}>-</Button>
                <span className="text-foreground text-base font-semibold w-8 text-center">{imageCount}</span>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-foreground hover:bg-secondary disabled:opacity-40" onClick={() => setImageCount(Math.min(3, imageCount + 1))} disabled={imageCount >= 3}>+</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">{t('countLabel')} (1-3)</p>
            </div>
            <div>
              <label className="block text-foreground/90 mb-2 text-sm font-medium">{t('sizeLabel')}</label>
              <select
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value as "1K" | "2K" | "4K")}
                className="w-full bg-background border border-border text-foreground rounded-lg p-3 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
              >
                <option value="1K">{t('size1K')}</option>
                <option value="2K">{t('size2K')}</option>
                <option value="4K">4K (Ultra HD)</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1.5">{t('sizeHint')}</p>
            </div>
            <div>
              <label className="block text-foreground/90 mb-2 text-sm font-medium">{t('aspectRatioLabel')}</label>
              <select value={imageAspectRatio} onChange={(e) => setImageAspectRatio(e.target.value as typeof imageAspectRatio)} className="w-full bg-background border border-border text-foreground rounded-lg p-3 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors cursor-pointer">
                <option value="1:1">{t('ratio1_1')}</option>
                <option value="16:9">{t('ratio16_9')}</option>
                <option value="9:16">{t('ratio9_16')}</option>
              </select>
            </div>

            {/* Google Search Grounding Option */}
            <div className="pt-2 border-t border-border space-y-3">
              <label
                className="flex items-start gap-3 p-2.5 rounded-lg border border-border bg-secondary cursor-pointer hover:bg-secondary/80 transition-colors"
              >
                <div className="flex items-center h-5 mt-0.5">
                  <input
                    type="checkbox"
                    checked={useSearch}
                    onChange={(e) => setUseSearch(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-border text-blue-500 focus:ring-blue-500 bg-transparent"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-blue-200">
                      Google Search
                    </span>
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">
                      Real-time
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Tìm kiếm dữ liệu thực tế (thời tiết, sự kiện...) trước khi vẽ.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-background/30">
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{t('estimatedCost')}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-accent font-bold text-lg">
                {CREDIT_COSTS.WITH_IMAGE * imageCount}
              </span>
              <span className="text-muted-foreground text-sm">Credits</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="border-border text-foreground hover:bg-secondary hover:border-border transition-colors" onClick={closeModal}>{t('cancel')}</Button>
            <Button className="bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20 transition-all" onClick={handleGenerateClick} disabled={!imagePrompt.trim() || isGenerating || isSubmitting}>
              {isGenerating ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />{t('generating')}</>
              ) : (
                <><SparklesIcon className="w-4 h-4 mr-2" />{t('generate')}</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Modal xac nhan xoa danh sach anh tam */}
      <Dialog open={isConfirmClearOpen} onOpenChange={setIsConfirmClearOpen}>
        <DialogContent className="max-w-[400px] bg-card border-border p-2 sm:p-4 shadow-2xl rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <DialogTitle className="text-xl text-foreground font-semibold">Xác nhận xóa?</DialogTitle>
            </div>
            <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
              Bạn có chắc chắn muốn xóa toàn bộ danh sách ảnh vừa tạo không? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex flex-row gap-3 sm:gap-4 sm:space-x-0">
            <Button
              variant="outline"
              onClick={() => setIsConfirmClearOpen(false)}
              className="flex-1 bg-transparent border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              Hủy bỏ
            </Button>
            <Button
              className="flex-1 bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition-all border-0"
              onClick={() => {
                clearSidebarImages();
                setIsConfirmClearOpen(false);
              }}
            >
              Đồng ý xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
