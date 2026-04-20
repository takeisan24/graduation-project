"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CalendarEvent } from "@/lib/types/calendar";
import { convert24HourToAmPm, convertAmPmTo24Hour } from "@/lib/utils/date";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { useTranslations } from 'next-intl';
import { getPlatformColors } from '@/lib/constants/platformColors';
import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from "@/components/ui/dialog";

interface PopupData {
  x: number;
  y: number;
  event: CalendarEvent;
  date: Date;
}

interface CalendarPopupsProps {
  popupData: PopupData | null;
  onClose: () => void;
  onOpenInEditor: (event: CalendarEvent, date: Date) => void;
  onConfirmDelete: (event: CalendarEvent, date: Date) => void;
  onSaveTime: (event: CalendarEvent, date: Date, newTime24h: string) => void;
}

export function CalendarPopups({ popupData, onClose, onOpenInEditor, onConfirmDelete, onSaveTime }: CalendarPopupsProps) {
  const t = useTranslations('CreatePage.calendarSection.popup');
  const tCommon = useTranslations('Common');

  const [isEditingTime, setIsEditingTime] = useState(false);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');
  const [isMobile, setIsMobile] = useState(false);

  // Reset editing state when popup opens/changes
  useEffect(() => {
    if (popupData) {
      setIsEditingTime(false);
    }
  }, [popupData]);

  // Handle Escape key for dialog
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (popupData) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [popupData, handleKeyDown]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (!popupData) return null;

  const { x, y, event, date } = popupData;
  const isYellowNote = event.noteType === 'yellow';
  const platformColors = getPlatformColors(event.platform);

  // Format time for ARIA
  const formatTimeForAria = (time: string) => {
    if (!time) return '';
    const parts = time.split(':');
    if (parts.length < 2) return time;
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m} ${period}`;
  };

  const ariaLabel = event.time
    ? t('ariaPopup', {
        platform: event.platform,
        time: formatTimeForAria(event.time)
      })
    : `${event.platform}. ${t('noEventsOnDay') || 'No time set'}`;

  const handleEditTimeClick = () => {
    const initialTime = event.time ? convert24HourToAmPm(event.time) : { hour: 9, minute: 0, ampm: 'AM' as const };
    setHour(initialTime.hour);
    setMinute(initialTime.minute);
    setAmpm(initialTime.ampm);
    setIsEditingTime(true);
  };

  const handleSaveTimeEdit = () => {
    const newTime24h = convertAmPmTo24Hour(hour, minute, ampm);
    onSaveTime(event, date, newTime24h);
    onClose();
  };

  // Prevent dialog from auto-focusing when opening
  const handleOpenAutoFocus = (e: Event) => {
    e.preventDefault();
  };

  return (
    <Dialog open={!!popupData} onOpenChange={(open) => !open && onClose()}>
      <DialogOverlay className="bg-black/50 backdrop-blur-sm" />
      <DialogContent
        className={`bg-card border shadow-lg flex flex-col ${
          isMobile
            ? "bottom-0 left-0 right-0 top-auto translate-y-0 rounded-t-2xl rounded-b-none border-x-0 border-b-0"
            : "rounded-lg"
        }`}
        style={isMobile ? undefined : {
          left: `${Math.min(x, window.innerWidth - 260)}px`,
          top: `${Math.min(y, window.innerHeight - 220)}px`,
          transform: 'translateY(calc(-100% - 8px))',
        }}
        aria-label={ariaLabel}
        aria-modal="true"
        role="dialog"
        onOpenAutoFocus={handleOpenAutoFocus}
      >
        {/* Platform color top border */}
        <div
          className={`h-1 w-full ${isMobile ? "-mt-6 -mx-6 mb-4" : "rounded-t-lg -mt-6 -mx-6 mb-4"} ${platformColors.bg}`}
        />

        {!isEditingTime ? (
          <div className={`flex flex-col gap-4 ${isMobile ? "px-0 pb-2" : "px-1 pb-1"}`}>
            {isMobile && (
              <div className="mx-auto h-1.5 w-14 rounded-full bg-muted-foreground/20" aria-hidden="true" />
            )}

            <div className="flex items-start gap-3 px-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${platformColors.border} ${platformColors.tint}`}>
                <PlatformIcon platform={event.platform} size={18} variant="inline" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{event.platform}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    event.noteType === "green" ? "bg-emerald-500/10 text-emerald-700"
                      : event.noteType === "red" ? "bg-rose-500/10 text-rose-700"
                      : event.noteType === "blue" ? "bg-sky-500/10 text-sky-700"
                      : "bg-amber-500/10 text-amber-700"
                  }`}>
                    {event.noteType === "green" ? t("statusPosted")
                      : event.noteType === "red" ? t("statusFailed")
                      : event.noteType === "blue" ? t("statusPublishing")
                      : t("statusScheduled")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.time ? t("scheduledTime", { time: formatTimeForAria(event.time) }) : t("scheduledTimeEmpty")}
                </p>
              </div>
            </div>

            <div className={`grid gap-2 px-3 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
              <Button
                title={t('viewEdit')}
                aria-label={t('viewEdit')}
                onClick={() => onOpenInEditor(event, date)}
                variant="outline"
                className="justify-start rounded-xl"
              >
                {t('viewEdit')}
              </Button>
              {isYellowNote && (
                <Button
                  title={t('editTime')}
                  aria-label={t('editTime')}
                  onClick={handleEditTimeClick}
                  variant="outline"
                  className="justify-start rounded-xl"
                >
                  {t('editTime')}
                </Button>
              )}
              {isYellowNote && (
                <Button
                  title={t('deleteEvent')}
                  aria-label={t('deleteEvent')}
                  onClick={() => onConfirmDelete(event, date)}
                  variant="outline"
                  className="justify-start rounded-xl text-rose-600 hover:text-rose-700"
                >
                  {t('deleteEvent')}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className={`flex flex-col gap-4 ${isMobile ? "p-1 pt-0" : "w-80 p-4"}`}>
            <h3 className="text-lg font-semibold text-foreground">{t('editTimeTitle')}</h3>
            <div className={`flex items-center justify-center gap-2 text-foreground ${isMobile ? "flex-wrap" : ""}`}>
              <select
                value={hour}
                onChange={e => setHour(parseInt(e.target.value))}
                aria-label="Hour"
                className="bg-secondary border border-border rounded-xl p-2 text-lg text-foreground"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
                ))}
              </select>
              <span aria-hidden="true">:</span>
              <select
                value={minute}
                onChange={e => setMinute(parseInt(e.target.value))}
                aria-label="Minute"
                className="bg-secondary border border-border rounded-xl p-2 text-lg text-foreground"
              >
                {Array.from({ length: 60 }, (_, i) => i).map(m => (
                  <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                ))}
              </select>
              <select
                value={ampm}
                onChange={e => setAmpm(e.target.value as 'AM' | 'PM')}
                aria-label="AM/PM"
                className="bg-secondary border border-border rounded-xl p-2 text-lg text-foreground"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsEditingTime(false)}>{tCommon('cancel')}</Button>
              <Button className="bg-primary hover:bg-primary/90" onClick={handleSaveTimeEdit}>{t('saveTime')}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
