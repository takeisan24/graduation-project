"use client";

import React from 'react';
import { AlertCircle, RefreshCw, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error | string;
  onRetry?: () => void;
  onReport?: () => void;
  variant?: 'inline' | 'card' | 'full';
  className?: string;
  isNetworkError?: boolean;
}

export default function ErrorState({
  title,
  description,
  error,
  onRetry,
  onReport,
  variant = 'card',
  className = '',
  isNetworkError = false,
}: ErrorStateProps) {
  const t = useTranslations('CreatePage.createSection.errorState');

  const displayTitle = title || (isNetworkError ? t('networkErrorTitle') : t('defaultTitle'));
  const displayDescription = description || (isNetworkError ? t('networkErrorMessage') : t('defaultMessage'));
  const errorDetail = error ? (typeof error === 'string' ? error : error.message) : null;

  // ──── Inline variant ────
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg ${className}`}>
        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
        <p className="text-sm text-destructive flex-1">{displayDescription}</p>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} className="h-7 text-xs">
            <RefreshCw className="h-3 w-3 mr-1" />
            {t('retryButton')}
          </Button>
        )}
      </div>
    );
  }

  // ──── Full variant ────
  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center justify-center h-full min-h-[300px] gap-4 p-8 ${className}`}>
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-foreground">{displayTitle}</h3>
          <p className="text-sm text-muted-foreground max-w-sm">{displayDescription}</p>
          {errorDetail && (
            <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-2 rounded-lg">
              {errorDetail}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onRetry && (
            <Button onClick={onRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {t('retryButton')}
            </Button>
          )}
          {onReport && (
            <Button variant="outline" onClick={onReport} className="gap-2">
              <Mail className="h-4 w-4" />
              {t('reportButton')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ──── Default: Card variant ────
  return (
    <div className={`flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-xl ${className}`}>
      <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{displayTitle}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{displayDescription}</p>
        {errorDetail && (
          <p className="text-xs text-muted-foreground/60 font-mono mt-1 truncate">
            {errorDetail}
          </p>
        )}
        <div className="flex gap-2 mt-2">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="h-7 text-xs gap-1">
              <RefreshCw className="h-3 w-3" />
              {t('retryButton')}
            </Button>
          )}
          {onReport && (
            <Button variant="ghost" size="sm" onClick={onReport} className="h-7 text-xs gap-1">
              <Mail className="h-3 w-3" />
              {t('reportButton')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
