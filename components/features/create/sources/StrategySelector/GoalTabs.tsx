"use client";

import { useRef, useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchContentGoals, ContentGoal } from '@/lib/constants/content-strategy';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';
import { MousePointer2, MoveHorizontal } from 'lucide-react'; // Thêm icon

interface GoalTabsProps {
  value: string;
  onChange: (goalId: string) => void;
}

export default function GoalTabs({ value, onChange }: GoalTabsProps) {
  const t = useTranslations('CreatePage.createSection.strategySelector');
  const [contentGoals, setContentGoals] = useState<ContentGoal[]>([]);
  
  // Ref cho container để xử lý lăn chuột
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  // State hiển thị gợi ý lăn chuột (chỉ hiện lần đầu nếu chưa cuộn)
  const [showScrollHint, setShowScrollHint] = useState(false);
  // Load data
  useEffect(() => {
    const loadGoals = async () => {
      try {
        const data = await fetchContentGoals();
        setContentGoals(data);
      } catch (error) {
        console.error("Failed to load goals", error);
      }
    };
    loadGoals();
  }, []);

  // Hàm kiểm tra vị trí cuộn để hiện/ẩn Fade
  const checkScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Sai số nhỏ (do zoom trình duyệt)
    const tolerance = 2; 

    // Hiện fade trái nếu đã cuộn ra khỏi lề trái
    setShowLeftFade(container.scrollLeft > tolerance);
    
    // Hiện fade phải nếu chưa cuộn đến cuối
    const isScrollable = container.scrollWidth > container.clientWidth;
    const isAtEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - tolerance;
    setShowRightFade(isScrollable && !isAtEnd);

    // Nếu người dùng đã cuộn, tắt gợi ý
    if (container.scrollLeft > 0) {
        setShowScrollHint(false);
    }
  };

  // Setup Listener và check lần đầu
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      checkScroll(); // Check initial state
      
      // Hiện gợi ý nếu nội dung dài hơn khung chứa
      if (container.scrollWidth > container.clientWidth) {
        setShowScrollHint(true);
      }

      container.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }
    return () => {
      if (container) container.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [contentGoals]);

  const handleWheel = (e: React.WheelEvent) => {
    const container = scrollContainerRef.current;
    if (container && e.deltaY !== 0) {
      if (container.scrollWidth <= container.clientWidth) return;
      e.preventDefault(); 
      container.scrollLeft += e.deltaY;
    }
  };

  return (
    <div className="relative w-full group/container">
    {/* 1. Fade Trái (Màu nền trùng với màu background form #1E1E23) */}
      <div 
        className={cn(
          "absolute left-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-r from-[#1E1E23] to-transparent pointer-events-none transition-opacity duration-300",
          showLeftFade ? "opacity-100" : "opacity-0"
        )}
      />

      {/* 2. Fade Phải */}
      <div 
        className={cn(
          "absolute right-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-l from-[#1E1E23] to-transparent pointer-events-none transition-opacity duration-300 flex items-center justify-end pr-1",
          showRightFade ? "opacity-100" : "opacity-0"
        )}
      >
      </div>

      {/* 3. Gợi ý lăn chuột (Icon nhỏ hiện ra ở giữa khi hover, tự mất khi đã scroll) */}
      {showRightFade && showScrollHint && (
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none opacity-0 group-hover/container:opacity-100 transition-opacity duration-500 delay-200">
            <div className="bg-black/60 backdrop-blur-sm text-white/80 px-2 py-1 rounded-full text-[10px] flex items-center gap-1.5 shadow-lg border border-white/10 animate-pulse">
                <MoveHorizontal className="w-3 h-3" />
                <span>Lăn chuột</span>
            </div>
         </div>
      )}
      <Tabs value={value} onValueChange={onChange} className="w-full">
        <div 
            ref={scrollContainerRef}
            onWheel={handleWheel} // Vẫn giữ tính năng lăn chuột
            className="w-full overflow-x-auto scroll-smooth snap-x snap-mandatory py-1"
            style={{ 
              scrollbarWidth: 'thin',  // Firefox: thin scrollbar
              scrollbarColor: 'rgba(227, 50, 101, 0.5) rgba(42, 42, 48, 0.5)', // Firefox: thumb và track color
            }}
        >
          {/* TabsList: inline-flex để content không bị co lại */}
          <TabsList className="bg-transparent p-0 gap-2 inline-flex h-auto items-center justify-start w-max px-1">
            {contentGoals.map((goal) => (
              <TabsTrigger
                key={goal.id}
                value={goal.id}
                className={`
                  snap-start flex-shrink-0 px-4 py-2.5 rounded-full text-sm font-medium border transition-all duration-200
                  
                  /* Active State */
                  data-[state=active]:border-[#E33265] 
                  data-[state=active]:bg-[#E33265]/10 
                  data-[state=active]:text-[#E33265]
                  data-[state=active]:shadow-[0_0_15px_rgba(227,50,101,0.2)]
                  
                  /* Inactive State */
                  data-[state=inactive]:border-white/10
                  data-[state=inactive]:bg-[#2A2A30]
                  data-[state=inactive]:text-gray-400
                  data-[state=inactive]:hover:bg-white/5
                  data-[state=inactive]:hover:text-white
                  data-[state=inactive]:hover:border-white/20
                `}
              >
                {t(`goals.${goal.slug}.label`, { defaultValue: goal.label })}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
    </div>
  );
}