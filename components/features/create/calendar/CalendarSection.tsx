"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useCreatePostsStore, useCalendarStore, useNavigationStore } from "@/store";
import { useShallow } from 'zustand/react/shallow';
import { useTranslations } from "next-intl";
import { CalendarEvent } from "@/lib/types/calendar";
import { getCalendarEventsForDay as getEventsFromStore } from "@/lib/utils/calendarUtils";
import { formatTime24h } from "@/lib/utils/date";
import { toast } from "sonner";
import { autoUpdatePublishingStatus as autoUpdatePublishingStatusFn } from "@/store/shared/statusCheck";
import { CALENDAR_ERRORS } from "@/lib/messages/errors";
import { Calendar } from "lucide-react";
import SectionHeader from '../layout/SectionHeader';

// Import các component con đã tạo
import { CalendarToolbar } from "./CalendarToolbar";
import { MonthlyViewGrid } from "./MonthlyViewGrid";
import { WeeklyViewGrid } from "./WeeklyViewGrid";
import { CalendarPopups } from "./CalendarPopups";
import ConfirmModal from "@/components/shared/ConfirmModal";

// --- HELPER FUNCTIONS (Tách ra từ file backup) ---

const getNoteTextWithT = (event: CalendarEvent, t: (key: string) => string): string => {
    const formattedTime = formatTime24h(event.time);
    const hasTime = Boolean(formattedTime);
    switch (event.noteType) {
        case 'green':
            return hasTime ? `${t('posted')} ${formattedTime}` : t('posted');
        case 'blue':
            return hasTime ? `${t('publishing')} ${formattedTime}` : t('publishing');
        case 'yellow':
            const hasContentOrTime = !!(event.content || event.time);
            if (!hasContentOrTime) return t('empty');
            return hasTime ? `${t('scheduled')} ${formattedTime}` : t('scheduled');
        case 'red':
            return hasTime ? `${t('failed')} ${formattedTime}` : t('failed');
        default:
            return hasTime ? `${event.platform} ${formattedTime}` : event.platform;
    }
};

// Định nghĩa kiểu cho state của modal xóa
type DeleteModalState = { event: CalendarEvent; date: Date } | null;

