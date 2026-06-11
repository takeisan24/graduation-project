/**
 * Create Page - Sources Store
 *
 * Manages saved sources and create from source functionality
 */

import { create } from 'zustand';
import { saveToLocalStorage, loadFromLocalStorage } from '@/lib/utils/storage';
import { supabaseClient } from '@/lib/supabaseClient';
import { handleErrorWithModal } from '@/lib/utils/errorHandler';
import { SOURCE_ERRORS, GENERIC_ERRORS } from '@/lib/messages/errors';
import type { SavedSource, SourceToGenerate, ChatMessage } from '../shared/types';
import {
  buildPromptParts,
} from '@/lib/ai/prompts/generate-from-source';

// Khóa localStorage cho danh sách nguồn — đổi theo dự án đang mở (1 dự án = 1 danh sách nguồn).
let activeSourcesKey = 'savedSources';

interface CreateSourcesState {
  savedSources: SavedSource[];
  isSourceModalOpen: boolean;
  isCreateFromSourceModalOpen: boolean;
  sourceToGenerate: SourceToGenerate;
  extractedContent: string | null;
  // Trạng thái form "Thêm/Sửa nguồn" — đặt ở store để cột danh sách (trái) và cột form (giữa)
  // dùng CHUNG (tránh mỗi instance một state cục bộ gây lệch logic).
  editingSource: SavedSource | null;
  isSourceFormReadOnly: boolean;

  setIsSourceModalOpen: (isOpen: boolean) => void;
  setSourcesScope: (projectId: string | null) => void;
  addSavedSource: (source: Omit<SavedSource, 'id'>) => SavedSource;
  deleteSavedSource: (sourceId: string) => void;
  clearSavedSources: () => void;
  openCreateFromSourceModal: (source: SourceToGenerate) => void;
  closeCreateFromSourceModal: () => void;
  openSourceForm: (source: SavedSource | null, readOnly?: boolean) => void;
  closeSourceForm: () => void;
  setExtractedContent: (content: string | null) => void;
  generatePostsFromSource: (
    selectedPlatforms: { platform: string; count: number }[],
    selectedModel: string,
    options: {
      onPostCreate?: (platform: string, content: string) => number;
      onPostContentChange?: (postId: number, content: string) => void;
      onAddChatMessage?: (message: ChatMessage) => void;
      onSetTyping?: (isTyping: boolean) => void;
    },
  ) => Promise<boolean>;
}

const parseSourceValue = (value: string) => {
  const sep = '\n\n[Attached Link/Resource]:';
  const parts = value.split(sep);
  return { idea: parts[0].trim(), resourceUrl: parts[1]?.trim() || '' };
};

