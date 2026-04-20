"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { CalendarClock, CheckCircle2, Link2, PencilLine, ShieldAlert, X as CloseIcon } from "lucide-react";
import type { FailedPost } from "@/store";
import { toast } from "sonner";
import { formatTimeTo12Hour } from "@/lib/utils/date";
import { CALENDAR_ERRORS } from "@/lib/messages/errors";
import { useLocale } from "next-intl";
import { getFailedRecoveryPresentation } from "./failedPostRecovery";

// Get accounts for platform (mock data) - unique to failed posts
  const getAccountsForPlatform = (platform: string) => {
    const mockAccounts = {
      'X': [{ username: '@whatevername', profilePic: '/shego.jpg' }],
      'Twitter': [{ username: '@whatevername', profilePic: '/shego.jpg' }],
      'Instagram': [{ username: '@instagram_user', profilePic: '/shego.jpg' }],
      'LinkedIn': [{ username: 'LinkedIn User', profilePic: '/shego.jpg' }],
      'Facebook': [{ username: 'Facebook User', profilePic: '/shego.jpg' }],
      'Threads': [{ username: '@threads_user', profilePic: '/shego.jpg' }],
      'YouTube': [{ username: 'YouTube Channel', profilePic: '/shego.jpg' }],
      'TikTok': [{ username: '@tiktok_user', profilePic: '/shego.jpg' }],
      'Pinterest': [{ username: 'Pinterest User', profilePic: '/shego.jpg' }]
    }
    return mockAccounts[platform as keyof typeof mockAccounts] || [{ username: 'Unknown Account', profilePic: '/shego.jpg' }]
  }

interface RetryDetailModalProps {
  post: FailedPost | null;
  onClose: () => void;
  onConfirmReschedule: (post: FailedPost, date: string, time: string) => void;
  onEdit: (post: FailedPost) => void;
  isPreview?: boolean;
}

