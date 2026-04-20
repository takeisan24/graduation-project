"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { SOCIAL_PLATFORMS } from "@/lib/constants/platforms";
import { needsInversion } from "@/lib/utils/platform";
import { cn } from "@/lib/utils/cn";
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
    onToday: () => void;
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
    onToday,
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
            <div className="sticky top-0 z-20 rounded-2xl border border-border/70 bg-card/92 px-4 py-3 shadow-sm backdrop-blur-sm">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between xl:min-w-[360px]">
                        <div className="flex items-center gap-2">
                    <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-xl border-border/70 bg-background/80 text-muted-foreground hover:text-foreground"
                        onClick={onPrev}
                    >
                        ‹
                    </Button>
                            <div className="min-w-[170px] rounded-xl border border-border/70 bg-secondary/70 px-4 py-2 text-center text-sm font-semibold text-foreground shadow-inner sm:min-w-[220px]">
                        {calendarView === "monthly"
                            ? `${months[currentMonth]}, ${currentYear}`
                            : getWeekRangeLabel()}
                            </div>
                    <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-xl border-border/70 bg-background/80 text-muted-foreground hover:text-foreground"
                        onClick={onNext}
                    >
                        ›
                    </Button>
                </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onToday}
                            className="h-9 rounded-xl border border-transparent px-3 text-xs font-medium text-muted-foreground hover:border-border hover:bg-secondary/70 hover:text-foreground"
                        >
                            {t("today")}
                        </Button>
                    </div>

                    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {SOCIAL_PLATFORMS.map((platform) => (
                        <Tooltip key={platform.name}>
                            <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        className="group flex min-w-max cursor-grab items-center gap-2 rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-secondary/70"
                                        draggable
                                        onDragStart={(e) => onIconDragStart(e, platform.name)}
                                        aria-label={`${platform.name}: ${t("platformIconTooltip")}`}
                                    >
                                        <Image
                                    unoptimized
                                    src={platform.icon}
                                            alt=""
                                    width={20}
                                    height={20}
                                    className={`h-5 w-5 flex-shrink-0 transition-all group-hover:opacity-80 ${
                                        needsInversion(platform.name)
                                            ? "dark:filter dark:brightness-0 dark:invert"
                                            : ""
                                    }`}
                                            aria-hidden="true"
                                        />
                                        <span className="text-xs font-medium text-foreground/85">{platform.name}</span>
                                    </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p className="text-xs max-w-[200px]">{t("platformIconTooltip")}</p>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                    <SyncBadge
                        isSyncing={!!isSyncing}
                        lastSyncedAt={lastSyncedAt ?? null}
                        isOnline={isOnline ?? true}
                    />
                        <div className="inline-flex rounded-xl border border-border/70 bg-background/80 p-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSetView("monthly")}
                                className={cn(
                                    "h-8 rounded-lg px-3 text-xs lg:text-sm",
                                    calendarView === "monthly" && "bg-gradient-to-r from-utc-royal to-utc-sky text-white shadow-sm hover:text-white"
                                )}
                        >
                            {t("month")}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSetView("weekly")}
                                className={cn(
                                    "h-8 rounded-lg px-3 text-xs lg:text-sm",
                                    calendarView === "weekly" && "bg-gradient-to-r from-utc-royal to-utc-sky text-white shadow-sm hover:text-white"
                                )}
                        >
                            {t("week")}
                        </Button>
                    </div>
                </div>
            </div>
            </div>
        </TooltipProvider>
    );
}
