"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useCreatePostsStore, useCalendarStore } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { useTranslations } from "next-intl";
import { CalendarEvent } from "@/lib/types/calendar";
import { getCalendarEventsForDay as getEventsFromStore } from "@/lib/utils/calendarUtils";
import { formatTime24h } from "@/lib/utils/date";
import { getPlatformColors } from "@/lib/constants/platformColors";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";
import { autoUpdatePublishingStatus as autoUpdatePublishingStatusFn } from "@/store/shared/statusCheck";
import { CALENDAR_ERRORS } from "@/lib/messages/errors";
import { Calendar, AlertTriangle, Clock3, Filter, ArrowRight, RotateCcw } from "lucide-react";
import SectionHeader from "../layout/SectionHeader";
import { CalendarToolbar } from "./CalendarToolbar";
import { MonthlyViewGrid } from "./MonthlyViewGrid";
import { WeeklyViewGrid } from "./WeeklyViewGrid";
import { CalendarPopups } from "./CalendarPopups";
import ConfirmModal from "@/components/shared/ConfirmModal";
import { CalendarEmptyState, getCalendarEmptyStateFlags } from "./CalendarEmptyState";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { useSectionNavigation } from "@/hooks/useSectionNavigation";

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
type CalendarStatusFilter = "all" | "scheduled" | "publishing" | "posted" | "failed";

function normalizeEventStatus(event: CalendarEvent): Exclude<CalendarStatusFilter, "all"> {
    const status = String(event.status || "").toLowerCase();
    if (status === "posted") return "posted";
    if (status === "failed") return "failed";
    if (status === "publishing") return "publishing";
    return "scheduled";
}

