"use client";

import { useTranslations } from 'next-intl';
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import type { FailedPost } from "@/store";
import { formatTime24h } from '@/lib/utils/date';

interface FailedPostItemProps {
    post: FailedPost;
    account: {username: string; profilePic: string};
    onRetry: (post: FailedPost) => void;
    onDelete: (post: FailedPost) => void;
    maxWidth?: number;
}

export function FailedPostItem({ post, account, onRetry, onDelete, maxWidth}: FailedPostItemProps) {
    const t = useTranslations('CreatePage.failed');
    return (
    <div className="group rounded-xl transition-colors hover:bg-secondary">
      <div className="flex items-center px-4 py-3 w-full">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <PlatformIcon platform={post.platform} size={27} variant="inline" />
          <div className="text-foreground/90 truncate flex-1 min-w-0">
            {post.content}
          </div>
        </div>
        
        <div className="flex flex-col items-start text-foreground/80 flex-shrink-0 ml-4" style={{ width: `${maxWidth}px` }}>
          <div className="flex items-center gap-2 mb-1 w-full">
            <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
              <img src={account.profilePic} alt="Profile" className="w-full h-full object-cover" />
            </div>
            <span className="text-xs font-semibold text-foreground/90">{account.username}</span>
          </div>
          <span className="text-xs whitespace-nowrap w-full">
            {post.date} <span className="opacity-70 ml-1">{formatTime24h(post.time)}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onRetry(post);
            }}
            className="w-24 h-9 bg-transparent border border-primary text-primary rounded-lg hover:bg-primary hover:text-primary-foreground transition-all text-sm font-semibold"
          >
            {t('retry')}
          </Button>
          <button
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-secondary transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(post);
            }}
            aria-label={t('delete')}
          >
            <img src="/Trash.svg" alt="Delete" className="opacity-80" style={{ width: 19, height: 19 }} />
          </button>
        </div>
      </div>
    </div>
    
  );
}