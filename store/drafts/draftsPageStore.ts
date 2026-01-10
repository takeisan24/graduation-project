/**
 * Drafts Store
 * 
 * Manages draft posts: save, edit, delete, publish
 */

import { create } from 'zustand';
import { saveToLocalStorage, loadFromLocalStorage } from '@/lib/utils/storage';
import { toast } from 'sonner';
import { DRAFT_ERRORS } from '@/lib/messages/errors';
import type { DraftPost, MediaFile } from '../shared/types';

interface DraftsState {
  // State
  draftPosts: DraftPost[];
  isSavingDraft: boolean;

  // Actions
  handleSaveDraft: (postId: number, content: string, media: MediaFile[], platform: string) => void;
  handleEditDraft: (post: DraftPost, onOpenPost?: (platform: string, content: string, mediaUrls?: string[]) => void) => void;
  handleDeleteDraft: (id: number) => void;
  handlePublishDraft: (id: number, onPublish?: (postId: number) => void) => void;
}

export const useDraftsStore = create<DraftsState>((set, get) => ({
  // Initial state - load from localStorage
  draftPosts: loadFromLocalStorage<DraftPost[]>('draftPosts', []),
  isSavingDraft: false,

  /**
   * Lưu bản nháp vào localStorage (KHÔNG lưu vào database)
   * - Chỉ lưu vào localStorage
   * - Bao gồm cả media URLs
   * - Khi user delete draft, sẽ xóa khỏi localStorage
   */
  handleSaveDraft: (postId, content, media, platform) => {
    set({ isSavingDraft: true });
    try {
      // Yêu cầu: Không lưu nháp nếu nội dung rỗng
      if (!content.trim()) {
        toast.warning(DRAFT_ERRORS.CANNOT_SAVE_EMPTY);
        return;
      }

      // Lấy media URLs của post này
      const mediaUrls: string[] = [];
      
      // Lưu media URLs (chỉ lưu URLs, không lưu File objects vì không thể serialize)
      for (const mediaItem of media) {
        if (mediaItem.preview) {
          // Lưu preview URL (có thể là blob URL hoặc http URL)
          mediaUrls.push(mediaItem.preview);
        }
      }

      const draft: DraftPost = {
        id: postId,
        platform: platform,
        content,
        time: new Date().toISOString(),
        status: 'draft',
        media: mediaUrls.length > 0 ? mediaUrls : undefined // Lưu media URLs
      };

      const updatedDrafts = [
        ...get().draftPosts.filter(d => d.id !== postId), // Xóa bản nháp cũ (nếu có)
        draft // Thêm bản nháp mới/cập nhật
      ];

      // CHỈ LƯU VÀO localStorage - KHÔNG GỌI API
      set({ draftPosts: updatedDrafts });
      saveToLocalStorage('draftPosts', updatedDrafts);

      // Hiển thị thông báo thành công
      toast.success(`Đã lưu bản nháp thành công!${mediaUrls.length > 0 ? ` (${mediaUrls.length} media)` : ''}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Lỗi không xác định.";
      console.error("Lỗi khi lưu bản nháp:", error);
      toast.error(DRAFT_ERRORS.SAVE_FAILED(errorMessage));
    } finally {
      // Luôn tắt trạng thái loading sau 1 giây để người dùng thấy phản hồi
      setTimeout(() => {
        set({ isSavingDraft: false });
      }, 1000);
    }
  },

  handleEditDraft: (post, onOpenPost) => {
    // Hàm này sẽ gọi callback để mở post trong editor
    // Truyền media URLs để load lại media khi mở draft
    if (onOpenPost) {
      onOpenPost(post.platform, post.content, post.media || []);
    }
    // Note: activeSection should be set by calling component
  },

  handleDeleteDraft: (id) => {
    set(state => {
      const draftToDelete = state.draftPosts.find(p => p.id === id);
      if (!draftToDelete) {
        toast.error(DRAFT_ERRORS.DRAFT_NOT_FOUND_DELETE);
        return {};
      }

      const updated = state.draftPosts.filter(p => p.id !== id);
      saveToLocalStorage('draftPosts', updated);

      toast.success("Đã xóa bản nháp thành công.");
      
      return { draftPosts: updated };
    });
  },

  handlePublishDraft: (id, onPublish) => {
    const { draftPosts } = get();
    const draft = draftPosts.find(p => p.id === id);
    if (draft && onPublish) {
      // Call publish callback (should be provided by create store)
      onPublish(id);
      // Delete draft after publishing
      get().handleDeleteDraft(id);
    }
  },
}));

