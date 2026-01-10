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
  const weekdays = tCommon.raw('weekdays') as string[];
  const tHour = tCommon('hour');

  // Lấy thời gian hiện tại một lần duy nhất khi component render
  const now = new Date();
  // Tạo một chuỗi đại diện cho ngày hôm nay (ví dụ: "Mon Oct 27 2025") để so sánh
  const todayDateString = now.toDateString();
  // Lấy giờ hiện tại
  const currentHour = now.getHours();
  const isToday = (date: Date) => new Date().toDateString() === date.toDateString();

  return (
    <div className="rounded-lg border border-white/10 overflow-hidden mt-4 h-[calc(100vh-120px)] flex flex-col">
      {/* Weekday headers */}
      <div className="flex bg-white/5 sticky top-0 z-10">
        <div className="w-16 flex-shrink-0 flex items-center justify-center py-2 border-r border-white/10">
          <span className="text-xs font-medium text-white/70">{tHour}</span>
        </div>
        <div className="grid grid-cols-7 flex-1">
          {weekDays.map((date) =>{
            const isCurrentDay = date.toDateString() === todayDateString;
            return(
            <div key={date.toISOString()} className="text-center py-2 border-r border-white/10 last:border-r-0">
              <span className="text-xs font-medium text-white/70 uppercase">
                {weekdays[date.getDay() === 0 ? 6 : date.getDay() - 1]}
              </span>
              <div className={`text-lg font-semibold mt-1 ${isToday(date) ? 'text-primary' : 'text-white'}`}>
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
              <div key={hour} className="h-20 flex justify-end pr-2 pt-1 border-t border-white/5 first:border-t-0">
                <span className="text-xs text-white/60 -translate-y-2">
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
                  className="border-r border-white/10 last:border-r-0 relative"
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
                      className={`h-20 border-t border-white/5 first:border-t-0 group hover:bg-white/5 transition-colors 
                        ${isPastHour ? 'bg-black/20 cursor-not-allowed' : 'group-hover:bg-white/[.03]'}`} />
                  )})}

                  {/* Render Events */}
                  {dayEvents.map((event, eventIdx) => {
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
                      : 'bg-white/10 border-white/20';

                    return (
                      <button
                        key={event.id}
                        draggable={true}
                        onDragStart={(e) => onNoteDragStart(e, date, event)}
                        onClick={(e) => onNoteClick(e, event, date)}
                        className={`absolute left-1 right-1 h-auto min-h-6 rounded border flex items-center gap-1.5 px-2 py-0.5 ${color} hover:opacity-80 z-20 whitespace-normal text-left`}
                        style={{ top: `${topPosition}px` }}
                        title={label}
                      >
                        <PlatformIcon platform={event.platform} size={12} variant="inline" />
                        <span className="text-[10px] flex-1" style={{ fontFamily: '"Fira Mono", monospace', fontWeight: 500 }}>
                          {label}
                        </span>
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