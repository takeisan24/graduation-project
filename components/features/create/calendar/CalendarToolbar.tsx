"use client";

import { Button } from "@/components/ui/button";
import { SOCIAL_PLATFORMS } from "@/lib/constants/platforms";
import { needsInversion } from "@/lib/utils/platform";
import { useTranslations, useLocale } from "next-intl";
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
    TooltipProvider,
} from "@/components/ui/tooltip";
import { SyncBadge } from "./SyncBadge";

interface CalendarToolbarProps {
    calendarView: "monthly" | "weekly";
    currentMonth: number;
    currentYear: number;
    currentWeekStart: Date;
    onPrev: () => void;
    onNext: () => void;
    onSetView: (view: "monthly" | "weekly") => void;
    onIconDragStart: (e: React.DragEvent, platform: string) => void;
    isSyncing?: boolean;
    lastSyncedAt?: Date | null;
    isOnline?: boolean;
}

export function CalendarToolbar({
    calendarView,
    currentMonth,
    currentYear,
    currentWeekStart,
    onPrev,
    onNext,
    onSetView,
    onIconDragStart,
    isSyncing,
    lastSyncedAt,
    isOnline,
}: CalendarToolbarProps) {
    const t = useTranslations("CreatePage.calendarSection");
    const tCommon = useTranslations("Common");
    const locale = useLocale();
    const months = tCommon.raw("months") as string[];

    const getWeekRangeLabel = () => {
        const startOfWeek = new Date(currentWeekStart);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const formatDate = (date: Date) => {
            try {
                return new Intl.DateTimeFormat(locale, {
                    day: "numeric",
                    month: "numeric",
                }).format(date);
            } catch {
                return `${date.getDate()}/${date.getMonth() + 1}`;
            }
        };

        return `${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}`;
    };

    return (
        <TooltipProvider delayDuration={300}>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-4 mb-2 mt-1 mr-2 lg:mr-8 px-2 lg:px-0">
                <div className="flex items-center gap-2">
                    <Button
                        size="icon"
                        variant="ghost"
                        className="w-8 h-8 text-muted-foreground hover:text-foreground"
                        onClick={onPrev}
                    >
                        ‹
                    </Button>
                    <div className="px-2 lg:px-4 py-1 rounded-md border border-border bg-secondary text-foreground flex items-center justify-center min-w-[140px] lg:min-w-[180px] text-sm lg:text-base">
                        {calendarView === "monthly"
                            ? `${months[currentMonth]}, ${currentYear}`
                            : getWeekRangeLabel()}
                    </div>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="w-8 h-8 text-muted-foreground hover:text-foreground"
                        onClick={onNext}
                    >
                        ›
                    </Button>
                </div>

                <div className="flex-grow flex justify-start lg:justify-center items-center gap-3 sm:gap-4 md:gap-6 lg:gap-10 order-last md:order-none w-full md:w-auto mt-4 md:mt-0 overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 pb-2">
                    {SOCIAL_PLATFORMS.map((platform) => (
                        <Tooltip key={platform.name}>
                            <TooltipTrigger asChild>
                                <img
                                    src={platform.icon}
                                    alt={platform.name}
                                    aria-label={`${platform.name}: ${t("platformIconTooltip")}`}
                                    className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 flex-shrink-0 cursor-grab hover:opacity-80 transition-all ${
                                        needsInversion(platform.name)
                                            ? "dark:filter dark:brightness-0 dark:invert"
                                            : ""
                                    }`}
                                    draggable
                                    onDragStart={(e) => onIconDragStart(e, platform.name)}
                                />
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p className="text-xs max-w-[200px]">{t("platformIconTooltip")}</p>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </div>

                <div className="ml-auto md:ml-4 flex items-center gap-3">
                    <SyncBadge
                        isSyncing={!!isSyncing}
                        lastSyncedAt={lastSyncedAt ?? null}
                        isOnline={isOnline ?? true}
                    />
                    <div className="inline-flex rounded-lg overflow-hidden border border-border">
                        <Button
                            variant={calendarView === "monthly" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => onSetView("monthly")}
                            className={`text-xs lg:text-sm ${
                                calendarView === "monthly"
                                    ? "bg-gradient-to-r from-utc-royal to-utc-sky text-white border-0"
                                    : ""
                            }`}
                        >
                            {t("month")}
                        </Button>
                        <Button
                            variant={calendarView === "weekly" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => onSetView("weekly")}
                            className={`text-xs lg:text-sm ${
                                calendarView === "weekly"
                                    ? "bg-gradient-to-r from-utc-royal to-utc-sky text-white border-0"
                                    : ""
                            }`}
                        >
                            {t("week")}
                        </Button>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}