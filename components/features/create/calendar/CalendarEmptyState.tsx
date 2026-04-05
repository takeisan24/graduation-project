"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { CalendarEvent } from "@/lib/types/calendar";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigationStore } from "@/store";
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";

interface CalendarEmptyStateProps {
  /** All calendar events from store */
  calendarEvents: Record<string, CalendarEvent[]>;
  /** Called when user wants to schedule a new post */
  onSchedule?: () => void;
  /** Called when user wants to go to settings */
  onConnectAccounts?: () => void;
}

interface PeriodicReminderProps {
  emptyDaysInWeek: number;
  onSchedule: () => void;
}

function PeriodicReminder({ emptyDaysInWeek, onSchedule }: PeriodicReminderProps) {
  const t = useTranslations('CreatePage.calendarSection');

  return (
    <div
      className="mx-4 mb-3 px-4 py-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 flex items-center gap-3"
      role="status"
      aria-live="polite"
    >
      <div className="text-lg" aria-hidden="true">💡</div>
      <p className="text-sm text-muted-foreground flex-1">
        {t('periodicEmpty', { count: emptyDaysInWeek })}
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={onSchedule}
        className="text-xs flex-shrink-0"
      >
        {t('periodicEmptyCta')}
      </Button>
    </div>
  );
}

export function CalendarEmptyState({
  calendarEvents,
  onSchedule,
  onConnectAccounts,
}: CalendarEmptyStateProps) {
  const t = useTranslations('CreatePage.calendarSection');
  const { accounts } = useConnectedAccounts();
  const { setActiveSection } = useNavigationStore();

  // Compute total events in last 30 days
  const totalEventsLast30Days = useMemo(() => {
    let count = 0;
    for (const [, events] of Object.entries(calendarEvents)) {
      count += events.length;
    }
    return count;
  }, [calendarEvents]);

  // Compute empty days in current week
  const { emptyDaysThisWeek, eventsThisWeek } = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    let emptyDays = 0;
    let eventCount = 0;
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const dayKey = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
      const dayEvents = calendarEvents[dayKey] || [];
      if (dayEvents.length === 0) {
        emptyDays++;
      }
      eventCount += dayEvents.length;
    }
    return { emptyDaysThisWeek: emptyDays, eventsThisWeek: eventCount };
  }, [calendarEvents]);

  const hasAccounts = (accounts?.length ?? 0) > 0;
  const isZeroState = totalEventsLast30Days === 0;
  const isPeriodicEmpty = !isZeroState && eventsThisWeek < 3 && emptyDaysThisWeek > 0;
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (!isZeroState && !isPeriodicEmpty) {
    return null;
  }

  const handleNavigateToCreate = () => {
    if (onSchedule) onSchedule();
    else setActiveSection('create');
  };

  const handleNavigateToSettings = () => {
    if (onConnectAccounts) onConnectAccounts();
    else setActiveSection('settings');
  };

  // L0: Zero state — full overlay
  if (isZeroState) {
    return (
      <div
        className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg"
        role="status"
        aria-label={t('zeroStateAria')}
      >
        <div className="max-w-sm text-center px-6 py-10">
          {/* Animated calendar icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-utc-royal/20 to-utc-sky/20 flex items-center justify-center">
                <Calendar className="w-10 h-10 text-utc-royal" />
              </div>
              {/* Floating platform icons */}
              <div className="absolute -top-2 -right-3 w-7 h-7 rounded-full bg-muted border-2 border-background shadow-sm flex items-center justify-center" aria-hidden="true">
                <span className="text-[10px]">✦</span>
              </div>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-foreground mb-2">
            {t('zeroStateTitle')}
          </h3>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            {t('zeroStateDescription')}
          </p>

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleNavigateToCreate}
              className="bg-gradient-to-r from-utc-royal to-utc-sky text-white"
            >
              {hasAccounts ? t('zeroStateCtaSchedule') : t('zeroStateCtaConnect')}
            </Button>
            {!hasAccounts && (
              <Button variant="outline" onClick={handleNavigateToSettings}>
                {t('zeroStateCtaSchedule')}
              </Button>
            )}
            {hasAccounts && (
              <button
                onClick={handleNavigateToSettings}
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                {t('zeroStateCtaConnectMore')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // L1: Periodic empty — inline banner
  return (
    <PeriodicReminder
      emptyDaysInWeek={emptyDaysThisWeek}
      onSchedule={handleNavigateToCreate}
    />
  );
}
