"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { useShallow } from "zustand/react/shallow"
import { usePublishedPostsStore } from "@/store/published/publishedPageStore"
import { usePostFilters } from "@/hooks/usePostFilters"
import { useFilteredPosts } from "@/hooks/useFilteredPosts"
import { FilterBar } from "@/components/shared/filters/FilterBar"
import { CheckCircle, ExternalLink, FileX, Layers3 } from "lucide-react"
import SectionHeader from '../layout/SectionHeader'
import PostCard from '../shared/PostCard'

export default function PublishedSection() {
  const t = useTranslations('CreatePage.published')
  const tHeaders = useTranslations('CreatePage.sectionHeaders')
  const tCard = useTranslations('CreatePage.postCard')
  
  const { 
    publishedPosts, 
    isLoadingPublishedPosts, 
    publishedPostsHasMore, 
    isLoadingMorePublishedPosts,
    loadPublishedPosts, 
    loadMorePublishedPosts,
    handleViewPost
  } = usePublishedPostsStore(useShallow((state) => ({
    publishedPosts: state.publishedPosts,
    isLoadingPublishedPosts: state.isLoadingPublishedPosts,
    publishedPostsHasMore: state.publishedPostsHasMore,
    isLoadingMorePublishedPosts: state.isLoadingMorePublishedPosts,
    loadPublishedPosts: state.loadPublishedPosts,
    loadMorePublishedPosts: state.loadMorePublishedPosts,
    handleViewPost: state.handleViewPost,
  })))

  const { platformFilter, dateFilter, searchTerm, setPlatformFilter, setDateFilter, setSearchTerm } = usePostFilters()
  const filteredPosts = useFilteredPosts(publishedPosts, searchTerm, platformFilter, dateFilter)
  const linkedPostCount = publishedPosts.filter((post) => Boolean(post.url)).length
  const publishedPlatforms = new Set(publishedPosts.map((post) => post.platform).filter(Boolean)).size

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
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Published output</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{publishedPosts.length}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Linked posts</p>
            <p className="mt-2 inline-flex items-center gap-2 text-2xl font-semibold text-foreground">
              <ExternalLink className="h-5 w-5 text-primary" />
              {linkedPostCount}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Active platforms</p>
            <p className="mt-2 inline-flex items-center gap-2 text-2xl font-semibold text-foreground">
              <Layers3 className="h-5 w-5 text-emerald-500" />
              {publishedPlatforms}
            </p>
          </div>
        </div>
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
                post={{ id: String(post.id), platform: post.platform, content: post.content, created_at: post.time, status: post.status }}
                variant="published"
                onClick={() => post.url && handleViewPost(post.url)}
              />
            ))}
          </div>
        )}

        {/* Load More Button */}
        {publishedPostsHasMore && (
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
    </div>
  )
}
