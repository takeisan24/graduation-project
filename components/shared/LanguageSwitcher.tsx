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
    <div className="relative flex items-center border border-white/10 rounded-lg p-0.5 bg-black/20">
      <Button 
        size="sm"
        variant='ghost'
        className={`relative z-10 h-7 px-2 text-xs hover:bg-white/10 transition-opacity ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
        // Vô hiệu hóa nút khi đang chuyển đổi
        disabled={isPending} 
        onClick={() => switchLocale('vi')}
      >
        VI
        {locale === 'vi' && (
          <motion.div 
            layoutId='active-language-highlight'
            className='absolute inset-0 bg-[#E33265] rounded-md -z-10'
            transition = {{type: 'spring', stiffness: 300, damping: 30}}
          />
        )}
      </Button>
      <Button 
        size="sm"
        variant='ghost'
        className={`relative z-10 h-7 px-2 text-xs hover:bg-white/10 transition-opacity ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
        // Vô hiệu hóa nút khi đang chuyển đổi
        disabled={isPending}
        onClick={() => switchLocale('en')}
      >
        EN
        {locale === 'en' && (
          <motion.div 
            layoutId='active-language-highlight'
            className='absolute inset-0 bg-[#E33265] rounded-md -z-10'
            transition = {{type: 'spring', stiffness: 300, damping: 30}}
          />
        )}
      </Button>
    </div>
  );
}