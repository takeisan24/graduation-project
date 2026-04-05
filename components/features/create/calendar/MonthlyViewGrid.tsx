"use client";

import { CalendarEvent } from "@/lib/types/calendar";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { useTranslations } from 'next-intl';
import { SOCIAL_PLATFORMS } from "@/lib/constants/platforms";

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
  // Keyboard navigation + platform quick-add
  selectedCellKey: string | null;
  onSelectCell: (cellKey: string) => void;
  onCloseCell: () => void;
  onAddToCell: (cell: CalendarCell, platform: string) => void;
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
  onAddToCell,
}: MonthlyViewGridProps) {
  const t = useTranslations('CreatePage.calendarSection');
  const tCommon = useTranslations('Common');
  const weekdays = tCommon.raw('weekdays') as string[];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  // Check for prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

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
      className="rounded-lg border border-border overflow-hidden mt-2 flex-1 flex flex-col mx-2 lg:mx-0"
      role="grid"
      aria-label={t('ariaCalendarSection')}
    >
      {/* Weekday headers */}
      <div className="grid grid-cols-7 bg-secondary" role="row">
        {weekdays.map((day) => (
          <div
            key={day}
            role="columnheader"
            className="text-center text-[10px] lg:text-xs font-medium text-muted-foreground py-1.5 lg:py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        className="grid grid-cols-7 grid-rows-5 flex-1 overflow-y-auto"
        role="rowgroup"
      >
        {calendarGrid.map((cell, i) => {
          const cellDateTime = new Date(cell.cellDate);
          cellDateTime.setHours(0, 0, 0, 0);
          const isPast = cellDateTime.getTime() < todayTime;
          const isSelected = selectedCellKey === cell.clickedKey;
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
              aria-selected={isSelected}
              aria-label={cellAriaLabel}
              tabIndex={isPast ? -1 : 0}
              onClick={isPast ? undefined : () => {
                if (isSelected) {
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
                  if (isSelected) {
                    onCloseCell();
                  } else {
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
                relative h-full p-1 lg:p-2
                ${!prefersReducedMotion ? 'transition-colors' : ''}
                ${isPast ? 'bg-secondary cursor-not-allowed' : 'cursor-pointer hover:bg-secondary'}
                ${isSelected && !isPast ? 'ring-2 ring-primary' : cell.isClicked ? 'ring-2 ring-primary' : 'border-t border-b border-border'}
                ${!cell.inCurrentMonth && !isPast ? 'bg-secondary' : ''}
                ${i < 7 ? 'border-t-0' : ''}
                ${i % 7 === 0 ? 'border-l' : ''}
                ${i % 7 === 6 ? 'border-r' : ''}
                ${cell.isToday ? 'ring-2 ring-utc-royal/50 bg-utc-royal/5' : ''}
              `}
            >
              <div className={`flex flex-col h-full ${isPast ? 'opacity-50' : ''}`}>
                {/* Today indicator bubble */}
                {cell.isToday && (
                  <div
                    className="absolute -top-1 -left-1 w-5 h-5 lg:w-6 lg:h-6 bg-primary rounded-full flex items-center justify-center z-10"
                    aria-hidden="true"
                  >
                    <div className="text-[10px] lg:text-xs text-foreground font-medium">
                      {cell.dayNum}
                    </div>
                  </div>
                )}

                {/* Day number */}
                <div
                  className={`
                    text-[11px] lg:text-sm font-medium
                    ${cell.inCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}
                    ${cell.isToday ? 'ml-4 lg:ml-6' : ''}
                  `}
                  aria-hidden="true"
                >
                  {!cell.isToday && cell.dayNum}
                </div>

                {/* Events list */}
                <div className="mt-0.5 lg:mt-1 space-y-0.5 lg:space-y-1 flex-1 overflow-y-auto scrollbar-hide pr-0.5 lg:pr-1">
                  {cell.dayEvents.map((event: CalendarEvent) => {
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
                          inline-flex items-center gap-1 lg:gap-2
                          text-[9px] lg:text-[11px] px-1 lg:px-2 py-0.5 lg:py-1
                          rounded-md border w-full h-5 lg:h-6
                          whitespace-nowrap overflow-hidden text-ellipsis
                          ${color}
                        `}
                        title={label}
                        aria-label={eventAriaLabel}
                      >
                        <PlatformIcon platform={event.platform} size={12} variant="inline" className="lg:w-4 lg:h-4" aria-hidden="true" />
                        <span className="hidden sm:inline" style={{ fontFamily: '"Fira Mono", monospace', fontWeight: 500 }}>{label}</span>
                      </button>
                    );
                  })}

                  {/* Quick-add button — shown when cell is selected and has no platform menu open */}
                  {isSelected && !isPast && (
                    <div className="relative">
                      <button
                        type="button"
                        aria-label={t('addToDay')}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Open inline platform menu
                          const menuEl = e.currentTarget.nextElementSibling as HTMLElement;
                          if (menuEl) menuEl.classList.toggle('hidden');
                        }}
                        className={`
                          w-full h-5 lg:h-6 rounded-md border border-dashed border-muted-foreground/30
                          flex items-center justify-center text-muted-foreground
                          hover:border-primary hover:text-primary
                          ${!prefersReducedMotion ? 'transition-colors' : ''}
                        `}
                      >
                        <span aria-hidden="true">+</span>
                      </button>

                      {/* Inline platform dropdown */}
                      <div
                        className="hidden absolute top-full left-0 z-20 mt-1 w-36 bg-card border border-border rounded-lg shadow-lg py-1"
                        role="menu"
                        aria-label={t('selectPlatform')}
                      >
                        {SOCIAL_PLATFORMS.map((platform) => (
                          <button
                            key={platform.name}
                            type="button"
                            role="menuitem"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddToCell(cell, platform.name);
                              onCloseCell();
                            }}
                            className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-secondary"
                          >
                            <img
                              src={platform.icon}
                              alt=""
                              className="w-4 h-4"
                              aria-hidden="true"
                            />
                            <span>{platform.name}</span>
                          </button>
                        ))}
                      </div>
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
