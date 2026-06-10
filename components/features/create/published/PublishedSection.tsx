"use client"

import { useEffect, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { useShallow } from "zustand/react/shallow"
import { usePublishedPostsStore } from "@/store/published/publishedPageStore"
import { usePostFilters } from "@/hooks/usePostFilters"
import { useFilteredPosts } from "@/hooks/useFilteredPosts"
import { FilterBar } from "@/components/shared/filters/FilterBar"
import { CheckCircle, ExternalLink, FileX, Layers3 } from "lucide-react"
import SectionHeader from '../layout/SectionHeader'
import PostCard from '../shared/PostCard'
import PreviewNotice from "../shared/PreviewNotice"
import { getCreatePreviewCopy, getPreviewPublishedPosts, isCreatePreviewEnabled } from "@/lib/mocks/createSectionPreview"
import { PublishedDetailModal } from "./PublishedDetailModal"
import type { PublishedPost } from "@/store/shared/types"
import { toast } from "sonner"
import { supabaseClient } from "@/lib/supabaseClient"
import ConfirmModal from "@/components/shared/ConfirmModal"

export default function PublishedSection() {
  const t = useTranslations('CreatePage.published')
  const tHeaders = useTranslations('CreatePage.sectionHeaders')
  const tCard = useTranslations('CreatePage.postCard')
  const locale = useLocale()
  
  const { 
    publishedPosts, 
    isLoadingPublishedPosts, 
    publishedPostsHasMore, 
    isLoadingMorePublishedPosts,
    hasLoadedPublishedPosts,
    loadPublishedPosts, 
    loadMorePublishedPosts,
    handleViewPost
  } = usePublishedPostsStore(useShallow((state) => ({
    publishedPosts: state.publishedPosts,
    isLoadingPublishedPosts: state.isLoadingPublishedPosts,
    publishedPostsHasMore: state.publishedPostsHasMore,
    isLoadingMorePublishedPosts: state.isLoadingMorePublishedPosts,
    hasLoadedPublishedPosts: state.hasLoadedPublishedPosts,
    loadPublishedPosts: state.loadPublishedPosts,
    loadMorePublishedPosts: state.loadMorePublishedPosts,
    handleViewPost: state.handleViewPost,
  })))

  const { platformFilter, dateFilter, searchTerm, setPlatformFilter, setDateFilter, setSearchTerm } = usePostFilters()
  const previewPosts = useMemo(() => getPreviewPublishedPosts(), [])
  const isPreviewMode = isCreatePreviewEnabled() && hasLoadedPublishedPosts && publishedPosts.length === 0
  const previewCopy = useMemo(() => getCreatePreviewCopy(locale), [locale])
  const displayPosts = isPreviewMode ? previewPosts : publishedPosts
  const filteredPosts = useFilteredPosts(displayPosts, searchTerm, platformFilter, dateFilter)
  const linkedPostCount = displayPosts.filter((post) => Boolean(post.url)).length
  const publishedPlatforms = new Set(displayPosts.map((post) => post.platform).filter(Boolean)).size
  const [selectedPost, setSelectedPost] = useState<PublishedPost | null>(null)
  const [postToUnpublish, setPostToUnpublish] = useState<PublishedPost | null>(null)

  const handleUnpublishConfirm = async () => {
    const target = postToUnpublish
    if (!target) return
    const { data: { session } } = await supabaseClient.auth.getSession()
    if (!session?.access_token) { toast.error(t('loginRequired')); return }
    const toastId = toast.loading(t('unpublishing'))
    try {
      const res = await fetch(`/api/schedule/posts/${target.id}/unpublish`, {
        method: 'POST',
        headers: { 'authorization': `Bearer ${session.access_token}` },
      })
      const json = await res.json().catch(() => ({} as Record<string, unknown>))
      if (!res.ok) {
        const errObj = json as { error?: unknown; message?: string }
        const msg = typeof errObj.error === 'string'
          ? errObj.error
          : (errObj.error as { message?: string })?.message || errObj.message || t('unpublishFailed')
        throw new Error(msg)
      }
      usePublishedPostsStore.setState((s) => ({
        publishedPosts: s.publishedPosts.filter((p) => String(p.id) !== String(target.id)),
      }))
      toast.success(t('unpublishSuccess'), { id: toastId })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('unpublishFailed'), { id: toastId })
    } finally {
      setPostToUnpublish(null)
    }
  }

  useEffect(() => {
    loadPublishedPosts()
  }, [loadPublishedPosts])

  // Initial loading state (only if no posts are loaded yet)
  if (isLoadingPublishedPosts && publishedPosts.length === 0) {
    return (
      <div className="w-full max-w-none mx-4 mt-4 overflow-hidden h-full flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-foreground/80">{t('loading')}</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-none py-2 lg:py-3 overflow-hidden h-full flex flex-col">
      <SectionHeader icon={CheckCircle} title={tHeaders('published.title')} description={tHeaders('published.description')} />
      
      <div className="px-4 lg:px-6 py-3">
        <div className="mb-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{t('statPublishedOutput')}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{displayPosts.length}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{t('statLinkedPosts')}</p>
            <p className="mt-2 inline-flex items-center gap-2 text-2xl font-semibold text-foreground">
              <ExternalLink className="h-5 w-5 text-primary" />
              {linkedPostCount}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{t('statActivePlatforms')}</p>
            <p className="mt-2 inline-flex items-center gap-2 text-2xl font-semibold text-foreground">
              <Layers3 className="h-5 w-5 text-emerald-500" />
              {publishedPlatforms}
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
            <p className="text-muted-foreground">{tCard('emptyPublished')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={{
                  id: String(post.id),
                  platform: post.platform,
                  content: post.content,
                  created_at: post.time,
                  status: post.status,
                  url: post.url ?? undefined
                }}
                variant="published"
                onClick={() => setSelectedPost(post)}
                onViewDetails={() => setSelectedPost(post)}
                onOpenExternal={() => post.url && handleViewPost(post.url)}
              />
            ))}
          </div>
        )}

        {/* Load More Button */}
        {publishedPostsHasMore && !isPreviewMode && (
          <div className="flex justify-center py-4">
            <Button
              onClick={() => loadMorePublishedPosts()}
              disabled={isLoadingMorePublishedPosts}
              className="bg-gradient-to-r from-utc-royal to-utc-sky text-white"
            >
              {isLoadingMorePublishedPosts ? t('loadingMore') : t('loadMore')}
            </Button>
          </div>
        )}
      </div>

      <PublishedDetailModal
        open={!!selectedPost}
        post={selectedPost}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPost(null)
          }
        }}
        onOpenExternal={handleViewPost}
        onUnpublish={(post) => { setSelectedPost(null); setPostToUnpublish(post) }}
      />

      <ConfirmModal
        isOpen={!!postToUnpublish}
        onClose={() => setPostToUnpublish(null)}
        onConfirm={handleUnpublishConfirm}
        title={t('unpublishTitle')}
        description={postToUnpublish ? t('unpublishDescription', { platform: postToUnpublish.platform }) : ''}
        confirmText={t('unpublishConfirm')}
        variant="danger"
      />
    </div>
  )
}
