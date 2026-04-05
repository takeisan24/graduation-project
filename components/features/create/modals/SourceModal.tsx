// components/create/modals/SourceModal.tsx
"use client";

import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UploadCloud as UploadCloudIcon, X as CloseIcon} from 'lucide-react';
import { toast } from 'sonner';
import { supabaseClient } from '@/lib/supabaseClient';

import { useCreateSourcesStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { SOURCE_ERRORS } from '@/lib/messages/errors';
import { useTranslations } from 'next-intl';

export default function SourceModal() {
    const t = useTranslations('CreatePage.createSection.sourceModal');
    const {
        isSourceModalOpen, 
        setIsSourceModalOpen,
        addSavedSource,
    } = useCreateSourcesStore(useShallow(state => ({
        isSourceModalOpen: state.isSourceModalOpen,
        setIsSourceModalOpen: state.setIsSourceModalOpen,
        addSavedSource: state.addSavedSource,
    })));

    // State cục bộ cho form bên trong modal
    const [selectedSourceType, setSelectedSourceType] = useState('text');
    const [sourceTextInput, setSourceTextInput] = useState('');
    const [sourceUrlInput, setSourceUrlInput] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null); // <-- State mới để lưu file
    const [isUploading, setIsUploading] = useState(false); // <-- State mới cho trạng thái upload
    const [shouldSaveSource, setShouldSaveSource] = useState(true);
    const [advancedInstructions, setAdvancedInstructions] = useState('');

    const [statusMessage, setStatusMessage] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null); // Ref cho input file ẩn

    if (!isSourceModalOpen) return null;

    // Hàm xử lý khi người dùng chọn file
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    };

   // Hàm xử lý chính khi nhấn nút "Thêm"
    const handleAdd = async () => {
        setIsUploading(true); // Bật loading
        setStatusMessage(''); // Reset thông báo

    try {
        let sourceType = selectedSourceType;
        let sourceValue: string;
        let sourceLabel: string;
        
        // --- Logic xác định giá trị nguồn (đã tốt, giữ nguyên) ---
        if (['article', 'youtube', 'tiktok'].includes(sourceType)) {
            sourceValue = sourceUrlInput.trim();
            if (!sourceValue) throw new Error(SOURCE_ERRORS.URL_REQUIRED);
            sourceLabel = sourceValue;
        } 
        else if (sourceType === 'text') {
            sourceValue = sourceTextInput.trim();
            if (!sourceValue) throw new Error(SOURCE_ERRORS.TEXT_REQUIRED);
            sourceLabel = `${t('textSource')}: ${sourceValue.substring(0, 50)}...`;
        }
        else if (sourceType === 'pdf' && selectedFile) {
            setStatusMessage(t('errors.uploadingFile', { fileName: selectedFile.name }));
            const formData = new FormData();
            formData.append('file', selectedFile);
            const { data: { session } } = await supabaseClient.auth.getSession();
            const response = await fetch('/api/data/pdf/upload', { 
                method: 'POST', 
                headers: session?.access_token ? { 'authorization': `Bearer ${session.access_token}` } as any : undefined,
                body: formData 
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.details || result.error || t('errors.uploadPdfFailed'));
            
            sourceValue = result.fileUri;
            sourceLabel = result.fileName;
        } 
        else {
            throw new Error(SOURCE_ERRORS.SOURCE_DATA_REQUIRED);
        }

        // Tạo đối tượng source
        const source = { type: sourceType, value: sourceValue, label: sourceLabel };

        // --- THAY ĐỔI LOGIC CHÍNH Ở ĐÂY ---
        
        // 1. Chỉ lưu nguồn nếu người dùng chọn
        if (shouldSaveSource) {
            addSavedSource(source);
        }
        
        // 2. Đóng modal hiện tại
        setIsSourceModalOpen(false);
        
        // 3. Hiển thị thông báo thành công
        // Note: SourcePanel.tsx cũng show toast khi add source, nhưng đây là 2 flow khác nhau
        // (SourceModal là modal riêng, SourcePanel là wizard flow), nên không duplicate
        toast.success(t('sourceAddSuccess', { type: sourceType }));
        
        // 4. XÓA BỎ LỆNH GỌI openCreateFromSourceModal(...)

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : t('errors.errorOccurred');
        console.error("Lỗi khi thêm nguồn:", error);
        // Thay vì setStatusMessage, chúng ta dùng toast.error
        toast.error(SOURCE_ERRORS.ADD_SOURCE_FAILED(errorMessage));
        // Không tắt loading ở đây để người dùng có thể thử lại
        setIsUploading(false);
    } 
    // Không cần finally nữa vì toast đã xử lý việc thông báo
};

    const isFileUpload = selectedSourceType === 'pdf' || selectedSourceType === 'audio';

    const sourceTypeOptions = [
    { key: "text", label: t('sourceTypeLabel.fromText') },
    { key: "article", label: t('sourceTypeLabel.fromArticle') },
    { key: "youtube", label: t('sourceTypeLabel.fromYoutube') },
    { key: "tiktok", label: t('sourceTypeLabel.fromTiktok') },
    { key: "pdf", label: t('sourceTypeLabel.fromPDF') },
    { key: "audio", label: t('sourceTypeLabel.fromAudio') },
  ]

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-2xl w-[1000px] max-w-[95vw]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-lg font-semibold text-foreground">{t('editSource')}</h2>
                    <button onClick={() => setIsSourceModalOpen(false)}>
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
                {/* Tabs */}
            <div className="px-6 pt-4">
              <div className="grid grid-cols-6 gap-3">
                {sourceTypeOptions.map((option) => (
                  <button
                    key={option.key}
                    className={`px-4 py-3 rounded-md text-sm ${
                      selectedSourceType === (option.key as any) 
                        ? 'bg-secondary text-foreground' 
                        : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                    onClick={() => setSelectedSourceType(option.key as any)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Body */}
                        <div className="px-6 py-4 space-y-3 overflow-auto" style={{ maxHeight: "60vh" }}>
                          {/* *** THAY ĐỔI GIAO DIỆN Ở ĐÂY *** */}
                    {!isFileUpload ? (
                        <>
                            <div className="text-foreground">
                                {selectedSourceType === 'text' ? t('sourceTypeLabel.fromText') : 'URL'}
                            </div>
                            {selectedSourceType === 'text' ? (
                                <Textarea
                                placeholder={t('sourceInputPlaceholder.fromText')}
                                className="bg-card border-border h-40"
                                value={sourceTextInput} onChange={(e) => setSourceTextInput(e.target.value)} />
                            ) : (
                                <Input
                                placeholder={
                                  selectedSourceType === 'article' ? t('sourceInputPlaceholder.fromArticle') :
                                  selectedSourceType === 'youtube' ? t('sourceInputPlaceholder.fromYoutube') :
                                  selectedSourceType === 'tiktok' ? t('sourceInputPlaceholder.fromTiktok')
                                  : t('sourceInputPlaceholder.fromSource')
                                }
                                className="bg-card border-border"
                                value={sourceUrlInput}
                                onChange={(e) => setSourceUrlInput(e.target.value)} />
                            )}
                        </>
                    ) : (
                        <>
                            <div className="text-foreground">{t('fileLabel')}</div>
                            <div
                                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-border"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileChange}
                                    accept={selectedSourceType === 'pdf' ? '.pdf' : 'audio/*'}
                                />
                                <UploadCloudIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                                {selectedFile ? (
                                    <p className="mt-2 text-sm text-green-400">{selectedFile.name}</p>
                                ) : (
                                    <p className="mt-2 text-sm text-muted-foreground">Nhấn để chọn file {selectedSourceType.toUpperCase()}</p>
                                )}
                            </div>
                        </>
                    )}  
                          <label className="flex items-center gap-3 text-foreground pt-2">
                            <input 
                              type="checkbox" 
                              className="accent-primary"
                              checked={shouldSaveSource}
                              onChange={(e) => setShouldSaveSource(e.target.checked)}
                            />
                            <span>{t('saveCheckbox')}</span>
                          </label>
                          <details className="text-foreground/90">
                            <summary className="cursor-pointer select-none">{t('advancedOptions')}</summary>
                            <div className="mt-2 text-sm text-muted-foreground">{t('mockOptionsText')}</div>
                          </details>
                          <label htmlFor="advanced-instructions" className="block text-foreground mb-2">
                        {t('chatRequestLabel')}
                      </label>
                      <Textarea
                        id="advanced-instructions"
                        placeholder={t('chatPlaceholder')}
                        className="bg-card border-border h-32 mb-4 placeholder:text-muted-foreground"
                        value={advancedInstructions}
                        onChange={(e) => setAdvancedInstructions(e.target.value)}
                      />
                        </div>
                <div className="px-6 pb-6">
                    {statusMessage && (
  <p className={`text-center text-sm mb-2 ${statusMessage.startsWith('Lỗi') ? 'text-red-400' : 'text-muted-foreground'}`}>
    {statusMessage}
  </p>
)}
                    <button 
                    onClick={handleAdd} 
                    className="w-full bg-accent hover:bg-accent/90 text-white py-3 rounded-md disabled:opacity-50"
                    disabled={isUploading || (!sourceTextInput.trim() && !sourceUrlInput.trim() && !selectedFile)}>
                        Thêm
                    </button>
                </div>
            </div>
        </div>
    );
}