/** Lưu 1 bài vừa sinh thành bản nháp (draft) gắn vào dự án. Trả về draftId, hoặc null nếu lỗi. */
async function saveSourceDraft(
  projectId: string,
  platform: string,
  content: string,
  token: string,
): Promise<string | null> {
  try {
    const res = await fetch(`/api/projects/${projectId}/drafts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ text_content: content, media_urls: [], platform, status: 'draft' }),
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({}));
    return json?.data?.id ? String(json.data.id) : null;
  } catch {
    return null;
  }
}

export const useCreateSourcesStore = create<CreateSourcesState>((set) => ({
  savedSources: loadFromLocalStorage<SavedSource[]>('savedSources', []),
  isSourceModalOpen: false,
  isCreateFromSourceModalOpen: false,
  sourceToGenerate: null,
  extractedContent: null,
  editingSource: null,
  isSourceFormReadOnly: false,

  setIsSourceModalOpen: (isOpen) => set({ isSourceModalOpen: isOpen }),

  // Đổi phạm vi nguồn sang dự án (mỗi dự án 1 danh sách nguồn riêng trong localStorage).
  setSourcesScope: (projectId) => {
    activeSourcesKey = projectId ? `savedSources:${projectId}` : 'savedSources';
    const loaded = loadFromLocalStorage<SavedSource[]>(activeSourcesKey, []);
    set({ savedSources: loaded, sourceToGenerate: null, extractedContent: null });
  },

  addSavedSource: (source) => {
    const newSource = { ...source, id: Date.now().toString() };
    set((state) => {
      const updated = [...state.savedSources, newSource];
      saveToLocalStorage(activeSourcesKey, updated);
      return { savedSources: updated };
    });
    return newSource;
  },

  deleteSavedSource: (sourceId) => {
    set((state) => {
      const updated = state.savedSources.filter((s) => s.id !== sourceId);
      saveToLocalStorage(activeSourcesKey,updated);
      return { savedSources: updated };
    });
  },

  clearSavedSources: () => {
    saveToLocalStorage(activeSourcesKey,[]);
    set({ savedSources: [], sourceToGenerate: null, extractedContent: null });
  },

  openCreateFromSourceModal: (source) => set({ sourceToGenerate: source, isCreateFromSourceModalOpen: true }),
  closeCreateFromSourceModal: () => set({ isCreateFromSourceModalOpen: false, sourceToGenerate: null }),
  openSourceForm: (source, readOnly = false) => set({ editingSource: source, isSourceFormReadOnly: readOnly }),
  closeSourceForm: () => set({ editingSource: null, isSourceFormReadOnly: false }),
  setExtractedContent: (content) => set({ extractedContent: content }),

  generatePostsFromSource: async (selectedPlatforms, selectedModel, options) => {
    const { sourceToGenerate } = useCreateSourcesStore.getState();
    if (!sourceToGenerate) return false;

    const { idea, resourceUrl } = parseSourceValue(sourceToGenerate.value);
    const sourceType = sourceToGenerate.type;

    if (options.onSetTyping) options.onSetTyping(true);
    set({ isCreateFromSourceModalOpen: false });

    const chatMsg = `Đang tạo ${selectedPlatforms.reduce((a, p) => a + p.count, 0)} bài viết từ nguồn ${sourceType}...`;
    if (options.onAddChatMessage) {
      options.onAddChatMessage({ role: 'assistant', content: chatMsg });
    }

    const ctx = { selectedPlatforms, sourceType, idea, resourceUrl };

    const promptParts = buildPromptParts(ctx);
    const platforms = selectedPlatforms.flatMap((p) => Array(p.count).fill(p.platform.toLowerCase()));

    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch('/api/ai/generate-from-source', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ promptParts, modelPreference: selectedModel, platforms }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const errMsg = err.error || SOURCE_ERRORS.GENERATE_FROM_SOURCE_FAILED('');
        await handleErrorWithModal(err, errMsg);
        if (options.onAddChatMessage) {
          options.onAddChatMessage({ role: 'assistant', content: SOURCE_ERRORS.GENERATE_POSTS_FROM_SOURCE_FAILED(errMsg) });
        }
        if (options.onSetTyping) options.onSetTyping(false);
        set({ sourceToGenerate: null });
        return false;
      }

      const raw = await response.json();
      const data = raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw;
      const responseText = typeof data?.response === 'string' ? data.response : '';

      if (data?.extractedContent && sourceType === 'youtube') {
        set({ extractedContent: data.extractedContent });
      } else if (sourceType !== 'youtube') {
        set({ extractedContent: null });
      }

      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      if (!jsonMatch?.[1]) {
        if (options.onAddChatMessage) {
          options.onAddChatMessage({ role: 'assistant', content: SOURCE_ERRORS.AI_RESPONSE_NO_JSON });
        }
        if (options.onSetTyping) options.onSetTyping(false);
        set({ sourceToGenerate: null });
        return false;
      }

      const cleanJson = jsonMatch[1].trim().replace(/,(\s*[}\]])/g, '$1');
      let posts;
      try {
        posts = JSON.parse(cleanJson);
      } catch {
        if (options.onAddChatMessage) {
          options.onAddChatMessage({ role: 'assistant', content: SOURCE_ERRORS.AI_RESPONSE_NO_JSON });
        }
        if (options.onSetTyping) options.onSetTyping(false);
        set({ sourceToGenerate: null });
        return false;
      }

      if (!Array.isArray(posts)) {
        if (options.onAddChatMessage) {
          options.onAddChatMessage({ role: 'assistant', content: SOURCE_ERRORS.AI_RESPONSE_NOT_ARRAY });
        }
        if (options.onSetTyping) options.onSetTyping(false);
        set({ sourceToGenerate: null });
        return false;
      }

      // Đảm bảo có DỰ ÁN (DB) trước — để lưu draft từng bài vào đúng dự án, và để
      // ProjectMenu hết "Nháp" + đổi tên được. Lỗi tạo dự án không làm hỏng việc sinh bài.
      let projectId: string | null = null;
      try {
        const { useCreateWorkspaceStore } = await import('./workspace');
        const project = await useCreateWorkspaceStore.getState().ensureWorkspaceProject();
        projectId = project?.projectId || null;
      } catch (projErr) {
        console.warn('[sources] ensureWorkspaceProject failed:', projErr);
      }

      const { useCreatePostsStore } = await import('./posts');
      const setPostContext = useCreatePostsStore.getState().setPostContext;

      let summary = `Đã tạo thành công các bài viết từ nguồn:\n`;
      for (const postData of posts) {
        if (postData.action === 'create_post' && postData.platform && postData.content) {
          if (options.onPostCreate && options.onPostContentChange) {
            const newId = options.onPostCreate(postData.platform, postData.content);
            if (newId) {
              options.onPostContentChange(newId, postData.content);
              // #2: TỰ LƯU bài thành bản nháp (draft) gắn vào dự án + gắn context để sửa/đăng đồng bộ.
              if (projectId && accessToken) {
                const draftId = await saveSourceDraft(projectId, postData.platform, postData.content, accessToken);
                if (draftId) {
                  setPostContext(newId, { source: 'drafts', draftId, projectId });
                }
              }
            }
          }
          summary += `- ${postData.summary_for_chat || `Một bài cho ${postData.platform}`}\n`;
        }
      }
      if (options.onAddChatMessage) {
        options.onAddChatMessage({ role: 'assistant', content: summary.trim() });
      }

      if (options.onSetTyping) options.onSetTyping(false);
      set({ sourceToGenerate: null });
      return true;
    } catch (error) {
      let msg = error instanceof Error ? error.message : GENERIC_ERRORS.UNKNOWN_ERROR_WITH_DETAILS;
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.message) {
          const m = parsed.message.match(/"message"\\s*:\\s*"([^"]+)/);
          msg = m ? m[1] : msg;
        }
      } catch {}
      console.error('Lỗi khi tạo bài viết từ nguồn:', msg);
      await handleErrorWithModal(error, msg);
      if (options.onAddChatMessage) {
        options.onAddChatMessage({ role: 'assistant', content: SOURCE_ERRORS.GENERATE_POSTS_FROM_SOURCE_FAILED(msg) });
      }
      if (options.onSetTyping) options.onSetTyping(false);
      set({ sourceToGenerate: null });
      return false;
    }
  },
}));
