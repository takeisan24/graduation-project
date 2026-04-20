

"use client";

import Image from 'next/image';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X as CloseIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CheckCircleIcon } from 'lucide-react';
import { usePublishModalStore, useCreatePostsStore } from '@/store';
import { publishPostNow, schedulePostById } from '@/store/create/actions';
import { getDaysInMonth } from '@/lib/utils/date';
import { vietnameseWeekdays } from '@/lib/constants/calendar';
import { toast } from 'sonner';
import { useConnectedAccounts } from '@/hooks/useConnectedAccounts';
import { useTranslations } from 'next-intl';
import { GENERIC_ERRORS } from '@/lib/messages/errors';
import { getPlatformIcon, getPlatformName, needsInversion } from '@/lib/utils/platform';

// Map platform names to provider slugs (for API)
const PLATFORM_TO_PROVIDER: Record<string, string> = {
  "TikTok": "tiktok",
  "Instagram": "instagram",
  "YouTube": "youtube",
  "Facebook": "facebook",
  "X": "twitter",
  "Twitter": "twitter",
  "X (Twitter)": "twitter",
  "Threads": "threads",
  "LinkedIn": "linkedin",
  "Pinterest": "pinterest"
};

export default function PublishModal() {

    const t = useTranslations('CreatePage.createSection.publishModal');

    // Fallback helper to avoid showing raw i18n keys when missing translations
    const getText = (key: string, fallback: string) => {
        const val = t(key);
        if (!val || val === key || val.startsWith('CreatePage.')) return fallback;
        return val;
    };
    const tToast = useTranslations('Common.toast');

    const isOpen = usePublishModalStore(state => state.isPublishModalOpen);
    const setIsPublishModalOpen = usePublishModalStore(state => state.setIsPublishModalOpen);
    const selectedPostId = useCreatePostsStore(state => state.selectedPostId);
    const openPosts = useCreatePostsStore(state => state.openPosts);
    
    // Fetch connected accounts using shared hook
    const { getAccountsForPlatform: getConnectedAccountsForPlatform } = useConnectedAccounts();

    const closeModal = useCallback(() => {
        setIsPublishModalOpen(false);
    }, [setIsPublishModalOpen]);

    // State cục bộ
    const [selectedPlatform, setSelectedPlatform] = useState('');
    const [selectedAccount, setSelectedAccount] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null); // Store connected account ID
    const [selectedAccountPic, setSelectedAccountPic] = useState('/shego.jpg');
    const [showAccountDropdown, setShowAccountDropdown] = useState(false);
    
    /**
     * Get accounts for platform from connected accounts
     * Maps connected accounts to format expected by UI
     */
    const getAccountsForPlatform = useCallback((platform: string): Array<{ 
      username: string; 
      profilePic: string;
      accountId: string; // Add accountId for posting
    }> => {
      const provider = PLATFORM_TO_PROVIDER[platform];
      if (!provider) {
        return [];
      }
      
      const platformAccounts = getConnectedAccountsForPlatform(provider);
      return platformAccounts.map(acc => {
        // Get avatar from multiple sources (priority order):
        // 1. profile_metadata.avatar_url (from getlate.dev accounts API)
        // 2. profile_metadata.profilePicture (backward compatibility)
        // 3. Default fallback
        const avatarUrl = acc.profile_metadata?.avatar_url || 
                         acc.profile_metadata?.profilePicture || 
                         '/shego.jpg';
        
        return {
          username: acc.profile_metadata?.username || acc.profile_name || 'Unknown',
          profilePic: avatarUrl,
          accountId: acc.id // Use connected_accounts.id for posting
        };
      });
    }, [getConnectedAccountsForPlatform]);
    const [publishTime, setPublishTime] = useState('now|Bây giờ');
    const [showCalendar, setShowCalendar] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedTime, setSelectedTime] = useState<string>('09:00 AM');
    const [isShorts, setIsShorts] = useState(false);
    const [timeHour, setTimeHour] = useState('');
    const [timeMinute, setTimeMinute] = useState('');
    const [timeAmPm, setTimeAmPm] = useState<'AM' | 'PM'>('AM');

    const modalRef = useRef<HTMLDivElement>(null);
    const calendarRef = useRef<HTMLDivElement>(null);
    const accountDropdownRef = useRef<HTMLDivElement>(null);

    // State để prevent double click
    const [isPublishing, setIsPublishing] = useState(false);

    // useEffect chính để khởi tạo state
    useEffect(() => {
        if (isOpen) {
            const currentPost = openPosts.find(p => p.id === selectedPostId);

            if (currentPost) {
                setSelectedPlatform(currentPost.type);
                
                const accounts = getAccountsForPlatform(currentPost.type);
                if (accounts.length > 0) {
                    setSelectedAccount(accounts[0].username);
                    setSelectedAccountPic(accounts[0].profilePic);
                    setSelectedAccountId(accounts[0].accountId);
                } else {
                    // No accounts connected for this platform
                    setSelectedAccount('');
                    setSelectedAccountId(null);
                    setSelectedAccountPic('/shego.jpg');
                }
            }

            // Reset các state khác
            setPublishTime('now|Bây giờ');
            const now = new Date();
            setSelectedDate(now);
            setSelectedTime(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
            setTimeHour(String(now.getHours() % 12 || 12));
            setTimeMinute(String(now.getMinutes()).padStart(2, '0'));
            setTimeAmPm(now.getHours() >= 12 ? 'PM' : 'AM');
            setIsPublishing(false); // Reset publishing state when modal opens
        } else {
            setIsPublishing(false); // Reset publishing state when modal closes
        }
    }, [isOpen, selectedPostId, getAccountsForPlatform, openPosts]);


    // useEffect phụ (giữ nguyên)
    useEffect(() => {
        setShowCalendar(publishTime === 'pick a time');
    }, [publishTime]);

    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (showCalendar && calendarRef.current && !calendarRef.current.contains(e.target as Node)) setShowCalendar(false);
            if (showAccountDropdown && accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) setShowAccountDropdown(false);
        };
        if (showCalendar || showAccountDropdown) document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [showCalendar, showAccountDropdown]);

    if (!isOpen) {
        return null;
    }

    const selectedPlatformLabel = getPlatformName(selectedPlatform);
    
    const handleConfirm = async () => {
        // Prevent double click
        if (isPublishing) return;

        setIsPublishing(true);
        try {
            // --- LOGIC MỚI Ở ĐÂY ---
            if (publishTime === 'next free slot') {
                // "Khe trống tiếp theo" = 9 giờ sáng ngày mai
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(9, 0, 0, 0); // Đặt giờ thành 9:00:00

                const timeString = "09:00 AM"; // Chuỗi thời gian để hiển thị

                // Gọi action schedulePost với thông tin đã tính toán
                await schedulePostById(selectedPostId, tomorrow, timeString, { isShorts });

            } else if (publishTime === 'pick a time') {
                const combinedDateTime = new Date(selectedDate);
                const hour24 = timeAmPm === 'PM' && timeHour !== '12' 
                    ? parseInt(timeHour, 10) + 12 
                    : timeAmPm === 'AM' && timeHour === '12' 
                    ? 0 
                    : parseInt(timeHour, 10);
                combinedDateTime.setHours(hour24, parseInt(timeMinute, 10), 0, 0);

                const now = new Date();
                if (combinedDateTime.getTime() < now.getTime()) {
                    toast.error(tToast('pastTimeScheduleError'));
                    return;
                }
                await schedulePostById(selectedPostId, combinedDateTime, selectedTime, { isShorts });
            } else { // Mặc định là 'now'
                if (!selectedAccountId) {
                    toast.error(GENERIC_ERRORS.ACCOUNT_SELECTION_REQUIRED);
                    return;
                }
                await publishPostNow(selectedPostId, { 
                    connectedAccountId: selectedAccountId || undefined,
                    isShorts 
                });
            }

            closeModal();
        } catch (error) {
            // Error already handled by store functions
            console.error('Error in handleConfirm:', error);
        } finally {
            setIsPublishing(false);
        }
    };

    const getMonthGrid = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
        const cells: Array<{ day: number | null }>[] = [];
        let row: Array<{ day: number | null }> = [];
        for (let i = 0; i < firstDay; i++) row.push({ day: null });
        for (let d = 1; d <= daysInMonth; d++) {
            row.push({ day: d });
            if (row.length === 7) { cells.push(row); row = []; }
        }
        if (row.length > 0) {
            while (row.length < 7) row.push({ day: null });
            cells.push(row);
        }
        return cells;
    };

    const handleConfirmPickTime = () => {
        const hh = parseInt(timeHour || '0', 10);
        const mm = parseInt(timeMinute || '0', 10);
        const hour12 = Math.min(12, Math.max(1, hh));
        const minute = Math.min(59, Math.max(0, mm));
        
        const newTime = `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${timeAmPm}`;
        setSelectedTime(newTime);
        setShowCalendar(false);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closeModal}>
            <div ref={modalRef} className="bg-card border border-border rounded-xl p-4 lg:p-6 w-[calc(100%-2rem)] lg:w-[480px] max-w-full shadow-2xl relative mx-4" onClick={e => e.stopPropagation()}>
                <button
                    onClick={closeModal}
                    className="absolute top-5 right-5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg p-1.5 transition-all"
                    aria-label={t('closeModal')}
                >
                    <CloseIcon className="w-5 h-5" />
                </button>
                <div className="mb-6 pr-8">
                    <h3 className="text-xl font-semibold text-foreground">{t('title')}</h3>
                    <p className="text-sm text-muted-foreground mt-1.5">{t('subtitle')}</p>
                </div>
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center flex-shrink-0">
                        <Image unoptimized src={getPlatformIcon(selectedPlatform)} alt={selectedPlatformLabel} width={24} height={24} className={`w-6 h-6 ${needsInversion(selectedPlatform) ? 'dark:filter dark:brightness-0 dark:invert' : ''}`} />
                    </div>
                    <div className="flex-1 relative">
                        

                {(() => {
                            const platformAccounts = getAccountsForPlatform(selectedPlatform);
                            const hasAccounts = platformAccounts.length > 0;
                            
                            return (
                            <>
                            <div 
                            className={`flex items-center gap-3 bg-background rounded-lg p-3 h-12 cursor-pointer transition-all border ${showAccountDropdown ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-border'}`}
                            onClick={() => hasAccounts && setShowAccountDropdown(!showAccountDropdown)}
                        >
                            <div className="w-8 h-8 rounded-full overflow-hidden border border-border"><Image unoptimized src={selectedAccountPic} alt="Profile" width={32} height={32} className="w-full h-full object-cover" /></div>
                            <div className="flex-1">
                                <div className="text-foreground text-sm font-medium">{selectedAccount || t('selectAccount')}</div>
                                <div className="text-xs text-muted-foreground">{selectedPlatformLabel}</div>
                            </div>
                            <ChevronDownIcon className={`w-4 h-4 text-muted-foreground transition-transform ${showAccountDropdown ? 'rotate-180' : ''}`} />
                        </div>
                        {showAccountDropdown && hasAccounts && (
                            <div ref={accountDropdownRef} className="absolute top-full left-0 right-0 mt-2 bg-background rounded-lg border border-border shadow-xl z-10 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600">
                                {platformAccounts.map((account, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        className="w-full text-left flex items-center gap-3 p-3 hover:bg-secondary transition-colors first:rounded-t-lg last:rounded-b-lg"
                                        onClick={() => {
                                            setSelectedAccount(account.username);
                                            setSelectedAccountPic(account.profilePic);
                                            setSelectedAccountId(account.accountId);
                                            setShowAccountDropdown(false);
                                        }}
                                    >
                                        <div className="w-8 h-8 rounded-full overflow-hidden border border-border"><Image unoptimized src={account.profilePic} alt="Profile" width={32} height={32} className="w-full h-full object-cover" /></div>
                                        <div className="flex-1"><div className="text-foreground text-sm font-medium">{account.username}</div></div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* YouTube Shorts Toggle */}
                        {selectedPlatform === 'YouTube' && (
                          <div className="flex items-center gap-2 mt-2 ml-1">
                            <input
                              type="checkbox"
                              id="isShorts"
                              checked={isShorts}
                              onChange={(e) => setIsShorts(e.target.checked)}
                              className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary/50"
                            />
                            <label htmlFor="isShorts" className="text-sm text-muted-foreground cursor-pointer select-none">
                              {t('shortsLabel')}
                            </label>
                          </div>
                        )}

                        </>
                    );
                    
                })()}
                        
                    </div>
                </div>  
                <div className="mb-5">
                    <p className="text-foreground/90 mb-2 text-sm font-medium">{t('whenPublish')}</p>
                    <div className="relative rounded-lg bg-background border border-border hover:border-border transition-colors">
                        <select
                            value={publishTime}
                            onChange={(e) => setPublishTime(e.target.value)}
                            className="w-full bg-background text-foreground rounded-lg p-3 appearance-none pr-10 focus:outline-none cursor-pointer [&>option]:bg-background [&>option]:text-foreground"
                        >
                            <option value="now|Bây giờ">{t('publishNow')}</option>
                            <option value="next free slot">{t('nextFreeSlot')}</option>
                            <option value="pick a time">{t('pickTime')}</option>
                        </select>
                        <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                </div>
                {publishTime === 'pick a time' && (
                  <div className="mb-4">
                    <div className="text-foreground mb-2">{t('selectTime')}</div>

                    {/* Date picker */}
                    <div className="mb-3">
                      <div className="text-muted-foreground text-sm mb-1">{t('dateLabel')}</div>
                      <div
                        className={`w-full bg-background text-foreground rounded-lg p-3 cursor-pointer border border-border ${showCalendar ? 'ring-2 ring-primary' : ''}`}
                        onClick={() => setShowCalendar(true)}
                      >
                        {selectedDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                    </div>
                    
                    {/* Time picker - có thể edit trực tiếp */}
                    <div>
                      <div className="text-muted-foreground text-sm mb-1">{t('timeLabel')}</div>
                      <div className="flex items-center gap-2 bg-background rounded-lg p-3 border border-border">
                        <select 
                          value={timeHour} 
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val && parseInt(val) >= 1 && parseInt(val) <= 12) {
                              setTimeHour(val);
                              // Update selectedTime immediately
                              const hh = parseInt(val, 10);
                              const mm = parseInt(timeMinute || '0', 10);
                              const newTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${timeAmPm}`;
                              setSelectedTime(newTime);
                            }
                          }}
                          className="bg-background text-foreground border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                            <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
                          ))}
                        </select>
                        <span className="text-foreground">:</span>
                        <select 
                          value={timeMinute} 
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val && parseInt(val) >= 0 && parseInt(val) <= 59) {
                              setTimeMinute(val);
                              // Update selectedTime immediately
                              const hh = parseInt(timeHour || '1', 10);
                              const mm = parseInt(val, 10);
                              const newTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${timeAmPm}`;
                              setSelectedTime(newTime);
                            }
                          }}
                          className="bg-background text-foreground border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          {Array.from({ length: 60 }, (_, i) => i).map(m => (
                            <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                          ))}
                        </select>
                        <select 
                          value={timeAmPm} 
                          onChange={(e) => {
                            const val = e.target.value as 'AM' | 'PM';
                            setTimeAmPm(val);
                            // Update selectedTime immediately
                            const hh = parseInt(timeHour || '1', 10);
                            const mm = parseInt(timeMinute || '0', 10);
                            const newTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${val}`;
                            setSelectedTime(newTime);
                          }}
                          className="bg-background text-foreground border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                    {showCalendar && (
                        <div ref={calendarRef} className="fixed top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 lg:left-[calc(50%+260px)] lg:translate-x-0 bg-card rounded-xl p-3 lg:p-4 w-[calc(100%-2rem)] lg:w-[360px] max-w-[400px] border border-border shadow-2xl z-[60]">
                            <div className="flex items-center justify-between mb-4">
                                <button onClick={() => setSelectedDate(d => new Date(d.getFullYear(), d.getMonth() - 1, d.getDate()))} className="p-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors"><ChevronLeftIcon className="w-5 h-5" /></button>
                                <h3 className="text-foreground font-semibold">{selectedDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}</h3>
                                <button onClick={() => setSelectedDate(d => new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()))} className="p-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors"><ChevronRightIcon className="w-5 h-5" /></button>
                            </div>
                            <div className="grid grid-cols-7 text-center text-xs text-muted-foreground mb-2 font-medium">
                                {vietnameseWeekdays.map((w) => (<div key={w} className="py-1.5">{w}</div>))}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {getMonthGrid(selectedDate).flat().map((cell, idx) => (
                                    <button
                                        key={idx}
                                        disabled={!cell.day}
                                        onClick={() => { if (cell.day) setSelectedDate(d => new Date(d.getFullYear(), d.getMonth(), cell.day!)) }}
                                        className={`h-9 rounded-lg text-sm font-medium transition-all ${!cell.day ? 'cursor-default' : 'hover:bg-secondary'} ${cell.day === selectedDate.getDate() ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30' : 'text-foreground/80'}`}
                                    >
                                        {cell.day || ''}
                                    </button>
                                ))}
                            </div>
                            <div className="mt-4 flex items-center gap-3">
                                <div className="flex items-center bg-background text-foreground rounded-lg px-3 py-2.5 gap-2 border border-border flex-1">
                                    <input type="text" value={timeHour} onChange={(e) => setTimeHour(e.target.value.replace(/[^0-9]/g, ''))} className="w-9 bg-transparent text-center font-medium focus:outline-none" placeholder="HH" />
                                    <span className="text-muted-foreground">:</span>
                                    <input type="text" value={timeMinute} onChange={(e) => setTimeMinute(e.target.value.replace(/[^0-9]/g, ''))} className="w-9 bg-transparent text-center font-medium focus:outline-none" placeholder="MM" />
                                    <select value={timeAmPm} onChange={(e) => setTimeAmPm(e.target.value as 'AM' | 'PM')} className="bg-transparent border-0 outline-none font-medium cursor-pointer">
                                        <option value="AM">AM</option>
                                        <option value="PM">PM</option>
                                    </select>
                                </div>
                                <button className="bg-primary text-primary-foreground p-2.5 rounded-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20" onClick={handleConfirmPickTime}>
                                    <CheckCircleIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                  </div>
                )}
                <div className="flex gap-3 mt-6 pt-4 border-t border-border">
                    <Button variant="outline" className="flex-1 border-border text-foreground hover:bg-secondary hover:border-border transition-all" onClick={closeModal}>{t('cancel')}</Button>
                    <Button
                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                        onClick={handleConfirm}
                        disabled={isPublishing}
                    >
                        {isPublishing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                {publishTime === 'now|Bây giờ' 
                                    ? getText('publishing', 'Đang đăng...') 
                                    : getText('scheduling', 'Đang lên lịch...')}
                            </>
                        ) : (
                            publishTime === 'now|Bây giờ' 
                                ? getText('publishNowButton', 'Đăng ngay') 
                                : getText('confirmSchedule', 'Xác nhận lịch')
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
