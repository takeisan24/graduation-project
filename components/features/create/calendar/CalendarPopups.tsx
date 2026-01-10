"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CalendarEvent } from "@/lib/types/calendar";
import { convert24HourToAmPm, convertAmPmTo24Hour } from "@/lib/utils/date";
import { useTranslations } from 'next-intl';

// --- TYPE DEFINITIONS ---
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

  useEffect(() => {
    if (popupData) {
      setIsEditingTime(false); // Reset về popup chính mỗi khi mở
    }
  }, [popupData]);

  if (!popupData) return null;

  const { x, y, event, date } = popupData;
  const isYellowNote = event.noteType === 'yellow';

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

  return (
    <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-[99]" onClick={onClose} />
            
            {/* --- THAY ĐỔI TOÀN BỘ PHẦN POPUP CONTENT NÀY --- */}
            <div
                className="fixed z-[100] bg-[#2A2A30] border border-white/10 rounded-lg shadow-lg flex flex-col"
                style={{ left: `${x}px`, top: `${y}px`, transform: 'translate(-50%, -110%)' }}
                onClick={(e) => e.stopPropagation()} // Ngăn backdrop bị click
            >
                {!isEditingTime ? (
                    // === Cấu trúc JSX được sửa lại giống hệt file backup ===
                    <div className="flex items-center justify-center gap-3 px-3" style={{ minHeight: '55px' }}>
                        <button title={t('viewEdit')} onClick={() => onOpenInEditor(event, date)} className="w-10 h-10 p-2 rounded-full hover:bg-white/10 flex-shrink-0 flex items-center justify-center transition-colors">
                            {/* Bỏ class w/h, dùng style để đảm bảo kích thước */}
                            <img src="/Eye.svg" alt="view" className="opacity-80" style={{ width: 24, height: 24 }} />
                        </button>
                        {isYellowNote && (
                            <>
                                <div className="w-px h-6 bg-white/10" />
                                <button title={t('editTime')} onClick={handleEditTimeClick} className="w-10 h-10 p-2 rounded-full hover:bg-white/10 flex-shrink-0 flex items-center justify-center transition-colors">
                                    <img src="/Clock.svg" alt="edit time" className="opacity-80" style={{ width: 20, height: 20 }}/>
                                </button>
                                <div className="w-px h-6 bg-white/10" />
                                <button title={t('deleteEvent')} onClick={() => onConfirmDelete(event, date)} className="w-10 h-10 p-2 rounded-full hover:bg-white/10 flex-shrink-0 flex items-center justify-center transition-colors">
                                    <img src="/Trash.svg" alt="delete" className="opacity-80" style={{ width: 20, height: 20 }} />
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    // Popup sửa thời gian (giữ nguyên cấu trúc này vì nó đã đúng)
                    <div className="p-4 flex flex-col gap-4 w-80">
                        <h3 className="text-lg font-semibold text-white">{t('editTimeTitle')}</h3>
                        <div className="flex items-center justify-center gap-2 text-white">
                            <select value={hour} onChange={e => setHour(parseInt(e.target.value))} className="bg-[#1E1E23] border border-white/20 rounded p-2 text-lg">
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                            </select>
                            <span>:</span>
                            <select value={minute} onChange={e => setMinute(parseInt(e.target.value))} className="bg-[#1E1E23] border border-white/20 rounded p-2 text-lg">
                                {Array.from({ length: 60 }, (_, i) => i).map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                            </select>
                            <select value={ampm} onChange={e => setAmpm(e.target.value as 'AM' | 'PM')} className="bg-[#1E1E23] border border-white/20 rounded p-2 text-lg">
                                <option value="AM">AM</option> <option value="PM">PM</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-3">
                            <Button variant="ghost" onClick={() => setIsEditingTime(false)}>{tCommon('cancel')}</Button>
                            <Button className="bg-primary hover:bg-primary/90" onClick={handleSaveTimeEdit}>{t('saveTime')}</Button>
                        </div>
                    </div>
                )}
            </div>
        </>
  );
}
