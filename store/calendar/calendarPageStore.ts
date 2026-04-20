/**
 * Calendar Page Store
 * 
 * Manages calendar events (delegates to shared calendar store)
 */

import { create } from 'zustand';
import { useCalendarStore } from '../shared/calendar';
import type { CalendarState } from '../shared/calendar';

interface CalendarPageState {
  // State (from calendar store)
  calendarEvents: CalendarState['calendarEvents'];
  
  // Actions (from calendar store)
  handleEventAdd: CalendarState['handleEventAdd'];
  handleEventUpdate: CalendarState['handleEventUpdate'];
  handleEventDelete: CalendarState['handleEventDelete'];
  handleClearCalendarEvents: CalendarState['handleClearCalendarEvents'];
  syncCalendarWithPostStatuses: CalendarState['syncCalendarWithPostStatuses'];
  hydrateScheduledPosts: CalendarState['hydrateScheduledPosts'];
}

export const useCalendarPageStore = create<CalendarPageState>(() => ({
  // State (delegated to calendar store)
  get calendarEvents() {
    return useCalendarStore.getState().calendarEvents;
  },
  
  // Actions (delegated to calendar store)
  handleEventAdd: (year, month, day, platform, time) => {
    useCalendarStore.getState().handleEventAdd(year, month, day, platform, time);
  },
  handleEventUpdate: async (oldYear, oldMonth, oldDay, oldEvent, newYear, newMonth, newDay, newTime) => {
    await useCalendarStore.getState().handleEventUpdate(oldYear, oldMonth, oldDay, oldEvent, newYear, newMonth, newDay, newTime);
  },
  handleEventDelete: async (year, month, day, event) => {
    await useCalendarStore.getState().handleEventDelete(year, month, day, event);
  },
  handleClearCalendarEvents: () => {
    useCalendarStore.getState().handleClearCalendarEvents();
  },
  syncCalendarWithPostStatuses: (updates, options) => {
    useCalendarStore.getState().syncCalendarWithPostStatuses(updates, options);
  },
  hydrateScheduledPosts: async () => {
    await useCalendarStore.getState().hydrateScheduledPosts();
  },
}));