function getDateKey(date: Date) {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

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
            hydrateScheduledPosts: state.hydrateScheduledPosts,
        }))
    );
    const { calendarEvents, addEvent, updateEvent, deleteEvent, syncCalendarWithPostStatuses, hydrateScheduledPosts } = calendarStoreState;
    const openPostFromUrl = useCreatePostsStore((state) => state.openPostFromUrl);
    const navigateToSection = useSectionNavigation();

    const autoUpdatePublishingStatus = useCallback(async () => {
        await autoUpdatePublishingStatusFn(calendarEvents, (updates) => {
            syncCalendarWithPostStatuses(updates);
        });
    }, [calendarEvents, syncCalendarWithPostStatuses]);

    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [calendarView, setCalendarView] = useState<"monthly" | "weekly">("monthly");
    const [, setClickedDays] = useState<Set<string>>(new Set());
    const [popup, setPopup] = useState<{ x: number; y: number; event: CalendarEvent; date: Date } | null>(null);
    const [eventToDelete, setEventToDelete] = useState<DeleteModalState>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [platformFilter, setPlatformFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<CalendarStatusFilter>("all");
    const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);
    const [liveAnnouncement, setLiveAnnouncement] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
    const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

    const handleSelectCell = useCallback((cellKey: string) => setSelectedCellKey(cellKey), []);
    const handleCloseCell = useCallback(() => setSelectedCellKey(null), []);

    const getMondayOfCurrentWeek = useCallback(() => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() + daysToMonday);
        startOfWeek.setHours(0, 0, 0, 0);
        return startOfWeek;
    }, []);

    const getMondayOfDate = useCallback((date: Date) => {
        const source = new Date(date);
        const dayOfWeek = source.getDay();
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        source.setDate(source.getDate() + daysToMonday);
        source.setHours(0, 0, 0, 0);
        return source;
    }, []);

    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMondayOfCurrentWeek());
    const getNoteText = useCallback((event: CalendarEvent) => getNoteTextWithT(event, t), [t]);

    useEffect(() => {
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        let isMounted = true;

        const doSync = async () => {
            if (document.hidden || !isMounted) return;
            setIsSyncing(true);
            await hydrateScheduledPosts();
            await autoUpdatePublishingStatus();
            if (!isMounted) return;
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
        const handleCalendarUpdated = () => scheduleSync();
        const handlePublished = () => scheduleSync();
        window.addEventListener("calendar:event-scheduled", handleScheduled);
        window.addEventListener("calendar:event-updated", handleCalendarUpdated);
        window.addEventListener("calendar:post-published", handlePublished);

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        const intervalId = setInterval(() => {
            if (!document.hidden) doSync();
        }, 15_000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
            if (debounceTimer) clearTimeout(debounceTimer);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("calendar:event-scheduled", handleScheduled);
            window.removeEventListener("calendar:event-updated", handleCalendarUpdated);
            window.removeEventListener("calendar:post-published", handlePublished);
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, [calendarEvents, autoUpdatePublishingStatus, hydrateScheduledPosts]);

    const goPrev = () => {
        if (calendarView === "monthly") {
            setCurrentMonth((prev) => {
                if (prev === 0) {
                    setCurrentYear((year) => year - 1);
                    return 11;
                }
                return prev - 1;
            });
        } else {
            setCurrentWeekStart((prev) => {
                const next = new Date(prev);
                next.setDate(prev.getDate() - 7);
                return next;
            });
        }
    };

    const goNext = () => {
        if (calendarView === "monthly") {
            setCurrentMonth((prev) => {
                if (prev === 11) {
                    setCurrentYear((year) => year + 1);
                    return 0;
                }
                return prev + 1;
            });
        } else {
            setCurrentWeekStart((prev) => {
                const next = new Date(prev);
                next.setDate(prev.getDate() + 7);
                return next;
            });
        }
    };

    const goToday = useCallback(() => {
        const today = new Date();
        setCurrentMonth(today.getMonth());
        setCurrentYear(today.getFullYear());
        setCurrentWeekStart(getMondayOfCurrentWeek());
        setSelectedDate(today);
    }, [getMondayOfCurrentWeek]);

    const syncSelectionToDate = useCallback((date: Date) => {
        setPopup(null);
        setSelectedDate(date);
        setCurrentMonth(date.getMonth());
        setCurrentYear(date.getFullYear());
        setCurrentWeekStart(getMondayOfDate(date));
    }, [getMondayOfDate]);

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
        } catch (error) {
            console.error("Drop failed:", error);
            toast.error(CALENDAR_ERRORS.DROP_FAILED);
        }
    };

    const handleNoteClick = (e: React.MouseEvent, _event: CalendarEvent, date: Date) => {
        e.stopPropagation();
        const dateKey = getDateKey(date);
        setClickedDays(new Set([dateKey]));
        setSelectedCellKey(dateKey);
        syncSelectionToDate(date);
    };

    const handleOpenInEditor = useCallback(async (event: CalendarEvent, date: Date) => {
        if (event.noteType === "green" && event.url) {
            window.open(event.url, "_blank", "noopener,noreferrer");
        } else {
            const dateKey = getDateKey(date);
            navigateToSection("create");
            openPostFromUrl(event.platform, event.content || "", { eventId: event.id, dateKey }, event.mediaUrls, undefined, undefined, {
                forceNewPost: true,
                context: {
                    source: "calendar",
                    scheduledPostId: event.scheduled_post_id,
                    eventId: event.id,
                    dateKey,
                }
            });
        }
        setPopup(null);
    }, [navigateToSection, openPostFromUrl]);

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

    const matchesFilters = useCallback((event: CalendarEvent) => {
        const platformMatches = platformFilter === "all" || event.platform.toLowerCase() === platformFilter.toLowerCase();
        const statusMatches = statusFilter === "all" || normalizeEventStatus(event) === statusFilter;
        return platformMatches && statusMatches;
    }, [platformFilter, statusFilter]);

    const allEvents = useMemo(() => {
        return Object.entries(calendarEvents).flatMap(([dateKey, events]) => {
            const [year, month, day] = dateKey.split("-").map(Number);
            const eventDate = new Date(year, month, day);
            return events.map((event) => ({
                event,
                date: eventDate,
                dateKey,
                normalizedStatus: normalizeEventStatus(event),
            }));
        });
    }, [calendarEvents]);

    const filteredEventCount = useMemo(() => {
        return allEvents.filter(({ event }) => matchesFilters(event)).length;
    }, [allEvents, matchesFilters]);

    const nextEmptyDate = useMemo(() => {
        const base = new Date();
        base.setHours(0, 0, 0, 0);
        for (let i = 0; i < 21; i++) {
            const candidate = new Date(base);
            candidate.setDate(base.getDate() + i);
            if (!calendarEvents[getDateKey(candidate)]?.length) {
                return candidate;
            }
        }
        return null;
    }, [calendarEvents]);

    const nextFailedEvent = useMemo(() => {
        return allEvents.find(({ normalizedStatus }) => normalizedStatus === "failed") ?? null;
    }, [allEvents]);

    const focusDateForScheduling = useCallback((targetDate?: Date | null) => {
        const fallbackDate = targetDate ?? nextEmptyDate ?? selectedDate ?? new Date();
        const dateKey = getDateKey(fallbackDate);
        const dateLabel = new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "long" }).format(fallbackDate);
        setCalendarView("monthly");
        setClickedDays(new Set([dateKey]));
        setSelectedCellKey(dateKey);
        syncSelectionToDate(fallbackDate);
        const hint = t("scheduleFocusHint", { date: dateLabel });
        setLiveAnnouncement(hint);
        toast.info(hint);
        window.setTimeout(() => setLiveAnnouncement(null), 3000);
    }, [nextEmptyDate, selectedDate, syncSelectionToDate, t]);

    const calendarGrid = useMemo(() => {
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
        const firstDayIndex = (firstDayOfMonth.getDay() + 6) % 7;
        const currentDay = new Date(currentYear, currentMonth, 1 - firstDayIndex);
        return Array.from({ length: 42 }, () => {
            const cellDate = new Date(currentDay);
            currentDay.setDate(currentDay.getDate() + 1);
            return cellDate;
        }).map((cellDate) => {
            const dayNum = cellDate.getDate();
            const inCurrentMonth = cellDate.getMonth() === currentMonth;
            const isToday = new Date().toDateString() === cellDate.toDateString();
            const clickedKey = `${cellDate.getFullYear()}-${cellDate.getMonth()}-${dayNum}`;
            const dayEvents = getEventsFromStore(cellDate.getFullYear(), cellDate.getMonth(), dayNum, calendarEvents)
                .filter(matchesFilters)
                .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
            return { dayNum, inCurrentMonth, isToday, clickedKey, dayEvents, cellDate, isClicked: false };
        });
    }, [currentYear, currentMonth, calendarEvents, matchesFilters]);

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
            const dateKey = getDateKey(date);
            const dayEvents = getEventsFromStore(date.getFullYear(), date.getMonth(), date.getDate(), calendarEvents)
                .filter(matchesFilters);
            if (dayEvents.length > 0) {
                events[dateKey] = dayEvents.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
            }
        });
        return events;
    }, [weekDays, calendarEvents, matchesFilters]);

    const selectedDateEvents = useMemo(() => {
        return getEventsFromStore(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
            calendarEvents
        )
            .filter(matchesFilters)
            .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    }, [selectedDate, calendarEvents, matchesFilters]);

    const selectedDateLabel = useMemo(() => {
        return new Intl.DateTimeFormat("vi-VN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
        }).format(selectedDate);
    }, [selectedDate]);

    const statusOptions: Array<{ value: CalendarStatusFilter; label: string }> = [
        { value: "all", label: t("filterAllStatuses") },
        { value: "scheduled", label: t("scheduled") },
        { value: "publishing", label: t("publishing") },
        { value: "posted", label: t("posted") },
        { value: "failed", label: t("failed") },
    ];

    const platformOptions = useMemo(() => {
        return Array.from(new Set(allEvents.map(({ event }) => event.platform))).sort((a, b) => a.localeCompare(b));
    }, [allEvents]);

    const hasActiveFilters = platformFilter !== "all" || statusFilter !== "all";
    const emptyStateFlags = useMemo(() => getCalendarEmptyStateFlags(calendarEvents), [calendarEvents]);
    const showAgendaScheduleCta = !emptyStateFlags.shouldRender;

    return (
        <div className="flex h-full min-h-0 w-full max-w-none flex-col overflow-y-auto overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(76,184,232,0.08),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.5),transparent_22%)]">
            <div className="flex min-h-full w-full flex-col px-4 pb-6 lg:px-6 lg:pb-8">
                <SectionHeader icon={Calendar} title={tHeaders("calendar.title")} description={tHeaders("calendar.description")} />

                <CalendarToolbar
                    calendarView={calendarView}
                    currentMonth={currentMonth}
                    currentYear={currentYear}
                    currentWeekStart={currentWeekStart}
                    onPrev={goPrev}
                    onNext={goNext}
                    onToday={goToday}
                    onSetView={setCalendarView}
                    onIconDragStart={handleIconDragStart}
                    isSyncing={isSyncing}
                    lastSyncedAt={lastSyncedAt}
                    isOnline={isOnline}
                />

                <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                    {liveAnnouncement}
                </div>

                <div className="mt-4 grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
                    <section className="flex min-h-[720px] min-w-0 flex-col overflow-hidden rounded-[28px] border border-border/70 bg-card/94 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                        <div className="min-h-0 flex-1 p-3 lg:p-4">
                            <div className="h-full min-h-[560px] overflow-hidden rounded-2xl border border-border/60 bg-background/80 p-3 lg:p-4">
                                <CalendarEmptyState
                                    calendarEvents={calendarEvents}
                                    onSchedule={() => focusDateForScheduling(nextEmptyDate)}
                                />

                                {calendarView === "monthly" ? (
                                    <MonthlyViewGrid
                                        calendarGrid={calendarGrid}
                                        getNoteText={getNoteText}
                                        onDayClick={(cell) => {
                                            setClickedDays(new Set([cell.clickedKey]));
                                            setSelectedCellKey(cell.clickedKey);
                                            syncSelectionToDate(cell.cellDate);
                                        }}
                                        onDragOver={handleDragOver}
                                        onDrop={(e, cell) => handleDrop(e, cell.cellDate)}
                                        onNoteDragStart={(e, cell, event) => handleNoteDragStart(e, cell.cellDate, event)}
                                        onNoteClick={handleNoteClick}
                                        selectedCellKey={selectedCellKey}
                                        onSelectCell={handleSelectCell}
                                        onCloseCell={handleCloseCell}
                                    />
                                ) : (
                                    <WeeklyViewGrid
                                        weekDays={weekDays}
                                        eventsByDay={eventsForWeek}
                                        getNoteText={getNoteText}
                                        onDayClick={(date) => {
                                            const dateKey = getDateKey(date);
                                            setClickedDays(new Set([dateKey]));
                                            setSelectedCellKey(dateKey);
                                            syncSelectionToDate(date);
                                        }}
                                        onDragOver={handleDragOver}
                                        onDrop={handleDrop}
                                        onNoteDragStart={handleNoteDragStart}
                                        onNoteClick={handleNoteClick}
                                    />
                                )}
                            </div>
                        </div>
                    </section>

                    <aside className="flex min-h-[720px] min-w-0 flex-col overflow-hidden rounded-[28px] border border-border/70 bg-card/95 shadow-[0_18px_50px_rgba(15,23,42,0.06)] xl:sticky xl:top-24 xl:max-h-[calc(100vh-8rem)]">
                        <div className="border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">{t("agendaTitle")}</p>
                                    <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">{selectedDateLabel}</h3>
                                </div>
                                {showAgendaScheduleCta ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => focusDateForScheduling(nextEmptyDate)}
                                        className="h-9 shrink-0 rounded-xl border-border/70"
                                    >
                                        {t("createNewSchedule")}
                                    </Button>
                                ) : null}
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                                {selectedDateEvents.length} {t("agendaSubtitle", { count: selectedDateEvents.length }).toLowerCase()} • {t("filterResultCount", { count: filteredEventCount }).toLowerCase()}
                            </p>
                        </div>

                        <div className="border-b border-border/60 p-4">
                            <div className="mb-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                        <Filter className="h-4 w-4" />
                                        {t("filterLabel")}
                                    </div>
                                    {hasActiveFilters ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 rounded-lg px-2.5 text-xs"
                                            onClick={() => {
                                                setPlatformFilter("all");
                                                setStatusFilter("all");
                                            }}
                                        >
                                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                                            {t("quickActionReset")}
                                        </Button>
                                    ) : null}
                                </div>

                                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                                    <label className="space-y-1">
                                        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                            {t("filterAllPlatforms")}
                                        </span>
                                        <div className="relative">
                                            <select
                                                value={platformFilter}
                                                onChange={(e) => setPlatformFilter(e.target.value)}
                                                className="h-10 w-full appearance-none rounded-xl border border-border/70 bg-background px-3 pr-9 text-sm text-foreground outline-none transition-colors hover:border-border focus:border-primary/40"
                                            >
                                                <option value="all">{t("filterAllPlatforms")}</option>
                                                {platformOptions.map((platform) => (
                                                    <option key={platform} value={platform.toLowerCase()}>
                                                        {platform}
                                                    </option>
                                                ))}
                                            </select>
                                            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">▾</span>
                                        </div>
                                    </label>

                                    <label className="space-y-1">
                                        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                            {t("filterAllStatuses")}
                                        </span>
                                        <div className="relative">
                                            <select
                                                value={statusFilter}
                                                onChange={(e) => setStatusFilter(e.target.value as CalendarStatusFilter)}
                                                className="h-10 w-full appearance-none rounded-xl border border-border/70 bg-background px-3 pr-9 text-sm text-foreground outline-none transition-colors hover:border-border focus:border-primary/40"
                                            >
                                                {statusOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">▾</span>
                                        </div>
                                    </label>
                                </div>

                                {hasActiveFilters ? (
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        {platformFilter !== "all" ? (
                                            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                                                {platformOptions.find((platform) => platform.toLowerCase() === platformFilter) || platformFilter}
                                            </span>
                                        ) : null}
                                        {statusFilter !== "all" ? (
                                            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                                                {statusOptions.find((option) => option.value === statusFilter)?.label}
                                            </span>
                                        ) : null}
                                    </div>
                                ) : (
                                    <p className="mt-3 text-xs text-muted-foreground">
                                        {t("filterResultCount", { count: filteredEventCount })}
                                    </p>
                                )}

                                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-muted-foreground">
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                                        {t("scheduled")}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden="true" />
                                        {t("publishing")}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                                        {t("posted")}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />
                                        {t("failed")}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                {nextFailedEvent && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="justify-between rounded-xl"
                                        onClick={() => {
                                            const dateKey = getDateKey(nextFailedEvent.date);
                                            setClickedDays(new Set([dateKey]));
                                            setSelectedCellKey(dateKey);
                                            syncSelectionToDate(nextFailedEvent.date);
                                        }}
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4" />
                                            {t("quickActionFailed")}
                                        </span>
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                )}

                                {nextEmptyDate && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="justify-between rounded-xl"
                                        onClick={() => focusDateForScheduling(nextEmptyDate)}
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <Clock3 className="h-4 w-4" />
                                            {t("quickActionEmpty")}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground">
                                            {new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(nextEmptyDate)}
                                        </span>
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                            {selectedDateEvents.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/25 p-5 text-center">
                                    <p className="text-sm font-medium text-foreground">{t("agendaEmptyTitle")}</p>
                                </div>
                            ) : (
                                selectedDateEvents.map((event) => {
                                    const status = normalizeEventStatus(event);
                                    const palette = getPlatformColors(event.platform);
                                    return (
                                        <div key={`${event.id}-${event.platform}`} className="rounded-2xl border border-border/70 bg-background/90 p-4 shadow-sm">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border", palette.border, palette.tint)}>
                                                        <PlatformIcon platform={event.platform} size={18} variant="inline" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-foreground">{event.platform}</p>
                                                        <p className="text-xs text-muted-foreground">{event.time ? formatTime24h(event.time) : t("agendaNoTime")}</p>
                                                    </div>
                                                </div>
                                                <div className={cn(
                                                    "rounded-full px-2.5 py-1 text-[11px] font-medium",
                                                    status === "posted" && "bg-emerald-500/10 text-emerald-700",
                                                    status === "failed" && "bg-rose-500/10 text-rose-700",
                                                    status === "publishing" && "bg-sky-500/10 text-sky-700",
                                                    status === "scheduled" && "bg-amber-500/10 text-amber-700"
                                                )}>
                                                    {status === "posted" ? t("posted") : status === "failed" ? t("failed") : status === "publishing" ? t("publishing") : t("scheduled")}
                                                </div>
                                            </div>

                                            <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                                                {event.content?.trim() || t("agendaNoContent")}
                                            </p>

                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 rounded-lg"
                                                    onClick={() => handleOpenInEditor(event, selectedDate)}
                                                >
                                                    {t("popup.viewEdit")}
                                                </Button>
                                                {status === "scheduled" && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 rounded-lg"
                                                        onClick={(clickEvent) => {
                                                            const rect = clickEvent.currentTarget.getBoundingClientRect();
                                                            setPopup({
                                                                x: rect.left + rect.width / 2,
                                                                y: rect.top,
                                                                event,
                                                                date: selectedDate,
                                                            });
                                                        }}
                                                    >
                                                        {t("popup.editTime")}
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 rounded-lg text-rose-600 hover:text-rose-700"
                                                    onClick={() => setEventToDelete({ event, date: selectedDate })}
                                                >
                                                    {t("popup.deleteEvent")}
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </aside>
                </div>
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
