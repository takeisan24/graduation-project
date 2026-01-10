/**
 * Status Check Store
 * 
 * Manages post status checking logic, timers, and pending post monitoring
 */

import { loadFromLocalStorage, saveToLocalStorage } from '@/lib/utils/storage';
import { supabaseClient } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import type { LateLifecycleStatus, PendingScheduledPost } from './types';
import { normalizeLateLifecycleStatus, isFinalLateStatus, getStatusCheckBuffer, getPublishingRecheckInterval } from './utils';
import { PENDING_CHECK_INTERVAL_MS } from './constants';
import { useCalendarStore } from './calendar';
import { usePublishedPostsStore } from '../published/publishedPageStore';
import { useFailedPostsStore } from '../failed/failedPageStore';
import { formatDate, formatTime } from '@/lib/utils/date';
import { POST_ERRORS } from '@/lib/messages/errors';
import { handleUnauthorizedOnClient } from '@/lib/utils/authClient';

// Module-level timers (persist across component unmounts)
const statusRecheckTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const scheduledStatusCheckTimers: Record<string, ReturnType<typeof setTimeout>> = {};

// Track which posts have already shown toast to avoid duplicates
const shownToastForPosts: Set<string> = new Set();

/**
 * Clear publishing status recheck timer
 */
export function clearPublishingStatusRecheckTimer(postId: string) {
  const timer = statusRecheckTimers[postId];
  if (timer !== undefined) {
    clearTimeout(timer);
    delete statusRecheckTimers[postId];
  }
}

/**
 * Schedule a recheck for a publishing post
 * Uses platform-specific intervals: TikTok = 30s, others = 10s for faster updates
 */
export function schedulePublishingStatusRecheck(
  postId: string,
  platform: string | null | undefined,
  delayMs?: number,
  onRecheck?: () => void
) {
  if (typeof window === "undefined") return;
  clearPublishingStatusRecheckTimer(postId);

  const interval = delayMs ?? getPublishingRecheckInterval(platform);

  statusRecheckTimers[postId] = setTimeout(() => {
    if (onRecheck) {
      onRecheck();
    }
    clearPublishingStatusRecheckTimer(postId);
  }, interval);
}

/**
 * Clear scheduled status check timer
 */
export function clearScheduledStatusCheckTimer(postId: string) {
  const timer = scheduledStatusCheckTimers[postId];
  if (timer !== undefined) {
    clearTimeout(timer);
    delete scheduledStatusCheckTimers[postId];
  }
}

/**
 * Check post status at scheduled time
 * Called when scheduled time arrives
 */
