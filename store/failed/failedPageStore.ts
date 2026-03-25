/**
 * Failed Posts Store
 * 
 * Manages failed posts: loading, retry, delete
 */

import { create } from 'zustand';
import { saveToLocalStorage, loadFromLocalStorage, saveToLocalStorageWithLimit, limitLocalStorageArray } from '@/lib/utils/storage';
import { supabaseClient } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import type { FailedPost, PendingScheduledPost } from '../shared/types';
import { useCalendarStore } from '../shared/calendar';
import { checkPostStatusAtScheduledTime, schedulePublishingStatusRecheck } from '../shared/statusCheck';
import { POST_ERRORS, AUTH_ERRORS, GENERIC_ERRORS } from '@/lib/messages/errors';
import { handleUnauthorizedOnClient } from '@/lib/utils/authClient';

interface FailedPostsState {
  // State
  failedPosts: FailedPost[];
  hasLoadedFailedPosts: boolean;
  isLoadingFailedPosts: boolean;
  failedPostsOffset: number;
  failedPostsHasMore: boolean;
  isLoadingMoreFailedPosts: boolean;

  // Actions
  loadFailedPosts: () => Promise<void>;
  loadMoreFailedPosts: () => Promise<void>;
  handleRetryPost: (id: string | number, rescheduleDate?: string, rescheduleTime?: string) => Promise<boolean>;
  handleDeleteFailedPost: (id: string | number) => Promise<boolean>;
}

// Module-level lock to prevent concurrent API calls
let isLoadingFailedPostsGlobal = false;