export default function CalendarSection() {
    const t = useTranslations('CreatePage.calendarSection');
    const tHeaders = useTranslations('CreatePage.sectionHeaders');
    // Lấy các action cần thiết từ Zustand store
    const { calendarEvents, addEvent, updateEvent, deleteEvent } = useCalendarStore(
        useShallow((state) => ({
            calendarEvents: state.calendarEvents,
            addEvent: state.handleEventAdd,
            updateEvent: state.handleEventUpdate,
            deleteEvent: state.handleEventDelete,
        }))
    );
    const openPostFromUrl = useCreatePostsStore(state => state.openPostFromUrl);
    const setActiveSection = useNavigationStore(state => state.setActiveSection);
    const syncCalendarWithPostStatuses = useCalendarStore(state => state.syncCalendarWithPostStatuses);

    const autoUpdatePublishingStatus = useCallback(async () => {
        await autoUpdatePublishingStatusFn(calendarEvents, (updates) => {
            syncCalendarWithPostStatuses(updates);
        });
    }, [calendarEvents, syncCalendarWithPostStatuses]);

    // --- STATE MANAGEMENT ---
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [calendarView, setCalendarView] = useState<'monthly' | 'weekly'>("monthly");
    const [clickedDays, setClickedDays] = useState<Set<string>>(new Set());
    
    // State cho popup chính và modal xác nhận xóa
    const [popup, setPopup] = useState<{ x: number; y: number; event: CalendarEvent; date: Date } | null>(null);
    const [eventToDelete, setEventToDelete] = useState<DeleteModalState>(null);

    // Keyboard navigation state
    const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);
    const [liveAnnouncement, setLiveAnnouncement] = useState<string | null>(null);

    // Keyboard cell selection handlers
    const handleSelectCell = useCallback((cellKey: string) => {
        setSelectedCellKey(cellKey);
    }, []);

    const handleCloseCell = useCallback(() => {
        setSelectedCellKey(null);
    }, []);

    const handleAddToCell = useCallback((cellKey: string, cellDate: Date, platform: string) => {
        addEvent(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate(), platform);
        const dateStr = new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long' }).format(cellDate);
        setLiveAnnouncement(t('addedScheduleFromCell', { platform, date: dateStr }));
        toast.success(t('addedSchedule', { platform }));
        setSelectedCellKey(null);
        // Clear announcement after 3s
        setTimeout(() => setLiveAnnouncement(null), 3000);
    }, [addEvent, t]);

    const getMondayOfCurrentWeek = useCallback(() => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() + daysToMonday);
        startOfWeek.setHours(0, 0, 0, 0);
        return startOfWeek;
    }, []);
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMondayOfCurrentWeek());

    const getNoteText = useCallback((event: CalendarEvent) => getNoteTextWithT(event, t), [t]);

    // Auto-update posts to "publishing" status when scheduled time arrives
    // Also set up interval to check periodically when user is on calendar page
    useEffect(() => {
        // Check immediately on mount for instant feedback
        autoUpdatePublishingStatus();
        
        // Set up interval to check periodically (every 3 seconds) when user is on calendar page
        // This is FE-only processing, so we can check more frequently without impacting BE
        const intervalId = setInterval(() => {
            autoUpdatePublishingStatus();
        }, 3 * 1000); // Check every 3 seconds (FE-only, no BE impact)
        
        return () => {
            clearInterval(intervalId);
        };
    }, [autoUpdatePublishingStatus]);

    // Force re-render when calendarEvents change to ensure UI updates when status changes
    // This ensures that when syncCalendarWithPostStatuses updates events, the calendar re-renders
    useEffect(() => {
        // This effect will run whenever calendarEvents changes
        // The calendar component will automatically re-render because it subscribes to calendarEvents
    }, [calendarEvents]);

    // --- EVENT HANDLERS (Logic từ file backup) ---

    // Điều hướng lịch
    const goPrev = () => {
    if (calendarView === 'monthly') {
        setCurrentMonth(prev => {
            if (prev === 0) {
                setCurrentYear(y => y - 1);
                return 11;
            }
            return prev - 1;
        });
    } else {
        // --- SỬA LỖI Ở ĐÂY ---
        setCurrentWeekStart(prev => {
            const newDate = new Date(prev); // 1. Tạo bản sao
            newDate.setDate(prev.getDate() - 7); // 2. Thay đổi trên bản sao
            return newDate; // 3. Trả về bản sao
        });
    }
};
    const goNext = () => {
    if (calendarView === 'monthly') {
        setCurrentMonth(prev => {
            if (prev === 11) {
                setCurrentYear(y => y + 1);
                return 0;
            }
            return prev + 1;
        });
    } else {
        // --- SỬA LỖI Ở ĐÂY ---
        setCurrentWeekStart(prev => {
            const newDate = new Date(prev); // 1. Tạo bản sao
            newDate.setDate(prev.getDate() + 7); // 2. Thay đổi trên bản sao
            return newDate; // 3. Trả về bản sao
        });
    }
};

    // Xử lý kéo/thả
    const handleIconDragStart = (e: React.DragEvent, platform: string) => e.dataTransfer.setData('application/json', JSON.stringify({ platform }));
    const handleNoteDragStart = (e: React.DragEvent, date: Date, event: CalendarEvent) => e.dataTransfer.setData('application/json', JSON.stringify({ event, oldDate: date.toISOString() }));
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = e.dataTransfer.types.includes('application/json') ? 'move' : 'copy'; };

    const handleDrop = (e: React.DragEvent, date: Date, time?: string) => {
        e.preventDefault();
        setPopup(null);
        try {
            const now = new Date();
            const targetDateTime = new Date(date);

            if (time) {
                const [hour, minute] = time.split(':').map(Number);
                targetDateTime.setHours(hour, minute, 0, 0);
            } else{
                targetDateTime.setHours(0, 0, 0, 0);
            }

            // Check if target date is in the past (not today)
            // Allow adding events to today, even if the time has passed
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const targetDate = new Date(targetDateTime);
            targetDate.setHours(0, 0, 0, 0);

            // Only block if the target date is before today (past date)
            // If it's today, allow it regardless of time
            if (targetDate.getTime() < today.getTime()) {
                toast.error(CALENDAR_ERRORS.PAST_DATE_ERROR);
                return;
            }

            // If time is specified and it's today, check if the time has passed
            // But allow a small buffer (5 minutes) to account for clock differences
            if (time && targetDate.getTime() === today.getTime()) {
                const timeDiff = targetDateTime.getTime() - now.getTime();
                const fiveMinutesInMs = 5 * 60 * 1000;
                if (timeDiff < -fiveMinutesInMs) {
                    toast.error(CALENDAR_ERRORS.PAST_TIME_ERROR);
                    return;
                }
            }

            const data = JSON.parse(e.dataTransfer.getData('application/json')); 

            if (data.platform) { // Kéo từ icon
                addEvent(date.getFullYear(), date.getMonth(), date.getDate(), data.platform, time);
                toast.success(t('addedSchedule', { platform: data.platform }));
            } else if (data.event && data.oldDate) { // Kéo từ một event đã có
                const oldDate = new Date(data.oldDate);
                const newTime =  time || data.event.time;
                updateEvent(
                    oldDate.getFullYear(), oldDate.getMonth(), oldDate.getDate(), data.event,
                    date.getFullYear(), date.getMonth(), date.getDate(), newTime 
                );
                toast.info(t('eventMoved'));
            }
        } catch (err) { console.error("Drop failed:", err); toast.error(CALENDAR_ERRORS.DROP_FAILED); }
    };

    // Xử lý click trên popup
    const handleNoteClick = (e: React.MouseEvent, event: CalendarEvent, date: Date) => { e.stopPropagation(); setPopup({ x: e.clientX, y: e.clientY, event, date }); };

    const handleOpenInEditor = (event: CalendarEvent, date: Date) => {
        if (event.noteType === 'green' && event.url) {
            window.open(event.url, '_blank');
        } else {
            const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            setActiveSection('create');
            openPostFromUrl(event.platform, event.content || '', { eventId: event.id, dateKey });
        }
        setPopup(null);
    };

    const handleSaveTime = async (event: CalendarEvent, date: Date, newTime24h: string) => {
        await updateEvent(
            date.getFullYear(), date.getMonth(), date.getDate(), event,
            date.getFullYear(), date.getMonth(), date.getDate(), newTime24h
        );
        // Toast message is handled in updateEvent (API call)
    };

    const handleDeleteConfirm = async () => {
        if (!eventToDelete) return;
        const { event, date } = eventToDelete;
        await deleteEvent(date.getFullYear(), date.getMonth(), date.getDate(), event);
        // Toast message is handled in deleteEvent (API call)
        setEventToDelete(null);
    };

    // --- DATA GENERATION (Sử dụng useMemo để tối ưu) ---
    const calendarGrid = useMemo(() => {
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
        const firstDayIndex = (firstDayOfMonth.getDay() + 6) % 7;
        const gridDays = [];
        const currentDay = new Date(currentYear, currentMonth, 1 - firstDayIndex);

        for (let i = 0; i < 42; i++) {
            const cellDate = new Date(currentDay);
            const dayNum = cellDate.getDate();
            const inCurrentMonth = cellDate.getMonth() === currentMonth;
            const isToday = new Date().toDateString() === cellDate.toDateString();
            const clickedKey = `${cellDate.getFullYear()}-${cellDate.getMonth()}-${dayNum}`;
            const dayEvents = getEventsFromStore(cellDate.getFullYear(), cellDate.getMonth(), dayNum, calendarEvents);

            gridDays.push({ dayNum, inCurrentMonth, isToday, clickedKey, dayEvents, cellDate, isClicked: clickedDays.has(clickedKey) });
            currentDay.setDate(currentDay.getDate() + 1);
        }
        return gridDays;
    }, [currentYear, currentMonth, calendarEvents, clickedDays]);

    const weekDays = useMemo(() => {
        const startOfWeek = new Date(currentWeekStart);
        return Array.from({ length: 7 }).map((_, i) => {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            return date;
        });
    }, [currentWeekStart]);

    const eventsForWeek = useMemo(() => {
        const events: Record<string, CalendarEvent[]> = {};
        const days = weekDays; // weekDays đã được tính toán bằng useMemo ở trên
        
        days.forEach(date => {
            const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            const dayEvents = getEventsFromStore(date.getFullYear(), date.getMonth(), date.getDate(), calendarEvents);
            if (dayEvents.length > 0) {
                events[dateKey] = dayEvents.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
            }
        });
        return events;
    }, [weekDays, calendarEvents]);

    // --- RENDER COMPONENT ---
    return (
        <div className="w-full max-w-none flex flex-col h-full overflow-hidden">
            <SectionHeader icon={Calendar} title={tHeaders('calendar.title')} description={tHeaders('calendar.description')} />
            <CalendarToolbar
                calendarView={calendarView}
                currentMonth={currentMonth}
                currentYear={currentYear}
                currentWeekStart={currentWeekStart}
                onPrev={goPrev}
                onNext={goNext}
                onSetView={setCalendarView}
                onIconDragStart={handleIconDragStart}
            />

            {/* ARIA live region for screen reader announcements */}
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
            >
                {liveAnnouncement}
            </div>

            <div className="flex-1 min-h-0">
                {calendarView === 'monthly' ? (
                    <MonthlyViewGrid
                        calendarGrid={calendarGrid}
                        getNoteText={getNoteText}
                        onDayClick={(cell) => { setClickedDays(new Set([cell.clickedKey])); setPopup(null); }}
                        onDragOver={handleDragOver}
                        onDrop={(e, cell) => handleDrop(e, cell.cellDate, undefined)}
                        onNoteDragStart={(e, cell, event) => handleNoteDragStart(e, cell.cellDate, event)}
                        onNoteClick={handleNoteClick}
                        selectedCellKey={selectedCellKey}
                        onSelectCell={handleSelectCell}
                        onCloseCell={handleCloseCell}
                        onAddToCell={(cell, platform) => handleAddToCell(cell.clickedKey, cell.cellDate, platform)}
                    />
                ) : (
                    <WeeklyViewGrid
                        weekDays={weekDays}
                        eventsByDay={eventsForWeek}
                        getNoteText={getNoteText}
                        onDayClick={(date) => { setClickedDays(new Set([`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`])); setPopup(null); }}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onNoteDragStart={handleNoteDragStart}
                        onNoteClick={handleNoteClick}
                    />
                )}
            </div>

            <CalendarPopups
                popupData={popup}
                onClose={() => setPopup(null)}
                onOpenInEditor={handleOpenInEditor}
                onConfirmDelete={(event, date) => { setEventToDelete({ event, date }); setPopup(null); }}
                onSaveTime={handleSaveTime}
            />
            
            {eventToDelete && (
                <ConfirmModal
                    isOpen={true}
                    onClose={() => setEventToDelete(null)}
                    onConfirm={handleDeleteConfirm}
                    title={t('deleteModal.title')}
                    description={t('deleteModal.message')}
                    confirmText={t('deleteModal.yes')}
                    cancelText={t('deleteModal.no')}
                    variant="danger"
                />
            )}
        </div>
    );
}