// components/create/editor/PostEditor.tsx
"use client";

import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

import { Button } from '@/components/ui/button';
import { useCreatePostsStore, useCreateSourcesStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { useTranslations } from 'next-intl';
import { Trash2, ChevronLeft, ChevronRight, History, FolderPlus, PenLine } from 'lucide-react';
import CreatorHubIcon from '@/components/shared/CreatorHubIcon';
import { PlatformIcon } from '@/components/shared/PlatformIcon';
import { getPlatformColors } from '@/lib/constants/platformColors';

import TabsManager from './TabsManager';
import MediaPreview from './MediaPreview';
import ActionBar from './ActionBar';

const QUICK_PLATFORMS = [
  { id: 'TikTok', label: 'TikTok' },
  { id: 'Instagram', label: 'Instagram' },
  { id: 'YouTube', label: 'YouTube' },
  { id: 'Facebook', label: 'Facebook' },
  { id: 'Twitter', label: 'X (Twitter)' },
  { id: 'LinkedIn', label: 'LinkedIn' },
]

function EmptyStateInteractive({ onOpenSources }: { onOpenSources?: () => void }) {
  const t = useTranslations('CreatePage.createSection.postPanel');
  const handlePostCreate = useCreatePostsStore(state => state.handlePostCreate);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8 min-h-0">
      {/* Header */}
      <div className="text-center space-y-3">
        <CreatorHubIcon className="w-10 h-10 mx-auto" />
        <div>
          <h3 className="text-lg font-semibold">{t('emptyState.title')}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t('emptyState.description')}</p>
        </div>
      </div>

      {/* Quick create: pick a platform */}
      <div className="w-full max-w-md space-y-3">
        <p className="text-xs font-medium text-muted-foreground text-center uppercase tracking-wider">{t('emptyState.step2.title')}</p>
        <div className="grid grid-cols-3 gap-2">
          {QUICK_PLATFORMS.map(({ id, label }) => {
            const colors = getPlatformColors(id);
            return (
              <Button
                key={id}
                variant="outline"
                onClick={() => handlePostCreate(id)}
                className={`flex items-center gap-2 h-auto px-3 py-2.5 ${colors.border} ${colors.tint} ${colors.darkTint} hover:scale-[1.02] hover:shadow-md active:scale-[0.98] transition-all text-sm`}
              >
                <PlatformIcon platform={id} size={16} />
                <span className="truncate">{label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Or add source */}
      <div className="flex items-center gap-3">
        <div className="h-px w-12 bg-border" />
        <span className="text-xs text-muted-foreground">hoặc</span>
        <div className="h-px w-12 bg-border" />
      </div>

      <Button
        variant="outline"
        className="gap-2"
        onClick={() => onOpenSources?.()}
      >
        <FolderPlus className="h-4 w-4" />
        {t('emptyState.step1.title')}
      </Button>
    </div>
  );
}

export default function PostEditor({ onOpenSources }: { onOpenSources?: () => void } = {}) {
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
                    <EmptyStateInteractive onOpenSources={onOpenSources} />

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
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => navigatePostVersion(selectedPostId, 'prev')}
                                        disabled={currentVerIndex === 0}
                                        className="h-6 w-6 p-0"
                                        aria-label="Previous version"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                    </Button>

                                    <span className="text-[10px] font-mono text-muted-foreground mx-2 min-w-[30px] text-center">
                                        v{currentVerIndex + 1}/{totalVersions}
                                    </span>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => navigatePostVersion(selectedPostId, 'next')}
                                        disabled={currentVerIndex === totalVersions - 1}
                                        className="h-6 w-6 p-0"
                                        aria-label="Next version"
                                    >
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => deletePostVersion(selectedPostId, currentVerIndex)}
                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                        aria-label="Delete version"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        )}
                        {/* ----------------------------------------------------- */}

                        {/* Scrollable textarea */}
                        <Textarea
                            placeholder={`${t('postContentPlaceholder')} ${currentPost?.type || "post"}?`}
                            value={postContents[selectedPostId] ?? ""}
                            onChange={(e) => handlePostContentChange(selectedPostId, e.target.value)}
                            className="flex-1 min-h-0 bg-card border-0 resize-none text-base md:text-sm text-foreground placeholder:text-muted-foreground focus:border-utc-royal/50 focus:ring-2 focus:ring-utc-royal/20 focus:outline-none p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-secondary rounded-none"
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