"use client"

import { useEffect } from "react"
import { usePostFilters } from "@/hooks/usePostFilters"
import { useFilteredPosts } from "@/hooks/useFilteredPosts"
import { FilterBar } from "@/components/shared/filters/FilterBar"
import { useTranslations } from 'next-intl'
import { FileText, FileX } from 'lucide-react'
import SectionHeader from '../layout/SectionHeader'
import PostCard from '../shared/PostCard'

import { useDraftsStore, useCreatePostsStore } from "@/store"
import { useShallow } from 'zustand/react/shallow'
import { useSectionNavigation } from "@/hooks/useSectionNavigation"


/**
 * Drafts section component for managing draft posts
 * Displays a list of draft posts with filtering, searching, and management options
 */
export default function DraftsSection() {
  const { draftPosts, onEditDraft, onDeleteDraft, loadDrafts } = useDraftsStore(
    useShallow((state) => ({
      draftPosts: state.draftPosts,
      onEditDraft: state.handleEditDraft,
      onDeleteDraft: state.handleDeleteDraft,
      loadDrafts: state.loadDrafts,
    }))
  )
  // Lấy hàm mở post trong editor và hàm đổi section để khi click bản nháp sẽ nhảy sang trang tạo bài viết
  const openPostFromUrl = useCreatePostsStore(state => state.openPostFromUrl)
  const navigateToSection = useSectionNavigation()
  const { platformFilter, dateFilter, searchTerm, setPlatformFilter, setDateFilter, setSearchTerm } = usePostFilters()
  const filteredPosts = useFilteredPosts(draftPosts, searchTerm, platformFilter, dateFilter)

  const tHeaders = useTranslations('CreatePage.sectionHeaders');
  const tCard = useTranslations('CreatePage.postCard');

  useEffect(() => {
    void loadDrafts()
  }, [loadDrafts])

  return (
    <div className="w-full max-w-none overflow-hidden h-full flex flex-col">
      <SectionHeader icon={FileText} title={tHeaders('drafts.title')} description={tHeaders('drafts.description')} />
      
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

      {/* Draft Posts Grid */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 pb-4">
        {filteredPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <FileX className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{tCard('emptyDrafts')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={{ id: String(post.id), platform: post.platform, content: post.content, created_at: post.time }}
                variant="draft"
                onClick={() =>
                  onEditDraft(post, (platform, content, mediaUrls) => {
                    navigateToSection('create')
                    openPostFromUrl(platform, content, undefined, mediaUrls, undefined, undefined, {
                      forceNewPost: true,
                      context: {
                        source: 'drafts',
                        draftId: String(post.id),
                        projectId: post.projectId,
                      }
                    })
                  })
                }
                onEdit={() =>
                  onEditDraft(post, (platform, content, mediaUrls) => {
                    navigateToSection('create')
                    openPostFromUrl(platform, content, undefined, mediaUrls, undefined, undefined, {
                      forceNewPost: true,
                      context: {
                        source: 'drafts',
                        draftId: String(post.id),
                        projectId: post.projectId,
                      }
                    })
                  })
                }
                onDelete={() => onDeleteDraft(post.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