export async function checkPostStatusAtScheduledTime(
  postId: string,
  scheduledAt: string,
  platform: string | null | undefined,
  options: {
    onStatusUpdate?: (status: LateLifecycleStatus, url: string | null) => void;
    onFinalStatus?: (status: LateLifecycleStatus) => Promise<void>;
    onPublishingStatus?: (postId: string, platform: string | null) => void;
  } = {}
) {
  const scheduledTime = new Date(scheduledAt);

  if (isNaN(scheduledTime.getTime())) {
    console.error(`[checkPostStatusAtScheduledTime] Invalid scheduledAt for post ${postId}: ${scheduledAt}`);
    return;
  }

  const now = new Date();
  const delay = scheduledTime.getTime() - now.getTime();

  clearScheduledStatusCheckTimer(postId);

  const executeStatusCheck = async () => {
    clearScheduledStatusCheckTimer(postId);
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        console.warn('[checkPostStatusAtScheduledTime] No session available');
        return;
      }

      const response = await fetch(`/api/late/posts/${postId}/check-status`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.warn('[checkPostStatusAtScheduledTime] Unauthorized (401) when checking post status');
          await handleUnauthorizedOnClient('checkPostStatusAtScheduledTime');
          return;
        }
        const errorData = await response.json();
        console.error(`[checkPostStatusAtScheduledTime] Failed to check post ${postId}:`, errorData);
        return;
      }

      const result = await response.json();
      const data = result?.data ?? result;

      const pendingPosts = loadFromLocalStorage<PendingScheduledPost[]>('pendingScheduledPosts', []);
      const existingEntry = pendingPosts.find((p) => p.postId === postId);
      let remainingPosts = pendingPosts.filter((p) => p.postId !== postId);

      const postPlatform = data.post?.platform || platform || existingEntry?.platform || '';
      const resolvedStatus = normalizeLateLifecycleStatus(
        data.postStatus || data.newStatus || data.post?.status
      );
      const postUrl = data.post?.post_url || null;
      const isFinal = isFinalLateStatus(resolvedStatus);

      // Call status update callback
      if (options.onStatusUpdate) {
        options.onStatusUpdate(resolvedStatus, postUrl);
      }

      if (!isFinal) {
        const entryToPersist: PendingScheduledPost = existingEntry
          ? { ...existingEntry }
          : {
            postId,
            lateJobId: data.post?.late_job_id || null,
            scheduledAt,
            platform: postPlatform,
            content: data.post?.payload?.text_content || data.post?.payload?.text || ''
          };
        entryToPersist.lastKnownStatus = resolvedStatus;
        entryToPersist.platform = postPlatform;
        remainingPosts.push(entryToPersist);

        if (resolvedStatus === 'publishing' && options.onPublishingStatus) {
          options.onPublishingStatus(postId, postPlatform);
        }
      } else {
        // Final states trigger refresh
        if (resolvedStatus === 'posted') {
          saveToLocalStorage('needsRefreshPublishedPosts', true);
          // Auto-refresh published posts store
          const publishedStore = usePublishedPostsStore.getState();
          await publishedStore.loadPublishedPosts();
        } else if (resolvedStatus === 'failed') {
          saveToLocalStorage('needsRefreshFailedPosts', true);
          // Auto-refresh failed posts store
          const failedStore = useFailedPostsStore.getState();
          await failedStore.loadFailedPosts();
        }

        // Sync calendar events with new status
        const calendarStore = useCalendarStore.getState();
        calendarStore.syncCalendarWithPostStatuses([{
          postId,
          status: resolvedStatus,
          url: postUrl || undefined
        }]);

        if (options.onFinalStatus) {
          await options.onFinalStatus(resolvedStatus);
        }

        clearPublishingStatusRecheckTimer(postId);
        clearScheduledStatusCheckTimer(postId);
      }

      saveToLocalStorage('pendingScheduledPosts', remainingPosts);

      if (data.statusChanged && isFinal) {
        console.log(`[checkPostStatusAtScheduledTime] ✅ Post ${postId} status changed to ${resolvedStatus}`);
        // Avoid duplicate toast - check if we've already shown toast for this post
        // Also check if immediate publish already showed toast
        const toastKey = `${postId}-${resolvedStatus}`;
        const immediatePublishKey = typeof window !== 'undefined' ? sessionStorage.getItem(`immediate-publish-${postId}`) : null;

        if (shownToastForPosts.has(toastKey) || immediatePublishKey === 'true') {
          console.log(`[checkPostStatusAtScheduledTime] Toast already shown for post ${postId} with status ${resolvedStatus}, skipping`);
        } else {
          // Format time detail for toast message
          const scheduledDateTime = new Date(scheduledAt);
          const timeDetail = `${formatTime(scheduledDateTime, 'vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày ${formatDate(scheduledDateTime, 'vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
          const platformName = postPlatform || 'mạng xã hội';

          if (resolvedStatus === 'failed') {
            toast.error(POST_ERRORS.PUBLISH_FAILED_WITH_DETAILS(platformName, timeDetail));
          } else if (resolvedStatus === 'posted') {
            toast.success(`Đăng bài thành công lên ${platformName} lúc ${timeDetail}`);
          }

          // Mark as shown
          shownToastForPosts.add(toastKey);

          // Clean up after 5 minutes to allow re-showing if status changes again
          setTimeout(() => {
            shownToastForPosts.delete(toastKey);
          }, 5 * 60 * 1000);
        }
      }
    } catch (error: any) {
      console.error(`[checkPostStatusAtScheduledTime] Error checking post ${postId}:`, error);
    }
  };

  if (delay <= 0) {
    executeStatusCheck();
    return;
  }

  const statusCheckBuffer = getStatusCheckBuffer(platform);
  const checkDelay = delay + statusCheckBuffer;

  console.log(`[checkPostStatusAtScheduledTime] Will check post ${postId} in ${Math.round(checkDelay / 1000)}s (platform: ${platform || 'unknown'}, buffer: ${Math.round(statusCheckBuffer / 1000)}s, scheduled: ${scheduledAt}, now: ${now.toISOString()})`);

  const timerId = setTimeout(executeStatusCheck, checkDelay);
  scheduledStatusCheckTimers[postId] = timerId;
}

/**
 * Check pending scheduled posts status (fallback when webhook is not called)
 * Also auto-updates calendar events to "publishing" status when scheduled time arrives
 */
export async function checkPendingScheduledPosts(options: {
  onAutoUpdatePublishing?: () => void;
  onStatusUpdates?: (updates: Array<{ postId: string; status: LateLifecycleStatus; url?: string | null; platform?: string | null }>) => void;
  onFinalStatus?: (hasPosted: boolean, hasFailed: boolean) => Promise<void>;
} = {}) {
  try {
    // First, auto-update publishing status for calendar events (UI-only update)
    if (options.onAutoUpdatePublishing) {
      options.onAutoUpdatePublishing();
    }

    const pendingPosts = loadFromLocalStorage<PendingScheduledPost[]>('pendingScheduledPosts', []);
    let pendingEntries: PendingScheduledPost[] = [...pendingPosts];

    if (pendingPosts.length === 0) {
      console.log('[checkPendingScheduledPosts] No pending posts to check');
      return;
    }

    // Cleanup old pending posts (older than 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const validPendingPosts = pendingPosts.filter(p => {
      try {
        const scheduledTime = new Date(p.scheduledAt);
        return !isNaN(scheduledTime.getTime()) && scheduledTime >= sevenDaysAgo;
      } catch {
        return false;
      }
    });

    if (validPendingPosts.length < pendingPosts.length) {
      const removedCount = pendingPosts.length - validPendingPosts.length;
      console.log(`[checkPendingScheduledPosts] Cleaned up ${removedCount} old pending post(s) from localStorage`);
      saveToLocalStorage('pendingScheduledPosts', validPendingPosts);
      pendingEntries = validPendingPosts;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      console.warn('[checkPendingScheduledPosts] No session available');
      return;
    }

    // Batch query all posts at once
    const postIds = pendingPosts.map(p => p.postId);
    const postsToCheckFromDB: string[] = [];
    const postsToRemove: string[] = [];

    if (postIds.length > 0) {
      try {
        const { data: postsData, error: postsError } = await supabaseClient
          .from('scheduled_posts')
          .select('id, status, scheduled_at')
          .in('id', postIds);

        if (postsError) {
          console.error('[checkPendingScheduledPosts] Error batch querying posts:', postsError);
          postsToCheckFromDB.push(...postIds);
        } else {
          const postsMap = new Map<string, { status: string; scheduled_at: string | null }>();
          (postsData || []).forEach(post => {
            postsMap.set(post.id, { status: post.status, scheduled_at: post.scheduled_at });
          });

          const now = new Date();

          for (const p of pendingPosts) {
            const postData = postsMap.get(p.postId);

            if (!postData) {
              console.warn(`[checkPendingScheduledPosts] Post ${p.postId} not found in database, removing from localStorage`);
              postsToRemove.push(p.postId);
              continue;
            }

            const normalizedStatus = normalizeLateLifecycleStatus(postData.status);

            if (isFinalLateStatus(normalizedStatus)) {
              console.log(`[checkPendingScheduledPosts] Post ${p.postId} already has final status: ${normalizedStatus}, removing from localStorage`);
              postsToRemove.push(p.postId);
              continue;
            }

            if (normalizedStatus === 'publishing') {
              postsToCheckFromDB.push(p.postId);
              continue;
            }

            if (normalizedStatus === 'scheduled') {
              const scheduledAt = postData.scheduled_at || p.scheduledAt;
              const scheduledTime = new Date(scheduledAt);

              if (isNaN(scheduledTime.getTime())) {
                console.warn(`[checkPendingScheduledPosts] Invalid scheduledAt for post ${p.postId}: ${scheduledAt}`);
                postsToRemove.push(p.postId);
                continue;
              }

              const checkTime = new Date(scheduledTime.getTime() + 2 * 60 * 1000);

              if (checkTime <= now && !scheduledStatusCheckTimers[p.postId]) {
                postsToCheckFromDB.push(p.postId);
              }
            } else {
              console.warn(`[checkPendingScheduledPosts] Post ${p.postId} has unknown status: ${postData.status}, removing from localStorage`);
              postsToRemove.push(p.postId);
            }
          }
        }
      } catch (dbError: any) {
        console.error('[checkPendingScheduledPosts] Error batch checking posts:', dbError);
        postsToCheckFromDB.push(...postIds);
      }
    }

    // Remove posts that are already in final state or not found
    if (postsToRemove.length > 0) {
      postsToRemove.forEach((postId) => {
        clearPublishingStatusRecheckTimer(postId);
        clearScheduledStatusCheckTimer(postId);
      });
      pendingEntries = pendingEntries.filter(p => !postsToRemove.includes(p.postId));
      saveToLocalStorage('pendingScheduledPosts', pendingEntries);
      console.log(`[checkPendingScheduledPosts] Removed ${postsToRemove.length} posts from localStorage (already in final state or not found)`);
    }

    if (postsToCheckFromDB.length === 0) {
      console.log('[checkPendingScheduledPosts] No posts ready to check yet (all are either already final or not yet due)');
      return;
    }

    console.log(`[checkPendingScheduledPosts] Checking ${postsToCheckFromDB.length} pending posts`);

    const response = await fetch('/api/late/posts/check-pending', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        postIds: postsToCheckFromDB
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[checkPendingScheduledPosts] API error:', errorData);
      return;
    }

    const result = await response.json();
    const data = result?.data ?? result;

    if (data.results && data.results.length > 0) {
      console.log(`[checkPendingScheduledPosts] ✅ Checked ${data.results.length} posts`);

      const pendingMap = new Map(pendingEntries.map((entry) => [entry.postId, entry]));
      const statusUpdates: Array<{ postId: string; status: LateLifecycleStatus; url?: string | null; platform?: string | null }> = [];

      data.results.forEach((r: any) => {
        const resolvedStatus = normalizeLateLifecycleStatus(
          r.postStatus || r.newStatus || r.post?.status
        );
        const postPlatform = r.post?.platform || null;
        const postIdStr = String(r.postId || r.post?.id || '');
        statusUpdates.push({
          postId: postIdStr,
          status: resolvedStatus,
          url: r.post?.post_url || null,
          platform: postPlatform
        });

        const existing = pendingMap.get(r.postId);
        if (!existing) return;

        if (postPlatform) {
          existing.platform = postPlatform;
        }

        if (isFinalLateStatus(resolvedStatus)) {
          pendingMap.delete(r.postId);
        } else {
          pendingMap.set(r.postId, {
            ...existing,
            lastKnownStatus: resolvedStatus
          });
        }
      });

      const pendingAfterApi = Array.from(pendingMap.values());
      saveToLocalStorage('pendingScheduledPosts', pendingAfterApi);

      // Call status updates callback
      if (options.onStatusUpdates) {
        options.onStatusUpdates(statusUpdates);
      }

      // Schedule recheck for publishing posts
      statusUpdates
        .filter((update) => update.status === 'publishing')
        .forEach((update) => {
          const platform = (update as any).platform;
          schedulePublishingStatusRecheck(update.postId, platform, undefined, () => {
            checkPendingScheduledPosts(options);
          });
        });

      statusUpdates
        .filter((update) => isFinalLateStatus(update.status))
        .forEach((update) => {
          clearPublishingStatusRecheckTimer(update.postId);
          clearScheduledStatusCheckTimer(update.postId);
        });

      const hasPosted = statusUpdates.some((s) => s.status === 'posted');
      const hasFailed = statusUpdates.some((s) => s.status === 'failed');

      // Auto-refresh stores when status changes to final
      if (hasPosted) {
        saveToLocalStorage('needsRefreshPublishedPosts', true);
        const publishedStore = usePublishedPostsStore.getState();
        await publishedStore.loadPublishedPosts();
      }
      if (hasFailed) {
        saveToLocalStorage('needsRefreshFailedPosts', true);
        const failedStore = useFailedPostsStore.getState();
        await failedStore.loadFailedPosts();
      }

      if (options.onFinalStatus) {
        await options.onFinalStatus(hasPosted, hasFailed);
      }

      // Sync calendar events with status updates
      const calendarStore = useCalendarStore.getState();
      calendarStore.syncCalendarWithPostStatuses(statusUpdates.filter(u => isFinalLateStatus(u.status)));

      // Show detailed toast messages for each post that changed status
      const statusChangedResults = data.results.filter((r: any) => r.statusChanged && isFinalLateStatus(normalizeLateLifecycleStatus(r.postStatus || r.newStatus || r.post?.status)));
      if (statusChangedResults.length > 0) {
        // Create a map of postId -> scheduledAt before pendingMap is modified
        const scheduledAtMap = new Map<string, string>();
        pendingEntries.forEach(p => {
          scheduledAtMap.set(p.postId, p.scheduledAt);
        });

        statusChangedResults.forEach((r: any) => {
          const resolvedStatus = normalizeLateLifecycleStatus(r.postStatus || r.newStatus || r.post?.status);
          const postPlatform = r.post?.platform || 'mạng xã hội';
          const postIdStr = String(r.postId || r.post?.id || '');
          const scheduledAt = r.post?.scheduled_at || scheduledAtMap.get(postIdStr);
          // Avoid duplicate toast - check if we've already shown toast for this post
          // Also check if immediate publish already showed toast
          const toastKey = `${postIdStr}-${resolvedStatus}`;
          const immediatePublishKey = typeof window !== 'undefined' ? sessionStorage.getItem(`immediate-publish-${postIdStr}`) : null;

          if (shownToastForPosts.has(toastKey) || immediatePublishKey === 'true') {
            console.log(`[checkPendingPostsWithStores] Toast already shown for post ${postIdStr} with status ${resolvedStatus}, skipping`);
            return;
          }

          if (scheduledAt) {
            const scheduledDateTime = new Date(scheduledAt);
            if (!isNaN(scheduledDateTime.getTime())) {
              const timeDetail = `${formatTime(scheduledDateTime, 'vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày ${formatDate(scheduledDateTime, 'vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

              if (resolvedStatus === 'failed') {
                toast.error(POST_ERRORS.PUBLISH_FAILED_WITH_DETAILS(postPlatform, timeDetail));
              } else if (resolvedStatus === 'posted') {
                toast.success(`Đăng bài thành công lên ${postPlatform} lúc ${timeDetail}`);
              }
            } else {
              // Invalid date, use fallback
              if (resolvedStatus === 'failed') {
                toast.error(`Đăng bài thất bại lên ${postPlatform}`);
              } else if (resolvedStatus === 'posted') {
                toast.success(`Đăng bài thành công lên ${postPlatform}`);
              }
            }
          } else {
            // Fallback if no scheduledAt available
            if (resolvedStatus === 'failed') {
              toast.error(`Đăng bài thất bại lên ${postPlatform}`);
            } else if (resolvedStatus === 'posted') {
              toast.success(`Đăng bài thành công lên ${postPlatform}`);
            }
          }

          // Mark as shown
          shownToastForPosts.add(toastKey);

          // Clean up after 5 minutes to allow re-showing if status changes again
          setTimeout(() => {
            shownToastForPosts.delete(toastKey);
          }, 5 * 60 * 1000);
        });
      }
    }

    if (data.errors && data.errors.length > 0) {
      console.warn(`[checkPendingScheduledPosts] ⚠️ ${data.errors.length} errors occurred`);
    }

  } catch (error: any) {
    console.error('[checkPendingScheduledPosts] Error:', error);
  }
}

