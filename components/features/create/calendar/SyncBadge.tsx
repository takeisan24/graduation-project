"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

interface SyncBadgeProps {
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  isOnline: boolean;
}

export function SyncBadge({ isSyncing, lastSyncedAt, isOnline }: SyncBadgeProps) {
  const t = useTranslations('CreatePage.calendarSection');

  const [displayText, setDisplayText] = useState<string | null>(null);

  useEffect(() => {
    if (isSyncing) {
      setDisplayText(t('syncing'));
      return;
    }
    if (!isOnline) {
      setDisplayText(t('offline'));
      return;
    }
    if (!lastSyncedAt) {
      setDisplayText(null);
      return;
    }

    const updateTime = () => {
      const seconds = Math.floor((Date.now() - lastSyncedAt.getTime()) / 1000);
      if (seconds < 5) {
        setDisplayText(t('syncedJustNow'));
      } else if (seconds < 60) {
        setDisplayText(t('syncedJustNow'));
      } else {
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) {
          setDisplayText(t('syncedMinutesAgo', { n: minutes }));
        } else {
          setDisplayText(null); // Too old — hide
        }
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [isSyncing, lastSyncedAt, isOnline, t]);

  if (!displayText && !isSyncing) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
      role="status"
      aria-live="polite"
      aria-label={t('ariaSyncStatus', { status: displayText || 'syncing' })}
    >
      {isSyncing ? (
        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
      ) : (
        <span aria-hidden="true" className="w-2 h-2 rounded-full bg-green-500/60" />
      )}
      <span className="whitespace-nowrap">{displayText}</span>
    </div>
  );
}
