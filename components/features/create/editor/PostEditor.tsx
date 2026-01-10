// components/create/editor/PostEditor.tsx
"use client";

import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

import { useCreatePostsStore, useCreateSourcesStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { useTranslations } from 'next-intl';
import { PlusCircle, Trash2, MessageSquare, Sparkles, ChevronLeft, ChevronRight, History } from 'lucide-react';

import TabsManager from './TabsManager';
import MediaPreview from './MediaPreview';
import ActionBar from './ActionBar';

export default function PostEditor() {
    const t = useTranslations('CreatePage.createSection.postPanel');
    

    // State và actions cho phần nội dung
    const {
        posts,
        selectedPostId,
        postContents,
        handlePostContentChange,
        navigatePostVersion,
        deletePostVersion
    } = useCreatePostsStore(useShallow(state => ({
        posts: state.openPosts,
        selectedPostId: state.selectedPostId,
        postContents: state.postContents,
        handlePostContentChange: state.handlePostContentChange,
        navigatePostVersion: state.navigatePostVersion,
        deletePostVersion: state.deletePostVersion
    })));
    
    const savedSources = useCreateSourcesStore(state => state.savedSources);

    const currentPost = posts.find(p => p.id === selectedPostId);
    
    // --- Logic hiển thị Version ---
    const hasVersions = currentPost?.versions && currentPost.versions.length > 1;
    const currentVerIndex = currentPost?.currentVersionIndex ?? (currentPost?.versions?.length ? currentPost.versions.length - 1 : 0);
    const totalVersions = currentPost?.versions?.length ?? 1;
    // ------------------------------

    return (
        <div className="flex-1 flex flex-col min-w-0 p-2 md:p-[15px] h-full" data-tour="create-post">
            {/* Dòng quản lý Tabs */}
            <TabsManager />

            {/* Editor Card */}
            <Card className="bg-[#2A2A30] border-[#3A3A42] p-0 gap-0 rounded-[5px] flex-1 flex flex-col w-full overflow-hidden">
                {selectedPostId === 0 || posts.length === 0 ? (
                    /* --- GIỮ NGUYÊN PHẦN EMPTY STATE (KHÔNG THAY ĐỔI) --- */
                    <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden min-h-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-[#1E1E23] via-[#2A2A30] to-[#1E1E23]"></div>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(227,50,101,0.15),transparent_50%)]"></div>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(124,58,237,0.1),transparent_50%)]"></div>
                        <div className="absolute inset-0 backdrop-blur-3xl"></div>
                        
                        <div className="max-w-2xl text-center space-y-4 relative z-10 animate-in fade-in duration-500">
                            <div className="flex justify-center animate-in zoom-in duration-500 delay-100">
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-gradient-to-r from-[#E33265]/30 to-[#7C3AED]/30 rounded-full blur-xl group-hover:blur-2xl transition-all duration-500 animate-pulse"></div>
                                    <div className="relative w-20 h-20 bg-gradient-to-br from-[#E33265]/20 via-[#7C3AED]/10 to-[#E33265]/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border-2 border-[#E33265]/30 shadow-xl shadow-[#E33265]/20">
                                        <Sparkles className="w-10 h-10 text-[#E33265] animate-pulse" />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-9 h-9 bg-gradient-to-br from-[#E33265] via-[#c52b57] to-[#7C3AED] rounded-full flex items-center justify-center shadow-lg shadow-[#E33265]/60 animate-bounce">
                                        <PlusCircle className="w-5 h-5 text-white" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 animate-in slide-in-from-bottom duration-500 delay-200">
                                <h3 className="text-2xl font-bold bg-gradient-to-r from-white via-gray-100 to-white bg-clip-text text-transparent drop-shadow-lg">
                                    {t('emptyState.title')}
                                </h3>
                                <p className="text-sm text-gray-200 leading-relaxed font-medium">
                                    {t('emptyState.description')}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-left">
                                <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-[#1E1E23]/80 to-[#252529]/80 backdrop-blur-sm border-2 border-[#E33265]/30 hover:border-[#E33265]/60 hover:shadow-xl hover:shadow-[#E33265]/30 transition-all group animate-in slide-in-from-left duration-500 delay-300">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#E33265] via-[#c52b57] to-[#7C3AED] text-white font-bold text-sm flex-shrink-0 shadow-lg shadow-[#E33265]/40 group-hover:scale-110 transition-transform">
                                        1
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white mb-1 group-hover:text-[#E33265] transition-colors">
                                            {t('emptyState.step1.title')}
                                        </p>
                                        <p className="text-xs text-gray-300 group-hover:text-gray-200 transition-colors leading-relaxed">
                                            {t('emptyState.step1.description')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-[#1E1E23]/80 to-[#252529]/80 backdrop-blur-sm border-2 border-[#7C3AED]/30 hover:border-[#7C3AED]/60 hover:shadow-xl hover:shadow-[#7C3AED]/30 transition-all group animate-in slide-in-from-left duration-500 delay-400">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#7C3AED] via-[#6D28D9] to-[#E33265] text-white font-bold text-sm flex-shrink-0 shadow-lg shadow-[#7C3AED]/40 group-hover:scale-110 transition-transform">
                                        2
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white mb-1 group-hover:text-[#7C3AED] transition-colors">
                                            {t('emptyState.step2.title')}
                                        </p>
                                        <p className="text-xs text-gray-300 group-hover:text-gray-200 transition-colors leading-relaxed">
                                            {t('emptyState.step2.description')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-blue-500/15 via-purple-500/15 to-pink-500/15 backdrop-blur-sm border border-blue-400/30 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/20 transition-all animate-in slide-in-from-bottom duration-500 delay-500">
                                <MessageSquare className="w-5 h-5 text-blue-300 flex-shrink-0 mt-0.5 animate-pulse" />
                                <p className="text-xs text-blue-100 text-left leading-relaxed">
                                    <strong className="font-semibold text-blue-200 text-sm">{t('emptyState.tip.title')}</strong>
                                    {' '}
                                    <span className="text-gray-200">{t('emptyState.tip.description')}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col min-h-0 relative">
                        {/* --- UI VERSION CONTROL: HIỂN THỊ KHI CÓ > 1 VERSION --- */}
                        {hasVersions && (
                            <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 bg-[#1E1E23] border-b border-[#3A3A42] animate-in fade-in slide-in-from-top-1">
                                <div className="flex items-center gap-2 text-xs text-blue-400">
                                    <History className="w-3.5 h-3.5" />
                                    <span>Lịch sử chỉnh sửa AI</span>
                                </div>
                                
                                <div className="flex items-center bg-[#2A2A30] rounded border border-[#3A3A42] p-0.5">
                                    <button
                                        onClick={() => navigatePostVersion(selectedPostId, 'prev')}
                                        disabled={currentVerIndex === 0}
                                        className="p-1 hover:bg-white/10 rounded-sm disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-white"
                                        title="Phiên bản cũ hơn"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                    </button>
                                    
                                    <span className="text-[10px] font-mono text-white/70 mx-2 min-w-[30px] text-center">
                                        v{currentVerIndex + 1}/{totalVersions}
                                    </span>

                                    <button
                                        onClick={() => navigatePostVersion(selectedPostId, 'next')}
                                        disabled={currentVerIndex === totalVersions - 1}
                                        className="p-1 hover:bg-white/10 rounded-sm disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-white"
                                        title="Phiên bản mới hơn"
                                    >
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            deletePostVersion(selectedPostId, currentVerIndex);
                                        }}
                                        className="p-1.5 hover:bg-red-500/20 text-white/50 hover:text-red-400 rounded transition-colors"
                                        title="Xóa phiên bản này"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                        {/* ----------------------------------------------------- */}

                        {/* Scrollable textarea */}
                        <Textarea
                            placeholder={`${t('postContentPlaceholder')} ${currentPost?.type || "post"}?`}
                            value={postContents[selectedPostId] ?? ""}
                            onChange={(e) => handlePostContentChange(selectedPostId, e.target.value)}
                            className="flex-1 min-h-0 bg-[#2A2A30] border-0 resize-none text-base md:text-sm text-white placeholder:text-gray-400 focus:ring-0 focus:outline-none p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 rounded-none"
                        />

                        {/* MediaPreview + ActionBar - Fixed ở bottom, luôn visible */}
                        <div className="flex-shrink-0 flex flex-col">
                            <MediaPreview />
                            <ActionBar />
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}