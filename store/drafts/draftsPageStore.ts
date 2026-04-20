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
import { supabaseClient } from '@/lib/supabaseClient';
import { useCreatePostsStore } from '../create/posts';
import { useCreateWorkspaceStore } from '../create/workspace';

interface BackendDraftRecord {
  id: string;
  project_id: string;
  platform: string | null;
  text_content: string | null;
  media_urls: string[] | null;
  status: 'draft' | 'scheduled' | 'posted' | 'failed';
  updated_at?: string;
  created_at: string;
}

function mapBackendDraftToDraftPost(draft: BackendDraftRecord): DraftPost {
  return {
    id: draft.id,
    platform: draft.platform || 'General',
    content: draft.text_content || '',
    time: draft.updated_at || draft.created_at,
    status: draft.status || 'draft',
    media: Array.isArray(draft.media_urls) ? draft.media_urls : undefined,
    projectId: draft.project_id,
    source: 'backend',
  };
}

function mergeDraftLists(localDrafts: DraftPost[], backendDrafts: DraftPost[]) {
  const merged = new Map<string, DraftPost>();

  backendDrafts.forEach((draft) => {
    merged.set(`backend:${draft.id}`, draft);
  });

  localDrafts.forEach((draft) => {
    merged.set(`local:${draft.id}`, { ...draft, source: draft.source || 'local' });
  });

  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
  );
}

function keepOnlyDraftStatus(draft: DraftPost) {
  return (draft.status || 'draft') === 'draft';
}

interface DraftsState {
  // State
  draftPosts: DraftPost[];
  isSavingDraft: boolean;
  hasLoadedDrafts: boolean;

  // Actions
  handleSaveDraft: (postId: number, content: string, media: MediaFile[], platform: string) => Promise<void>;
  handleEditDraft: (post: DraftPost, onOpenPost?: (platform: string, content: string, mediaUrls?: string[]) => void) => void;
  handleDeleteDraft: (id: number | string) => Promise<void>;
  handlePublishDraft: (id: number | string, onPublish?: (postId: number | string) => void) => void;
  loadDrafts: (force?: boolean) => Promise<void>;
}