export function RetryDetailModal({ post, onClose, onConfirmReschedule, onEdit, isPreview = false }: RetryDetailModalProps) {
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const locale = useLocale();

  useEffect(() => {
    if (post) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 5); // Default to 5 mins in the future
      setRescheduleDate(now.toISOString().split('T')[0]);
      setRescheduleTime(now.toTimeString().slice(0, 5));
    }
  }, [post]);

  if (!post) return null;

  const reason = getFailedRecoveryPresentation(post, locale);
  const canAutoReschedule = !isPreview && Boolean(post.lateJobId);
  
  // Use post.profileName if available, otherwise fallback to mock data
  const account = post.profileName && post.profilePic
    ? { username: post.profileName, profilePic: post.profilePic }
    : getAccountsForPlatform(post.platform)[0];
  
  const isContentIssue = reason.recommendedAction === 'edit';
  const recoveryAccent = reason.severity === 'high'
    ? "border-rose-500/25 bg-rose-500/10"
    : reason.severity === 'low'
      ? "border-amber-500/25 bg-amber-500/10"
      : "border-primary/25 bg-primary/10";
  const RecoveryIcon = reason.recommendedAction === 'reconnect'
    ? Link2
    : reason.recommendedAction === 'reschedule'
      ? CalendarClock
      : reason.recommendedAction === 'edit'
        ? PencilLine
        : reason.recommendedAction === 'retry'
          ? CheckCircle2
          : ShieldAlert;
  
  // Format time for display: Extract time from "2025-11-26T10:56" or "10:56" and convert to "10:56 AM"
  const formatTimeForDisplay = (timeStr: string): string => {
    if (!timeStr) return '';
    
    // If timeStr contains "T", extract time part (e.g., "2025-11-26T10:56" => "10:56")
    if (timeStr.includes('T')) {
      const timePart = timeStr.split('T')[1];
      // Remove seconds if present (e.g., "10:56:00" => "10:56")
      const [hours, minutes] = timePart.split(':');
      return formatTimeTo12Hour(`${hours}:${minutes}`);
    }
    
    // If already in "HH:MM" format, use directly
    return formatTimeTo12Hour(timeStr);
  };

  const handleConfirmClick = () => {
    // const targetDateTime = new Date(`${rescheduleDate}T${rescheduleTime}`);
    // if (targetDateTime.getTime() < new Date().getTime()) {
    //   toast.error("Không thể lên lịch vào một thời điểm trong quá khứ.");
    //   return;
    // }
    // onConfirmReschedule(post, rescheduleDate, rescheduleTime);
    if (!rescheduleDate || !rescheduleTime) {
        toast.error(CALENDAR_ERRORS.INVALID_DATETIME);
        return;
    }

    const targetDateTime = new Date(`${rescheduleDate}T${rescheduleTime}`);

    const now = new Date();
    now.setMinutes(now.getMinutes() + 1); // Allow at least 1 minute in the future

    if (targetDateTime.getTime() < now.getTime()) {
        toast.error(CALENDAR_ERRORS.PAST_SCHEDULE_ERROR);
        return;
    }

    onConfirmReschedule(post, rescheduleDate, rescheduleTime);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-[600px] max-w-[95vw] shadow-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b border-border"><div className="flex items-center justify-between"><h3 className="text-xl font-bold text-foreground">Chi tiết bài đăng thất bại</h3><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><CloseIcon className="w-6 h-6" /></button></div></div>
        <div className="px-6 py-5 overflow-y-auto">
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background shadow-sm">
              <PlatformIcon platform={post.platform} size={22} variant="inline" />
            </div>
            <div className="flex-1">
              <div className="text-foreground font-semibold">{post.platform}</div>
              <div className="text-muted-foreground text-sm">{account.username}</div>
            </div>
            <div className="text-muted-foreground text-sm text-right">
              <div>{post.date}</div>
              <div>{formatTimeForDisplay(post.time)}</div>
            </div>
          </div>
          <div className="mb-5"><div className="text-foreground/80 text-sm font-semibold mb-2">Nội dung bài đăng:</div><div className="bg-muted border border-border rounded-lg p-4 text-foreground whitespace-pre-wrap max-h-[200px] overflow-y-auto">{post.content}</div></div>
          <div className={`border rounded-xl p-5 mb-5 ${recoveryAccent}`}>
            <div className="flex items-center gap-2 mb-3">
              <RecoveryIcon className="h-5 w-5 text-foreground" />
              <div className="font-semibold text-foreground">{reason.title}</div>
            </div>
            <div className="text-foreground text-base leading-6">{reason.summary}</div>
            <div className="mt-3 rounded-lg border border-border/60 bg-background/70 px-4 py-3 text-sm leading-6 text-muted-foreground">
              {reason.guidance}
            </div>
            {post.errorMessage && (
              <div className="mt-3 text-sm text-foreground/80 leading-6">
                <span className="font-semibold text-foreground">Chi tiết từ nền tảng:</span> {post.errorMessage}
              </div>
            )}
            {isPreview && (
              <div className="mt-3 text-sm text-foreground/80 leading-6">
                Đây là dữ liệu demo để xem UX. Luồng lên lịch lại backend đã được tắt trong preview này.
              </div>
            )}
          </div>
          {isContentIssue ? (
            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => onEdit(post)}>Chỉnh sửa bài đăng</Button>
          ) : (
            <div className="bg-muted border border-border rounded-xl p-5">
              {canAutoReschedule ? (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div className="text-foreground font-semibold">Chọn thời gian đăng lại:</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-muted-foreground text-sm mb-2">Ngày:</label>
                      <Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-muted-foreground text-sm mb-2">Giờ:</label>
                      <Input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} />
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-foreground/80 text-sm leading-6">
                  Bài đăng này không còn Late.dev job ID nên không thể lên lịch lại tự động. Vui lòng mở trong trình soạn thảo để chỉnh sửa và đăng lại.
                </div>
              )}
            </div>
          )}
        </div>
        {!isContentIssue && (
          <div className="px-6 pb-6 flex items-center justify-between gap-4 border-t border-border pt-4 mt-auto">
            {/* Nút sửa bài: luôn hiển thị bên trái để mở bài trong trang create page */}
            <div className="flex items-center gap-3">
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => onEdit(post)}>Sửa bài</Button>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" className="border-border hover:bg-secondary" onClick={onClose}>Hủy</Button>
              {canAutoReschedule ? (
                <Button className="bg-primary hover:bg-primary/90" onClick={handleConfirmClick}>Lên lịch lại</Button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
