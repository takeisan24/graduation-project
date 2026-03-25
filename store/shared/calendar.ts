/**
 * Calendar Store
 * 
 * Manages calendar events and syncs with post statuses
 */

import { create } from 'zustand';
import { saveToLocalStorage, loadFromLocalStorage, removeFromLocalStorage, cleanupOldLocalStorageData } from '@/lib/utils/storage';
import { CalendarEvent, CalendarEventType } from '@/lib/types/calendar';
import { toast } from 'sonner';
import { supabaseClient } from '@/lib/supabaseClient';
import type { LateLifecycleStatus, PendingScheduledPost } from './types';
import { normalizeLateLifecycleStatus, isFinalLateStatus } from './utils';
import { statusToNoteTypeMap } from './constants';
import { AUTH_ERRORS, CALENDAR_ERRORS, GENERIC_ERRORS } from '@/lib/messages/errors';

export interface CalendarState {
  // State
  calendarEvents: Record<string, CalendarEvent[]>;

  // Actions
  handleEventAdd: (year: number, month: number, day: number, platform: string, time?: string) => void;
  handleEventUpdate: (oldYear: number, oldMonth: number, oldDay: number, oldEvent: CalendarEvent, newYear: number, newMonth: number, newDay: number, newTime?: string) => Promise<void>;
  handleEventDelete: (year: number, month: number, day: number, event: CalendarEvent) => Promise<void>;
  handleClearCalendarEvents: () => void;
  syncCalendarWithPostStatuses: (
    updates: Array<{ postId: string; status: LateLifecycleStatus; url?: string | null }>,
    options?: {
      onStatusChangedToFailed?: () => void;
      onStatusChangedToPosted?: () => void;
    }
  ) => void;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  // Initial state - load from localStorage and cleanup old data
  calendarEvents: (() => {
    const events = loadFromLocalStorage('calendarEvents', {});
    cleanupOldLocalStorageData(); // Cleanup old calendar events and pending posts
    return events;
  })(),

  handleEventAdd: (year, month, day, platform, time = '') => {
    const key = `${year}-${month}-${day}`;
    const eventId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newEvent: CalendarEvent = {
      id: eventId,
      platform,
      time: time,
      status: 'Trống',
      noteType: 'yellow'
    };
    set(state => {
      const updatedDayEvents = [...(state.calendarEvents[key] || []), newEvent];
      const updatedEvents = {
        ...state.calendarEvents,
        [key]: updatedDayEvents
      };
      saveToLocalStorage('calendarEvents', updatedEvents);
      return { calendarEvents: updatedEvents };
    });
  },

