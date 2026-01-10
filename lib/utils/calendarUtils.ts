/**
 * Calendar Helper Functions
 * Business logic for calendar operations
 */

import { CalendarEvent } from '../types/calendar'

/**
 * Get calendar events for a specific day
 * @param year - The year
 * @param month - The month (0-11)
 * @param day - The day
 * @param calendarEvents - The calendar events object
 * @returns Array of events for the day
 */
export function getCalendarEventsForDay(
  year: number,
  month: number,
  day: number,
  calendarEvents: Record<string, CalendarEvent[]>
): CalendarEvent[] {
  // Use year-month-day as unique key to avoid cross-month collisions
  const key = `${year}-${month}-${day}`
  return calendarEvents[key] || []
}

