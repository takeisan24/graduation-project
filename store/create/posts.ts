/**
 * Create Page - Posts Management Store
 * 
 * Manages post creation, deletion, content updates, cloning
 */

import { create } from 'zustand';
import { saveToLocalStorage, loadFromLocalStorage } from '@/lib/utils/storage';
import { useCalendarStore } from '../shared/calendar';
import { useCreateMediaStore } from './media';
import { useCreateWorkspaceStore } from './workspace';
import { POST_ERRORS, TOAST_MESSAGES } from '@/lib/messages/errors';
import { supabaseClient } from '@/lib/supabaseClient';
import type { Post, MediaFile } from '../shared/types';
import { useCreateSourcesStore } from './sources';
import { toast } from 'sonner';

export type CreateOpenPostContext = {
  source: 'manual' | 'drafts' | 'calendar' | 'failed' | 'published';
  draftId?: string;
  projectId?: string;
  scheduledPostId?: string;
  eventId?: string;
  dateKey?: string;
};

interface CreatePostsState {
  // State
  openPosts: Post[];
  selectedPostId: number;
  postContents: Record<number, string>;
  postToEventMap: Record<number, { eventId: string; dateKey: string }>;
  postContextMap: Record<number, CreateOpenPostContext>;
  setPostContext: (id: number, context?: CreateOpenPostContext) => void;
  deletePostVersion: (id: number, versionIndex: number) => void;
  isFormatting: boolean;
  isTranslating: boolean;

  // Actions
  handlePostSelect: (id: number) => void;
  handlePostCreate: (type: string) => number;
  handlePostDelete: (id: number) => void;
  handleFormatPost: (postId: number) => Promise<void>;
  handleTranslatePost: (postId: number, targetLanguage?: string) => Promise<void>;
  handlePostContentChange: (id: number, content: string) => void;
  handleClonePost: (postId: number, postMedia: Record<number, MediaFile[]>, onCloneMedia?: (postId: number, media: MediaFile[]) => void) => void;
  openPostFromUrl: (
    platform: string,
    content?: string,
    eventMapping?: { eventId: string; dateKey: string },
    mediaUrls?: string[],
    postMedia?: Record<number, MediaFile[]>,
    onLoadMedia?: (postId: number, media: MediaFile[]) => void,
    options?: { forceNewPost?: boolean; context?: CreateOpenPostContext }
  ) => void;

  addPostVersion: (id: number, newContent: string) => void;
  navigatePostVersion: (id: number, direction: 'prev' | 'next') => void;
  clearPosts: () => void;
}

function formatTextLocally(text: string): string {
  if (!text) return "";

  // 1. Chuẩn hóa khoảng trắng: Xóa khoảng trắng thừa đầu đuôi, chuyển nhiều dấu cách thành 1
  let processed = text.trim().replace(/[ \t]+/g, ' ');

  // 2. Tách đoạn thông minh:
  // Nếu văn bản dính chùm (không có xuống dòng), thử tách câu dựa trên dấu kết thúc câu (. ! ?)
  // Logic: Nếu cả bài dài > 150 ký tự mà không có dấu xuống dòng nào
  const hasNewLines = processed.includes('\n');
  if (!hasNewLines && processed.length > 150) {
    // Thêm xuống dòng sau dấu chấm câu, nhưng trừ các trường hợp số thập phân (vd: 1.5) hoặc tên viết tắt (Mr.)
    // Regex: Dấu chấm/hỏi/than + khoảng trắng + Chữ cái viết hoa (để nhận diện đầu câu mới)
    processed = processed.replace(/([.!?])\s+(?=[A-ZÀ-Ỹ])/g, "$1\n\n");
  }

  // 3. Xử lý các gạch đầu dòng (bullet points)
  // Nếu thấy các ký tự như -, *, • ở đầu, đảm bảo nó nằm trên dòng riêng
  processed = processed.replace(/([^\n])\s*([•\-\*])\s+/g, "$1\n$2 ");

  // 4. Chuẩn hóa xuống dòng:
  // Đảm bảo giữa các đoạn văn có 1 dòng trống để dễ đọc (Facebook/LinkedIn chuẩn)
  // Thay thế 3+ dòng trống thành 2 dòng trống
  processed = processed.replace(/\n{3,}/g, "\n\n");

  return processed;
}

