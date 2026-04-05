"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CalendarEvent } from "@/lib/types/calendar";
import { convert24HourToAmPm, convertAmPmTo24Hour } from "@/lib/utils/date";
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
        className="bg-card border rounded-lg shadow-lg flex flex-col"
        style={{
          left: `${Math.min(x, window.innerWidth - 200)}px`,
          top: `${Math.min(y, window.innerHeight - 150)}px`,
          transform: 'translateY(calc(-100% - 8px))',
        }}
        aria-label={ariaLabel}
        aria-modal="true"
        role="dialog"
        onOpenAutoFocus={handleOpenAutoFocus}
      >
        {/* Platform color top border */}
        <div
          className={`h-1 w-full rounded-t-lg -mt-6 -mx-6 mb-4 ${platformColors.bg}`}
        />

        {!isEditingTime ? (
          <div className="flex items-center justify-center gap-3 px-3" style={{ minHeight: '55px' }}>
            <button
              title={t('viewEdit')}
              aria-label={t('viewEdit')}
              onClick={() => onOpenInEditor(event, date)}
              className="w-10 h-10 p-2 rounded-full hover:bg-white/10 flex-shrink-0 flex items-center justify-center transition-colors"
            >
              <img src="/icons/sidebar/Eye.svg" alt="" className="opacity-80" style={{ width: 24, height: 24 }} />
            </button>
            {isYellowNote && (
              <>
                <div className="w-px h-6 bg-white/10" />
                <button
                  title={t('editTime')}
                  aria-label={t('editTime')}
                  onClick={handleEditTimeClick}
                  className="w-10 h-10 p-2 rounded-full hover:bg-white/10 flex-shrink-0 flex items-center justify-center transition-colors"
                >
                  <img src="/icons/sidebar/Clock.svg" alt="" className="opacity-80" style={{ width: 20, height: 20 }}/>
                </button>
                <div className="w-px h-6 bg-white/10" />
                <button
                  title={t('deleteEvent')}
                  aria-label={t('deleteEvent')}
                  onClick={() => onConfirmDelete(event, date)}
                  className="w-10 h-10 p-2 rounded-full hover:bg-white/10 flex-shrink-0 flex items-center justify-center transition-colors"
                >
                  <img src="/icons/sidebar/Trash.svg" alt="" className="opacity-80" style={{ width: 20, height: 20 }} />
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-4 w-80">
            <h3 className="text-lg font-semibold text-foreground">{t('editTimeTitle')}</h3>
            <div className="flex items-center justify-center gap-2 text-foreground">
              <select
                value={hour}
                onChange={e => setHour(parseInt(e.target.value))}
                aria-label="Hour"
                className="bg-secondary border border-border rounded p-2 text-lg text-foreground"
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
                className="bg-secondary border border-border rounded p-2 text-lg text-foreground"
              >
                {Array.from({ length: 60 }, (_, i) => i).map(m => (
                  <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                ))}
              </select>
              <select
                value={ampm}
                onChange={e => setAmpm(e.target.value as 'AM' | 'PM')}
                aria-label="AM/PM"
                className="bg-secondary border border-border rounded p-2 text-lg text-foreground"
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
