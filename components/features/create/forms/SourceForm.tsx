"use client";

import { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ArrowRight, Plus, X, RefreshCcw, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import StrategySelector from '../sources/StrategySelector';
import { type Framework } from '@/lib/constants/content-strategy';
import { SourceMetadata } from '@/store/shared/types';

interface SourceFormProps {
  initialData?: {
    metadata?: SourceMetadata; // Thay any bằng SourceMetadata chuẩn
  };
  isReadOnly?: boolean;
  onComplete?: (source: { type: string; value: string; label: string; file?: File }) => void;
  onCancel?: () => void;
}

export default function SourceForm({ onComplete, onCancel, initialData, isReadOnly = false }: SourceFormProps) {
  const t = useTranslations('CreatePage.createSection.sourceModal');
  const tStrategy = useTranslations('CreatePage.createSection.strategySelector');

  // Multi-step wizard state
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Strategy Selection
  const [selectedFramework, setSelectedFramework] = useState<Framework | null>(null);
  const [selectedGoal, setSelectedGoal] = useState('');
  const [selectedNiche, setSelectedNiche] = useState('');

  // Step 2: Content Input
  const [isSelectingSource, setIsSelectingSource] = useState(false);
  const [sourceType, setSourceType] = useState<'youtube' | 'tiktok' | 'article' | 'text' | 'file'>('text');

  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [articleUrl, setArticleUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (initialData && initialData.metadata) {
      const meta = initialData.metadata;

      // 1. Restore Step 1
      if (meta.framework) setSelectedFramework(meta.framework);
      if (meta.goalId) setSelectedGoal(meta.goalId);
      if (meta.nicheId) setSelectedNiche(meta.nicheId);

      // 2. Restore Step 2
      if (meta.userIdea) setTextContent(meta.userIdea);

      if (meta.attachment) {
        setSourceType(meta.attachment.type);
        if (meta.attachment.type === 'youtube') setYoutubeUrl(meta.attachment.url || '');
        if (meta.attachment.type === 'tiktok') setTiktokUrl(meta.attachment.url || '');
        if (meta.attachment.type === 'article') setArticleUrl(meta.attachment.url || '');
        // File không thể restore object File, chỉ hiện tên (cần xử lý UI hiển thị tên file cũ nếu cần)
      }

      // Tùy chọn: Muốn mở ngay ở Step 2 hay Step 1?
      // User yêu cầu: "Show lại từ đầu" -> Để Step 1
      setStep(1);

      // Notify
    }
  }, [initialData]);

  const constructFinalPrompt = (
    goalId: string,
    nicheId: string,
    customRequest: string
  ): string => {
    const storedJson = localStorage.getItem("selectedData");
    if (storedJson) {
      try {
        const framework = JSON.parse(storedJson) as Framework;
        const goalModifier = framework.goal_overrides?.[goalId] || "";

        const overridePrompt = framework.niche_overrides?.[nicheId] || "";

        let promptContent = framework.base_prompt_text || "";

        return `${goalModifier}\n${overridePrompt}\n${promptContent}\n${customRequest || ""}`;

      } catch (error) {
        console.error("Dữ liệu trong localStorage không hợp lệ", error);
      }
    }
    return "";
  };

  // --- VALIDATION FUNCTIONS ---
  const isValidUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // 2. Validate YouTube (Chấp nhận: Standard, Shorts, Mobile, Rút gọn)
  const isYoutubeVideoUrl = (url: string): boolean => {
    if (!isValidUrl(url)) return false;
    // Regex bắt các dạng:
    // - youtube.com/watch?v=ID
    // - youtube.com/shorts/ID
    // - youtu.be/ID
    // - m.youtube.com/...
    const youtubeRegex = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]{11}(&.*)?$/;
    return youtubeRegex.test(url);
  };

  // 3. Validate TikTok (Chấp nhận: Web Video, Mobile Short Link)
  const isTiktokVideoUrl = (url: string): boolean => {
    if (!isValidUrl(url)) return false;
    // Regex bắt các dạng:
    // - tiktok.com/@user/video/ID
    // - www.tiktok.com/@user/video/ID
    // - vt.tiktok.com/ID (Link rút gọn từ mobile)
    // - vm.tiktok.com/ID
    const standardRegex = /tiktok\.com\/@[\w.-]+\/video\/\d+/;
    const shortLinkRegex = /(vt|vm)\.tiktok\.com\/[\w-]+\/?/;
    
    return standardRegex.test(url) || shortLinkRegex.test(url);
  };

   // 4. Validate Article (Chặn các link mạng xã hội video để tránh user chọn nhầm tab)
  const isArticleUrl = (url: string): boolean => {
    if (!isValidUrl(url)) return false;
    
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      // Danh sách các domain video phổ biến cần chặn ở tab "Bài viết"
      const videoDomains = [
        'youtube.com', 'youtu.be', 
        'tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com',
        'instagram.com', 'facebook.com', 'vimeo.com'
      ];
      
      // Nếu link thuộc các domain trên -> Báo lỗi (để user sang đúng tab)
      const isVideoDomain = videoDomains.some(domain => hostname.includes(domain));
      return !isVideoDomain;
    } catch {
      return false;
    }
  };

  const canProceedToStep2 = selectedFramework !== null;

  // Validation cập nhật: Kiểm tra cả text VÀ source (nếu có chọn source)
  const getValidationError = (): string | null => {
    // 1. Validate Text (Ý tưởng) - Luôn kiểm tra
    if (!textContent.trim()) {
      return t('errors.pleaseEnterText') || 'Vui lòng nhập mô tả ý tưởng của bạn';
    }

    // 2. Validate Source đính kèm (chỉ khi user chọn source khác 'text')
    if (sourceType === 'youtube') {
      if (!youtubeUrl.trim()) {
        return t('errors.pleaseEnterUrl') || 'Vui lòng nhập URL YouTube';
      }
      if (!isYoutubeVideoUrl(youtubeUrl)) {
        return 'Link không hợp lệ. Vui lòng nhập link video cụ thể (VD: youtube.com/watch?v=... hoặc youtu.be/...)';
      }
    } 
    else if (sourceType === 'tiktok') {
      if (!tiktokUrl.trim()) {
        return t('errors.pleaseEnterUrl') || 'Vui lòng nhập URL TikTok';
      }
      if (!isTiktokVideoUrl(tiktokUrl)) {
        return 'Link không hợp lệ. Vui lòng nhập link video cụ thể (VD: tiktok.com/@user/video/...)';
      }
    } 
    else if (sourceType === 'article') {
      if (!articleUrl.trim()) {
        return t('errors.pleaseEnterUrl') || 'Vui lòng nhập URL bài viết';
      }
      if (!isArticleUrl(articleUrl)) {
        return 'Đây có vẻ là link mạng xã hội/video. Vui lòng chọn tab YouTube hoặc TikTok.';
      }
    } 
    else if (sourceType === 'file') {
      if (!selectedFile) {
        return 'Vui lòng chọn file để tải lên';
      }
      // Validate file size (Max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        return 'Kích thước file không được vượt quá 10MB';
      }
    }

    return null;
  };

  const validationError = getValidationError();
  const canSubmit = validationError === null;

  // --- HANDLERS ---
  const handleNextStep = () => {
    if (canProceedToStep2) setStep(2);
  };

  const handleBackStep = () => {
    setStep(1);
  };

  const handleSelectSourceType = (type: 'youtube' | 'tiktok' | 'article' | 'text' | 'file') => {
    setSourceType(type);
    setIsSelectingSource(false);
  };

  const handleRemoveAttachedSource = () => {
    setSourceType('text');
    setYoutubeUrl('');
    setTiktokUrl('');
    setArticleUrl('');
    setSelectedFile(null);
  };

  // --- LOGIC GỘP DỮ LIỆU Ở ĐÂY ---
  const handleAdd = async () => {
    if (!canSubmit || !selectedFramework) return;
    setIsUploading(true);

    try {
      let finalSourceType: string;
      let attachedValue: string = '';

      const finalCompiledPrompt = await constructFinalPrompt(
        selectedGoal,
        selectedNiche,
        textContent
      );

      // 1. Xác định Source Type chính
      if (sourceType === 'youtube') {
        finalSourceType = 'youtube';
        attachedValue = youtubeUrl.trim();
      } else if (sourceType === 'tiktok') {
        finalSourceType = 'tiktok';
        attachedValue = tiktokUrl.trim();
      } else if (sourceType === 'article') {
        finalSourceType = 'article';
        attachedValue = articleUrl.trim();
      } else if (sourceType === 'file') {
        const isPdf = selectedFile?.type.includes('pdf');
        const isDoc = selectedFile?.type.includes('word') || selectedFile?.name.match(/\.(doc|docx)$/i);
        finalSourceType = isPdf ? 'pdf' : (isDoc ? 'doc' : 'audio');
        attachedValue = selectedFile?.name || 'File Upload';
      } else {
        finalSourceType = 'text';
      }

      // 2. Gộp nội dung: Ý tưởng + Link/File
      // Format: "Nội dung ý tưởng... \n\n [Attached Resource]: Link..."
      let finalValue = finalCompiledPrompt.trim();

      if (finalSourceType !== 'text' && attachedValue) {
        finalSourceType = 'text-source';
        finalValue = `${finalCompiledPrompt}\n\n[Attached Link/Resource]: ${attachedValue}`;
      }

      const metadata = {
        framework: selectedFramework,
        goalId: selectedGoal,
        nicheId: selectedNiche,
        userIdea: textContent,
        attachment: {
          type: sourceType,
          url: attachedValue, // URL hoặc tên file
          // Lưu ý: File thực tế không lưu được vào localStorage, 
          // nên nếu clone lại file, user phải upload lại file mới.
        }
      };

      // 3. Tạo Label hiển thị ngắn gọn
      const shortText = textContent.length > 40 ? textContent.substring(0, 40) + '...' : textContent;
      const sourceLabel = selectedFramework.title;

      const source = {
        type: finalSourceType,
        value: finalValue,
        label: `${sourceLabel}: ${shortText}`,
        file: selectedFile || undefined, // Truyền file object nếu cần upload ở bước sau
        metadata: metadata
      };

      if (onComplete) onComplete(source);

      // Reset
      handleRemoveAttachedSource();
      setTextContent('');
      setSelectedFramework(null);
      setStep(1);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('errors.errorOccurred');
      toast.error(t('sourceAddError', { error: errorMessage }));
    } finally {
      setIsUploading(false);
    }
  };

  const getPlaceholder = (): string => {
    const placeholders = selectedFramework?.placeholders;
    if (Array.isArray(placeholders) && placeholders.length > 0) {
      const title = selectedFramework?.title || '';
      return `💡 ${title}:\n\n${placeholders.filter(p => typeof p === 'string').join('\n\n')}`;
    }
    return `💡 Nhập ý tưởng của bạn...`;
  };

  // UI Step 1: Strategy Selection
  if (step === 1) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-semibold text-foreground">{tStrategy('title')}</h2>
          <p className="text-sm text-muted-foreground mt-1">{tStrategy('subtitle')}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6 pb-4 scrollbar-thin scrollbar-thumb-primary/60 scrollbar-track-secondary/50">
          <div className={isReadOnly ? "pointer-events-none opacity-90" : ""}>
            <StrategySelector
              selectedFramework={selectedFramework}
              onSelectFramework={setSelectedFramework}
              selectedGoal={selectedGoal}
              onSelectGoal={setSelectedGoal}
              selectedNiche={selectedNiche}
              onSelectNiche={setSelectedNiche}
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex-shrink-0 bg-background">
          {!canProceedToStep2 ? (
            <div className="mb-3 p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-300 text-center">⚠️ {tStrategy('selectTemplateHint')}</div>
          ) : (
            <div className="mb-3 p-2.5 rounded-lg bg-green-500/10 border border-green-500/30 text-xs text-green-300 text-center">✓ {tStrategy('templateSelected', { template: tStrategy(`frameworks.${selectedFramework.slug}.title`, { defaultValue: selectedFramework.title }) })}</div>
          )}
          <div className="flex gap-3">
            {onCancel && <button onClick={onCancel} className="flex-1 bg-secondary hover:bg-muted text-foreground py-3 rounded-lg font-medium">{t('cancelButton')}</button>}
            <button onClick={handleNextStep} disabled={!canProceedToStep2} className="flex-1 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-3 rounded-lg font-medium disabled:opacity-50 shadow-lg shadow-primary/30 flex items-center justify-center gap-2">
              {tStrategy('nextButton')} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // UI Step 2: Content Input
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        <button onClick={handleBackStep} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> {tStrategy('backButton')}
        </button>
        <h2 className="text-lg font-semibold text-foreground">{t('title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{tStrategy('step2Subtitle')}</p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-4 space-y-5 scrollbar-thin scrollbar-thumb-primary/60 scrollbar-track-secondary/50">

        {/* Framework Badge */}
        {selectedFramework && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
              {selectedFramework.icon && typeof selectedFramework.icon === 'function' ? (
                <selectedFramework.icon className="w-4 h-4 text-primary" />
              ) : (
                /* Fallback icon nếu dữ liệu icon bị mất do lưu JSON */
                <span className="text-sm"></span>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {tStrategy(`frameworks.${selectedFramework.slug}.title`, { defaultValue: selectedFramework.title })}
              </p>
              <p className="text-xs text-muted-foreground">
                {tStrategy(`frameworks.${selectedFramework.slug}.description`, { defaultValue: selectedFramework.description })}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* PHẦN 1: Ý TƯỞNG (LUÔN HIỂN THỊ) */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">💭 {t('ideaProvided')}</label>
            <Textarea
              readOnly={isReadOnly}
              placeholder={getPlaceholder()}
              className="bg-background text-foreground placeholder:text-muted-foreground min-h-[150px] resize-none border-border focus:border-primary/50"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
            />
            <div className="flex justify-end mt-1 text-xs text-muted-foreground">
              {textContent.length} 
            </div>
          </div>

          {/* PHẦN 2: NGUỒN THAM KHẢO (CHỌN THÊM) */}
          <div>
            {/* Header: Label + Nút Action */}
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <LinkIcon className="w-4 h-4" /> {t('addResource')}
              </label>

              {/* Nếu đang chọn nguồn thì hiện nút Hủy/Đổi */}
              {!isReadOnly && !isSelectingSource && sourceType !== 'text' && (
                <button onClick={handleRemoveAttachedSource} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded">
                  <X className="w-3 h-3" /> {t('cancelButton')}
                </button>
              )}

              {/* Nếu đang hiện lưới chọn thì hiện nút Đóng */}
              {isSelectingSource && (
                <button onClick={() => setIsSelectingSource(false)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 bg-secondary px-2 py-1 rounded">
                  <X className="w-3 h-3" /> {t('cancelButton')}
                </button>
              )}
            </div>

            {/* CASE A: Đang chọn nguồn (Lưới Icon) */}
            {isSelectingSource && (
              <div className="grid grid-cols-4 gap-2 animate-in fade-in zoom-in-95 duration-200">
                <button onClick={() => handleSelectSourceType('youtube')} className="p-3 rounded-lg border border-border bg-secondary hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center gap-1 transition-all">
                  <span className="text-xl">📺</span> <span className="text-[10px] uppercase font-bold text-muted-foreground">YouTube</span>
                </button>
                <button onClick={() => handleSelectSourceType('tiktok')} className="p-3 rounded-lg border border-border bg-secondary hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center gap-1 transition-all">
                  <span className="text-xl">🎵</span> <span className="text-[10px] uppercase font-bold text-muted-foreground">TikTok</span>
                </button>
                <button onClick={() => handleSelectSourceType('article')} className="p-3 rounded-lg border border-border bg-secondary hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center gap-1 transition-all">
                  <span className="text-xl">📰</span> <span className="text-[10px] uppercase font-bold text-muted-foreground">Artile</span>
                </button>
                <button onClick={() => handleSelectSourceType('file')} className="p-3 rounded-lg border border-border bg-secondary hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center gap-1 transition-all">
                  <span className="text-xl">📁</span> <span className="text-[10px] uppercase font-bold text-muted-foreground">File</span>
                </button>
              </div>
            )}

            {/* CASE B: Đã chọn nguồn (Hiển thị Input tương ứng) */}
            {!isSelectingSource && sourceType !== 'text' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                {sourceType === 'youtube' && (
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-lg">📺</span>
                    <input type="url" readOnly={isReadOnly} placeholder="https://youtube.com/..." className="w-full bg-background border border-border pl-10 pr-4 py-3 rounded-lg text-sm text-foreground focus:border-primary/50 focus:outline-none" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} autoFocus />
                  </div>
                )}
                {sourceType === 'tiktok' && (
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-lg">🎵</span>
                    <input type="url" readOnly={isReadOnly} placeholder="https://tiktok.com/..." className="w-full bg-background border border-border pl-10 pr-4 py-3 rounded-lg text-sm text-foreground focus:border-primary/50 focus:outline-none" value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} autoFocus />
                  </div>
                )}
                {sourceType === 'article' && (
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-lg">📰</span>
                    <input type="url" readOnly={isReadOnly} placeholder="https://example.com/..." className="w-full bg-background border border-border pl-10 pr-4 py-3 rounded-lg text-sm text-foreground focus:border-primary/50 focus:outline-none" value={articleUrl} onChange={(e) => setArticleUrl(e.target.value)} autoFocus />
                  </div>
                )}
                {sourceType === 'file' && (
                  <div className="border-2 border-dashed border-border rounded-lg p-4 hover:bg-secondary transition-colors relative">
                    <input type="file" readOnly={isReadOnly} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".pdf,audio/*,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }} />
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-2xl">📁</span>
                      <div className="text-sm">
                        {selectedFile ? <span className="text-green-400 font-medium">{selectedFile.name}</span> : <span className="text-muted-foreground">Click hoặc kéo thả file vào đây</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CASE C: Chưa chọn nguồn (Hiện nút Thêm) */}
            {!isReadOnly && !isSelectingSource && sourceType === 'text' && (
              <button onClick={() => setIsSelectingSource(true)} className="w-full py-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-all">
                <Plus className="w-4 h-4" /> {t('addButton')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border flex-shrink-0 bg-background">
        {validationError && <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 text-center">⚠️ {validationError}</div>}
        <div className="flex gap-3">
          {isReadOnly ? (
            <button
              onClick={onCancel}
              className="flex-1 bg-secondary hover:bg-muted text-foreground py-3 rounded-lg font-medium transition-colors"
            >{t('cancelButton')}</button>
          ) : (
            <button
              onClick={handleAdd}
              className="flex-1 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-3 rounded-lg font-medium shadow-lg shadow-primary/30 disabled:opacity-50"
              disabled={isUploading || !canSubmit}
            >
              {isUploading ? t('processing') : t('addButton')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}