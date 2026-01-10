/**
 * Create Page - Publish Store
 * 
 * Manages post publishing and scheduling
 */

import { create } from 'zustand';
import { saveToLocalStorage, loadFromLocalStorage } from '@/lib/utils/storage';
import { supabaseClient } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { useConnectionsStore } from '../shared/connections';
import { useCalendarStore } from '../shared/calendar';
import { usePublishedPostsStore } from '../published/publishedPageStore';
import { useFailedPostsStore } from '../failed/failedPageStore';
import { useCreditsStore } from '../shared/credits';
import { useLimitExceededModalStore } from '../shared/limitExceededModal';
import { checkPostStatusAtScheduledTime } from '../shared/statusCheck';
import { handleErrorWithModal } from '@/lib/utils/errorHandler';
import { LIMIT_ERRORS, AUTH_ERRORS, CONNECTION_ERRORS, POST_ERRORS, MEDIA_ERRORS, GENERIC_ERRORS } from '@/lib/messages/errors';
import type { MediaFile, PendingScheduledPost, PublishedPost } from '../shared/types';
import { CalendarEvent } from '@/lib/types/calendar';
import { formatDate, formatTime } from '@/lib/utils/date';

interface CreatePublishState {
  // Actions
  handlePublish: (
    postId: number,
    post: { id: number; type: string },
    content: string,
    postMedia: MediaFile[],
    options: {
      onPostDelete?: (postId: number) => void;
      onLoadFailedPosts?: () => void;
    },
    overrides?: {
      connectedAccountId?: string;
      isShorts?: boolean;
    }
  ) => Promise<void>;

  schedulePost: (
    postId: number,
    post: { id: number; type: string },
    content: string,
    postMedia: MediaFile[],
    date: Date,
    time: string,
    options: {
      onPostDelete?: (postId: number) => void;
      onLoadFailedPosts?: () => void;
      isShorts?: boolean;
    }
  ) => Promise<void>;
}

