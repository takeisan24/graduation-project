"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDownIcon, ImageIcon, SparklesIcon, Wand2, Languages, Coins } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

import { useCreatePostsStore, useCreateMediaStore, usePublishModalStore, useImageGenModalStore, useVideoGenModalStore, useMediaLibraryModalStore, useDraftsStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { useLocale, useTranslations } from 'next-intl';

export default function ActionBar() {
  const t = useTranslations('CreatePage.createSection.actionBar');
  const locale = useLocale();
  const creditsRemaining = 0; // Credits store removed

  const {
    selectedPostId,
    postContents,
    openPosts,
    isFormatting,
    isTranslating,
    handleFormatPost,
    handleTranslatePost,
    handleClonePost,
  } = useCreatePostsStore(useShallow(state => ({
    selectedPostId: state.selectedPostId,
    postContents: state.postContents,
    openPosts: state.openPosts,
    isFormatting: state.isFormatting,
    isTranslating: state.isTranslating,
    handleFormatPost: state.handleFormatPost,
    handleTranslatePost: state.handleTranslatePost,
    handleClonePost: state.handleClonePost,
  })));
  const currentPost = openPosts.find(p => p.id === selectedPostId);
  const { handleMediaUpload, postMedia, setPostMedia } = useCreateMediaStore(
    useShallow(state => ({
      handleMediaUpload: state.handleMediaUpload,
      postMedia: state.postMedia,
      setPostMedia: state.setPostMedia,
    }))
  );
  const setIsPublishModalOpen = usePublishModalStore(state => state.setIsPublishModalOpen);
  const setIsImageGenModalOpen = useImageGenModalStore(state => state.setIsImageGenModalOpen);
  const setIsVideoGenModalOpen = useVideoGenModalStore(state => state.setIsVideoGenModalOpen);
  const setIsMediaLibraryModalOpen = useMediaLibraryModalStore(state => state.setIsMediaLibraryModalOpen);
  const { handleSaveDraft, isSavingDraft } = useDraftsStore(
    useShallow(state => ({
      handleSaveDraft: state.handleSaveDraft,
      isSavingDraft: state.isSavingDraft,
    }))
  );

  // State cục bộ cho UI của action bar
  const [showGenerateMenu, setShowGenerateMenu] = useState(false);
  const [isTranslateDialogOpen, setIsTranslateDialogOpen] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState(locale === 'vi' ? 'en' : 'vi');
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const generateMenuRef = useRef<HTMLDivElement>(null);
  const generateButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Đóng dropdown khi click ra ngoài và tính toán vị trí
  useEffect(() => {
    if (!showGenerateMenu) return;

    // Tính toán vị trí dropdown
    if (generateButtonRef.current) {
      const rect = generateButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.top - 120, // Hiển thị phía trên button
        left: rect.left
      });
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (generateMenuRef.current && !generateMenuRef.current.contains(e.target as Node) &&
        generateButtonRef.current && !generateButtonRef.current.contains(e.target as Node)) {
        setShowGenerateMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showGenerateMenu]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      handleMediaUpload(files, selectedPostId);
    }
  };

  const getCharLimit = () => {
    const platform = currentPost?.type || 'default';
    const limits: Record<string, number> = { Twitter: 280, Instagram: 2200, LinkedIn: 3000, Facebook: 63206, Pinterest: 500, TikTok: 2200, Threads: 500, YouTube: 5000, default: 5000 };
    return limits[platform] ?? limits.default;
  };

  const shouldShowFormatButton = () => {
    const content = postContents[selectedPostId] || "";

    // Đảm bảo content là string
    const textContent = typeof content === "string" ? content : String(content || "");

    // Quá ngắn thì không cần format
    if (textContent.length < 50) return false;

    // 1. Kiểm tra Emoji
    // Đếm số lượng emoji thay vì chỉ check có/không
    // Regex này bắt hầu hết các emoji phổ biến
    const emojiMatches = textContent.match(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu);
    const emojiCount = emojiMatches ? emojiMatches.length : 0;

    // 2. Kiểm tra cấu trúc dòng (Line breaks)
    const newLines = (textContent.match(/\n/g) || []).length;

    // 3. [TỐI ƯU MỚI] Tính "Mật độ ký tự trên mỗi dòng" (Character Density per Line)
    // Nếu trung bình mỗi dòng quá dài (> 200 ký tự) -> Dấu hiệu của việc thiếu ngắt đoạn (Wall of text)
    const density = textContent.length / (newLines + 1);

    // HIỆN NÚT KHI:
    // - Mật độ quá dày (Wall of text) -> Cần chia đoạn
    // - HOẶC: Rất ít emoji (< 2) và văn bản đủ dài -> Cần thêm icon cho sinh động
    if (density > 150) return true; // Đoạn văn quá dài không ngắt dòng
    if (emojiCount < 2 && textContent.length > 100) return true; // Văn bản dài mà khô khan (ít hơn 2 emoji)

    return false;
  };

  return (
    <div className="sticky bottom-0 left-0 right-0 bg-muted">
      {/* Use 15px top padding for buttons and 0 bottom to tighten bottom spacing */}
      <div className="relative border-t border-border pt-[15px] pb-0 flex items-center justify-between opacity-100">
        {/* Character and Credit count aligned to the right, above line */}
        {/* Place count above divider with a 15px gap below it. Approx height ~16px => offset 16 + 15 = 31px */}
        <div className="absolute -top-[31px] right-0 flex items-center gap-3 pr-[10px]">
          <span className="flex items-center gap-1.5 text-xs font-medium text-brand-yellow bg-brand-yellow/10 px-2 py-0.5 rounded-full" title="Tín dụng AI còn lại">
            <Coins className="w-3.5 h-3.5" />
            {creditsRemaining}
          </span>
          <span className="text-xs text-muted-foreground">
            {(postContents[selectedPostId] ?? "").length}/{getCharLimit()} {t('characterCount')}
          </span>
        </div>

        {/* Left: Add Image, Generate, Format */}
        <div className="flex items-center gap-2 pl-[10px] pb-[10px]">
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
            id="media-upload"
          />
          <label htmlFor="media-upload">
            <Button
              size="sm"
              variant="outline"
              className="h-9 px-3 lg:px-4 cursor-pointer bg-background hover:bg-primary/50 hover:border-primary/80 border-background text-foreground"
              asChild
            >
              <span className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                <span className="hidden lg:inline text-xs font-medium whitespace-nowrap">{t('addImage')}</span>
              </span>
            </Button>
          </label>

          {/* Generate button */}
          <div className="relative">
            <Button
              ref={generateButtonRef}
              size="sm"
              variant="outline"
              className="h-9 px-3 lg:px-4 bg-background hover:bg-accent/50 hover:border-accent/80 border-background text-foreground"
              onClick={() => setShowGenerateMenu(!showGenerateMenu)}
            >
              <SparklesIcon className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline text-xs font-medium whitespace-nowrap">{t('generate')}</span>
              <ChevronDownIcon className={`w-4 h-4 ml-0 lg:ml-1 transition-transform ${showGenerateMenu ? 'rotate-180' : ''}`} />
            </Button>
          </div>

          {/* Dropdown menu */}
          {showGenerateMenu && (
            <div
              ref={generateMenuRef}
              className="fixed w-48 bg-card border border-border rounded-md shadow-2xl py-2 z-[9999]"
              style={{
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsImageGenModalOpen(true, 'content');
                  setShowGenerateMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-muted-foreground hover:bg-secondary flex items-center gap-3"
              >
                <ImageIcon className="w-4 h-4" />
                {t('generateImage')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsVideoGenModalOpen(true);
                  setShowGenerateMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-muted-foreground hover:bg-secondary flex items-center gap-3"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {t('generateVideo')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMediaLibraryModalOpen(true);
                  setShowGenerateMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-muted-foreground hover:bg-secondary flex items-center gap-3"
              >
                <ImageIcon className="w-4 h-4" />
                {t('mediaLibrary')}
              </button>
            </div>
          )}

          {/* Format Button */}
          {shouldShowFormatButton() && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleFormatPost(selectedPostId)}
              disabled={isFormatting}
              className={`h-9 px-3 lg:px-4 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 hover:border-purple-500 transition-all ${isFormatting ? 'animate-pulse' : ''}`}
              title="Tự động định dạng lại bài viết cho đẹp mắt"
            >
              {isFormatting ? (
                <span className="flex items-center gap-2">
                  <SparklesIcon className="w-4 h-4 animate-spin" />
                  <span className="hidden lg:inline text-xs font-medium whitespace-nowrap">Đang sửa...</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4" />
                  <span className="hidden lg:inline text-xs font-medium whitespace-nowrap">Format</span>
                </span>
              )}
            </Button>
          )}

          {/* Translate Button */}
          {postContents[selectedPostId] && postContents[selectedPostId].length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsTranslateDialogOpen(true)}
              disabled={isTranslating}
              className={`h-9 px-3 lg:px-4 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500 transition-all ${isTranslating ? 'animate-pulse' : ''}`}
              title="Dịch bài viết"
            >
              {isTranslating ? (
                <span className="flex items-center gap-2">
                  <SparklesIcon className="w-4 h-4 animate-spin" />
                  <span className="hidden lg:inline text-xs font-medium whitespace-nowrap">Đang dịch...</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Languages className="w-4 h-4" />
                  <span className="hidden lg:inline text-xs font-medium whitespace-nowrap">Translate</span>
                </span>
              )}
            </Button>
          )}
        </div>

        {/* Right: Clone, Save, Publish */}
        <div className="flex items-center gap-2 pr-[10px] pb-[10px]">
          {/* Clone Button */}
          <Button
            size="sm"
            variant="outline"
            className="h-9 px-3 lg:px-4 border-primary text-foreground hover:bg-primary/10"
            onClick={() => {
              if (!selectedPostId) return;
              handleClonePost(selectedPostId, postMedia, (newPostId, clonedMedia) => {
                setPostMedia(newPostId, clonedMedia);
              });
            }}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="hidden lg:inline text-xs font-medium whitespace-nowrap">{t('clone')}</span>
            </span>
          </Button>

          {/* Save Draft Button */}
          <Button
            size="sm"
            variant="outline"
            className="h-9 px-3 lg:px-4 lg:w-16 border-primary text-foreground hover:bg-primary/10 transition-all"
            onClick={() => {
              if (!selectedPostId || !currentPost) return;
              const content = postContents[selectedPostId] || '';
              const media = postMedia[selectedPostId] || [];
              handleSaveDraft(selectedPostId, content, media, currentPost.type);
            }}
            disabled={isSavingDraft}
          >
            {isSavingDraft ? (
              <span className="text-xs font-medium whitespace-nowrap">{t('saving')}</span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                <span className="hidden lg:inline text-xs font-medium whitespace-nowrap">{t('save')}</span>
              </span>
            )}
          </Button>

          <Button
            onClick={() => setIsPublishModalOpen(true)}
            className="h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
          >
            <span className="flex items-center gap-2">
              <span className="hidden lg:inline text-sm font-bold">{t('publish')}</span>
              {/* Corrected Send Icon Direction using Lucide Send (or rotated SVG) */}
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </span>
          </Button>
        </div>
      </div>

      {/* Target Language Dialog */}
      <Dialog open={isTranslateDialogOpen} onOpenChange={setIsTranslateDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md p-2 sm:p-4 shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Chọn ngôn ngữ đích</DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1.5 flex flex-col gap-1">
              <span>Bạn muốn dịch bài viết sang ngôn ngữ nào?</span>
              <span className="flex items-center gap-1 text-primary font-medium text-xs bg-primary/10 w-fit px-2 py-0.5 rounded-md mt-1">
                <SparklesIcon className="w-3 h-3" /> Chi phí: 1 Credit
              </span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <select 
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="w-full bg-background border border-border rounded-xl p-3.5 text-sm text-foreground focus:outline-none focus:border-blue-500/50 shadow-inner"
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">Tiếng Anh (English)</option>
              <option value="ja">Tiếng Nhật (日本語)</option>
              <option value="ko">Tiếng Hàn (한국어)</option>
              <option value="zh">Tiếng Trung (中文)</option>
              <option value="fr">Tiếng Pháp (Français)</option>
              <option value="es">Tiếng Tây Ban Nha (Español)</option>
            </select>
          </div>

          <DialogFooter className="mt-2 sm:mt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsTranslateDialogOpen(false)}
              className="border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 bg-transparent rounded-lg"
            >
              Hủy
            </Button>
            <Button 
              onClick={() => {
                setIsTranslateDialogOpen(false);
                handleTranslatePost(selectedPostId, targetLanguage);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-lg shadow-blue-500/20 rounded-lg"
            >
              Dịch ngay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}