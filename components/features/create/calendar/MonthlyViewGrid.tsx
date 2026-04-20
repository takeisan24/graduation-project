"use client";

import { useState, useEffect } from "react";
import { CalendarEvent } from "@/lib/types/calendar";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { useTranslations } from 'next-intl';

/** Calendar cell data type */
export interface CalendarCell {
  dayNum: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  clickedKey: string;
  dayEvents: CalendarEvent[];
  cellDate: Date;
  isClicked: boolean;
}

interface MonthlyViewGridProps {
  calendarGrid: CalendarCell[];
  getNoteText: (event: CalendarEvent) => string;
  onDayClick: (cell: CalendarCell) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, cell: CalendarCell) => void;
  onNoteDragStart: (e: React.DragEvent, cell: CalendarCell, event: CalendarEvent) => void;
  onNoteClick: (e: React.MouseEvent, event: CalendarEvent, date: Date) => void;
  // Keyboard navigation
  selectedCellKey: string | null;
  onSelectCell: (cellKey: string) => void;
  onCloseCell: () => void;
}

export function MonthlyViewGrid({
  calendarGrid,
  getNoteText,
  onDayClick,
  onDragOver,
  onDrop,
  onNoteDragStart,
  onNoteClick,
  selectedCellKey,
  onSelectCell,
  onCloseCell,
}: MonthlyViewGridProps) {
  const t = useTranslations('CreatePage.calendarSection');
  const tCommon = useTranslations('Common');
  const weekdays = tCommon.raw('weekdays') as string[];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Format date for ARIA
  const formatDateForAria = (date: Date) => {
    return new Intl.DateTimeFormat('vi-VN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  };

  // Get platform names for ARIA
  const getPlatformNames = (events: CalendarEvent[]) => {
    const platforms = [...new Set(events.map(e => e.platform))];
    return platforms.join(', ');
  };

  // Map noteType to translation key
  const getStatusAriaLabel = (noteType: string) => {
    switch (noteType) {
      case 'green': return t('posted');
      case 'blue': return t('publishing');
      case 'yellow': return t('scheduled');
      case 'red': return t('failed');
      default: return t('empty');
    }
  };

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
      role="grid"
      aria-label={t('ariaCalendarSection')}
    >
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border/70 bg-secondary/60" role="row">
        {weekdays.map((day) => (
          <div
            key={day}
            role="columnheader"
            className="py-3 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground lg:text-xs"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 overflow-hidden"
        role="rowgroup"
      >
        {calendarGrid.map((cell, i) => {
          const cellDateTime = new Date(cell.cellDate);
          cellDateTime.setHours(0, 0, 0, 0);
          const isPast = cellDateTime.getTime() < todayTime;
          const hasEvents = cell.dayEvents.length > 0;

          // Build ARIA label for this cell
          let cellAriaLabel = formatDateForAria(cell.cellDate);
          if (isPast) {
            cellAriaLabel += `. ${t('pastDate')}`;
          } else if (cell.isToday) {
            cellAriaLabel += `. ${t('today')}`;
            if (hasEvents) {
              cellAriaLabel += `. ${t('eventCountOnDay', { count: cell.dayEvents.length, platforms: getPlatformNames(cell.dayEvents) })}`;
            } else {
              cellAriaLabel += `. ${t('noEventsOnDay')}`;
            }
          } else if (hasEvents) {
            cellAriaLabel += `. ${t('eventCountOnDay', { count: cell.dayEvents.length, platforms: getPlatformNames(cell.dayEvents) })}`;
          } else {
            cellAriaLabel += `. ${t('noEventsOnDay')}`;
          }

          return (
            <div
              key={i}
              role="gridcell"
              aria-disabled={isPast}
              aria-selected={selectedCellKey === cell.clickedKey}
              aria-label={cellAriaLabel}
              tabIndex={isPast ? -1 : 0}
              onClick={isPast ? undefined : () => {
                if (selectedCellKey === cell.clickedKey) {
                  onCloseCell();
                } else {
                  onDayClick(cell);
                  onSelectCell(cell.clickedKey);
                }
              }}
              onKeyDown={(e) => {
                if (isPast) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (selectedCellKey === cell.clickedKey) {
                    onCloseCell();
                  } else {
                    onDayClick(cell);
                    onSelectCell(cell.clickedKey);
                  }
                }
                if (e.key === 'Escape') {
                  onCloseCell();
                }
              }}
              onDragOver={isPast ? undefined : onDragOver}
              onDrop={isPast ? undefined : (e) => onDrop(e, cell)}
              className={`
                relative min-h-0 h-full p-2 lg:p-3
                ${!prefersReducedMotion ? 'transition-colors' : ''}
                ${isPast ? 'cursor-not-allowed bg-secondary/40' : 'cursor-pointer hover:bg-secondary/35'}
                ${selectedCellKey === cell.clickedKey && !isPast ? 'z-10 ring-2 ring-primary/70 ring-inset' : 'border-b border-r border-border/70'}
                ${!cell.inCurrentMonth && !isPast ? 'bg-secondary/20' : ''}
                ${cell.isToday ? 'bg-utc-royal/5' : ''}
              `}
            >
              <div className={`flex h-full flex-col ${isPast ? 'opacity-50' : ''}`}>
                {/* Today indicator bubble */}
                {cell.isToday && (
                  <div
                    className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary lg:h-7 lg:w-7"
                    aria-hidden="true"
                  >
                    <div className="text-[10px] font-medium text-primary-foreground lg:text-xs">
                      {cell.dayNum}
                    </div>
                  </div>
                )}

                {/* Day number */}
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={`
                      text-[11px] lg:text-sm font-semibold
                      ${cell.inCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}
                      ${cell.isToday ? 'ml-8 lg:ml-9' : ''}
                    `}
                    aria-hidden="true"
                  >
                    {!cell.isToday && cell.dayNum}
                  </div>
                  {hasEvents && (
                    <div className="rounded-full border border-border/70 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {cell.dayEvents.length}
                    </div>
                  )}
                </div>

                {/* Events list */}
                <div className="mt-2 flex-1 space-y-1 overflow-y-auto pr-0.5 scrollbar-hide lg:space-y-1.5 lg:pr-1">
                  {cell.dayEvents.slice(0, 3).map((event: CalendarEvent) => {
                    const label = getNoteText(event);
                    const statusLabel = getStatusAriaLabel(event.noteType);
                    const formattedTime = event.time ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(`1970-01-01T${event.time}`)) : '';

                    const baseColor = event.noteType === 'green' ? 'bg-[#8AE177]/20 border-[#8AE177]/40 text-[#8AE177]'
                      : event.noteType === 'yellow' ? 'bg-[#FACD5B]/20 border-[#FACD5B]/40 text-[#FACD5B]'
                      : event.noteType === 'red' ? 'bg-[#FF4F4F]/20 border-[#FF4F4F]/40 text-[#FF4F4F]'
                      : event.noteType === 'blue' ? 'bg-[#6BC1FF]/20 border-[#6BC1FF]/40 text-[#6BC1FF]'
                      : 'bg-secondary border-border text-foreground/80';
                    const hoverTint = event.noteType === 'green' ? 'hover:bg-[#8AE177]/30'
                      : event.noteType === 'yellow' ? 'hover:bg-[#FACD5B]/30'
                      : event.noteType === 'red' ? 'hover:bg-[#FF4F4F]/30'
                      : event.noteType === 'blue' ? 'hover:bg-[#6BC1FF]/30'
                      : 'hover:bg-secondary';
                    const color = `${baseColor} ${hoverTint}`;

                    // ARIA label for event button
                    const eventAriaLabel = formattedTime
                      ? t('ariaEventLabel', { status: statusLabel, platform: event.platform, time: formattedTime })
                      : `${statusLabel} ${event.platform}.`;

                    return (
                      <button
                        key={`${cell.clickedKey}-${event.id}`}
                        draggable={true}
                        onDragStart={(e) => onNoteDragStart(e, cell, event)}
                        onClick={(e) => onNoteClick(e, event, cell.cellDate)}
                        className={`
                          inline-flex w-full items-center gap-1.5 overflow-hidden rounded-lg border px-2 py-1 text-left
                          text-[10px] lg:text-[11px]
                          ${color}
                        `}
                        title={label}
                        aria-label={eventAriaLabel}
                      >
                        <PlatformIcon platform={event.platform} size={12} variant="inline" className="lg:w-4 lg:h-4" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate" style={{ fontFamily: '"Fira Mono", monospace', fontWeight: 500 }}>{label}</span>
                      </button>
                    );
                  })}

                  {cell.dayEvents.length > 3 && (
                    <div className="rounded-lg border border-dashed border-border/70 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                      +{cell.dayEvents.length - 3} lịch khác
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