export async function checkPendingPostsWithStores() {
  const calendarStore = useCalendarStore.getState();
  const publishedStore = usePublishedPostsStore.getState();
  const failedStore = useFailedPostsStore.getState();

  await checkPendingScheduledPosts({
    onAutoUpdatePublishing: () => {
      autoUpdatePublishingStatus(calendarStore.calendarEvents, (updates) => {
        calendarStore.syncCalendarWithPostStatuses(updates);
      });
    },
    onStatusUpdates: (updates) => {
      calendarStore.syncCalendarWithPostStatuses(updates);
    },
    onFinalStatus: async (hasPosted, hasFailed) => {
      if (hasPosted) {
        await publishedStore.loadPublishedPosts();
      }
      if (hasFailed) {
        await failedStore.loadFailedPosts();
      }
    },
  });
}

/**
 * Auto-update calendar events to "publishing" status when scheduled time arrives
 * This only updates UI (calendar events), not database
 */
export async function autoUpdatePublishingStatus(
  calendarEvents: Record<string, any[]>,
  onUpdate: (updates: Array<{ postId: string; status: LateLifecycleStatus }>) => void
) {
  const now = new Date();
  let hasChanges = false;
  const updates: Array<{ postId: string; status: LateLifecycleStatus }> = [];

  const postIdsToCheck: string[] = [];
  const postIdsSet = new Set<string>();

  for (const [dateKey, events] of Object.entries(calendarEvents)) {
    for (const event of events) {
      if (event.scheduled_post_id &&
        (event.status === 'scheduled' || event.noteType === 'yellow') &&
        !postIdsSet.has(event.scheduled_post_id)) {
        postIdsToCheck.push(event.scheduled_post_id);
        postIdsSet.add(event.scheduled_post_id);
      }
    }
  }

  if (postIdsToCheck.length === 0) {
    return;
  }

  const pendingPosts = loadFromLocalStorage<PendingScheduledPost[]>('pendingScheduledPosts', []);
  const pendingPostsMap = new Map<string, PendingScheduledPost>();
  pendingPosts.forEach(p => pendingPostsMap.set(p.postId, p));

  const postIdsToFetchFromDB: string[] = [];

  for (const postId of postIdsToCheck) {
    const pendingPost = pendingPostsMap.get(postId);
    if (pendingPost?.scheduledAt) {
      const scheduledTime = new Date(pendingPost.scheduledAt);
      if (!isNaN(scheduledTime.getTime()) && scheduledTime <= now) {
        updates.push({
          postId,
          status: 'publishing'
        });
        hasChanges = true;
      }
    } else {
      postIdsToFetchFromDB.push(postId);
    }
  }

  if (postIdsToFetchFromDB.length > 0) {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.access_token) {
        const { data: postsData, error } = await supabaseClient
          .from('scheduled_posts')
          .select('id, scheduled_at, status')
          .in('id', postIdsToFetchFromDB)
          .eq('status', 'scheduled');

        if (!error && postsData) {
          for (const post of postsData) {
            if (post.scheduled_at) {
              const scheduledTime = new Date(post.scheduled_at);
              if (!isNaN(scheduledTime.getTime()) && scheduledTime <= now) {
                updates.push({
                  postId: post.id,
                  status: 'publishing'
                });
                hasChanges = true;
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.warn('[autoUpdatePublishingStatus] Error fetching scheduled_at from database:', error);
    }
  }

  if (hasChanges && updates.length > 0) {
    console.log(`[autoUpdatePublishingStatus] Updating ${updates.length} post(s) to "publishing" status`);
    onUpdate(updates);
  }
}

/**
 * Initialize pending scheduled posts watcher
 * Should be called once on app startup
 */
export function initializePendingPostsWatcher(options: {
  onCheckPending: () => void;
  onRestoreWatchers: (pendingPosts: PendingScheduledPost[]) => void;
}) {
  if (typeof window === "undefined") return;

  if ((window as any).__pendingScheduledPostsWatcherInitialized) {
    return;
  }

  (window as any).__pendingScheduledPostsWatcherInitialized = true;

  const restorePendingScheduledPostWatchers = () => {
    const pendingPosts = loadFromLocalStorage<PendingScheduledPost[]>("pendingScheduledPosts", []);
    if (!pendingPosts.length) {
      return;
    }
    options.onRestoreWatchers(pendingPosts);
  };

  const runPendingChecks = () => {
    // Tối ưu: Chỉ gọi onCheckPending khi thực sự có pending posts trong localStorage
    // Tránh việc spam log "[checkPendingScheduledPosts] No pending posts to check" và gọi API không cần thiết
    const pendingPosts = loadFromLocalStorage<PendingScheduledPost[]>("pendingScheduledPosts", []);
    if (!pendingPosts.length) {
      return;
    }
    options.onCheckPending();
  };

  restorePendingScheduledPostWatchers();

  // window.addEventListener("focus", runPendingChecks); // DISABLED: Prevent API spam on tab focus
  (window as any).__pendingScheduledPostsIntervalId = window.setInterval(
    runPendingChecks,
    PENDING_CHECK_INTERVAL_MS
  );

  window.addEventListener("beforeunload", () => {
    if ((window as any).__pendingScheduledPostsIntervalId) {
      window.clearInterval((window as any).__pendingScheduledPostsIntervalId);
    }
    // window.removeEventListener("focus", runPendingChecks);
  });
}

