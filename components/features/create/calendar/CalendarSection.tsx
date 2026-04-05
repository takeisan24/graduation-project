"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useCreatePostsStore, useCalendarStore, useNavigationStore } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { useTranslations } from "next-intl";
import { CalendarEvent } from "@/lib/types/calendar";
import { getCalendarEventsForDay as getEventsFromStore } from "@/lib/utils/calendarUtils";
import { formatTime24h } from "@/lib/utils/date";
import { toast } from "sonner";
import { autoUpdatePublishingStatus as autoUpdatePublishingStatusFn } from "@/store/shared/statusCheck";
import { CALENDAR_ERRORS } from "@/lib/messages/errors";
import { Calendar } from "lucide-react";
import SectionHeader from "../layout/SectionHeader";
import { CalendarToolbar } from "./CalendarToolbar";
import { MonthlyViewGrid } from "./MonthlyViewGrid";
import { WeeklyViewGrid } from "./WeeklyViewGrid";
import { CalendarPopups } from "./CalendarPopups";
import ConfirmModal from "@/components/shared/ConfirmModal";
import { CalendarEmptyState } from "./CalendarEmptyState";
import type { CalendarCell } from "./MonthlyViewGrid";

const getNoteTextWithT = (event: CalendarEvent, t: (key: string) => string): string => {
    const formattedTime = formatTime24h(event.time);
    const hasTime = Boolean(formattedTime);
    switch (event.noteType) {
        case "green":
            return hasTime ? `${t("posted")} ${formattedTime}` : t("posted");
        case "blue":
            return hasTime ? `${t("publishing")} ${formattedTime}` : t("publishing");
        case "yellow":
            return hasTime ? `${t("scheduled")} ${formattedTime}` : t("scheduled");
        case "red":
            return hasTime ? `${t("failed")} ${formattedTime}` : t("failed");
        default:
            return hasTime ? `${event.platform} ${formattedTime}` : event.platform;
    }
};

type DeleteModalState = { event: CalendarEvent; date: Date } | null;

