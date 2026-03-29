"use client"

import { useEffect, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { useShallow } from "zustand/react/shallow"
import { useFailedPostsStore } from "@/store/failed/failedPageStore"
import { usePostFilters } from "@/hooks/usePostFilters"
import { useFilteredPosts } from "@/hooks/useFilteredPosts"
import { FilterBar } from "@/components/shared/filters/FilterBar"
import { FailedPostItem } from "./FailedPostItem"
import { RetryDetailModal } from "./RetryDetailModal"
import { ConfirmDeleteFailedPostModal } from "./ConfirmDeleteFailedPostModal"
import { LoadingModal, SuccessModal } from "./GenericStatusModals"
import { FailedPost } from "@/store/shared/types"
import { XCircle } from "lucide-react"
import SectionHeader from '../layout/SectionHeader'

// Helper to get mock accounts if profile data is missing
const getAccountsForPlatform = (platform: string) => {
  const mockAccounts = {
    'Twitter': [{ username: '@whatevername', profilePic: '/shego.jpg' }],
    'Instagram': [{ username: '@instagram_user', profilePic: '/shego.jpg' }],
    'LinkedIn': [{ username: 'LinkedIn User', profilePic: '/shego.jpg' }],
    'Facebook': [{ username: 'Facebook User', profilePic: '/shego.jpg' }],
    'Threads': [{ username: '@threads_user', profilePic: '/shego.jpg' }],
    'YouTube': [{ username: 'YouTube Channel', profilePic: '/shego.jpg' }],
    'TikTok': [{ username: '@tiktok_user', profilePic: '/shego.jpg' }],
    'Pinterest': [{ username: 'Pinterest User', profilePic: '/shego.jpg' }]
  }
  return mockAccounts[platform as keyof typeof mockAccounts] || [{ username: 'Unknown Account', profilePic: '/shego.jpg' }]
}

export default function FailedSection() {
  const t = useTranslations('CreatePage.failed')
  const tHeaders = useTranslations('CreatePage.sectionHeaders')
  
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
        
        <FilterBar 
          platformFilter={platformFilter}
          dateFilter={dateFilter}
          searchTerm={searchTerm}
          onPlatformChange={setPlatformFilter}
          onDateChange={setDateFilter}
          onSearchChange={setSearchTerm}
        />
        
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div className="space-y-[1px] pb-4">
            {filteredPosts && filteredPosts.length > 0 ? (
              filteredPosts.map((post) => {
                // Determine account info for display
                const account = post.profileName && post.profilePic
                  ? { username: post.profileName, profilePic: post.profilePic }
                  : getAccountsForPlatform(post.platform)[0]

                return (
                  <FailedPostItem 
                    key={post.id} 
                    post={post} 
                    account={account}
                    onRetry={() => handleRetryClick(post)}
                    onDelete={() => handleDeleteClick(post.id)}
                  />
                )
              })
            ) : (
             !isLoadingFailedPosts && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <p>No failed posts found</p>
                </div>
             )
            )}
          </div>
          
          {/* Load More Button */}
          {failedPostsHasMore && (
            <div className="flex justify-center py-4">
              <button
                onClick={() => loadMoreFailedPosts()}
                disabled={isLoadingMoreFailedPosts}
                className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingMoreFailedPosts ? t('loadingMore') : t('loadMore')}
              </button>
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