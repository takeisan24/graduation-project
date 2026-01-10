"use client";

import { Button } from '@/components/ui/button';
import { FileTextIcon, Eye, Pencil, NewspaperIcon, YoutubeIcon, MusicIcon, FileIcon, HeadphonesIcon, LinkIcon, X as CloseIcon, Sparkles as SparklesIcon, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

// Import store để lấy dữ liệu sources và các action liên quan
import { useCreateSourcesStore, useNavigationStore, useImageGenModalStore, useCreateLightboxStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';

// Import SourceForm for wizard mode
import SourceForm from '../forms/SourceForm';

import { useTranslations } from 'next-intl';
import { useCreateChatStore } from '@/store/create/chat';

const SourceIcon = ({ type, isSelected }: { type: string, isSelected: boolean }) => {
    const iconClass = `w-5 h-5 ${isSelected ? 'text-[#E33265]' : 'text-gray-400'}`;
    switch (type) {
        case 'text': return <FileTextIcon className={iconClass} />;
        case 'article': return <NewspaperIcon className={iconClass} />;
        case 'youtube': return <YoutubeIcon className={iconClass} />;
        case 'tiktok': return <MusicIcon className={iconClass} />;
        case 'pdf': return <FileIcon className={iconClass} />;
        case 'audio': return <HeadphonesIcon className={iconClass} />;
        default: return <LinkIcon className={iconClass} />;
    }
};

interface SourcePanelProps {
    mode?: 'list' | 'form';
}

export default function SourcePanel({ mode = 'list' }: SourcePanelProps) {

    const t = useTranslations('CreatePage.createSection.sourcePanel');
    const tModal = useTranslations('CreatePage.createSection.sourceModal');

    const [hasSeenTour, setHasSeenTour] = useState(true);
    const [newSourceId, setNewSourceId] = useState<string | null>(null);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [editingSource, setEditingSource] = useState<any>(null);
    const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

    const {
        savedSources,
        deleteSavedSource,
        openCreateFromSourceModal,
        addSavedSource
    } = useCreateSourcesStore(
        useShallow(state => ({
            savedSources: state.savedSources,
            deleteSavedSource: state.deleteSavedSource,
            openCreateFromSourceModal: state.openCreateFromSourceModal,
            addSavedSource: state.addSavedSource,
        })));

    const {
        sidebarImages,
        clearSidebarImages,
    } = useImageGenModalStore(useShallow(state => ({
        sidebarImages: state.sidebarImages,
        clearSidebarImages: state.clearSidebarImages,
    })));

    const { openLightbox } = useCreateLightboxStore();
    const setWizardStep = useNavigationStore(state => state.setWizardStep);

    useEffect(() => {
        const seen = localStorage.getItem('hasSeenOnboarding');
        setHasSeenTour(!!seen);
    }, []);

    const getSourceTypeLabel = (type: string) => {
        return t(`sourceTypes.${type}`, { defaultValue: type });
    };

    const handleSourceClick = (source: any) => {
        useCreateChatStore.getState().clearChat();
        setIsReadOnly(false);
        setWizardStep('configuringPosts');
        openCreateFromSourceModal({ type: source.type, value: source.value, label: source.label || source.value });
    };

    const handleEditSource = (e: React.MouseEvent, source: any) => {
        e.stopPropagation();
        setEditingSource(source);
        setIsReadOnly(false);
        setWizardStep('addingSource');
    };

    const handleViewSource = (e: React.MouseEvent, source: any) => {
        e.stopPropagation();
        setEditingSource(source);
        setIsReadOnly(true);
        setWizardStep('addingSource');
    };

    const handleFormComplete = (source: { type: string; value: string; label: string }) => {
        const addedSource = addSavedSource(source);
        setNewSourceId(addedSource.id);
        setTimeout(() => setNewSourceId(null), 1500);

        toast.success(t('sourceAddSuccess', { type: source.type }));
        useCreateChatStore.getState().clearChat();
        openCreateFromSourceModal({ type: source.type, value: source.value, label: source.label });
        setEditingSource(null);
        setWizardStep('configuringPosts');
    };

    const handleFormCancel = () => {
        setEditingSource(null);
        setWizardStep('idle');
    };

    if (mode === 'form') {
        return (
            <div className="w-full h-full border-r border-white/10 bg-[#2A2A30]">
                <SourceForm onComplete={handleFormComplete} onCancel={handleFormCancel} isReadOnly={isReadOnly} initialData={editingSource} />
            </div>
        );
    }

    return (
        <div className="w-full h-full md:border-r border-white/10 p-3 md:p-4 md:pt-[30px] flex flex-col overflow-hidden" data-tour="source-list">

            <div className="flex flex-col gap-2 mb-2 flex-shrink-0" data-tour="add-source">
                <Button
                    size="sm"
                    className="text-base md:text-sm bg-gradient-to-r from-[#E33265] to-[#c52b57] hover:from-[#c52b57] hover:to-[#a82449] text-white px-4 py-3 md:py-2 transition-all duration-300 border-0 relative group shadow-lg shadow-[#E33265]/30 hover:shadow-[#E33265]/50 w-full md:w-auto"
                    onClick={() => {
                        setEditingSource(null);
                        setIsReadOnly(false);
                        setWizardStep('addingSource');
                    }}
                >
                    {!hasSeenTour && savedSources.length === 0 && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3 z-10">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                        </span>
                    )}
                    <FileTextIcon className="w-5 h-5 md:w-4 md:h-4 mr-2 inline-block group-hover:scale-110 transition-transform" />
                    {t('addSource')}
                    <span className="ml-2 text-lg md:text-base group-hover:scale-110 transition-transform inline-block">+</span>
                </Button>

                <Button
                    size="sm"
                    className="text-base md:text-sm bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] hover:from-[#6D28D9] hover:to-[#5B21B6] text-white px-4 py-3 md:py-2 transition-all duration-300 border-0 relative group shadow-lg shadow-[#7C3AED]/30 hover:shadow-[#7C3AED]/50 w-full md:w-auto mt-1"
                    onClick={() => useImageGenModalStore.getState().setIsImageGenModalOpen(true, 'sidebar')}
                >
                    <SparklesIcon className="w-5 h-5 md:w-4 md:h-4 mr-2 inline-block group-hover:scale-110 transition-transform" />
                    Tạo ảnh với AI
                </Button>
            </div>

            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {savedSources.length === 0 ? (
                    <div className="mt-4 p-4 md:p-5 rounded-xl bg-gradient-to-br from-[#E33265]/10 via-[#1E1E23] to-[#1E1E23] border-2 border-dashed border-[#E33265]/30 hover:border-[#E33265]/50 transition-all duration-300 group flex-shrink-0">
                        <div className="flex justify-center mb-4">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#E33265]/20 to-[#E33265]/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <FileTextIcon className="w-8 h-8 text-[#E33265] group-hover:scale-110 transition-transform" />
                                </div>
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#E33265] rounded-full flex items-center justify-center animate-pulse">
                                    <span className="text-white text-xs font-bold">+</span>
                                </div>
                            </div>
                        </div>
                        <p className="text-base text-white text-center font-semibold mb-2">
                            {tModal('title')}
                        </p>
                        <p className="text-xs text-gray-300 text-center leading-relaxed">
                            {tModal('description')}
                        </p>
                    </div>
                ) : (
                    <div className="mt-2 md:mt-4 flex-1 min-h-0 flex flex-col overflow-hidden" data-tour="source-list">
                        <div className="flex items-center justify-between mb-2 flex-shrink-0">
                            <h3 className="text-sm font-semibold text-gray-300">
                                {t('sourcesTitle')} ({savedSources.length})
                            </h3>
                        </div>
                        <div className="space-y-2 flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 pr-1 md:pr-2 pb-2">
                            {savedSources.map((source) => {
                                const isNewSource = source.id === newSourceId;

                                return (
                                    <div
                                        key={source.id}
                                        className={`group relative p-3 rounded-lg border cursor-pointer transition-all duration-200 bg-[#1E1E23] border-white/10 hover:border-[#E33265]/50 hover:bg-[#25252b] ${isNewSource ? 'animate-flash' : ''}`}
                                        onClick={() => handleSourceClick(source)}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex-shrink-0 mt-1">
                                                <SourceIcon type={source.type} isSelected={false} />
                                            </div>
                                            <div className="flex-1 min-w-0 pr-16 md:pr-0">
                                                <div className="text-[11px] uppercase font-bold text-gray-500 mb-0.5 tracking-wider">
                                                    {getSourceTypeLabel(source.type)}
                                                </div>
                                                <div className="text-base md:text-sm text-gray-200 font-medium line-clamp-2 leading-snug group-hover:text-white transition-colors">
                                                    {source.label}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 px-1 py-1 rounded-md bg-[#25252b] shadow-lg border border-white/5">
                                            <button
                                                className="p-1.5 hover:bg-blue-500/10 text-gray-400 hover:text-blue-400 rounded-md transition-all"
                                                onClick={(e) => handleViewSource(e, source)}
                                                title={t('viewDetails')}
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                className="p-1.5 hover:bg-yellow-500/10 text-gray-400 hover:text-yellow-400 rounded-md transition-all"
                                                onClick={(e) => handleEditSource(e, source)}
                                                title={t('editClone')}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <div className="w-px h-3 bg-white/10 mx-0.5"></div>
                                            <button
                                                className="p-1.5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 rounded-md transition-all"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteSavedSource(source.id);
                                                    toast.success(t('sourceDeleted'));
                                                }}
                                                aria-label={t('deleteSource')}
                                                title={t('deleteSource')}
                                            >
                                                <CloseIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Phần hiển thị ảnh đã tạo từ Sidebar */}
            {sidebarImages.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-col min-h-0 flex-shrink-0" style={{ maxHeight: '250px' }}>
                    <div className="flex items-center justify-between mb-3 px-1">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold text-[#7C3AED] uppercase tracking-widest">Ảnh đã tạo</h3>
                            <span className="bg-[#7C3AED]/20 text-[#7C3AED] text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                {sidebarImages.length}
                            </span>
                        </div>
                        <button
                            onClick={() => setIsConfirmClearOpen(true)}
                            className="text-gray-500 hover:text-red-400 transition-colors"
                            title="Xóa danh sách sidebar"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 pr-1">
                        {sidebarImages.map((img) => (
                            <div
                                key={img.id}
                                className="group relative aspect-square rounded-md overflow-hidden bg-[#1E1E23] border border-white/5 cursor-pointer hover:border-[#7C3AED]/50 transition-all hover:scale-[1.02] active:scale-95 shadow-lg"
                                onClick={() => openLightbox(img.preview, 'image')}
                            >
                                <img
                                    src={img.preview}
                                    alt="Sidebar Generated"
                                    className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-300"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <Eye className="w-4 h-4 text-white drop-shadow-md" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {/* Modal xác nhận xóa danh sách sidebar */}
            <Dialog open={isConfirmClearOpen} onOpenChange={setIsConfirmClearOpen}>
                <DialogContent className="max-w-[400px] bg-[#2A2A30] border-[#3A3A42] p-2 sm:p-4 shadow-2xl rounded-2xl">
                    <DialogHeader>
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20">
                                <AlertTriangle className="w-6 h-6 text-red-500" />
                            </div>
                            <DialogTitle className="text-xl text-white font-semibold">Xác nhận xóa?</DialogTitle>
                        </div>
                        <DialogDescription className="text-gray-400 text-sm leading-relaxed">
                            Bạn có chắc chắn muốn xóa toàn bộ danh sách ảnh đã tạo không? Hành động này không thể hoàn tác.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-8 flex flex-row gap-3 sm:gap-4 sm:space-x-0">
                        <Button
                            variant="outline"
                            onClick={() => setIsConfirmClearOpen(false)}
                            className="flex-1 bg-transparent border-[#3A3A42] text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                        >
                            Hủy bỏ
                        </Button>
                        <Button
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition-all border-0"
                            onClick={() => {
                                clearSidebarImages();
                                setIsConfirmClearOpen(false);
                                toast.success("Đã xóa danh sách ảnh đã tạo");
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