"use client"

import { useEffect, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { useShallow } from "zustand/react/shallow"
import { useFailedPostsStore } from "@/store/failed/failedPageStore"
import { usePostFilters } from "@/hooks/usePostFilters"
import { useFilteredPosts } from "@/hooks/useFilteredPosts"
import { FilterBar } from "@/components/shared/filters/FilterBar"
import { RetryDetailModal } from "./RetryDetailModal"
import { ConfirmDeleteFailedPostModal } from "./ConfirmDeleteFailedPostModal"
import { LoadingModal, SuccessModal } from "./GenericStatusModals"
import { FailedPost } from "@/store/shared/types"
import { FileX, XCircle } from "lucide-react"
import SectionHeader from '../layout/SectionHeader'
import PostCard from '../shared/PostCard'

export default function FailedSection() {
  const t = useTranslations('CreatePage.failed')
  const tHeaders = useTranslations('CreatePage.sectionHeaders')
  const tCard = useTranslations('CreatePage.postCard')
  
  const { 
    failedPosts, 
    isLoadingFailedPosts, 
    failedPostsHasMore, 
    isLoadingMoreFailedPosts,
    loadFailedPosts, 
    loadMoreFailedPosts,
    handleRetryPost,
    handleDeleteFailedPost
  } = useFailedPostsStore(useShallow((state) => ({
    failedPosts: state.failedPosts,
    isLoadingFailedPosts: state.isLoadingFailedPosts,
    failedPostsHasMore: state.failedPostsHasMore,
    isLoadingMoreFailedPosts: state.isLoadingMoreFailedPosts,
    loadFailedPosts: state.loadFailedPosts,
    loadMoreFailedPosts: state.loadMoreFailedPosts,
    handleRetryPost: state.handleRetryPost,
    handleDeleteFailedPost: state.handleDeleteFailedPost,
  })))

  const { platformFilter, dateFilter, searchTerm, setPlatformFilter, setDateFilter, setSearchTerm } = usePostFilters()
  
  // Cast failedPosts if needed
  const filteredPosts = useFilteredPosts(failedPosts as any[], searchTerm, platformFilter, dateFilter) as FailedPost[]

  // Modal States
  const [retryModalState, setRetryModalState] = useState<{ type: 'detail' | 'loading' | 'success', post: FailedPost | null } | null>(null)
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null)

  useEffect(() => {
    loadFailedPosts()
  }, [loadFailedPosts])

  const handleRetryClick = useCallback((post: FailedPost) => {
    setRetryModalState({ type: 'detail', post })
  }, [])

  const handleDeleteClick = useCallback((id: string | number) => {
    setDeleteModalId(String(id))
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
    // Assuming handleRetryPost without date/time triggers logic to open editor/retry immediately
    handleRetryPost(post.id) 
  }, [handleRetryPost])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteModalId) return
    await handleDeleteFailedPost(deleteModalId)
    setDeleteModalId(null)
  }, [deleteModalId, handleDeleteFailedPost])

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
              {filteredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={{ id: post.id, platform: post.platform, content: post.content, created_at: post.created_at, error_message: post.error_message }}
                  variant="failed"
                  onRetry={() => handleRetryClick(post)}
                  onDelete={() => handleDeleteClick(post.id)}
                />
              ))}
            </div>
          )}

          {/* Load More Button */}
          {failedPostsHasMore && (
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
      />
      
      <LoadingModal isOpen={retryModalState?.type === 'loading'} />
      
      <SuccessModal 
        isOpen={retryModalState?.type === 'success'} 
        onClose={() => setRetryModalState(null)} 
      />
      
      <ConfirmDeleteFailedPostModal
        isOpen={!!deleteModalId}
        onClose={() => setDeleteModalId(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}