export const useFailedPostsStore = create<FailedPostsState>((set, get) => ({
  // Initial state - load from localStorage
  failedPosts: (() => {
    const posts = loadFromLocalStorage<FailedPost[]>('failedPosts', []);
    limitLocalStorageArray('failedPosts', 1000);
    return Array.isArray(posts) ? posts.slice(-1000) : [];
  })(),
  hasLoadedFailedPosts: false,
  isLoadingFailedPosts: false,
  failedPostsOffset: 0,
  failedPostsHasMore: true,
  isLoadingMoreFailedPosts: false,

  loadFailedPosts: async () => {
    const needsRefresh = loadFromLocalStorage<boolean>('needsRefreshFailedPosts', false);

    if (get().hasLoadedFailedPosts && !needsRefresh) {
      return;
    }

    if (needsRefresh) {
      saveToLocalStorage('needsRefreshFailedPosts', false);
      set({
        hasLoadedFailedPosts: false,
        failedPostsOffset: 0,
        failedPostsHasMore: true
      });
    }

    if (isLoadingFailedPostsGlobal) {
      return;
    }

    if (get().isLoadingFailedPosts) {
      return;
    }

    isLoadingFailedPostsGlobal = true;
    set({ isLoadingFailedPosts: true });

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();

      if (session?.access_token) {
        const limit = 100;
        const offset = 0;

        const response = await fetch(`/api/posts/failed?limit=${limit}&offset=${offset}`, {
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

          const convertedPosts: FailedPost[] = apiPosts.map((apiPost: any) => ({
            id: String(apiPost.id || apiPost.postId || Date.now()),
            platform: apiPost.platform || 'Unknown',
            content: apiPost.content || '',
            date: apiPost.date || new Date().toISOString().split('T')[0],
            time: apiPost.time || new Date().toTimeString().slice(0, 5),
            error: apiPost.error || apiPost.errorMessage || 'Unknown error',
            errorMessage: apiPost.errorMessage || apiPost.error || null,
            profileName: apiPost.profileName || 'Unknown Account',
            profilePic: apiPost.profilePic || '/shego.jpg',
            url: apiPost.url || null,
            scheduledAt: apiPost.scheduledAt || apiPost.scheduled_at || null,
            lateJobId: apiPost.lateJobId || apiPost.late_job_id || null,
            getlateAccountId: apiPost.getlateAccountId || apiPost.getlate_account_id || null,
            // Media URLs từ API (ưu tiên field chuẩn media, sau đó mediaUrls/media_urls)
            media: apiPost.media || apiPost.mediaUrls || apiPost.media_urls || undefined
          }));

          const hasMore = apiPosts.length === limit && (offset + apiPosts.length) < totalCount;

          set({
            failedPosts: convertedPosts,
            hasLoadedFailedPosts: true,
            isLoadingFailedPosts: false,
            failedPostsOffset: offset + apiPosts.length,
            failedPostsHasMore: hasMore
          });

          // Sync calendar events (with flag to prevent reload loop)
          useCalendarStore.getState().syncCalendarWithPostStatuses(
            convertedPosts.map((post) => ({
              postId: String(post.id),
              status: 'failed',
              url: null,
              _isSyncFromLoad: true
            } as any)),
            {} // No callbacks needed when syncing from load
          );

          isLoadingFailedPostsGlobal = false;
          const limitedPosts = convertedPosts.slice(-1000);
          saveToLocalStorageWithLimit('failedPosts', limitedPosts);
          return;
        } else {
          if (response.status === 401) {
            console.warn("[loadFailedPosts] Unauthorized (401) from /api/posts/failed");
            isLoadingFailedPostsGlobal = false;
            set({ isLoadingFailedPosts: false });
            handleUnauthorizedOnClient('loadFailedPosts');
            return;
          }
          console.warn("Failed to load failed posts from API, falling back to localStorage");
        }
      }

      // Fallback: Load from localStorage
      const localPosts = loadFromLocalStorage<FailedPost[]>('failedPosts', []).map((post: any) => ({
        ...post,
        id: String(post.id),
        error: post.error || post.errorMessage || 'Unknown error',
        errorMessage: post.errorMessage || post.error || null
      }));
      set({
        failedPosts: localPosts || [],
        hasLoadedFailedPosts: true,
        isLoadingFailedPosts: false
      });
      if (localPosts && localPosts.length > 0) {
        useCalendarStore.getState().syncCalendarWithPostStatuses(
          localPosts.map((post: FailedPost) => ({
            postId: String(post.id),
            status: 'failed',
            url: null
          }))
        );
      }
      isLoadingFailedPostsGlobal = false;

    } catch (error) {
      console.error("Error loading failed posts:", error);
      const localPosts = loadFromLocalStorage<FailedPost[]>('failedPosts', []).map((post: any) => ({
        ...post,
        id: String(post.id),
        error: post.error || post.errorMessage || 'Unknown error',
        errorMessage: post.errorMessage || post.error || null
      }));
      set({
        failedPosts: localPosts || [],
        hasLoadedFailedPosts: true,
        isLoadingFailedPosts: false
      });
      if (localPosts && localPosts.length > 0) {
        useCalendarStore.getState().syncCalendarWithPostStatuses(
          localPosts.map((post: FailedPost) => ({
            postId: String(post.id),
            status: 'failed',
            url: null
          }))
        );
      }
      isLoadingFailedPostsGlobal = false;
    }
  },

  loadMoreFailedPosts: async () => {
    const state = get();

    if (!state.failedPostsHasMore) {
      return;
    }

    if (state.isLoadingMoreFailedPosts) {
      return;
    }

    set({ isLoadingMoreFailedPosts: true });

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();

      if (!session?.access_token) {
        console.warn("[loadMoreFailedPosts] No session available");
        set({ isLoadingMoreFailedPosts: false });
        return;
      }

      const limit = 100;
      const offset = state.failedPostsOffset;

      const response = await fetch(`/api/posts/failed?limit=${limit}&offset=${offset}`, {
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

        const newPosts: FailedPost[] = apiPosts.map((apiPost: any) => ({
          id: String(apiPost.id || apiPost.postId || Date.now()),
          platform: apiPost.platform || 'Unknown',
          content: apiPost.content || '',
          date: apiPost.date || new Date().toISOString().split('T')[0],
          time: apiPost.time || new Date().toTimeString().slice(0, 5),
          error: apiPost.error || apiPost.errorMessage || 'Unknown error',
          errorMessage: apiPost.errorMessage || apiPost.error || null,
          profileName: apiPost.profileName || 'Unknown Account',
          profilePic: apiPost.profilePic || '/shego.jpg',
          url: apiPost.url || null,
          scheduledAt: apiPost.scheduledAt || apiPost.scheduled_at || null,
          lateJobId: apiPost.lateJobId || apiPost.late_job_id || null,
          getlateAccountId: apiPost.getlateAccountId || apiPost.getlate_account_id || null,
          media: apiPost.media || apiPost.mediaUrls || apiPost.media_urls || undefined
        }));

        const updatedPosts = [...state.failedPosts, ...newPosts];
        const hasMore = apiPosts.length === limit && (offset + apiPosts.length) < totalCount;

        set({
          failedPosts: updatedPosts,
          failedPostsOffset: offset + apiPosts.length,
          failedPostsHasMore: hasMore,
          isLoadingMoreFailedPosts: false
        });

        const limitedPosts = updatedPosts.slice(-1000);
        saveToLocalStorageWithLimit('failedPosts', limitedPosts);

        // Sync calendar events
        useCalendarStore.getState().syncCalendarWithPostStatuses(
          newPosts.map((post) => ({
            postId: String(post.id),
            status: 'failed',
            url: null
          }))
        );
      } else {
        if (response.status === 401) {
          console.warn("[loadMoreFailedPosts] Unauthorized (401) from /api/posts/failed");
          set({ isLoadingMoreFailedPosts: false });
          handleUnauthorizedOnClient('loadMoreFailedPosts');
          return;
        }
        console.error("[loadMoreFailedPosts] API error:", response.status);
        set({ isLoadingMoreFailedPosts: false });
      }
    } catch (error) {
      console.error("[loadMoreFailedPosts] Error:", error);
      set({ isLoadingMoreFailedPosts: false });
    }
  },

  handleRetryPost: async (id, rescheduleDate, rescheduleTime) => {
    const postId = String(id);
    const { failedPosts } = get();
    const post = failedPosts.find(p => String(p.id) === postId);
    if (!post) {
      toast.error(POST_ERRORS.FAILED_POST_NOT_FOUND_RETRY);
      return false;
    }

    if (rescheduleDate && rescheduleTime) {
      if (!post.lateJobId) {
        toast.warning(POST_ERRORS.NO_LATE_JOB_ID);
        // Note: openPostFromUrl should be called from calling component
        return false;
      }

      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const [hourStr = "0", minuteStr = "0"] = rescheduleTime.split(":");
      const dateObj = new Date(rescheduleDate);
      dateObj.setHours(parseInt(hourStr, 10) || 0, parseInt(minuteStr, 10) || 0, 0, 0);
      const scheduledAtISO = dateObj.toISOString();

      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        toast.error(AUTH_ERRORS.LOGIN_REQUIRED_RESCHEDULE);
        return false;
      }

      const toastId = toast.loading("Đang gửi yêu cầu lên lịch lại...");
      try {
        const response = await fetch(`/api/late/posts/${postId}/reschedule`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            newScheduleAt: scheduledAtISO,
            timezone: userTimezone
          })
        });

        if (!response.ok) {
          let errorData: any = {};
          try {
            errorData = await response.json();
          } catch (parseError) {
            errorData = { error: response.statusText || 'Lỗi không xác định' };
          }

          let errorMessage = 'Không thể lên lịch lại bài đăng.';

          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            if (typeof errorData.error === 'string') {
              errorMessage = errorData.error;
            } else if (errorData.error.message) {
              errorMessage = errorData.error.message;
            }
          }

          try {
            const parsed = JSON.parse(errorMessage);
            if (parsed && typeof parsed === 'object' && parsed.message) {
              errorMessage = parsed.message;
            }
          } catch {
            // Not a JSON string, use as is
          }

          if (response.status === 403) {
            if (errorMessage.includes('ngắt kết nối') || errorMessage.includes('no longer connected') || errorMessage.includes('disconnected')) {
              errorMessage = `Tài khoản ${post.platform} đã bị ngắt kết nối. Vui lòng kết nối lại tài khoản trước khi lên lịch lại bài đăng.`;
            } else if (errorMessage.includes('không có quyền') || errorMessage.includes('permission') || errorMessage.includes('Access denied')) {
              errorMessage = 'Bạn không có quyền lên lịch lại bài đăng này.';
            } else if (errorMessage.includes('không khớp') || errorMessage.includes('mismatch')) {
              errorMessage = 'Thông tin tài khoản không khớp. Vui lòng kiểm tra lại.';
            }
          } else if (response.status === 400) {
            if (errorMessage.includes('thông tin tài khoản') || errorMessage.includes('profile ID') || errorMessage.includes('reconnect')) {
              errorMessage = 'Bài đăng này không có thông tin tài khoản hợp lệ. Vui lòng kết nối lại tài khoản trước khi lên lịch lại.';
            }
          }

          throw new Error(errorMessage);
        }

        const result = await response.json();
        const rescheduleData = result?.data ?? result;
        const updatedPost = rescheduleData?.post;

        // Remove from failed posts
        set(state => ({
          failedPosts: state.failedPosts.filter(p => String(p.id) !== postId)
        }));
        saveToLocalStorage('failedPosts', get().failedPosts);

        // Update pendingScheduledPosts in localStorage
        const pendingPosts = loadFromLocalStorage<PendingScheduledPost[]>('pendingScheduledPosts', []);
        const updatedPending = [
          ...pendingPosts.filter(p => p.postId !== postId),
          {
            postId,
            lateJobId: post.lateJobId || updatedPost?.late_job_id || null,
            scheduledAt: scheduledAtISO,
            platform: post.platform,
            content: post.content,
            lastKnownStatus: 'scheduled'
          }
        ];
        saveToLocalStorage('pendingScheduledPosts', updatedPending);

        // Schedule status check at new scheduled time
        checkPostStatusAtScheduledTime(postId, scheduledAtISO, post.platform, {
          onStatusUpdate: (status, url) => {
            useCalendarStore.getState().syncCalendarWithPostStatuses([{
              postId: String(postId),
              status,
              url
            }]);
          },
          onFinalStatus: async (status) => {
            if (status === 'posted') {
              saveToLocalStorage('needsRefreshPublishedPosts', true);
            } else if (status === 'failed') {
              saveToLocalStorage('needsRefreshFailedPosts', true);
            }
            // Reload posts will be handled by the calling store
          },
          onPublishingStatus: (postId, platform) => {
            schedulePublishingStatusRecheck(postId, platform);
          }
        });

        // Update calendar events
        const newDate = new Date(scheduledAtISO);
        const newDateKey = `${newDate.getFullYear()}-${newDate.getMonth()}-${newDate.getDate()}`;
        const newTime24 = `${String(newDate.getHours()).padStart(2, '0')}:${String(newDate.getMinutes()).padStart(2, '0')}`;

        const calendarState = useCalendarStore.getState();
        const updatedEvents = { ...calendarState.calendarEvents };

        // Remove old calendar event
        for (const [dateKey, events] of Object.entries(updatedEvents)) {
          updatedEvents[dateKey] = events.filter(e => e.scheduled_post_id !== postId);
        }

        // Add new calendar event
        const eventId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newEvent = {
          id: eventId,
          platform: post.platform,
          time: newTime24,
          status: 'scheduled',
          noteType: 'yellow' as const,
          content: post.content,
          scheduled_post_id: postId
        };

        if (!updatedEvents[newDateKey]) {
          updatedEvents[newDateKey] = [];
        }
        updatedEvents[newDateKey].push(newEvent);

        useCalendarStore.setState({ calendarEvents: updatedEvents });
        saveToLocalStorage('calendarEvents', updatedEvents);

        toast.success("Đã lên lịch lại bài đăng thành công", { id: toastId });
        return true;
      } catch (error: any) {
        let errorMessage = error?.message || "Không thể lên lịch lại bài đăng.";

        try {
          const parsed = JSON.parse(errorMessage);
          if (parsed && typeof parsed === 'object' && parsed.message) {
            errorMessage = parsed.message;
          }
        } catch {
          // Not a JSON string, use as is
        }

        toast.error(errorMessage, { id: toastId });
        console.error("[handleRetryPost] Error rescheduling post:", error);
        return false;
      }
    }

    // If no reschedule date/time, return true to indicate post should be opened in editor
    // The calling component should handle opening the post
    return true;
  },

  handleDeleteFailedPost: async (id) => {
    const postId = String(id);

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        toast.error(AUTH_ERRORS.LOGIN_REQUIRED_DELETE);
        return false;
      }

      const post = get().failedPosts.find(p => String(p.id) === postId);
      if (!post) {
        toast.error(POST_ERRORS.POST_NOT_FOUND_DELETE);
        return false;
      }

      const scheduledPostId = post.id;

      const response = await fetch(`/api/late/posts/${scheduledPostId}`, {
        method: 'DELETE',
        headers: {
          'authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Không thể xóa bài đăng.');
      }

      // Remove from failedPosts state
      set(state => {
        const updatedFailed = state.failedPosts.filter(p => String(p.id) !== postId);
        const limitedFailed = updatedFailed.slice(-1000);
        saveToLocalStorageWithLimit('failedPosts', limitedFailed);
        return { failedPosts: limitedFailed };
      });

      // Remove from pendingScheduledPosts
      const pendingPosts = loadFromLocalStorage<PendingScheduledPost[]>('pendingScheduledPosts', []);
      const updatedPending = pendingPosts.filter(p => p.postId !== scheduledPostId);
      saveToLocalStorage('pendingScheduledPosts', updatedPending);

      // Remove from calendar events
      const calendarState = useCalendarStore.getState();
      const updatedEvents: Record<string, any[]> = {};
      let changed = false;

      for (const [dateKey, events] of Object.entries(calendarState.calendarEvents)) {
        const filteredEvents = events.filter(event => {
          if (event.scheduled_post_id && String(event.scheduled_post_id) === scheduledPostId) {
            changed = true;
            return false;
          }
          return true;
        });

        if (filteredEvents.length > 0) {
          updatedEvents[dateKey] = filteredEvents;
        }
      }

      if (changed) {
        useCalendarStore.setState({ calendarEvents: updatedEvents });
        saveToLocalStorage('calendarEvents', updatedEvents);
      }

      toast.success("Đã xóa bài đăng thất bại thành công.");
      return true;
    } catch (error: any) {
      console.error('[handleDeleteFailedPost] Error deleting failed post:', error);
      toast.error(GENERIC_ERRORS.DELETE_FAILED(error.message || GENERIC_ERRORS.UNKNOWN_ERROR));
      return false;
    }
  },
}));

