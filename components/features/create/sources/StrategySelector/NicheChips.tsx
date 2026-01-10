"use client";

import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { fetchNiches, Niche } from '@/lib/constants/content-strategy';
import { useTranslations } from 'next-intl';

interface NicheChipsProps {
  value: string;
  onChange: (nicheId: string) => void;
}

export default function NicheChips({ value, onChange }: NicheChipsProps) {
  const t = useTranslations('CreatePage.createSection.strategySelector');
  const containerRef = useRef<HTMLDivElement>(null);
  const [niches, setNiches] = useState<Niche[]>([]);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  useEffect(() => {
    const loadNiches = async () => {
      try {
        const data = await fetchNiches();
        setNiches(data);
      } catch (error) {
        console.error("Failed to load niches inside component", error);
      }
    };

    loadNiches();
  }, []);

  // Sử dụng native event listener với passive: false để chặn hoàn toàn scroll dọc
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Luôn ngăn scroll dọc
      e.preventDefault();
      e.stopPropagation();

      const isScrollable = container.scrollWidth > container.clientWidth;

      // Chỉ scroll ngang nếu container có thể scroll
      if (isScrollable) {
        container.scrollLeft += e.deltaY;
      }
    };

    // Thêm listener với passive: false để có thể preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Kiểm tra scroll position để hiển thị fade indicators
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const checkScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setShowLeftFade(scrollLeft > 10);
      setShowRightFade(scrollLeft < scrollWidth - clientWidth - 10);
    };

    // Check initially và khi resize
    checkScroll();
    const resizeObserver = new ResizeObserver(checkScroll);
    resizeObserver.observe(container);

    container.addEventListener('scroll', checkScroll);
    
    return () => {
      container.removeEventListener('scroll', checkScroll);
      resizeObserver.disconnect();
    };
  }, [niches]);

  return (
    <div className="relative">
      {/* Left fade indicator */}
      {showLeftFade && (
        <div className="absolute left-0 top-0 bottom-3 w-8 bg-gradient-to-r from-[#1E1E23] to-transparent z-10 pointer-events-none" />
      )}
      
      {/* Right fade indicator */}
      {showRightFade && (
        <div className="absolute right-0 top-0 bottom-3 w-8 bg-gradient-to-l from-[#1E1E23] to-transparent z-10 pointer-events-none" />
      )}

      <div
        ref={containerRef}
        className="flex gap-2 overflow-x-auto pb-3 pr-2 relative scrollbar-thin scrollbar-thumb-primary/60 scrollbar-track-gray-800/50"
      >
        {niches.map((niche) => {
          const isActive = value === niche.id;
          return (
            <Button
              key={niche.id}
              variant="outline"
              size="sm"
              onClick={() => onChange(niche.id)}
              className={`
                flex-shrink-0 transition-all duration-200 whitespace-nowrap
                ${isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-white/5'
                }
              `}
            >
              {t(`niches.${niche.slug}.label`, { defaultValue: niche.label })}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
