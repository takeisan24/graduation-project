/**
 * Create Page - Sources Store
 *
 * Manages saved sources and create from source functionality
 */

import { create } from 'zustand';
import { saveToLocalStorage, loadFromLocalStorage } from '@/lib/utils/storage';
import { supabaseClient } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { handleErrorWithModal } from '@/lib/utils/errorHandler';
import { SOURCE_ERRORS, GENERIC_ERRORS } from '@/lib/messages/errors';
import type { SavedSource, SourceToGenerate, ChatMessage } from '../shared/types';
import {
  buildPromptParts,
  selectInstructions,
  type GenerateFromSourceContext,
} from '@/lib/ai/prompts/generate-from-source';

interface CreateSourcesState {
  savedSources: SavedSource[];
  isSourceModalOpen: boolean;
  isCreateFromSourceModalOpen: boolean;
  sourceToGenerate: SourceToGenerate;
  extractedContent: string | null;

  setIsSourceModalOpen: (isOpen: boolean) => void;
  addSavedSource: (source: Omit<SavedSource, 'id'>) => SavedSource;
  deleteSavedSource: (sourceId: string) => void;
  openCreateFromSourceModal: (source: SourceToGenerate) => void;
  closeCreateFromSourceModal: () => void;
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

export const useCreateSourcesStore = create<CreateSourcesState>((set) => ({
  savedSources: loadFromLocalStorage<SavedSource[]>('savedSources', []),
  isSourceModalOpen: false,
  isCreateFromSourceModalOpen: false,
  sourceToGenerate: null,
  extractedContent: null,

  setIsSourceModalOpen: (isOpen) => set({ isSourceModalOpen: isOpen }),
  addSavedSource: (source) => {
    const newSource = { ...source, id: Date.now().toString() };
    set((state) => {
      const updated = [...state.savedSources, newSource];
      saveToLocalStorage('savedSources', updated);
      return { savedSources: updated };
    });
    return newSource;
  },

  deleteSavedSource: (sourceId) => {
    set((state) => {
      const updated = state.savedSources.filter((s) => s.id !== sourceId);
      saveToLocalStorage('savedSources', updated);
      return { savedSources: updated };
    });
  },

  openCreateFromSourceModal: (source) => set({ sourceToGenerate: source, isCreateFromSourceModalOpen: true }),
  closeCreateFromSourceModal: () => set({ isCreateFromSourceModalOpen: false, sourceToGenerate: null }),
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
    const instructions = selectInstructions(ctx, selectedModel);
    const promptParts = buildPromptParts(ctx);
    const platforms = selectedPlatforms.flatMap((p) => Array(p.count).fill(p.platform.toLowerCase());

    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const accessToken = sessionData?.access_token;

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

      let cleanJson = jsonMatch[1].trim().replace(/,(\s*[}\]])/g, '$1');
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

      let summary = `Đã tạo thành công các bài viết từ nguồn:\n`;
      for (const postData of posts) {
        if (postData.action === 'create_post' && postData.platform && postData.content) {
          if (options.onPostCreate && options.onPostContentChange) {
            const newId = options.onPostCreate(postData.platform, postData.content);
            if (newId) options.onPostContentChange(newId, postData.content);
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
