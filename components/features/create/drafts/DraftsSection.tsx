"use client"

import { usePostFilters } from "@/hooks/usePostFilters"
import { useFilteredPosts } from "@/hooks/useFilteredPosts"
import { FilterBar } from "@/components/shared/filters/FilterBar"
import { PlatformIcon } from "@/components/shared/PlatformIcon"
import { formatDate } from "@/lib/utils/date"
import { useTranslations } from 'next-intl'
import { FileText } from 'lucide-react'
import SectionHeader from '../layout/SectionHeader'

import { useDraftsStore, useCreatePostsStore, useNavigationStore } from "@/store"
import { useShallow } from 'zustand/react/shallow'


/**
 * Drafts section component for managing draft posts
 * Displays a list of draft posts with filtering, searching, and management options
 */
export default function DraftsSection() {
  const t = useTranslations('CreatePage.draftsSection');
  
  const { draftPosts, onEditDraft, onDeleteDraft } = useDraftsStore(
    useShallow((state) => ({
      draftPosts: state.draftPosts,
      onEditDraft: state.handleEditDraft,
      onDeleteDraft: state.handleDeleteDraft,
      onPublishDraft: state.handlePublishDraft,
    }))
  )
  // Lấy hàm mở post trong editor và hàm đổi section để khi click bản nháp sẽ nhảy sang trang tạo bài viết
  const openPostFromUrl = useCreatePostsStore(state => state.openPostFromUrl)
  const setActiveSection = useNavigationStore(state => state.setActiveSection)
  const { platformFilter, dateFilter, searchTerm, setPlatformFilter, setDateFilter, setSearchTerm } = usePostFilters()
  const filteredPosts = useFilteredPosts(draftPosts, searchTerm, platformFilter, dateFilter)

  const tHeaders = useTranslations('CreatePage.sectionHeaders');

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

      {/* Draft Posts List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
        <div className="space-y-[1px]">
          {filteredPosts.map((post) => (
            <div 
              key={post.id} 
              className="group rounded-xl hover:bg-primary/70 transition-colors cursor-pointer"
              onClick={() =>
                onEditDraft(post, (platform, content, mediaUrls) => {
                  // Khi user click 1 bản nháp:
                  // - Chuyển sang section 'create' để hiển thị trang chỉnh sửa
                  // - Mở post tương ứng trong editor, kèm media URLs nếu có
                  setActiveSection('create')
                  openPostFromUrl(platform, content, undefined, mediaUrls)
                })
              }
            >
              <div className="flex items-center px-2 lg:px-4 py-2 lg:py-3 w-full">
                {/* Left: platform icon + content */}
                <div className="flex items-center gap-2 lg:gap-3 flex-1 min-w-0">
                  <PlatformIcon 
                    platform={post.platformIcon || post.platform}
                    size={24}
                    variant="inline"
                    className="lg:w-[27px] lg:h-[27px]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground/90 truncate flex-1 min-w-0 text-sm lg:text-base">
                      {post.content}
                    </div>
                  </div>
                </div>
                
                {/* Right: date and trash */}
                <div className="flex items-center gap-2 lg:gap-3 ml-2 lg:ml-4 flex-shrink-0">
                  <span className="text-xs lg:text-sm text-foreground/80 whitespace-nowrap">
                    {formatDate(post.time, 'vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                  </span>
                  <button
                    className="w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center rounded hover:bg-secondary"
                    onClick={(e) => { e.stopPropagation(); onDeleteDraft(post.id) }}
                    aria-label="Xóa bản nháp"
                  >
                    <img src="/icons/sidebar/Trash.svg" alt="Delete" className="opacity-80 w-4 h-4 lg:w-[19px] lg:h-[19px]" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
