"use client";

import { CalendarEvent } from "@/lib/types/calendar";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { useTranslations } from 'next-intl';

interface WeeklyViewGridProps {
  weekDays: Date[];
  eventsByDay: Record<string, CalendarEvent[]>; 
  getNoteText: (event: CalendarEvent) => string;
  onDayClick: (date: Date) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, date: Date, targetTime: string) => void; 
  onNoteDragStart: (e: React.DragEvent, date: Date, event: CalendarEvent) => void;
  onNoteClick: (e: React.MouseEvent, event: CalendarEvent, date: Date) => void;
}

export function WeeklyViewGrid({
  weekDays,
  eventsByDay,
  getNoteText,
  onDayClick,
  onDragOver,
  onDrop,
  onNoteDragStart,
  onNoteClick,
}: WeeklyViewGridProps) {
  const tCommon = useTranslations('Common');
  const t = useTranslations('CreatePage.calendarSection');
  const weekdays = tCommon.raw('weekdays') as string[];
  const tHour = tCommon('hour');

  // Lấy thời gian hiện tại một lần duy nhất khi component render
  const now = new Date();
  // Tạo một chuỗi đại diện cho ngày hôm nay (ví dụ: "Mon Oct 27 2025") để so sánh
  const todayDateString = now.toDateString();
  // Lấy giờ hiện tại
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const isToday = (date: Date) => new Date().toDateString() === date.toDateString();
  const currentTimeTop = (currentHour + currentMinute / 60) * 80;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      {/* Weekday headers */}
      <div className="sticky top-0 z-10 flex border-b border-border/70 bg-secondary/60 backdrop-blur-sm">
        <div className="flex w-16 flex-shrink-0 items-center justify-center border-r border-border/70 py-3">
          <span className="text-xs font-medium text-muted-foreground">{tHour}</span>
        </div>
        <div className="grid grid-cols-7 flex-1">
          {weekDays.map((date) =>{
            return(
            <div key={date.toISOString()} className="border-r border-border/70 py-3 text-center last:border-r-0">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {weekdays[date.getDay() === 0 ? 6 : date.getDay() - 1]}
              </span>
              <div className={`mt-1 text-lg font-semibold ${isToday(date) ? 'text-primary' : 'text-foreground'}`}>
                {date.getDate()}
              </div>
            </div>
          )})}
        </div>
      </div>

      {/* Weekly grid content */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="flex h-full">
          {/* Time column */}
          <div className="w-16 flex-shrink-0">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="flex h-20 justify-end border-t border-border/70 pr-2 pt-1 first:border-t-0">
                <span className="-translate-y-2 text-xs text-muted-foreground">
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Days columns */}
          <div className="grid grid-cols-7 flex-1">
            {weekDays.map((date) => {
              const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
              const dayEvents = eventsByDay[dateKey] || [];

              const isCurrentDay = date.toDateString() === todayDateString;
              return (
                <div
                  key={date.toISOString()}
                  className="relative border-r border-border/70 last:border-r-0"
                  onClick={() => onDayClick(date)}
                  onDragOver={onDragOver}
                  onDrop={(e) => {
                            // Lấy bounding box của cột ngày
                            const rect = e.currentTarget.getBoundingClientRect();
                            // Tính vị trí Y của chuột bên trong cột
                            const y = e.clientY - rect.top;
                            // --- LOGIC SNAP-TO-GRID 15 PHÚT (giữ nguyên) ---
                            const totalMinutesInDay = 24 * 60;
                            const totalHeight = e.currentTarget.offsetHeight;
                            const totalMinutes = (y / totalHeight) * totalMinutesInDay;
                                        
                            const snappedMinutes = Math.round(totalMinutes / 15) * 15;
                            const hour = Math.floor(snappedMinutes / 60);
                            const minute = snappedMinutes % 60;

                            const targetTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                            // Gọi onDrop với thông tin giờ
                            onDrop(e, date, targetTime);
                        }}
                >
                  {/* Hour slots */}
                  {Array.from({ length: 24 }, (_, hour) => {
                    const isPastHour = isCurrentDay && hour < currentHour;
                    return(
                    <div
                      key={hour}
                      aria-disabled={isPastHour || undefined}
                      title={isPastHour ? t('pastDate') : undefined}
                      className={`group h-20 border-t border-border/70 first:border-t-0 ${isPastHour ? 'cursor-not-allowed bg-muted/35' : 'hover:bg-secondary/20'}`}
                    />
                  )})}

                  {isCurrentDay && (
                    <div
                      className="pointer-events-none absolute left-0 right-0 z-10 border-t border-red-400/80"
                      style={{ top: `${currentTimeTop}px` }}
                      aria-hidden="true"
                    >
                      <span className="absolute -left-1 -top-1.5 h-3 w-3 rounded-full bg-red-400" />
                    </div>
                  )}

                  {/* Render Events */}
                  {dayEvents.map((event) => {
                    const timeParts = event.time?.split(':');
                    if (!timeParts || timeParts.length < 2) return null; // Bỏ qua nếu không có thời gian hợp lệ

                    const eventHour = parseInt(timeParts[0], 10);
                    const eventMinute = parseInt(timeParts[1], 10);
                    const topPosition = (eventHour + eventMinute / 60) * 80; // 80px per hour (h-20)

                    const label = getNoteText(event);
                    const color = event.noteType === 'green' ? 'bg-[#8AE177]/20 border-[#8AE177]/40'
                      : event.noteType === 'yellow' ? 'bg-[#FACD5B]/20 border-[#FACD5B]/40'
                      : event.noteType === 'red' ? 'bg-[#FF4F4F]/20 border-[#FF4F4F]/40'
                      : event.noteType === 'blue' ? 'bg-[#6BC1FF]/20 border-[#6BC1FF]/40'
                      : 'bg-secondary border-border';

                    return (
                      <button
                        key={event.id}
                        draggable={true}
                        onDragStart={(e) => onNoteDragStart(e, date, event)}
                        onClick={(e) => onNoteClick(e, event, date)}
                        className={`absolute left-1.5 right-1.5 z-20 min-h-9 rounded-xl border px-2.5 py-1.5 text-left shadow-sm hover:opacity-90 ${color}`}
                        style={{ top: `${topPosition}px` }}
                        title={label}
                      >
                        <div className="flex items-start gap-2">
                          <PlatformIcon platform={event.platform} size={12} variant="inline" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/70">{event.platform}</div>
                            <span className="block text-[10px]" style={{ fontFamily: '"Fira Mono", monospace', fontWeight: 500 }}>
                              {label}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
