/**
 * Published Posts Store
 * 
 * Manages published posts: loading, viewing, deleting
 */

import { create } from 'zustand';
import { saveToLocalStorage, loadFromLocalStorage, saveToLocalStorageWithLimit, limitLocalStorageArray } from '@/lib/utils/storage';
import { supabaseClient } from '@/lib/supabaseClient';
import { handleUnauthorizedOnClient } from '@/lib/utils/authClient';
import type { PublishedPost } from '../shared/types';
import { useCalendarStore } from '../shared/calendar';

interface PublishedPostsState {
  // State
  publishedPosts: PublishedPost[];
  hasLoadedPublishedPosts: boolean;
  isLoadingPublishedPosts: boolean;
  publishedPostsOffset: number;
  publishedPostsHasMore: boolean;
  isLoadingMorePublishedPosts: boolean;

  // Actions
  loadPublishedPosts: () => Promise<void>;
  loadMorePublishedPosts: () => Promise<void>;
  handleViewPost: (url: string) => void;
  handleDeletePost: (id: number) => void;
}

// Module-level lock to prevent concurrent API calls
let isLoadingPublishedPostsGlobal = false;

export const usePublishedPostsStore = create<PublishedPostsState>((set, get) => ({
  // Initial state - load from localStorage
  publishedPosts: (() => {
    const posts = loadFromLocalStorage<PublishedPost[]>('publishedPosts', []);
    limitLocalStorageArray('publishedPosts', 1000);
    return Array.isArray(posts) ? posts.slice(-1000) : [];
  })(),
  hasLoadedPublishedPosts: false,
  isLoadingPublishedPosts: false,
  publishedPostsOffset: 0,
  publishedPostsHasMore: true,
  isLoadingMorePublishedPosts: false,

  loadPublishedPosts: async () => {
    const needsRefresh = loadFromLocalStorage<boolean>('needsRefreshPublishedPosts', false);

    if (get().hasLoadedPublishedPosts && !needsRefresh) {
      return;
    }

    if (needsRefresh) {
      saveToLocalStorage('needsRefreshPublishedPosts', false);
      set({
        hasLoadedPublishedPosts: false,
        publishedPostsOffset: 0,
        publishedPostsHasMore: true
      });
    }

    if (isLoadingPublishedPostsGlobal) {
      return;
    }

    if (get().isLoadingPublishedPosts) {
      return;
    }

    isLoadingPublishedPostsGlobal = true;
    set({ isLoadingPublishedPosts: true });

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();

      if (session?.access_token) {
        const limit = 100;
        const offset = 0;

        const response = await fetch(`/api/posts/published?limit=${limit}&offset=${offset}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${session.access_token}`
          }
        });

        if (response.ok) {
          const result = await response.json();
          const apiPosts = result?.data?.posts || [];
          const totalCount = result?.data?.count || apiPosts.length;

          const convertedPosts: PublishedPost[] = apiPosts.map((apiPost: any) => ({
            id: apiPost.id || Date.now(),
            platform: apiPost.platform || 'Unknown',
            content: apiPost.content || '',
            time: apiPost.time || new Date().toISOString(),
            status: apiPost.status || 'posted',
            url: apiPost.url || '',
            profileName: apiPost.profileName || 'Unknown Account',
            profilePic: apiPost.profilePic || '/shego.jpg',
            engagement: apiPost.engagement || {
              likes: 0,
              comments: 0,
              shares: 0
            }
          }));

          const hasMore = apiPosts.length === limit && (offset + apiPosts.length) < totalCount;

          set({
            publishedPosts: convertedPosts,
            hasLoadedPublishedPosts: true,
            isLoadingPublishedPosts: false,
            publishedPostsOffset: offset + apiPosts.length,
            publishedPostsHasMore: hasMore
          });

          // Sync calendar events (with flag to prevent reload loop)
          useCalendarStore.getState().syncCalendarWithPostStatuses(
            convertedPosts.map((post) => ({
              postId: String(post.id),
              status: 'posted',
              url: post.url,
              _isSyncFromLoad: true
            } as any)),
            {} // No callbacks needed when syncing from load
          );

          isLoadingPublishedPostsGlobal = false;
          const limitedPosts = convertedPosts.slice(-1000);
          saveToLocalStorageWithLimit('publishedPosts', limitedPosts);

          // Check for TikTok posts with null URLs and request updates from backend
          const tiktokPostsWithNullUrl = convertedPosts
            .filter((post) => post.platform?.toLowerCase() === 'tiktok' && !post.url)
            .map((post) => String(post.id));

          if (tiktokPostsWithNullUrl.length > 0) {
            fetch(`/api/posts/published/tiktok-urls`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({ postIds: tiktokPostsWithNullUrl })
            })
              .then(async (response) => {
                if (response.ok) {
                  const result = await response.json();
                  const updatedUrls = result?.data?.updatedUrls || {};
                  const updatedCount = Object.keys(updatedUrls).length;

                  if (updatedCount > 0) {
                    const state = get();
                    const updatedPosts = state.publishedPosts.map((post) => {
                      const postId = String(post.id);
                      if (updatedUrls[postId]) {
                        return { ...post, url: updatedUrls[postId] };
                      }
                      return post;
                    });

                    set({ publishedPosts: updatedPosts });
                    const limitedUpdatedPosts = updatedPosts.slice(-1000);
                    saveToLocalStorageWithLimit('publishedPosts', limitedUpdatedPosts);

                    // Sync calendar events
                    useCalendarStore.getState().syncCalendarWithPostStatuses(
                      updatedPosts
                        .filter((post) => updatedUrls[String(post.id)])
                        .map((post) => ({
                          postId: String(post.id),
                          status: 'posted',
                          url: post.url
                        }))
                    );
                  }
                } else {
                  console.warn(`[loadPublishedPosts] Failed to check TikTok URLs: ${response.status}`);
                }
              })
              .catch((error) => {
                console.error(`[loadPublishedPosts] Error checking TikTok URLs:`, error);
              });
          }

          return;
        } else {
          if (response.status === 401) {
            console.warn("[loadPublishedPosts] Unauthorized (401) from /api/posts/published");
            isLoadingPublishedPostsGlobal = false;
            set({ isLoadingPublishedPosts: false });
            handleUnauthorizedOnClient('loadPublishedPosts');
            return;
          }
          console.warn("Failed to load published posts from API, falling back to localStorage");
        }
      }

      // Fallback: Load from localStorage
      const localPosts = loadFromLocalStorage<PublishedPost[]>('publishedPosts', []);
      set({
        publishedPosts: localPosts || [],
        hasLoadedPublishedPosts: true,
        isLoadingPublishedPosts: false
      });
      if (localPosts && localPosts.length > 0) {
        useCalendarStore.getState().syncCalendarWithPostStatuses(
          localPosts.map((post: PublishedPost) => ({
            postId: String(post.id),
            status: 'posted',
            url: post.url
          }))
        );
      }
      isLoadingPublishedPostsGlobal = false;

    } catch (error) {
      console.error("Error loading published posts:", error);
      const localPosts = loadFromLocalStorage<PublishedPost[]>('publishedPosts', []);
      set({
        publishedPosts: localPosts || [],
        hasLoadedPublishedPosts: true,
        isLoadingPublishedPosts: false
      });
      if (localPosts && localPosts.length > 0) {
        useCalendarStore.getState().syncCalendarWithPostStatuses(
          localPosts.map((post: PublishedPost) => ({
            postId: String(post.id),
            status: 'posted',
            url: post.url
          }))
        );
      }
      isLoadingPublishedPostsGlobal = false;
    }
  },

  loadMorePublishedPosts: async () => {
    const state = get();

    if (!state.publishedPostsHasMore) {
      return;
    }

    if (state.isLoadingMorePublishedPosts) {
      return;
    }

    set({ isLoadingMorePublishedPosts: true });

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();

      if (!session?.access_token) {
        console.warn("[loadMorePublishedPosts] No session available");
        set({ isLoadingMorePublishedPosts: false });
        return;
      }

      const limit = 100;
      const offset = state.publishedPostsOffset;

      const response = await fetch(`/api/posts/published?limit=${limit}&offset=${offset}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        const apiPosts = result?.data?.posts || [];
        const totalCount = result?.data?.count || 0;

        const newPosts: PublishedPost[] = apiPosts.map((apiPost: any) => ({
          id: apiPost.id || Date.now(),
          platform: apiPost.platform || 'Unknown',
          content: apiPost.content || '',
          time: apiPost.time || new Date().toISOString(),
          status: apiPost.status || 'posted',
          url: apiPost.url || '',
          profileName: apiPost.profileName || 'Unknown Account',
          profilePic: apiPost.profilePic || '/shego.jpg',
          engagement: apiPost.engagement || {
            likes: 0,
            comments: 0,
            shares: 0
          }
        }));

        const updatedPosts = [...state.publishedPosts, ...newPosts];
        const hasMore = apiPosts.length === limit && (offset + apiPosts.length) < totalCount;

        set({
          publishedPosts: updatedPosts,
          publishedPostsOffset: offset + apiPosts.length,
          publishedPostsHasMore: hasMore,
          isLoadingMorePublishedPosts: false
        });

        const limitedPosts = updatedPosts.slice(-1000);
        saveToLocalStorageWithLimit('publishedPosts', limitedPosts);

        // Sync calendar events
        useCalendarStore.getState().syncCalendarWithPostStatuses(
          newPosts.map((post) => ({
            postId: String(post.id),
            status: 'posted',
            url: post.url
          }))
        );
      } else {
        if (response.status === 401) {
          console.warn("[loadMorePublishedPosts] Unauthorized (401) from /api/posts/published");
          set({ isLoadingMorePublishedPosts: false });
          handleUnauthorizedOnClient('loadMorePublishedPosts');
          return;
        }
        console.error("[loadMorePublishedPosts] API error:", response.status);
        set({ isLoadingMorePublishedPosts: false });
      }
    } catch (error) {
      console.error("[loadMorePublishedPosts] Error:", error);
      set({ isLoadingMorePublishedPosts: false });
    }
  },

  handleViewPost: (url) => {
    if (url) window.open(url, '_blank');
  },

  handleDeletePost: (id) => {
    let postFound = false;
    set(state => {
      const updatedPublished = state.publishedPosts.filter(p => p.id !== id);

      if (updatedPublished.length < state.publishedPosts.length) {
        postFound = true;
      }

      const limitedPublished = updatedPublished.slice(-1000);
      saveToLocalStorageWithLimit('publishedPosts', limitedPublished);
      return { publishedPosts: limitedPublished };
    });

    if (postFound) {
      // Note: Toast should be shown by calling component
      // toast.success("Đã xóa bài viết thành công.");
    } else {
      // toast.error("Không tìm thấy bài viết để xóa.");
    }
  },
}));

