"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { useShallow } from "zustand/react/shallow"
import { useFailedPostsStore } from "@/store/failed/failedPageStore"
import { usePostFilters } from "@/hooks/usePostFilters"
import { useFilteredPosts } from "@/hooks/useFilteredPosts"
import { FilterBar } from "@/components/shared/filters/FilterBar"
import { RetryDetailModal } from "./RetryDetailModal"
import { LoadingModal, SuccessModal } from "./GenericStatusModals"
import { FailedPost } from "@/store/shared/types"
import { FileX, RotateCcw, TriangleAlert, XCircle } from "lucide-react"
import SectionHeader from '../layout/SectionHeader'
import PostCard from '../shared/PostCard'
import { useCreatePostsStore } from "@/store"
import { useSectionNavigation } from "@/hooks/useSectionNavigation"
import PreviewNotice from "../shared/PreviewNotice"
import { getCreatePreviewCopy, getPreviewFailedPosts, isCreatePreviewEnabled } from "@/lib/mocks/createSectionPreview"
import { getFailedRecoveryPresentation } from "./failedPostRecovery"

export default function FailedSection() {
  const t = useTranslations('CreatePage.failed')
  const tHeaders = useTranslations('CreatePage.sectionHeaders')
  const tCard = useTranslations('CreatePage.postCard')
  const locale = useLocale()
  
  const { 
    failedPosts, 
    isLoadingFailedPosts, 
    failedPostsHasMore, 
    isLoadingMoreFailedPosts,
    hasLoadedFailedPosts,
    loadFailedPosts, 
    loadMoreFailedPosts,
    handleRetryPost
  } = useFailedPostsStore(useShallow((state) => ({
    failedPosts: state.failedPosts,
    isLoadingFailedPosts: state.isLoadingFailedPosts,
    failedPostsHasMore: state.failedPostsHasMore,
    isLoadingMoreFailedPosts: state.isLoadingMoreFailedPosts,
    hasLoadedFailedPosts: state.hasLoadedFailedPosts,
    loadFailedPosts: state.loadFailedPosts,
    loadMoreFailedPosts: state.loadMoreFailedPosts,
    handleRetryPost: state.handleRetryPost,
  })))

  const { platformFilter, dateFilter, searchTerm, setPlatformFilter, setDateFilter, setSearchTerm } = usePostFilters()
  const navigateToSection = useSectionNavigation()
  const openPostFromUrl = useCreatePostsStore((state) => state.openPostFromUrl)

  const previewPosts = useMemo(() => getPreviewFailedPosts(), [])
  const isPreviewMode = isCreatePreviewEnabled() && hasLoadedFailedPosts && failedPosts.length === 0
  const previewCopy = useMemo(() => getCreatePreviewCopy(locale), [locale])
  const displayPosts = isPreviewMode ? previewPosts : failedPosts
  const filterableFailedPosts = displayPosts.map((post) => ({
    ...post,
    time: post.scheduledAt || `${post.date}T${post.time || "00:00"}`,
  }))
  const filteredPosts = useFilteredPosts(filterableFailedPosts, searchTerm, platformFilter, dateFilter)
  const retryReadyCount = displayPosts.filter((post) => Boolean(post.lateJobId)).length
  const failedPlatforms = new Set(displayPosts.map((post) => post.platform).filter(Boolean)).size

  // Modal States
  const [retryModalState, setRetryModalState] = useState<{ type: 'detail' | 'loading' | 'success', post: FailedPost | null } | null>(null)

  useEffect(() => {
    loadFailedPosts()
  }, [loadFailedPosts])

  const handleRetryClick = useCallback((post: FailedPost) => {
    setRetryModalState({ type: 'detail', post })
  }, [])

  const handleConfirmReschedule = useCallback(async (post: FailedPost, date: string, time: string) => {
    if (retryModalState?.type !== 'detail' || !retryModalState.post || retryModalState.post.id !== post.id) return

    setRetryModalState({ type: 'loading', post: post })
    const success = await handleRetryPost(post.id, date, time)
    
    if (success) {
      setRetryModalState({ type: 'success', post: null })
      // Toast handles success message
    } else {
      setRetryModalState({ type: 'detail', post: post }) 
    }
  }, [handleRetryPost, retryModalState])

  const handleEditInEditor = useCallback((post: FailedPost) => {
    setRetryModalState(null)
    navigateToSection('create')
    openPostFromUrl(post.platform, post.content || '', undefined, post.media, undefined, undefined, {
      forceNewPost: true,
      context: {
        source: 'failed',
        scheduledPostId: String(post.id),
      }
    })
  }, [navigateToSection, openPostFromUrl])

  // Initial loading state
  if (isLoadingFailedPosts && failedPosts.length === 0) {
    return (
      <div className="w-full max-w-none mx-4 mt-4 overflow-hidden h-full flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-foreground/80">{t('loading')}</p>
      </div>
    )
  }

  return (
    <>
      <div className="w-full max-w-none py-2 lg:py-3 overflow-hidden h-full flex flex-col">
        <SectionHeader icon={XCircle} title={tHeaders('failed.title')} description={tHeaders('failed.description')} />
        
        <div className="px-4 lg:px-6 py-3">
          <div className="mb-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Pipeline errors</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{displayPosts.length}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Retry ready</p>
              <p className="mt-2 inline-flex items-center gap-2 text-2xl font-semibold text-foreground">
                <RotateCcw className="h-5 w-5 text-primary" />
                {retryReadyCount}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Affected platforms</p>
              <p className="mt-2 inline-flex items-center gap-2 text-2xl font-semibold text-foreground">
                <TriangleAlert className="h-5 w-5 text-rose-500" />
                {failedPlatforms}
              </p>
            </div>
          </div>
          {isPreviewMode ? (
            <PreviewNotice badge={previewCopy.badge} description={previewCopy.emptyDescription} className="mb-3" />
          ) : null}
          <FilterBar
            platformFilter={platformFilter}
            dateFilter={dateFilter}
            searchTerm={searchTerm}
            onPlatformChange={setPlatformFilter}
            onDateChange={setDateFilter}
            onSearchChange={setSearchTerm}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 lg:px-6 pb-4">
          {filteredPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <FileX className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">{tCard('emptyFailed')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredPosts.map((post) => {
                const recovery = getFailedRecoveryPresentation(post, locale)
                return (
                <PostCard
                  key={post.id}
                  post={{
                    id: post.id,
                    platform: post.platform,
                    content: post.content,
                    created_at: post.date,
                    error_message: recovery.title
                  }}
                  variant="failed"
                  onClick={() => handleRetryClick(post)}
                  onEdit={() => handleEditInEditor(post)}
                  onViewDetails={() => handleRetryClick(post)}
                />
                )
              })}
            </div>
          )}

          {/* Load More Button */}
          {failedPostsHasMore && !isPreviewMode && (
            <div className="flex justify-center py-4">
              <Button
                onClick={() => loadMoreFailedPosts()}
                disabled={isLoadingMoreFailedPosts}
                className="bg-gradient-to-r from-utc-royal to-utc-sky text-white"
              >
                {isLoadingMoreFailedPosts ? t('loadingMore') : t('loadMore')}
              </Button>
            </div>
          )}
        </div>
      </div>
      
      {/* Modals */}
      <RetryDetailModal
        post={retryModalState?.type === 'detail' ? retryModalState.post : null}
        onClose={() => setRetryModalState(null)}
        onConfirmReschedule={handleConfirmReschedule}
        onEdit={() => retryModalState?.post && handleEditInEditor(retryModalState.post)}
        isPreview={isPreviewMode}
      />
      
      <LoadingModal isOpen={retryModalState?.type === 'loading'} />
      
      <SuccessModal 
        isOpen={retryModalState?.type === 'success'} 
        onClose={() => setRetryModalState(null)} 
      />
    </>
  )
}
