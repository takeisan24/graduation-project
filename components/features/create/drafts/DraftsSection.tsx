"use client"

import { useEffect, useMemo, useState } from "react"
import { usePostFilters } from "@/hooks/usePostFilters"
import { useFilteredPosts } from "@/hooks/useFilteredPosts"
import { FilterBar } from "@/components/shared/filters/FilterBar"
import { useLocale, useTranslations } from 'next-intl'
import { FileText, FileX } from 'lucide-react'
import SectionHeader from '../layout/SectionHeader'
import PostCard from '../shared/PostCard'
import PreviewNotice from "../shared/PreviewNotice"
import ConfirmModal from "@/components/shared/ConfirmModal"

import { useDraftsStore, useCreatePostsStore } from "@/store"
import { useShallow } from 'zustand/react/shallow'
import { useSectionNavigation } from "@/hooks/useSectionNavigation"
import { getCreatePreviewCopy, getPreviewDraftPosts, isCreatePreviewEnabled } from "@/lib/mocks/createSectionPreview"
import type { DraftPost } from "@/store/shared/types"


/**
 * Drafts section component for managing draft posts
 * Displays a list of draft posts with filtering, searching, and management options
 */
export default function DraftsSection() {
  const { draftPosts, onEditDraft, onDeleteDraft, loadDrafts, hasLoadedDrafts } = useDraftsStore(
    useShallow((state) => ({
      draftPosts: state.draftPosts,
      onEditDraft: state.handleEditDraft,
      onDeleteDraft: state.handleDeleteDraft,
      loadDrafts: state.loadDrafts,
      hasLoadedDrafts: state.hasLoadedDrafts,
    }))
  )
  const locale = useLocale()
  const openPostFromUrl = useCreatePostsStore(state => state.openPostFromUrl)
  const navigateToSection = useSectionNavigation()
  const { platformFilter, dateFilter, searchTerm, setPlatformFilter, setDateFilter, setSearchTerm } = usePostFilters()
  const [previewPosts, setPreviewPosts] = useState(() => getPreviewDraftPosts())
  const [pendingDeleteDraft, setPendingDeleteDraft] = useState<DraftPost | null>(null)
  const isPreviewMode = isCreatePreviewEnabled() && hasLoadedDrafts && draftPosts.length === 0
  const previewCopy = useMemo(() => getCreatePreviewCopy(locale), [locale])
  const displayPosts = isPreviewMode ? previewPosts : draftPosts
  const filteredPosts = useFilteredPosts(displayPosts, searchTerm, platformFilter, dateFilter)

  const tHeaders = useTranslations('CreatePage.sectionHeaders');
  const tCard = useTranslations('CreatePage.postCard');

  useEffect(() => {
    void loadDrafts()
  }, [loadDrafts])

  return (
    <div className="w-full max-w-none overflow-hidden h-full flex flex-col">
      <SectionHeader icon={FileText} title={tHeaders('drafts.title')} description={tHeaders('drafts.description')} />
      
      <div className="px-4 lg:px-6 py-3">
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
                onDelete={() => {
                  setPendingDeleteDraft(post)
                }}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!pendingDeleteDraft}
        onClose={() => setPendingDeleteDraft(null)}
        onConfirm={() => {
          if (!pendingDeleteDraft) return
          if (isPreviewMode) {
            setPreviewPosts((current) => current.filter((item) => String(item.id) !== String(pendingDeleteDraft.id)))
            return
          }
          void onDeleteDraft(pendingDeleteDraft.id)
        }}
        title={tCard('deleteTitle')}
        description={tCard('deleteDescription')}
        confirmText={tCard('delete')}
        cancelText={tCard('cancel')}
        variant="danger"
      />
    </div>
  )
}
