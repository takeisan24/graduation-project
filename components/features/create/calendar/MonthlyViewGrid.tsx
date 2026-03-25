"use client";

import { CalendarEvent } from "@/lib/types/calendar";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { useTranslations } from 'next-intl';

interface MonthlyViewGridProps {
  calendarGrid: any[]; // Bạn có thể định nghĩa kiểu chi tiết hơn sau
  getNoteText: (event: CalendarEvent) => string;
  onDayClick: (cell: any) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, cell: any) => void;
  onNoteDragStart: (e: React.DragEvent, cell: any, event: CalendarEvent) => void;
  onNoteClick: (e: React.MouseEvent, event: CalendarEvent, date: Date) => void;
}

export function MonthlyViewGrid({
  calendarGrid,
  getNoteText,
  onDayClick,
  onDragOver,
  onDrop,
  onNoteDragStart,
  onNoteClick,
}: MonthlyViewGridProps) {
  const tCommon = useTranslations('Common');
  const weekdays = tCommon.raw('weekdays') as string[];
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Đặt giờ về 00:00:00 để so sánh chính xác
  const todayTime = today.getTime();
  
    return (
    <div className="rounded-lg border border-border overflow-hidden mt-4 h-[calc(100vh-180px)] lg:h-[calc(100vh-120px)] flex flex-col mx-2 lg:mx-0">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 bg-secondary">
        {weekdays.map((day) => (
          <div key={day} className="text-center text-[10px] lg:text-xs font-medium text-muted-foreground py-1.5 lg:py-2">
            {day}
          </div>
        ))}
      </div>
      
      {/* Day grid */}
      <div className="grid grid-cols-7 grid-rows-5 flex-1 overflow-y-auto">
        {calendarGrid.map((cell, i) => {
            const cellDateTime = new Date(cell.cellDate);
            cellDateTime.setHours(0, 0, 0, 0);
            const isPast = cellDateTime.getTime() < todayTime;
            
            return(
          <div
            key={i}
            className={`relative h-full p-1 lg:p-2 transition-colors ${
                isPast ? 'bg-secondary cursor-not-allowed' : 'cursor-pointer hover:bg-secondary'
              } ${
                cell.isClicked ? "border-2 border-primary" : "border-t border-b border-border"
              } ${
                !cell.inCurrentMonth && !isPast ? 'bg-secondary' : ''
              } ${i < 7 ? 'border-t-0' : ''} ${i % 7 === 0 ? 'border-l' : ''} ${i % 7 === 6 ? 'border-r' : ''}
              `}
            onClick={isPast ? undefined : () => onDayClick(cell)}
            onDragOver={isPast ? undefined : onDragOver}
            onDrop={isPast ? undefined : (e) => onDrop(e, cell)}
          >
            <div className={`flex flex-col h-full ${isPast ? 'opacity-50' : ''}`}>
              {/* Today indicator bubble */}
              {cell.isToday && (
                <div className="absolute -top-1 -left-1 w-5 h-5 lg:w-6 lg:h-6 bg-primary rounded-full flex items-center justify-center z-10">
                  <div className="text-[10px] lg:text-xs text-foreground font-medium">
                    {cell.dayNum}
                  </div>
                </div>
              )}
              {/* Day number */}
              <div className={`text-[11px] lg:text-sm font-medium ${
                cell.inCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
              } ${cell.isToday ? 'ml-4 lg:ml-6' : ''}`}>
                {!cell.isToday && cell.dayNum}
              </div>
              
              {/* Events list */}
              <div className="mt-0.5 lg:mt-1 space-y-0.5 lg:space-y-1 flex-1 overflow-y-auto scrollbar-hide pr-0.5 lg:pr-1">
                {cell.dayEvents.map((event: CalendarEvent, eventIdx: number) => {
                  const label = getNoteText(event);
                  const baseColor = event.noteType === 'green' ? 'bg-[#8AE177]/20 border-[#8AE177]/40 text-[#8AE177]'
                    : event.noteType === 'yellow' ? 'bg-[#FACD5B]/20 border-[#FACD5B]/40 text-[#FACD5B]'
                    : event.noteType === 'red' ? 'bg-[#FF4F4F]/20 border-[#FF4F4F]/40 text-[#FF4F4F]'
                    : event.noteType === 'blue' ? 'bg-[#6BC1FF]/20 border-[#6BC1FF]/40 text-[#6BC1FF]'
                    : 'bg-secondary border-border text-foreground/80'
                  const hoverTint = event.noteType === 'green' ? 'hover:bg-[#8AE177]/30'
                    : event.noteType === 'yellow' ? 'hover:bg-[#FACD5B]/30'
                    : event.noteType === 'red' ? 'hover:bg-[#FF4F4F]/30'
                    : event.noteType === 'blue' ? 'hover:bg-[#6BC1FF]/30'
                    : 'hover:bg-secondary'
                  const color = `${baseColor} ${hoverTint}`
                  return (
                    <button
                      key={`${cell.clickedKey}-${event.id}`} // Sử dụng event.id để đảm bảo key là duy nhất
                      draggable={true}
                      onDragStart={(e) => onNoteDragStart(e, cell, event)}
                      onClick={(e) => onNoteClick(e, event, cell.cellDate)}
                      className={`inline-flex items-center gap-1 lg:gap-2 text-[9px] lg:text-[11px] px-1 lg:px-2 py-0.5 lg:py-1 rounded-md border w-full h-5 lg:h-6 whitespace-nowrap overflow-hidden text-ellipsis ${color}`}
                      title={label}
                      aria-label={`${label} event on ${event.platform}`}
                    >
                      <PlatformIcon platform={event.platform} size={12} variant="inline" className="lg:w-4 lg:h-4" />
                      <span className="hidden sm:inline" style={{ fontFamily: '"Fira Mono", monospace', fontWeight: 500 }}>{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )})}
      </div>
    </div>
  );
}