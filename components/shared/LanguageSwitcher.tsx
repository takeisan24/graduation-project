// components/shared/LanguageSwitcher.tsx
"use client";

import {useTransition} from 'react'

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export default function LanguageSwitcher() {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();

  const switchLocale = (nextLocale: string) => {
    if (locale === nextLocale || isPending) return;

    startTransition(() => {
        // const newPath = pathname.replace(`/${locale}`, `/${nextLocale}`);
        // router.push(newPath);
        router.push(pathname, { locale: nextLocale });
    });
  };

  return (
    <div className="relative flex items-center border border-border rounded-lg p-0.5 bg-secondary/50">
      <Button
        size="sm"
        variant='ghost'
        className={`relative z-10 h-7 px-2 text-xs transition-opacity ${locale === 'vi' ? 'text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'} ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={isPending}
        onClick={() => switchLocale('vi')}
      >
        VI
        {locale === 'vi' && (
          <motion.div
            layoutId='active-language-highlight'
            className='absolute inset-0 bg-primary rounded-md -z-10'
            transition = {{type: 'spring', stiffness: 300, damping: 30}}
          />
        )}
      </Button>
      <Button
        size="sm"
        variant='ghost'
        className={`relative z-10 h-7 px-2 text-xs transition-opacity ${locale === 'en' ? 'text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'} ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={isPending}
        onClick={() => switchLocale('en')}
      >
        EN
        {locale === 'en' && (
          <motion.div
            layoutId='active-language-highlight'
            className='absolute inset-0 bg-primary rounded-md -z-10'
            transition = {{type: 'spring', stiffness: 300, damping: 30}}
          />
        )}
      </Button>
    </div>
  );
}