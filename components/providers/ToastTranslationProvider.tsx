"use client";

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { setToastTranslation } from '@/lib/utils/i18nHelper';

export function ToastTranslationProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Common.toast');
  
  useEffect(() => {
    // Set the translation function that will be used by the store
    setToastTranslation((key: string, params?: Record<string, any>) => {
      return t(key, params);
    });
  }, [t]);

  return <>{children}</>;
}
