"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useShallow } from "zustand/react/shallow"
import { usePublishedPostsStore } from "@/store/published/publishedPageStore"
import { usePostFilters } from "@/hooks/usePostFilters"
import { useFilteredPosts } from "@/hooks/useFilteredPosts"
import { FilterBar } from "@/components/shared/filters/FilterBar"
import { PlatformIcon } from "@/components/shared/PlatformIcon"
import { formatDate } from "@/lib/utils/date"
import { PublishedPost } from "@/store/shared/types"
import { ExternalLink, Trash2, Heart, MessageCircle, Share2, CheckCircle } from "lucide-react"
import SectionHeader from '../layout/SectionHeader'

export default function PublishedSection() {
  const t = useTranslations('CreatePage.published')
  const tHeaders = useTranslations('CreatePage.sectionHeaders')
  
  const { 
    publishedPosts, 
    isLoadingPublishedPosts, 
    publishedPostsHasMore, 
    isLoadingMorePublishedPosts,
    loadPublishedPosts, 
    loadMorePublishedPosts,
    handleViewPost,
    handleDeletePost
  } = usePublishedPostsStore(useShallow((state) => ({
    publishedPosts: state.publishedPosts,
    isLoadingPublishedPosts: state.isLoadingPublishedPosts,
    publishedPostsHasMore: state.publishedPostsHasMore,
    isLoadingMorePublishedPosts: state.isLoadingMorePublishedPosts,
    loadPublishedPosts: state.loadPublishedPosts,
    loadMorePublishedPosts: state.loadMorePublishedPosts,
    handleViewPost: state.handleViewPost,
    handleDeletePost: state.handleDeletePost,
  })))

  const { platformFilter, dateFilter, searchTerm, setPlatformFilter, setDateFilter, setSearchTerm } = usePostFilters()
  
  // Cast if necessary
  const filteredPosts = useFilteredPosts(publishedPosts as any[], searchTerm, platformFilter, dateFilter) as PublishedPost[]

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
            filteredPosts.map((post) => (
              <div 
                key={post.id} 
                className="group rounded-xl bg-card hover:bg-muted transition-colors border border-border p-3 lg:p-4 mb-2 cursor-pointer flex flex-col sm:flex-row gap-3"
                onClick={() => post.url && handleViewPost(post.url)}
              >
                {/* Icon & Content */}
                <div className="flex-1 min-w-0 flex gap-3">
                  <div className="flex-shrink-0 pt-1">
                    <PlatformIcon 
                      platform={post.platform} 
                      size={24} 
                      className="opacity-90"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                     <p className="text-sm lg:text-base text-foreground/90 line-clamp-2 mb-2">
                       {post.content}
                     </p>
                     
                     {/* Mobile Engagement Stats (visible on small screens) */}
                     <div className="flex sm:hidden items-center gap-4 text-xs text-muted-foreground mb-1">
                        <div className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          <span>{post.engagement?.likes || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          <span>{post.engagement?.comments || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Share2 className="w-3 h-3" />
                          <span>{post.engagement?.shares || 0}</span>
                        </div>
                     </div>

                     <div className="flex items-center gap-2 text-xs text-muted-foreground">
                       <span>{formatDate(post.time, 'vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                       {post.url && (
                         <span className="flex items-center gap-1 hover:text-primary transition-colors">
                           <ExternalLink className="w-3 h-3" />
                           {t('open')}
                         </span>
                       )}
                     </div>
                  </div>
                </div>

                {/* Desktop Engagement & Actions */}
                <div className="hidden sm:flex flex-col items-end gap-2 text-right pl-2 border-l border-border min-w-[100px]">
                   <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex flex-col items-center" title="Likes">
                        <Heart className="w-3.5 h-3.5 mb-0.5" />
                        <span>{post.engagement?.likes || 0}</span>
                      </div>
                      <div className="flex flex-col items-center" title="Comments">
                        <MessageCircle className="w-3.5 h-3.5 mb-0.5" />
                        <span>{post.engagement?.comments || 0}</span>
                      </div>
                      <div className="flex flex-col items-center" title="Shares">
                        <Share2 className="w-3.5 h-3.5 mb-0.5" />
                        <span>{post.engagement?.shares || 0}</span>
                      </div>
                   </div>
                   
                   <div className="mt-auto">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(t('confirmDelete'))) {
                             handleDeletePost(post.id);
                          }
                        }}
                        className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-red-400 transition-colors"
                        title={t('deleteFromList')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                   </div>
                </div>
              </div>
            ))
          ) : (
             !isLoadingPublishedPosts && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <p>{t('noPublishedPosts')}</p>
                </div>
             )
          )}
        </div>
        
        {/* Load More Button */}
        {publishedPostsHasMore && (
          <div className="flex justify-center py-4">
            <button
              onClick={() => loadMorePublishedPosts()}
              disabled={isLoadingMorePublishedPosts}
              className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingMorePublishedPosts ? t('loadingMore') : t('loadMore')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}