export default function CalendarSection() {
    const t = useTranslations("CreatePage.calendarSection");
    const tHeaders = useTranslations("CreatePage.sectionHeaders");
    const calendarStoreState = useCalendarStore(
        useShallow((state) => ({
            calendarEvents: state.calendarEvents,
            addEvent: state.handleEventAdd,
            updateEvent: state.handleEventUpdate,
            deleteEvent: state.handleEventDelete,
            syncCalendarWithPostStatuses: state.syncCalendarWithPostStatuses,
        }))
    );
    const { calendarEvents, addEvent, updateEvent, deleteEvent, syncCalendarWithPostStatuses } = calendarStoreState;
    const openPostFromUrl = useCreatePostsStore((state) => state.openPostFromUrl);
    const setActiveSection = useNavigationStore((state) => state.setActiveSection);

    const autoUpdatePublishingStatus = useCallback(async () => {
        await autoUpdatePublishingStatusFn(calendarEvents, (updates) => {
            syncCalendarWithPostStatuses(updates);
        });
    }, [calendarEvents, syncCalendarWithPostStatuses]);

    // --- STATE ---
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [calendarView, setCalendarView] = useState<"monthly" | "weekly">("monthly");
    const [clickedDays, setClickedDays] = useState<Set<string>>(new Set());
    const [popup, setPopup] = useState<{ x: number; y: number; event: CalendarEvent; date: Date } | null>(null);
    const [eventToDelete, setEventToDelete] = useState<DeleteModalState>(null);

    // Keyboard navigation state
    const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);
    const [liveAnnouncement, setLiveAnnouncement] = useState<string | null>(null);

    // Sync state
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
    const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

    // Handlers
    const handleSelectCell = useCallback((cellKey: string) => setSelectedCellKey(cellKey), []);
    const handleCloseCell = useCallback(() => setSelectedCellKey(null), []);
    const handleAddToCell = useCallback((cell: CalendarCell, platform: string) => {
        const cellDate = cell.cellDate;
        addEvent(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate(), platform);
        const dateStr = new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "long" }).format(cellDate);
        setLiveAnnouncement(t("addedScheduleFromCell", { platform, date: dateStr }));
        toast.success(t("addedSchedule", { platform }));
        setSelectedCellKey(null);
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

    // Visibility-aware polling (15s interval + event-driven)
    useEffect(() => {
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        const doSync = async () => {
            if (document.hidden) return;
            setIsSyncing(true);
            await autoUpdatePublishingStatus();
            setLastSyncedAt(new Date());
            setIsSyncing(false);
        };

        const scheduleSync = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(doSync, 2000);
        };

        doSync();

        const handleVisibilityChange = () => {
            if (!document.hidden) scheduleSync();
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        const handleScheduled = () => scheduleSync();
        const handlePublished = () => scheduleSync();
        window.addEventListener("calendar:event-scheduled", handleScheduled);
        window.addEventListener("calendar:post-published", handlePublished);

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        const intervalId = setInterval(() => {
            if (!document.hidden) doSync();
        }, 15_000);

        return () => {
            clearInterval(intervalId);
            if (debounceTimer) clearTimeout(debounceTimer);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("calendar:event-scheduled", handleScheduled);
            window.removeEventListener("calendar:post-published", handlePublished);
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, [calendarEvents, autoUpdatePublishingStatus]);

    // --- EVENT HANDLERS ---
    const goPrev = () => {
        if (calendarView === "monthly") {
            setCurrentMonth((prev) => {
                if (prev === 0) {
                    setCurrentYear((y) => y - 1);
                    return 11;
                }
                return prev - 1;
            });
        } else {
            setCurrentWeekStart((prev) => {
                const newDate = new Date(prev);
                newDate.setDate(prev.getDate() - 7);
                return newDate;
            });
        }
    };

    const goNext = () => {
        if (calendarView === "monthly") {
            setCurrentMonth((prev) => {
                if (prev === 11) {
                    setCurrentYear((y) => y + 1);
                    return 0;
                }
                return prev + 1;
            });
        } else {
            setCurrentWeekStart((prev) => {
                const newDate = new Date(prev);
                newDate.setDate(prev.getDate() + 7);
                return newDate;
            });
        }
    };

    const handleIconDragStart = (e: React.DragEvent, platform: string) => {
        e.dataTransfer.setData("application/json", JSON.stringify({ platform }));
    };

    const handleNoteDragStart = (e: React.DragEvent, date: Date, event: CalendarEvent) => {
        e.dataTransfer.setData("application/json", JSON.stringify({ event, oldDate: date.toISOString() }));
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = e.dataTransfer.types.includes("application/json") ? "move" : "copy";
    };

    const handleDrop = (e: React.DragEvent, date: Date, time?: string) => {
        e.preventDefault();
        setPopup(null);
        try {
            const now = new Date();
            const targetDateTime = new Date(date);
            targetDateTime.setHours(
                time ? parseInt(time.split(":")[0], 10) : 0,
                time ? parseInt(time.split(":")[1], 10) : 0,
                0,
                0
            );
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const targetDate = new Date(targetDateTime);
            targetDate.setHours(0, 0, 0, 0);
            if (targetDate.getTime() < today.getTime()) {
                toast.error(CALENDAR_ERRORS.PAST_DATE_ERROR);
                return;
            }
            if (time && targetDate.getTime() === today.getTime()) {
                const timeDiff = targetDateTime.getTime() - now.getTime();
                if (timeDiff < -5 * 60 * 1000) {
                    toast.error(CALENDAR_ERRORS.PAST_TIME_ERROR);
                    return;
                }
            }
            const data = JSON.parse(e.dataTransfer.getData("application/json"));
            if (data.platform) {
                addEvent(date.getFullYear(), date.getMonth(), date.getDate(), data.platform, time);
                toast.success(t("addedSchedule", { platform: data.platform }));
            } else if (data.event && data.oldDate) {
                const oldDate = new Date(data.oldDate);
                const newTime = time || data.event.time;
                updateEvent(
                    oldDate.getFullYear(),
                    oldDate.getMonth(),
                    oldDate.getDate(),
                    data.event,
                    date.getFullYear(),
                    date.getMonth(),
                    date.getDate(),
                    newTime
                );
                toast.info(t("eventMoved"));
            }
        } catch (err) {
            console.error("Drop failed:", err);
            toast.error(CALENDAR_ERRORS.DROP_FAILED);
        }
    };

    const handleNoteClick = (e: React.MouseEvent, event: CalendarEvent, date: Date) => {
        e.stopPropagation();
        setPopup({ x: e.clientX, y: e.clientY, event, date });
    };

    const handleOpenInEditor = async (event: CalendarEvent, date: Date) => {
        if (event.noteType === "green" && event.url) {
            window.open(event.url, "_blank");
        } else {
            const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            setActiveSection("create");
            openPostFromUrl(event.platform, event.content || "", { eventId: event.id, dateKey });
        }
        setPopup(null);
    };

    const handleSaveTime = async (event: CalendarEvent, date: Date, newTime24h: string) => {
        await updateEvent(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            event,
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            newTime24h
        );
    };

    const handleDeleteConfirm = async () => {
        if (!eventToDelete) return;
        const { event, date } = eventToDelete;
        await deleteEvent(date.getFullYear(), date.getMonth(), date.getDate(), event);
        setEventToDelete(null);
    };

    // DATA GENERATION
    const calendarGrid = useMemo(() => {
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
        const firstDayIndex = (firstDayOfMonth.getDay() + 6) % 7;
        const currentDay = new Date(currentYear, currentMonth, 1 - firstDayIndex);
        return Array.from({ length: 42 }, (_, i) => {
            const cellDate = new Date(currentDay);
            currentDay.setDate(currentDay.getDate() + 1);
            return cellDate;
        }).map((cellDate) => {
            const dayNum = cellDate.getDate();
            const inCurrentMonth = cellDate.getMonth() === currentMonth;
            const isToday = new Date().toDateString() === cellDate.toDateString();
            const clickedKey = `${cellDate.getFullYear()}-${cellDate.getMonth()}-${dayNum}`;
            const dayEvents = getEventsFromStore(cellDate.getFullYear(), cellDate.getMonth(), dayNum, calendarEvents);
            return { dayNum, inCurrentMonth, isToday, clickedKey, dayEvents, cellDate, isClicked: false };
        });
    }, [currentYear, currentMonth, calendarEvents]);

    const weekDays = useMemo(() => {
        const startOfWeek = new Date(currentWeekStart);
        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            return date;
        });
    }, [currentWeekStart]);

    const eventsForWeek = useMemo(() => {
        const events: Record<string, CalendarEvent[]> = {};
        weekDays.forEach((date) => {
            const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            const dayEvents = getEventsFromStore(date.getFullYear(), date.getMonth(), date.getDate(), calendarEvents);
            if (dayEvents.length > 0) {
                events[dateKey] = dayEvents.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
            }
        });
        return events;
    }, [weekDays, calendarEvents]);

    // --- RENDER ---
    return (
        <div className="w-full max-w-none flex flex-col h-full overflow-hidden">
            <SectionHeader icon={Calendar} title={tHeaders("calendar.title")} description={tHeaders("calendar.description")} />

            <CalendarToolbar
                calendarView={calendarView}
                currentMonth={currentMonth}
                currentYear={currentYear}
                currentWeekStart={currentWeekStart}
                onPrev={goPrev}
                onNext={goNext}
                onSetView={setCalendarView}
                onIconDragStart={handleIconDragStart}
                isSyncing={isSyncing}
                lastSyncedAt={lastSyncedAt}
                isOnline={isOnline}
            />

            <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                {liveAnnouncement}
            </div>

            <div className="flex-1 min-h-0 relative">
                <CalendarEmptyState calendarEvents={calendarEvents} />

                {calendarView === "monthly" ? (
                    <MonthlyViewGrid
                        calendarGrid={calendarGrid}
                        getNoteText={getNoteText}
                        onDayClick={(cell) => {
                            setClickedDays(new Set([cell.clickedKey]));
                            setPopup(null);
                            setSelectedCellKey(null);
                        }}
                        onDragOver={handleDragOver}
                        onDrop={(e, cell) => handleDrop(e, cell.cellDate)}
                        onNoteDragStart={(e, cell, event) => handleNoteDragStart(e, cell.cellDate, event)}
                        onNoteClick={handleNoteClick}
                        selectedCellKey={selectedCellKey}
                        onSelectCell={handleSelectCell}
                        onCloseCell={handleCloseCell}
                        onAddToCell={handleAddToCell}
                    />
                ) : (
                    <WeeklyViewGrid
                        weekDays={weekDays}
                        eventsByDay={eventsForWeek}
                        getNoteText={getNoteText}
                        onDayClick={(date) => {
                            setClickedDays(new Set([`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`]));
                            setPopup(null);
                        }}
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
                onConfirmDelete={(event, date) => {
                    setEventToDelete({ event, date });
                    setPopup(null);
                }}
                onSaveTime={handleSaveTime}
            />

            {eventToDelete && (
                <ConfirmModal
                    isOpen={true}
                    onClose={() => setEventToDelete(null)}
                    onConfirm={handleDeleteConfirm}
                    title={t("deleteModal.title")}
                    description={t("deleteModal.message")}
                    confirmText={t("deleteModal.yes")}
                    cancelText={t("deleteModal.no")}
                    variant="danger"
                />
            )}
        </div>
    );
}
