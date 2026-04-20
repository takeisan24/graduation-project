"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { CalendarEvent } from "@/lib/types/calendar";
import { Calendar, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CalendarEmptyStateProps {
  calendarEvents: Record<string, CalendarEvent[]>;
  onSchedule?: () => void;
}

interface PeriodicReminderProps {
  emptyDaysInWeek: number;
  onSchedule: () => void;
}

export function getCalendarEmptyStateFlags(calendarEvents: Record<string, CalendarEvent[]>) {
  let totalEventsLast30Days = 0;
  for (const [, events] of Object.entries(calendarEvents)) {
    totalEventsLast30Days += events.length;
  }

  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  let emptyDaysThisWeek = 0;
  let eventsThisWeek = 0;

  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dayKey = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
    const dayEvents = calendarEvents[dayKey] || [];
    if (dayEvents.length === 0) {
      emptyDaysThisWeek++;
    }
    eventsThisWeek += dayEvents.length;
  }

  const isZeroState = totalEventsLast30Days === 0;
  const isPeriodicEmpty = !isZeroState && eventsThisWeek < 3 && emptyDaysThisWeek > 0;

  return {
    totalEventsLast30Days,
    emptyDaysThisWeek,
    eventsThisWeek,
    isZeroState,
    isPeriodicEmpty,
    shouldRender: isZeroState || isPeriodicEmpty,
  };
}

function PeriodicReminder({ emptyDaysInWeek, onSchedule }: PeriodicReminderProps) {
  const t = useTranslations("CreatePage.calendarSection");

  return (
    <div
      className="mx-4 mb-3 flex items-center gap-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <div className="text-lg" aria-hidden="true">💡</div>
      <p className="flex-1 text-sm text-muted-foreground">
        {t("periodicEmpty", { count: emptyDaysInWeek })}
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={onSchedule}
        className="shrink-0 text-xs"
      >
        {t("periodicEmptyCta")}
      </Button>
    </div>
  );
}

export function CalendarEmptyState({
  calendarEvents,
  onSchedule,
}: CalendarEmptyStateProps) {
  const t = useTranslations("CreatePage.calendarSection");

  const { emptyDaysThisWeek, isZeroState, isPeriodicEmpty } = useMemo(
    () => getCalendarEmptyStateFlags(calendarEvents),
    [calendarEvents]
  );

  if (!isZeroState && !isPeriodicEmpty) {
    return null;
  }

  const handleScheduleFocus = () => {
    onSchedule?.();
  };

  if (isZeroState) {
    return (
      <div
        className="mb-3 rounded-2xl border border-dashed border-primary/20 bg-gradient-to-r from-utc-royal/5 via-background to-utc-sky/10 p-4 shadow-sm"
        role="status"
        aria-label={t("zeroStateAria")}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-utc-royal/20 to-utc-sky/20">
              <Calendar className="h-5 w-5 text-utc-royal" />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary">
                <Sparkles className="h-3 w-3" />
                {t("plannerOnboarding")}
              </div>
              <h3 className="mt-2 text-base font-semibold tracking-tight text-foreground">
                {t("recommendedActionWithAccounts")}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("stepScheduleDescription")}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleScheduleFocus}
              className="bg-gradient-to-r from-utc-royal to-utc-sky text-white"
            >
              {t("zeroStateCtaSchedule")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PeriodicReminder
      emptyDaysInWeek={emptyDaysThisWeek}
      onSchedule={handleScheduleFocus}
    />
  );
}