export const useCreatePostsStore = create<CreatePostsState>((set, get) => ({
  // Initial state - load from localStorage
  openPosts: [],
  selectedPostId: 0,
  postContents: loadFromLocalStorage<Record<number, string>>('postContents', {}),
  postToEventMap: {},
  postContextMap: {},
  isFormatting: false,
  isTranslating: false,

  handlePostSelect: (id) => set({ selectedPostId: id }),

  setPostContext: (id, context) => {
    set((state) => {
      const nextPostContextMap = { ...state.postContextMap };

      if (context) {
        nextPostContextMap[id] = context;
      } else {
        delete nextPostContextMap[id];
      }

      return { postContextMap: nextPostContextMap };
    });

    if (context?.projectId) {
      void useCreateWorkspaceStore.getState().hydrateWorkspaceProject(context.projectId);
    }
  },

  handlePostCreate: (type) => {
    const newPostId = Date.now() + Math.floor(Math.random() * 1000000);
    const newPost = { id: newPostId, type: type };
    set((state) => ({
      openPosts: [...state.openPosts, newPost],
      postContents: { ...state.postContents, [newPostId]: '' },
      selectedPostId: newPostId,
    }));
    return newPostId;
  },


  deletePostVersion: (id, versionIndex) => {
    set(state => {
      const post = state.openPosts.find(p => p.id === id);
      if (!post || !post.versions || post.versions.length <= 1) return {};

      const newVersions = [...post.versions];

      newVersions.splice(versionIndex, 1);

      let newIndex = versionIndex;
      if (newIndex >= newVersions.length) {
        newIndex = newVersions.length - 1;
      }

      const updatedOpenPosts = state.openPosts.map(p =>
        p.id === id
          ? { ...p, versions: newVersions, currentVersionIndex: newIndex }
          : p
      );

      const updatedPostContents = {
        ...state.postContents,
        [id]: newVersions[newIndex]
      };

      return {
        openPosts: updatedOpenPosts,
        postContents: updatedPostContents
      };
    });
  },

  handlePostDelete: (id) => {
    set((state) => {
      const remaining = state.openPosts.filter((p) => p.id !== id);
      const nextId = remaining.length > 0 ? remaining[0].id : 0;
      const newPostContents = { ...state.postContents };
      delete newPostContents[id];
      const newPostToEventMap = { ...state.postToEventMap };
      delete newPostToEventMap[id];
      const newPostContextMap = { ...state.postContextMap };
      delete newPostContextMap[id];

      // Clear extractedContent khi đóng hết posts để tránh dùng content cũ
      if (remaining.length === 0) {
        useCreateSourcesStore.getState().setExtractedContent(null);
      }

      return {
        openPosts: remaining,
        selectedPostId: nextId,
        postContents: newPostContents,
        postToEventMap: newPostToEventMap,
        postContextMap: newPostContextMap,
      };
    });
  },

  clearPosts: () => {
    set({
      openPosts: [],
      selectedPostId: 0,
      postContents: {},
      postToEventMap: {},
      postContextMap: {}
    });
    saveToLocalStorage('postContents', {});
    // Also clear extracted content from source store to match
    useCreateSourcesStore.getState().setExtractedContent(null);
  },


  handlePostContentChange: (id, content) => {
    set((state) => {
      const updatedPostContents = { ...state.postContents, [id]: content };
      saveToLocalStorage('postContents', updatedPostContents);

      // Cập nhật calendar event nếu có liên kết
      const eventMapping = state.postToEventMap[id];
      if (eventMapping) {
        const { eventId, dateKey } = eventMapping;
        const calendarState = useCalendarStore.getState();
        const updatedEvents = { ...calendarState.calendarEvents };
        if (updatedEvents[dateKey]) {
          updatedEvents[dateKey] = updatedEvents[dateKey].map(event =>
            event.id === eventId ? { ...event, content } : event
          );
          useCalendarStore.setState({ calendarEvents: updatedEvents });
          saveToLocalStorage('calendarEvents', updatedEvents);
        }
      }

      return { postContents: updatedPostContents };
    });
  },

  handleClonePost: (postId, postMedia, onCloneMedia) => {
    const { openPosts, postContents } = get();
    const post = openPosts.find(p => p.id === postId);
    if (!post) {
      toast.error(POST_ERRORS.POST_NOT_FOUND("nhân bản"));
      return;
    }

    const newId = Date.now();
    const content = postContents[postId] || "";
    const newPost = { id: newId, type: post.type };

    // Clone media của post gốc (tạo deep copy để tránh reference issues)
    const originalMedia = postMedia[postId] || [];
    const clonedMedia: MediaFile[] = originalMedia.map(media => ({
      ...media,
      id: `${media.id}-clone-${newId}`, // Tạo ID mới cho media clone
      preview: media.preview, // Giữ nguyên preview URL
      file: media.file // File object sẽ được share reference (có thể cần deep clone sau)
    }));

    set(state => ({
      openPosts: [...state.openPosts, newPost],
      postContents: { ...state.postContents, [newId]: content },
      selectedPostId: newId
    }));

    // Call callback to add cloned media to media store
    if (onCloneMedia && clonedMedia.length > 0) {
      onCloneMedia(newId, clonedMedia);
    }

    toast.info(`Đã nhân bản bài viết "${post.type}".`);
  },
  addPostVersion: (id, newContent) => {
    set(state => {
      const updatedPostContents = { ...state.postContents, [id]: newContent };

      const updatedOpenPosts = state.openPosts.map(post => {
        if (post.id !== id) return post;

        // Lấy versions hiện tại hoặc tạo mới từ content cũ
        const currentVersions = post.versions && post.versions.length > 0
          ? [...post.versions]
          : [state.postContents[id] || ''];

        // Thêm nội dung mới vào cuối
        currentVersions.push(newContent);

        return {
          ...post,
          versions: currentVersions,
          currentVersionIndex: currentVersions.length - 1 // Trỏ tới cái mới nhất
        };
      });

      return {
        openPosts: updatedOpenPosts,
        postContents: updatedPostContents
      };
    });
  },

  // --- ACTION MỚI: Điều hướng giữa các version (Prev/Next) ---
  navigatePostVersion: (id, direction) => {
    set(state => {
      const post = state.openPosts.find(p => p.id === id);
      if (!post || !post.versions || post.versions.length === 0) return {};

      const maxIndex = post.versions.length - 1;
      let newIndex = post.currentVersionIndex || 0;

      if (direction === 'prev') newIndex = Math.max(0, newIndex - 1);
      if (direction === 'next') newIndex = Math.min(maxIndex, newIndex + 1);

      // Lấy nội dung tại version mới
      const contentAtVersion = post.versions[newIndex];

      // Cập nhật postContents để UI hiển thị lại
      const updatedPostContents = { ...state.postContents, [id]: contentAtVersion };

      // Cập nhật index trong openPosts
      const updatedOpenPosts = state.openPosts.map(p =>
        p.id === id ? { ...p, currentVersionIndex: newIndex } : p
      );

      return {
        openPosts: updatedOpenPosts,
        postContents: updatedPostContents
      };
    });
  },

  openPostFromUrl: (platform, content = '', eventMapping, mediaUrls, postMedia, onLoadMedia, options) => {
    // Chuẩn hoá tên nền tảng về dạng hiển thị thống nhất với UI (X, Facebook, YouTube, ...)
    const normalizePlatformType = (name: string): string => {
      const lower = (name || '').toLowerCase();
      const map: Record<string, string> = {
        twitter: 'X',
        x: 'X',
        'x (twitter)': 'X',
        'twitter (x)': 'X',
        instagram: 'Instagram',
        linkedin: 'LinkedIn',
        facebook: 'Facebook',
        pinterest: 'Pinterest',
        tiktok: 'TikTok',
        threads: 'Threads',
        youtube: 'YouTube',
      };
      return map[lower] || name;
    };

    const platformType = normalizePlatformType(platform);

    const { openPosts } = get();
    const existing = options?.forceNewPost ? undefined : openPosts.find(p => p.type === platformType);
    let targetId = existing?.id;

    if (!targetId) {
      targetId = Date.now();
      const newPost = { id: targetId, type: platformType };
      set(state => ({
        openPosts: [...state.openPosts, newPost]
      }));
    }

    // Load media từ URLs (nếu có)
    const loadedMedia: MediaFile[] = [];
    if (mediaUrls && mediaUrls.length > 0) {
      for (const url of mediaUrls) {
        if (url.startsWith('blob:')) {
          loadedMedia.push({
            id: `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: url.includes('image') ? 'image' : 'video',
            preview: url,
            file: new File([], 'media-placeholder'),
            postId: targetId
          });
        } else if (url.startsWith('http://') || url.startsWith('https://')) {
          const isVideo = /\.(mp4|webm|ogg|mov|avi)$/i.test(url);

          loadedMedia.push({
            id: `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: isVideo ? 'video' : 'image',
            preview: url,
            file: new File([], url.split('/').pop() || 'media'),
            postId: targetId
          });
        }
      }
    }

    set(state => {
      const nextPostContents = { ...state.postContents, [targetId!]: content };
      const nextPostToEventMap = { ...state.postToEventMap };
      const nextPostContextMap = { ...state.postContextMap };

      if (eventMapping) {
        nextPostToEventMap[targetId!] = eventMapping;
      } else {
        delete nextPostToEventMap[targetId!];
      }

      if (options?.context) {
        nextPostContextMap[targetId!] = options.context;
      } else {
        delete nextPostContextMap[targetId!];
      }

      saveToLocalStorage('postContents', nextPostContents);

      return {
        selectedPostId: targetId!,
        postContents: nextPostContents,
        postToEventMap: nextPostToEventMap,
        postContextMap: nextPostContextMap,
      };
    });

    // Call callback to add loaded media to media store
    if (onLoadMedia && loadedMedia.length > 0) {
      onLoadMedia(targetId!, loadedMedia);
      if (options?.context?.projectId) {
        void useCreateWorkspaceStore.getState().hydrateWorkspaceProject(options.context.projectId);
      }
      return;
    }

    useCreateMediaStore.getState().setPostMedia(targetId!, loadedMedia);
    if (options?.context?.projectId) {
      void useCreateWorkspaceStore.getState().hydrateWorkspaceProject(options.context.projectId);
    }
  },
  handleFormatPost: async (postId) => {
    const { postContents, addPostVersion } = get();
    const content = postContents[postId];

    if (!content || !content.trim()) {
      toast.warning(TOAST_MESSAGES.FORMAT_NO_CONTENT);
      return;
    }

    // --- LOGIC MỚI: XỬ LÝ LOCAL ---
    set({ isFormatting: true });

    // Giả lập độ trễ cực nhỏ để user cảm thấy "hệ thống đang làm việc" (tuỳ chọn)
    await new Promise(r => setTimeout(r, 300));

    try {
      const formattedContent = formatTextLocally(content);

      // Nếu nội dung thay đổi thì mới update
      if (formattedContent !== content) {
        addPostVersion(postId, formattedContent);
        toast.success(TOAST_MESSAGES.FORMAT_SUCCESS);
      } else {
        toast.info("Bài viết đã có bố cục tốt, không cần thay đổi.");
      }
    } catch (error) {
      console.error("Local format error:", error);
      toast.error(TOAST_MESSAGES.FORMAT_ERROR);
    } finally {
      set({ isFormatting: false });
    }
  },
  handleTranslatePost: async (postId, targetLanguage) => {
    const { postContents, addPostVersion, openPosts } = get();
    const content = postContents[postId];
    const post = openPosts.find(p => p.id === postId);

    if (!content || !content.trim()) {
      toast.warning(TOAST_MESSAGES.TRANSLATE_NO_CONTENT);
      return;
    }

    set({ isTranslating: true });

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();

      const response = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          content,
          platform: post?.type || 'general',
          suggestionType: 'translate',
          targetLanguage
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Lỗi khi dịch văn bản');
      }

      const translatedContent = data.data?.suggestions;
      if (translatedContent && translatedContent !== content) {
        addPostVersion(postId, translatedContent);
        toast.success(TOAST_MESSAGES.TRANSLATE_SUCCESS);
      } else {
        toast.info("Không có thay đổi sau khi dịch.");
      }
    } catch (error: unknown) {
      console.error("Local translate error:", error);
      toast.error(error instanceof Error ? error.message : "Lỗi khi dịch văn bản.");
    } finally {
      set({ isTranslating: false });
    }
  }
}));