export const useCreatePublishStore = create<CreatePublishState>(() => ({
  handlePublish: async (postId, post, content, postMedia, options, overrides) => {
    if (!content.trim()) {
      toast.warning(POST_ERRORS.CANNOT_PUBLISH_EMPTY);
      return;
    }

    // FE Validation: Check post limit before publishing
    const creditsStore = useCreditsStore.getState();
    await creditsStore.refreshCredits(true); // Force refresh to get latest limits
    const postLimits = useCreditsStore.getState().postLimits;

    if (postLimits && postLimits.limit !== -1 && postLimits.current >= postLimits.limit) {
      // Show limit exceeded modal
      const errorMessage = `Bạn đã đăng tối đa số bài post trong tháng (${postLimits.current}/${postLimits.limit} bài). Nâng cấp gói plan của bạn để tiếp tục đăng bài.`;
      useLimitExceededModalStore.getState().openModal('post_limit_reached', errorMessage, {
        profileUsage: useCreditsStore.getState().profileLimits,
        postUsage: postLimits,
        creditsRemaining: useCreditsStore.getState().creditsRemaining,
        currentPlan: useCreditsStore.getState().currentPlan,
      });
      // Still show error toast
      toast.error(errorMessage);
      return;
    }

    // Get connected accounts
    const connectionsStore = useConnectionsStore.getState();
    let connectedAccounts = connectionsStore.connectedAccounts;
    if (!connectedAccounts || connectedAccounts.length === 0) {
      await connectionsStore.loadConnectedAccounts();
      connectedAccounts = connectionsStore.connectedAccounts;
    }

    const platformProvider = post.type.toLowerCase();
    const account = overrides?.connectedAccountId
      ? connectedAccounts.find((acc: any) => acc.id === overrides.connectedAccountId)
      : connectedAccounts.find(
        (acc: any) => acc.platform?.toLowerCase() === platformProvider
      );

    if (!account) {
      toast.error(CONNECTION_ERRORS.ACCOUNT_NOT_CONNECTED(post.type));
      return;
    }

    let publishingToastId: string | number | undefined;
    try {
      publishingToastId = toast.loading("Đang đăng bài lên mạng xã hội, vui lòng đợi...");
      const mediaUrls: string[] = [];

      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        toast.error(AUTH_ERRORS.LOGIN_REQUIRED_PUBLISH);
        return;
      }

      // Validate Facebook: Cannot mix videos and images
      const platform = post.type?.toLowerCase();
      if (platform === 'facebook' && postMedia.length > 0) {
        const hasVideo = postMedia.some((m: any) => m.type === 'video');
        const hasImage = postMedia.some((m: any) => m.type === 'image');

        if (hasVideo && hasImage) {
          toast.error(POST_ERRORS.FACEBOOK_MIXED_MEDIA);
          if (publishingToastId) toast.dismiss(publishingToastId);
          return;
        }
      }

      // Process each media file
      for (const media of postMedia) {
        if (!media.preview) continue;

        if (media.preview.startsWith('http://') || media.preview.startsWith('https://')) {
          // Already uploaded media (existing URL)
          mediaUrls.push(media.preview);
        } else if (media.preview.startsWith('blob:')) {
          try {
            const blobResponse = await fetch(media.preview);
            const blob = await blobResponse.blob();
            const fileName = media.file?.name || `media-${Date.now()}.${media.type === 'image' ? 'jpg' : 'mp4'}`;
            const contentType = media.type === 'image' ? (blob.type || 'image/jpeg') : (blob.type || 'video/mp4');

            // Step 1: request presigned URL from Server A -> Server B
            const presignRes = await fetch('/api/files/presign-upload', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                filename: fileName,
                contentType,
                contentLength: blob.size,
                prefix: 'posts/media'
              })
            });

            const presignJson = await presignRes.json();
            if (!presignRes.ok || !presignJson?.success) {
              console.error('[handlePublish] Failed to get presigned URL:', presignJson);
              toast.warning(MEDIA_ERRORS.UPLOAD_FAILED(presignJson?.error || GENERIC_ERRORS.UNKNOWN_ERROR));
              continue;
            }

            const { signed_url, upload_url } = presignJson.data || presignJson;
            if (!signed_url || !upload_url) {
              console.error('[handlePublish] Invalid presign response:', presignJson);
              toast.warning(MEDIA_ERRORS.UPLOAD_FAILED('Không thể chuẩn bị URL upload cho media.'));
              continue;
            }

            // Step 2: upload directly from FE to S3 using presigned URL
            const putRes = await fetch(signed_url, {
              method: 'PUT',
              headers: {
                'Content-Type': contentType
              },
              body: blob
            });

            if (!putRes.ok) {
              console.error('[handlePublish] Failed to upload media to S3:', await putRes.text());
              toast.warning(MEDIA_ERRORS.UPLOAD_FAILED('Upload media lên server thất bại.'));
              continue;
            }

            mediaUrls.push(upload_url);
            console.log(`[handlePublish] Uploaded media to S3 via Server B: ${upload_url}`);
          } catch (uploadError: any) {
            console.error(`[handlePublish] Error uploading media via presigned URL:`, uploadError);
            toast.warning(MEDIA_ERRORS.UPLOAD_FAILED(uploadError.message || GENERIC_ERRORS.UNKNOWN_ERROR));
          }
        }
      }

      // Determine contentType: For Facebook, always use 'regular' (not reel) unless explicitly set
      // For YouTube, use 'shorts' if requested
      const contentType = overrides?.isShorts
        ? 'shorts'
        : (platform === 'facebook' ? 'regular' : undefined);

      // Call API to publish immediately
      const response = await fetch('/api/late/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          connectedAccountId: account.id,
          text: content,
          mediaUrls: mediaUrls,
          scheduledAt: null,
          contentType: contentType
        })
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: response.statusText || 'Không thể đăng bài.' };
        }

        // If post was saved to DB with failed status, reload failed posts
        if (errorData.scheduledPost) {
          console.log('[handlePublish] Post failed but was saved to DB, reloading failed posts...');
          saveToLocalStorage('needsRefreshFailedPosts', true);
          if ((globalThis as any).reloadFailedPostsTimeout) {
            clearTimeout((globalThis as any).reloadFailedPostsTimeout);
          }
          (globalThis as any).reloadFailedPostsTimeout = setTimeout(() => {
            (globalThis as any).reloadFailedPostsTimeout = null;
            if (options.onLoadFailedPosts) {
              options.onLoadFailedPosts();
            }
          }, 1000);
        }

        // Format time detail for error message
        const now = new Date();
        const timeDetail = `${formatTime(now, 'vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày ${formatDate(now, 'vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
        const platformName = post.type || 'mạng xã hội';

        // Handle error with modal (will show both toast and modal if it's a limit/credits error)
        const detailedErrorMessage = POST_ERRORS.PUBLISH_FAILED_WITH_DETAILS(platformName, timeDetail);
        await handleErrorWithModal(errorData, detailedErrorMessage);

        // Error already handled (toast + modal shown), no need to throw
        // Just dismiss loading toast and return
        if (publishingToastId) {
          toast.dismiss(publishingToastId);
        }
        return;
      }

      const result = await response.json();
      const data = result?.data ?? result;

      // Update published posts
      const now = new Date();
      const publishedPost: PublishedPost = {
        id: postId,
        platform: post.type,
        content: content,
        time: now.toISOString(),
        status: 'posted',
        url: data?.latePost?.url || `https://${post.type.toLowerCase()}.com/post/${postId}`,
        engagement: { likes: 0, comments: 0, shares: 0 }
      };

      const publishedStore = usePublishedPostsStore.getState();
      const updatedPublished = [...publishedStore.publishedPosts, publishedPost];
      usePublishedPostsStore.setState({ publishedPosts: updatedPublished.slice(-1000) });

      // Update calendar events
      const pad = (n: number) => String(n).padStart(2, '0');
      const time24h = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

      const newCalendarEvent: CalendarEvent = {
        id: `event-${Date.now()}`,
        platform: post.type,
        time: time24h,
        status: 'posted',
        noteType: 'green',
        content: content,
        url: publishedPost.url
      };

      const calendarStore = useCalendarStore.getState();
      const updatedEvents = { ...calendarStore.calendarEvents };
      updatedEvents[dateKey] = [...(updatedEvents[dateKey] || []), newCalendarEvent];
      useCalendarStore.setState({ calendarEvents: updatedEvents });
      saveToLocalStorage('calendarEvents', updatedEvents);

      // Mark toast as shown to avoid duplicate from statusCheck
      const toastKey = `${postId}-posted`;
      if (typeof window !== 'undefined') {
        // Use a simple flag in sessionStorage to track immediate publish toasts
        // This prevents duplicate toast if statusCheck also triggers
        const immediatePublishKey = `immediate-publish-${postId}`;
        sessionStorage.setItem(immediatePublishKey, 'true');
        // Clean up after 5 minutes
        setTimeout(() => {
          sessionStorage.removeItem(immediatePublishKey);
        }, 5 * 60 * 1000);
      }

      toast.success(`Bài viết "${post.type}" đã được đăng thành công!`, {
        id: publishingToastId
      });

      // Delete post after successful publish
      if (options.onPostDelete) {
        options.onPostDelete(postId);
      }
    } catch (error) {
      // This catch block handles unexpected errors (network errors, etc.)
      // API errors are already handled in the try block with handleErrorWithModal
      console.error('Error publishing post:', error);

      // Dismiss loading toast if it exists
      if (publishingToastId) {
        toast.dismiss(publishingToastId);
      }

      // Show error toast for unexpected errors (network, etc.)
      const now = new Date();
      const timeDetail = `${formatTime(now, 'vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày ${formatDate(now, 'vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
      const platformName = post.type || 'mạng xã hội';
      const detailedErrorMessage = POST_ERRORS.PUBLISH_FAILED_WITH_DETAILS(platformName, timeDetail);
      await handleErrorWithModal(error, detailedErrorMessage);
    }
  },

  schedulePost: async (postId, post, content, postMedia, date, time, options) => {
    if (!content.trim()) {
      toast.warning(POST_ERRORS.CANNOT_SCHEDULE_EMPTY);
      return;
    }

    // FE Validation: Check post limit before scheduling
    const creditsStore = useCreditsStore.getState();
    await creditsStore.refreshCredits(true); // Force refresh to get latest limits
    const postLimits = useCreditsStore.getState().postLimits;

    if (postLimits && postLimits.limit !== -1 && postLimits.current >= postLimits.limit) {
      // Show limit exceeded modal
      const errorMessage = `Bạn đã đăng tối đa số bài post trong tháng (${postLimits.current}/${postLimits.limit} bài). Nâng cấp gói plan của bạn để tiếp tục đăng bài.`;
      useLimitExceededModalStore.getState().openModal('post_limit_reached', errorMessage, {
        profileUsage: useCreditsStore.getState().profileLimits,
        postUsage: postLimits,
        creditsRemaining: useCreditsStore.getState().creditsRemaining,
        currentPlan: useCreditsStore.getState().currentPlan,
      });
      // Still show error toast
      toast.error(errorMessage);
      return;
    }

    // Convert time from AM/PM to 24h format
    const [hStr, rest] = String(time || '').split(':');
    let hour = parseInt(hStr || '0', 10);
    let minute = parseInt((rest || '0').slice(0, 2) || '0', 10);
    const ampm = (time || '').toUpperCase().includes('PM');
    if (ampm && hour < 12) hour += 12;
    if (!ampm && hour === 12) hour = 0;
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
    const time24 = `${pad(hour)}:${pad(minute)}`;

    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const scheduledDateTime = new Date(date);
    scheduledDateTime.setHours(hour, minute, 0, 0);
    const scheduledAt = scheduledDateTime.toISOString();

    console.log(`[schedulePost] Local time: ${hour}:${minute}, Timezone: ${userTimezone}, UTC ISO: ${scheduledAt}`);

    let schedulingToastId: string | number | undefined;
    try {
      schedulingToastId = toast.loading("Đang lên lịch bài đăng, vui lòng chờ...");
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        toast.error(AUTH_ERRORS.LOGIN_REQUIRED_SCHEDULE);
        return;
      }

      // Get connected accounts
      const connectionsStore = useConnectionsStore.getState();
      let connectedAccounts = connectionsStore.connectedAccounts;
      if (!connectedAccounts || connectedAccounts.length === 0) {
        await connectionsStore.loadConnectedAccounts();
        connectedAccounts = connectionsStore.connectedAccounts;
      }

      if (!connectedAccounts || connectedAccounts.length === 0) {
        throw new Error('Không tìm thấy tài khoản đã kết nối. Vui lòng kết nối tài khoản trước khi lên lịch bài đăng.');
      }

      const platform = post.type || 'general';
      const platformProfiles = connectedAccounts.filter(
        (account: any) => account.platform?.toLowerCase() === platform.toLowerCase()
      );

      if (platformProfiles.length === 0) {
        throw new Error(POST_ERRORS.NO_ACCOUNT_FOR_PLATFORM(platform));
      }

      // Validate Facebook: Cannot mix videos and images
      if (platform.toLowerCase() === 'facebook' && postMedia.length > 0) {
        const hasVideo = postMedia.some((m: any) => m.type === 'video');
        const hasImage = postMedia.some((m: any) => m.type === 'image');

        if (hasVideo && hasImage) {
          toast.error(POST_ERRORS.FACEBOOK_MIXED_MEDIA);
          if (schedulingToastId) toast.dismiss(schedulingToastId);
          return;
        }
      }

      // Upload media files
      const mediaUrls: string[] = [];

      for (const media of postMedia) {
        if (!media.preview) continue;

        if (media.preview.startsWith('http://') || media.preview.startsWith('https://')) {
          mediaUrls.push(media.preview);
        } else if (media.preview.startsWith('blob:')) {
          try {
            const blobResponse = await fetch(media.preview);
            const blob = await blobResponse.blob();
            const fileName = media.file?.name || `media-${Date.now()}.${media.type === 'image' ? 'jpg' : 'mp4'}`;
            const contentType = media.type === 'image' ? (blob.type || 'image/jpeg') : (blob.type || 'video/mp4');

            // Step 1: request presigned URL from Server A -> Server B
            const presignRes = await fetch('/api/files/presign-upload', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                filename: fileName,
                contentType,
                contentLength: blob.size,
                prefix: 'posts/media'
              })
            });

            const presignJson = await presignRes.json();
            if (!presignRes.ok || !presignJson?.success) {
              console.error('[schedulePost] Failed to get presigned URL:', presignJson);
              toast.warning(MEDIA_ERRORS.UPLOAD_FAILED(presignJson?.error || GENERIC_ERRORS.UNKNOWN_ERROR));
              continue;
            }

            const { signed_url, upload_url } = presignJson.data || presignJson;
            if (!signed_url || !upload_url) {
              console.error('[schedulePost] Invalid presign response:', presignJson);
              toast.warning(MEDIA_ERRORS.UPLOAD_FAILED('Không thể chuẩn bị URL upload cho media.'));
              continue;
            }

            // Step 2: upload directly from FE to S3 using presigned URL
            const putRes = await fetch(signed_url, {
              method: 'PUT',
              headers: {
                'Content-Type': contentType
              },
              body: blob
            });

            if (!putRes.ok) {
              console.error('[schedulePost] Failed to upload media to S3:', await putRes.text());
              toast.warning(MEDIA_ERRORS.UPLOAD_FAILED('Upload media lên server thất bại.'));
              continue;
            }

            mediaUrls.push(upload_url);
            console.log(`[schedulePost] Uploaded media to S3 via Server B: ${upload_url}`);
          } catch (uploadError: any) {
            console.error(`[schedulePost] Error uploading blob media via presigned URL:`, uploadError);
            toast.warning(MEDIA_ERRORS.UPLOAD_FAILED(uploadError.message || GENERIC_ERRORS.UNKNOWN_ERROR));
          }
        }
      }

      // Determine contentType: For Facebook, always use 'regular' (not reel)
      // For YouTube, use 'shorts' if requested
      const contentType = options.isShorts
        ? 'shorts'
        : (platform.toLowerCase() === 'facebook' ? 'regular' : undefined);

      const postsPayload = [{
        platform: platform,
        profileIds: platformProfiles.map((p: any) => p.id),
        text: content,
        mediaUrls: mediaUrls,
        contentType: contentType
      }];

      // Call API to schedule
      const response = await fetch('/api/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          scheduledAt: scheduledAt,
          timezone: userTimezone,
          posts: postsPayload
        })
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: response.statusText || 'Không thể lên lịch bài đăng.' };
        }

        // If post was saved to DB with failed status, reload failed posts
        if (errorData.scheduledPost) {
          console.log('[schedulePost] Post failed but was saved to DB, reloading failed posts...');
          saveToLocalStorage('needsRefreshFailedPosts', true);
          if ((globalThis as any).reloadFailedPostsTimeout) {
            clearTimeout((globalThis as any).reloadFailedPostsTimeout);
          }
          (globalThis as any).reloadFailedPostsTimeout = setTimeout(() => {
            (globalThis as any).reloadFailedPostsTimeout = null;
            if (options.onLoadFailedPosts) {
              options.onLoadFailedPosts();
            }
          }, 1000);
        }

        // Format time detail for error message
        const scheduledDateTime = new Date(scheduledAt);
        const timeDetail = `${formatTime(scheduledDateTime, 'vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày ${formatDate(scheduledDateTime, 'vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
        const platformName = platform || 'mạng xã hội';

        // Handle error with modal (will show both toast and modal if it's a limit/credits error)
        const detailedErrorMessage = POST_ERRORS.PUBLISH_FAILED_WITH_DETAILS(platformName, timeDetail);
        await handleErrorWithModal(errorData, detailedErrorMessage);

        // Error already handled (toast + modal shown), no need to throw
        // Just dismiss loading toast and return
        if (schedulingToastId) {
          toast.dismiss(schedulingToastId);
        }
        return;
      }

      const result = await response.json();
      const data = result?.data ?? result;
      const scheduledPosts = data?.scheduledPosts || [];

      // Save scheduled posts to localStorage
      const pendingScheduledPosts = loadFromLocalStorage<PendingScheduledPost[]>('pendingScheduledPosts', []);

      scheduledPosts.forEach((sp: any) => {
        if (sp.id && sp.late_job_id && sp.scheduled_at) {
          const exists = pendingScheduledPosts.find(p => p.postId === sp.id);
          if (!exists) {
            let scheduledAtISO: string;
            if (typeof sp.scheduled_at === 'string') {
              scheduledAtISO = sp.scheduled_at;
            } else if (sp.scheduled_at instanceof Date) {
              scheduledAtISO = sp.scheduled_at.toISOString();
            } else {
              const dateObj = new Date(sp.scheduled_at);
              if (isNaN(dateObj.getTime())) {
                console.warn(`[schedulePost] Invalid scheduled_at for post ${sp.id}: ${sp.scheduled_at}`);
                return;
              }
              scheduledAtISO = dateObj.toISOString();
            }

            pendingScheduledPosts.push({
              postId: sp.id,
              lateJobId: sp.late_job_id,
              scheduledAt: scheduledAtISO,
              platform: sp.platform || '',
              content: sp.payload?.text_content || sp.payload?.text || '',
              lastKnownStatus: 'scheduled'
            });
          }
        }
      });

      saveToLocalStorage('pendingScheduledPosts', pendingScheduledPosts);
      console.log(`[schedulePost] Saved ${scheduledPosts.length} scheduled posts to localStorage for status checking`);

      // Schedule status checks for each post
      scheduledPosts.forEach((sp: any) => {
        if (sp.id && sp.scheduled_at) {
          checkPostStatusAtScheduledTime(sp.id, sp.scheduled_at, sp.platform, {
            onStatusUpdate: (status, url) => {
              useCalendarStore.getState().syncCalendarWithPostStatuses([{
                postId: String(sp.id),
                status,
                url
              }]);
            },
            onFinalStatus: async (status) => {
              if (status === 'posted') {
                saveToLocalStorage('needsRefreshPublishedPosts', true);
                usePublishedPostsStore.getState().loadPublishedPosts();
              } else if (status === 'failed') {
                saveToLocalStorage('needsRefreshFailedPosts', true);
                if (options.onLoadFailedPosts) {
                  options.onLoadFailedPosts();
                }
              }
            },
            onPublishingStatus: (postId, platform) => {
              // Schedule recheck will be handled by statusCheck module
            }
          });
        }
      });

      // Add calendar events
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const calendarEvents: CalendarEvent[] = [];

      scheduledPosts.forEach((scheduledPost: any) => {
        const eventId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        calendarEvents.push({
          id: eventId,
          platform: platform,
          time: time24,
          status: 'scheduled',
          noteType: 'yellow',
          content: content,
          scheduled_post_id: scheduledPost.id
        });
      });

      const calendarStore = useCalendarStore.getState();
      const updatedEvents = { ...calendarStore.calendarEvents };
      updatedEvents[key] = [...(updatedEvents[key] || []), ...calendarEvents];
      useCalendarStore.setState({ calendarEvents: updatedEvents });
      saveToLocalStorage('calendarEvents', updatedEvents);

      // Show success message
      const formattedDate = date.toLocaleDateString('vi-VN');
      const scheduledCount = scheduledPosts.length;
      const successMessage = `Đã lên lịch ${scheduledCount} bài đăng cho ${platform} vào ${time} ngày ${formattedDate}.`;
      if (schedulingToastId) {
        toast.success(successMessage, { id: schedulingToastId });
      } else {
        toast.success(successMessage);
      }

      // Delete post after successful schedule
      if (options.onPostDelete) {
        options.onPostDelete(postId);
      }

    } catch (error) {
      // This catch block handles unexpected errors (network errors, etc.)
      // API errors are already handled in the try block with handleErrorWithModal
      console.error('Error scheduling post:', error);

      // Dismiss loading toast if it exists
      if (schedulingToastId) {
        toast.dismiss(schedulingToastId);
      }

      // Show error toast for unexpected errors (network, etc.)
      const scheduledDateTime = new Date(scheduledAt);
      const timeDetail = `${formatTime(scheduledDateTime, 'vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày ${formatDate(scheduledDateTime, 'vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
      const platformName = post.type || 'mạng xã hội';
      const detailedErrorMessage = POST_ERRORS.PUBLISH_FAILED_WITH_DETAILS(platformName, timeDetail);
      await handleErrorWithModal(error, detailedErrorMessage);
    }
  },
}));