  handleEventDelete: async (year, month, day, event) => {
    // If event has scheduled_post_id, call API to delete on getlate.dev
    if (event.scheduled_post_id) {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session?.access_token) {
          toast.error(AUTH_ERRORS.LOGIN_REQUIRED_DELETE);
          return;
        }

        const response = await fetch(`/api/late/posts/${event.scheduled_post_id}`, {
          method: 'DELETE',
          headers: {
            'authorization': `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Không thể xóa bài đăng.');
        }

        // Remove from pendingScheduledPosts in localStorage
        const pendingPosts = loadFromLocalStorage<PendingScheduledPost[]>('pendingScheduledPosts', []);
        const updatedPending = pendingPosts.filter(p => p.postId !== event.scheduled_post_id);
        saveToLocalStorage('pendingScheduledPosts', updatedPending);

        toast.success("Đã xóa bài đăng trên getlate.dev.");
      } catch (error: any) {
        toast.error(CALENDAR_ERRORS.DELETE_FAILED(error.message || GENERIC_ERRORS.UNKNOWN_ERROR));
        return; // Don't delete from local state if API call failed
      }
    }

    set(state => {
      const key = `${year}-${month}-${day}`;
      if (!state.calendarEvents[key]) {
        return {};
      }

      const updatedDayEvents = state.calendarEvents[key].filter(ev => ev.id !== event.id);
      const updatedEvents = { ...state.calendarEvents };

      if (updatedDayEvents.length > 0) {
        updatedEvents[key] = updatedDayEvents;
      } else {
        delete updatedEvents[key];
      }

      saveToLocalStorage('calendarEvents', updatedEvents);
      return { calendarEvents: updatedEvents };
    });
  },

  handleEventUpdate: async (oldYear, oldMonth, oldDay, oldEvent, newYear, newMonth, newDay, newTime) => {
    // If event has scheduled_post_id, call API to reschedule on getlate.dev
    if (oldEvent.scheduled_post_id && newTime) {
      try {
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const newDate = new Date(newYear, newMonth, newDay);
        const [hStr, rest] = String(newTime || '').split(':');
        let hour = parseInt(hStr || '0', 10);
        let minute = parseInt((rest || '0').slice(0, 2) || '0', 10);
        newDate.setHours(hour, minute, 0, 0);
        const newScheduleAt = newDate.toISOString();

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session?.access_token) {
          toast.error(AUTH_ERRORS.LOGIN_REQUIRED_UPDATE_SCHEDULE);
          return;
        }

        const response = await fetch(`/api/late/posts/${oldEvent.scheduled_post_id}/reschedule`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            newScheduleAt,
            timezone: userTimezone
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Không thể cập nhật lịch đăng.');
        }

        const result = await response.json();
        const rescheduleData = result?.data ?? result;
        const updatedPost = rescheduleData?.post;

        // Update pendingScheduledPosts in localStorage with new scheduled time
        const pendingPosts = loadFromLocalStorage<PendingScheduledPost[]>('pendingScheduledPosts', []);
        const updatedPending = [
          ...pendingPosts.filter(p => p.postId !== oldEvent.scheduled_post_id),
          {
            postId: oldEvent.scheduled_post_id!,
            lateJobId: updatedPost?.late_job_id || null,
            scheduledAt: newScheduleAt,
            platform: oldEvent.platform,
            content: oldEvent.content || '',
            lastKnownStatus: 'scheduled'
          }
        ];
        saveToLocalStorage('pendingScheduledPosts', updatedPending);

        // Note: checkPostStatusAtScheduledTime should be called from the calling store
        // This keeps calendar store focused on calendar events only

        toast.success("Đã cập nhật lịch đăng thành công.");
      } catch (error: any) {
        toast.error(CALENDAR_ERRORS.UPDATE_SCHEDULE_FAILED(error.message || GENERIC_ERRORS.UNKNOWN_ERROR));
        return; // Don't update local state if API call failed
      }
    }

    set(state => {
      const oldKey = `${oldYear}-${oldMonth}-${oldDay}`;
      const newKey = `${newYear}-${newMonth}-${newDay}`;
      const updatedEvents = { ...state.calendarEvents };

      // Remove from old date
      if (updatedEvents[oldKey]) {
        const newOldDayEvents = updatedEvents[oldKey].filter(ev => ev.id !== oldEvent.id);
        if (newOldDayEvents.length > 0) {
          updatedEvents[oldKey] = newOldDayEvents;
        } else {
          delete updatedEvents[oldKey];
        }
      }

      // Add to new date
      const updatedEvent = {
        ...oldEvent,
        time: newTime === undefined ? oldEvent.time : newTime,
        noteType: oldEvent.scheduled_post_id ? 'yellow' : oldEvent.noteType,
        status: oldEvent.scheduled_post_id ? 'scheduled' : oldEvent.status
      };
      const newNewDayEvents = [...(updatedEvents[newKey] || []), updatedEvent];
      newNewDayEvents.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      updatedEvents[newKey] = newNewDayEvents;

      saveToLocalStorage('calendarEvents', updatedEvents);
      return { calendarEvents: updatedEvents };
    });
  },

  handleClearCalendarEvents: () => {
    set({ calendarEvents: {} });
    removeFromLocalStorage('calendarEvents');
  },

  syncCalendarWithPostStatuses: (updates, options) => {
    if (!updates || updates.length === 0) return;

    // Normalize all postIds to strings for consistent matching
    const updateMap = updates.reduce<Record<string, { noteType: CalendarEventType; status: LateLifecycleStatus; url?: string | null }>>((acc, item) => {
      const normalizedStatus = normalizeLateLifecycleStatus(item.status);
      const postIdStr = String(item.postId || '');
      acc[postIdStr] = {
        noteType: statusToNoteTypeMap[normalizedStatus],
        status: normalizedStatus,
        url: item.url
      };
      return acc;
    }, {});

    set((state) => {
      let changed = false;
      let statusActuallyChangedToFailed = false;
      let statusActuallyChangedToPosted = false;
      const updatedEvents: Record<string, CalendarEvent[]> = {};
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

      // Iterate through all calendar events and update matching ones
      for (const [dateKey, events] of Object.entries(state.calendarEvents)) {
        const [year, month, day] = dateKey.split('-').map(Number);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          const eventDate = new Date(year, month, day);
          if (eventDate < threeMonthsAgo) {
            continue;
          }
        }

        const newEvents = events.map((event) => {
          if (!event.scheduled_post_id) return event;

          const eventPostIdStr = String(event.scheduled_post_id);
          const update = updateMap[eventPostIdStr];
          if (!update) return event;

          const previousStatus = event.status || 'scheduled';

          // Update URL: if update.url is provided (even if null), use it
          // This ensures URL is synced when post is successfully posted
          // If update.url is undefined, keep existing event.url
          // Convert null to undefined to match CalendarEvent.url type
          let updatedUrl = event.url;
          if (update.url !== undefined) {
            // If update.url is explicitly provided (including null), use it
            // Convert null to undefined to match CalendarEvent.url type (string | undefined)
            updatedUrl = update.url ?? undefined;
          }

          const nextEvent: CalendarEvent = {
            ...event,
            noteType: update.noteType,
            status: update.status,
            isPublished: update.status === 'posted',
            isFailed: update.status === 'failed',
            url: updatedUrl
          };

          // Skip reload if this is a sync from loadFailedPosts/loadPublishedPosts (prevent infinite loop)
          const isSyncFromLoad = (update as any)._isSyncFromLoad;
          if (!isSyncFromLoad) {
            const statusChanged = nextEvent.status !== previousStatus;
            if (statusChanged) {
              if (update.status === 'failed' && previousStatus !== 'failed') {
                statusActuallyChangedToFailed = true;
              }
              if (update.status === 'posted' && previousStatus !== 'posted') {
                statusActuallyChangedToPosted = true;
              }
            }
          }

          if (
            nextEvent.noteType !== event.noteType ||
            nextEvent.status !== event.status ||
            nextEvent.url !== event.url ||
            nextEvent.isPublished !== event.isPublished ||
            nextEvent.isFailed !== event.isFailed
          ) {
            changed = true;
          }

          return nextEvent;
        });

        if (newEvents.length > 0) {
          updatedEvents[dateKey] = newEvents;
        }
      }

      // Call callbacks if status changed
      if (statusActuallyChangedToFailed && options?.onStatusChangedToFailed) {
        options.onStatusChangedToFailed();
      }
      if (statusActuallyChangedToPosted && options?.onStatusChangedToPosted) {
        options.onStatusChangedToPosted();
      }

      // Always save and return updated events to ensure UI re-renders
      if (changed || Object.keys(updatedEvents).length !== Object.keys(state.calendarEvents).length) {
        saveToLocalStorage('calendarEvents', updatedEvents);
        return { calendarEvents: updatedEvents };
      }

      // IMPORTANT: Always return new reference when we have updates to ensure calendar re-renders
      if (updates.length > 0) {
        const mergedEvents: Record<string, CalendarEvent[]> = {};

        for (const [dateKey, events] of Object.entries(state.calendarEvents)) {
          mergedEvents[dateKey] = [...events];
        }

        for (const [dateKey, events] of Object.entries(updatedEvents)) {
          mergedEvents[dateKey] = events;
        }

        saveToLocalStorage('calendarEvents', mergedEvents);
        return { calendarEvents: mergedEvents };
      }

      return {};
    });
  },
}));