export const useDraftsStore = create<DraftsState>((set, get) => ({
  // Initial state - load from localStorage
  draftPosts: (loadFromLocalStorage<DraftPost[]>('draftPosts', []) || []).map((draft) => ({
    ...draft,
    source: draft.source || 'local',
  })),
  isSavingDraft: false,
  hasLoadedDrafts: false,

  /**
   * Lưu bản nháp vào localStorage (KHÔNG lưu vào database)
   * - Chỉ lưu vào localStorage
   * - Bao gồm cả media URLs
   * - Khi user delete draft, sẽ xóa khỏi localStorage
   */
  handleSaveDraft: async (postId, content, media, platform) => {
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

      const postContext = useCreatePostsStore.getState().postContextMap[postId];
      const { setPostContext } = useCreatePostsStore.getState();

      const persistLocalDraft = () => {
        const draft: DraftPost = {
          id: postId,
          platform,
          content,
          time: new Date().toISOString(),
          status: 'draft',
          media: mediaUrls.length > 0 ? mediaUrls : undefined,
          source: 'local'
        };

        const existingLocalDrafts = get().draftPosts.filter((d) => d.source !== 'local' || d.id !== postId);
        const updatedDrafts = mergeDraftLists(
          [draft, ...existingLocalDrafts.filter((d) => d.source === 'local' && keepOnlyDraftStatus(d))],
          existingLocalDrafts.filter((d) => d.source === 'backend' && keepOnlyDraftStatus(d))
        );

        set({ draftPosts: updatedDrafts });
        saveToLocalStorage('draftPosts', updatedDrafts.filter((item) => item.source !== 'backend'));
      };

      if (postContext?.draftId && postContext.projectId) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session?.access_token) {
          toast.error(DRAFT_ERRORS.SAVE_FAILED("Bạn cần đăng nhập lại để cập nhật bản nháp."));
          return;
        }

        const response = await fetch(`/api/projects/${postContext.projectId}/drafts/${postContext.draftId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            text_content: content,
            media_urls: mediaUrls,
            platform,
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(typeof errorData?.error === 'string' ? errorData.error : "Không thể cập nhật bản nháp backend.");
        }

        const result = await response.json();
        const updatedBackendDraft = result?.data as BackendDraftRecord | undefined;
        if (updatedBackendDraft) {
          const updatedDraftPost = mapBackendDraftToDraftPost(updatedBackendDraft);
          set((state) => {
            const otherDrafts = state.draftPosts.filter((draft) => String(draft.id) !== String(updatedDraftPost.id));
            return {
              draftPosts: mergeDraftLists(
                otherDrafts.filter((d) => d.source === 'local' && keepOnlyDraftStatus(d)),
                [updatedDraftPost, ...otherDrafts.filter((d) => d.source === 'backend' && keepOnlyDraftStatus(d))]
              )
            };
          });
          saveToLocalStorage('draftPosts', get().draftPosts.filter((item) => item.source !== 'backend'));
        }

        toast.success(`Đã cập nhật bản nháp thành công!${mediaUrls.length > 0 ? ` (${mediaUrls.length} media)` : ''}`);
        return;
      }

      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        persistLocalDraft();
        toast.warning("Không thể đồng bộ backend lúc này. Bản nháp đã được giữ cục bộ.");
        return;
      }

      try {
        const workspaceProject = await useCreateWorkspaceStore.getState().ensureWorkspaceProject();
        if (!workspaceProject?.projectId) {
          persistLocalDraft();
          toast.warning("Không thể tạo dự án làm việc để lưu backend. Bản nháp đã được giữ cục bộ.");
          return;
        }

        const response = await fetch(`/api/projects/${workspaceProject.projectId}/drafts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            text_content: content,
            media_urls: mediaUrls,
            platform,
            status: 'draft'
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(typeof errorData?.error === 'string' ? errorData.error : "Không thể tạo bản nháp backend.");
        }

        const result = await response.json();
        const createdBackendDraft = result?.data as BackendDraftRecord | undefined;
        if (!createdBackendDraft) {
          throw new Error("Không nhận được dữ liệu bản nháp sau khi lưu.");
        }

        const createdDraftPost = mapBackendDraftToDraftPost(createdBackendDraft);
        set((state) => {
          const remainingLocalDrafts = state.draftPosts.filter(
            (draft) => !(draft.source === 'local' && String(draft.id) === String(postId))
          );
          const nextDraftPosts = mergeDraftLists(
            remainingLocalDrafts.filter((draft) => draft.source === 'local' && keepOnlyDraftStatus(draft)),
            [createdDraftPost, ...remainingLocalDrafts.filter((draft) => draft.source === 'backend' && keepOnlyDraftStatus(draft))]
          );
          saveToLocalStorage('draftPosts', nextDraftPosts.filter((item) => item.source !== 'backend'));
          return { draftPosts: nextDraftPosts };
        });

        setPostContext(postId, {
          source: postContext?.source || 'manual',
          draftId: String(createdBackendDraft.id),
          projectId: createdBackendDraft.project_id,
        });
        useCreateWorkspaceStore.getState().setWorkspaceProject({
          projectId: createdBackendDraft.project_id,
          projectName: workspaceProject.projectName,
          sourceType: workspaceProject.sourceType,
          sourceContent: workspaceProject.sourceContent,
        });

        toast.success(`Đã lưu bản nháp thành công!${mediaUrls.length > 0 ? ` (${mediaUrls.length} media)` : ''}`);
      } catch (backendError) {
        console.error("Lỗi khi đồng bộ bản nháp backend, fallback local:", backendError);
        persistLocalDraft();
        const errorMessage = backendError instanceof Error ? backendError.message : "Lỗi không xác định.";
        toast.warning(`Không thể đồng bộ backend. Đã giữ bản nháp cục bộ. ${errorMessage}`);
      }

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

  handleDeleteDraft: async (id) => {
    const draftToDelete = get().draftPosts.find((post) => String(post.id) === String(id));
    if (!draftToDelete) {
      toast.error(DRAFT_ERRORS.DRAFT_NOT_FOUND_DELETE);
      return;
    }

    if (draftToDelete.source === 'backend' && typeof id === 'string') {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session?.access_token) {
          toast.error(DRAFT_ERRORS.DELETE_FAILED("Bạn cần đăng nhập lại để xóa bản nháp."));
          return;
        }

        const deleteUrl = draftToDelete.projectId
          ? `/api/projects/${draftToDelete.projectId}/drafts/${id}`
          : `/api/drafts/${id}`;

        const response = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'authorization': `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(typeof errorData?.error === 'string' ? errorData.error : 'Không thể xóa bản nháp backend.');
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Lỗi không xác định.';
        toast.error(DRAFT_ERRORS.DELETE_FAILED(message));
        return;
      }
    }

    set((state) => {
      const updated = state.draftPosts.filter((post) => String(post.id) !== String(id));
      saveToLocalStorage('draftPosts', updated.filter((item) => item.source !== 'backend'));
      return { draftPosts: updated };
    });

    toast.success("Đã xóa bản nháp thành công.");
  },

  handlePublishDraft: (id, onPublish) => {
    const { draftPosts } = get();
    const draft = draftPosts.find((post) => String(post.id) === String(id));
    if (draft && onPublish) {
      // Call publish callback (should be provided by create store)
      onPublish(id);
      // Delete draft after publishing
      get().handleDeleteDraft(id);
    }
  },

  loadDrafts: async (force = false) => {
    if (get().hasLoadedDrafts && !force) {
      return;
    }

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
      set({ hasLoadedDrafts: true });
      return;
    }

      const response = await fetch('/api/drafts', {
        method: 'GET',
        headers: {
          'authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(typeof errorData?.error === 'string' ? errorData.error : 'Không thể tải danh sách bản nháp.');
      }

      const result = await response.json();
      const backendDrafts = Array.isArray(result?.data)
        ? result.data
            .filter((draft: BackendDraftRecord) => draft.status === 'draft')
            .map((draft: BackendDraftRecord) => mapBackendDraftToDraftPost(draft))
        : [];

      const localDrafts = (loadFromLocalStorage<DraftPost[]>('draftPosts', []) || []).map((draft) => ({
        ...draft,
        source: 'local' as const,
      })).filter((draft) => keepOnlyDraftStatus(draft));

      set({
        draftPosts: mergeDraftLists(localDrafts, backendDrafts),
        hasLoadedDrafts: true,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định.';
      console.error('[drafts] Failed to load drafts:', message);
      set({ hasLoadedDrafts: true });
    }
  },
}));

