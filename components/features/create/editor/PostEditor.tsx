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
                    <div className="flex-1 flex items-center justify-center p-6 md:p-8 relative overflow-hidden min-h-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5"></div>

                        <div className="max-w-xl text-center space-y-5 relative z-10">
                            <div className="flex justify-center">
                                <div className="relative">
                                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                                        <Sparkles className="w-8 h-8 text-primary" />
                                    </div>
                                    <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-primary rounded-lg flex items-center justify-center shadow-md">
                                        <PlusCircle className="w-4 h-4 text-primary-foreground" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-foreground">
                                    {t('emptyState.title')}
                                </h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {t('emptyState.description')}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                                <div className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/40 hover:shadow-md transition-all group">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm flex-shrink-0">
                                        1
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                                            {t('emptyState.step1.title')}
                                        </p>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {t('emptyState.step1.description')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border hover:border-accent/40 hover:shadow-md transition-all group">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground font-bold text-sm flex-shrink-0">
                                        2
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground mb-1 group-hover:text-accent transition-colors">
                                            {t('emptyState.step2.title')}
                                        </p>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {t('emptyState.step2.description')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                                <MessageSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-left leading-relaxed">
                                    <strong className="font-semibold text-foreground text-sm">{t('emptyState.tip.title')}</strong>
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
                                <div className="flex items-center gap-2 text-xs text-primary">
                                    <History className="w-3.5 h-3.5" />
                                    <span>{t('versionHistory', { defaultMessage: 'Lịch sử chỉnh sửa AI' })}</span>
                                </div>

                                <div className="flex items-center bg-card rounded border border-border p-0.5">
                                    <button
                                        onClick={() => navigatePostVersion(selectedPostId, 'prev')}
                                        disabled={currentVerIndex === 0}
                                        className="p-1 hover:bg-secondary rounded-sm disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-foreground"
                                        aria-label="Previous version"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                    </button>

                                    <span className="text-[10px] font-mono text-muted-foreground mx-2 min-w-[30px] text-center">
                                        v{currentVerIndex + 1}/{totalVersions}
                                    </span>

                                    <button
                                        onClick={() => navigatePostVersion(selectedPostId, 'next')}
                                        disabled={currentVerIndex === totalVersions - 1}
                                        className="p-1 hover:bg-secondary rounded-sm disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-foreground"
                                        aria-label="Next version"
                                    >
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            deletePostVersion(selectedPostId, currentVerIndex);
                                        }}
                                        className="p-1.5 hover:bg-red-500/20 text-muted-foreground hover:text-red-500 rounded transition-colors"
                                        aria-label="Delete version"
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