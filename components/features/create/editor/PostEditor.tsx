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
            <Card className="bg-card border-border p-0 gap-0 rounded-[5px] flex-1 flex flex-col w-full overflow-hidden">
                {selectedPostId === 0 || posts.length === 0 ? (
                    /* --- GIỮ NGUYÊN PHẦN EMPTY STATE (KHÔNG THAY ĐỔI) --- */
                    <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden min-h-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-background"></div>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.15),transparent_50%)]"></div>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--accent)/0.1),transparent_50%)]"></div>
                        <div className="absolute inset-0 backdrop-blur-3xl"></div>
                        
                        <div className="max-w-2xl text-center space-y-4 relative z-10 animate-in fade-in duration-500">
                            <div className="flex justify-center animate-in zoom-in duration-500 delay-100">
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-accent/30 rounded-full blur-xl group-hover:blur-2xl transition-all duration-500 animate-pulse"></div>
                                    <div className="relative w-20 h-20 bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border-2 border-primary/30 shadow-xl shadow-primary/20">
                                        <Sparkles className="w-10 h-10 text-primary animate-pulse" />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-9 h-9 bg-gradient-to-br from-primary via-primary/80 to-accent rounded-full flex items-center justify-center shadow-lg shadow-primary/60 animate-bounce">
                                        <PlusCircle className="w-5 h-5 text-white" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 animate-in slide-in-from-bottom duration-500 delay-200">
                                <h3 className="text-2xl font-bold bg-gradient-to-r from-white via-gray-100 to-white bg-clip-text text-transparent drop-shadow-lg">
                                    {t('emptyState.title')}
                                </h3>
                                <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                                    {t('emptyState.description')}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-left">
                                <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-background/80 to-secondary/80 backdrop-blur-sm border-2 border-primary/30 hover:border-primary/60 hover:shadow-xl hover:shadow-primary/30 transition-all group animate-in slide-in-from-left duration-500 delay-300">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary via-primary/80 to-accent text-white font-bold text-sm flex-shrink-0 shadow-lg shadow-primary/40 group-hover:scale-110 transition-transform">
                                        1
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white mb-1 group-hover:text-primary transition-colors">
                                            {t('emptyState.step1.title')}
                                        </p>
                                        <p className="text-xs text-muted-foreground group-hover:text-muted-foreground transition-colors leading-relaxed">
                                            {t('emptyState.step1.description')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-background/80 to-secondary/80 backdrop-blur-sm border-2 border-accent/30 hover:border-accent/60 hover:shadow-xl hover:shadow-accent/30 transition-all group animate-in slide-in-from-left duration-500 delay-400">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-accent via-violet-700 to-primary text-white font-bold text-sm flex-shrink-0 shadow-lg shadow-accent/40 group-hover:scale-110 transition-transform">
                                        2
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white mb-1 group-hover:text-accent transition-colors">
                                            {t('emptyState.step2.title')}
                                        </p>
                                        <p className="text-xs text-muted-foreground group-hover:text-muted-foreground transition-colors leading-relaxed">
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
                                    <span className="text-muted-foreground">{t('emptyState.tip.description')}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col min-h-0 relative">
                        {/* --- UI VERSION CONTROL: HIỂN THỊ KHI CÓ > 1 VERSION --- */}
                        {hasVersions && (
                            <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 bg-background border-b border-border animate-in fade-in slide-in-from-top-1">
                                <div className="flex items-center gap-2 text-xs text-blue-400">
                                    <History className="w-3.5 h-3.5" />
                                    <span>Lịch sử chỉnh sửa AI</span>
                                </div>
                                
                                <div className="flex items-center bg-card rounded border border-border p-0.5">
                                    <button
                                        onClick={() => navigatePostVersion(selectedPostId, 'prev')}
                                        disabled={currentVerIndex === 0}
                                        className="p-1 hover:bg-secondary rounded-sm disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-foreground"
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
                                        className="p-1 hover:bg-secondary rounded-sm disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-foreground"
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
                            className="flex-1 min-h-0 bg-card border-0 resize-none text-base md:text-sm text-foreground placeholder:text-muted-foreground focus:ring-0 focus:outline-none p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-secondary rounded-none"
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