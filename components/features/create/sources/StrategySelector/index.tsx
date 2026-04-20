"use client";

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Framework, fetchFrameworks } from '@/lib/constants/content-strategy';
import { Card } from '@/components/ui/card';
import GoalTabs from './GoalTabs';
import NicheChips from './NicheChips';
import TemplateGallery from './TemplateGallery';
import GallerySkeleton from './GallerySkeleton';
import { useTranslations } from 'next-intl';

interface StrategySelectorProps {
  onSelectFramework?: (framework: Framework) => void;
  selectedFramework?: Framework | null;
  selectedNiche: string;
  onSelectNiche: (nicheId: string) => void;
  selectedGoal: string;
  onSelectGoal: (goalId: string) => void;
}

export default function StrategySelector({ onSelectFramework, selectedFramework,
  selectedNiche,
  onSelectNiche,
  selectedGoal,
  onSelectGoal
}: StrategySelectorProps) {
  const t = useTranslations('CreatePage.createSection.strategySelector');
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewPosition, setPreviewPosition] = useState<{ top: number; left: number } | null>(null);

  const [isFiltering, setIsFiltering] = useState(false);
  const [filteredFrameworks, setFilteredFrameworks] = useState<Framework[]>([]);
  const [hoveredFramework, setHoveredFramework] = useState<Framework | null>(null);

  // Debounced filtering với fake API latency
  useEffect(() => {
    let isMounted = true; // Cờ kiểm tra component còn mount không

    const loadFrameworks = async () => {
      setIsFiltering(true);
      try {
        // Gọi hàm async fetchFrameworks
        const data = await fetchFrameworks(selectedGoal, selectedNiche);

        // Chỉ cập nhật state nếu component chưa bị unmount
        if (isMounted) {
          setFilteredFrameworks(data);
        }
      } catch (error) {
        console.error("Error loading frameworks:", error);
      } finally {
        if (isMounted) {
          setIsFiltering(false);
        }
      }
    };

    loadFrameworks();

    // Cleanup function: Đánh dấu component đã unmount để không set state nữa
    return () => {
      isMounted = false;
    };
  }, [selectedGoal, selectedNiche]);

  // Tính toán vị trí preview box khi hover
  useEffect(() => {
    if (hoveredFramework && containerRef.current) {
      const updatePosition = () => {
        // Tìm modal container - tìm parent element có class chứa "h-full flex flex-col"
        let modalContainer: HTMLElement | null = null;
        let element = containerRef.current?.parentElement;

        while (element && element !== document.body) {
          const classList = element.classList;
          // Tìm element có class "h-full" và "flex" và "flex-col" (modal container)
          if (classList.contains('h-full') && classList.contains('flex') && classList.contains('flex-col')) {
            modalContainer = element;
            break;
          }
          element = element.parentElement;
        }

        // Fallback: dùng containerRef nếu không tìm thấy modal container
        const containerRect = modalContainer?.getBoundingClientRect() || containerRef.current?.getBoundingClientRect();
        if (containerRect) {
          // Preview box hiển thị bên phải modal, cách 16px, căn giữa vertical
          const gap = 16;
          const left = containerRect.right + gap;
          const top = containerRect.top + (containerRect.height / 2);

          setPreviewPosition({ top, left });
        }
      };

      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);

      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    } else {
      setPreviewPosition(null);
    }
  }, [hoveredFramework]);

  const handleFrameworkSelect = (framework: Framework) => {
    if (onSelectFramework) {
      onSelectFramework(framework);
    }
  };

  // Lấy title và description đầy đủ từ translation hoặc fallback
  const getFrameworkTitle = (framework: Framework) => {
    return t(`frameworks.${framework.slug}.title`, { defaultValue: framework.title });
  };

  const getFrameworkDescription = (framework: Framework) => {
    return t(`frameworks.${framework.slug}.description`, { defaultValue: framework.description });
  };

  return (
    <>
      <div ref={containerRef} className="space-y-4">
        {/* Goal Selection */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            {t('goalTitle')}
          </h3>
          <GoalTabs value={selectedGoal} onChange={onSelectGoal} />
        </div>

        {/* Niche Selection */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            {t('nicheTitle')}
          </h3>
          <NicheChips value={selectedNiche} onChange={onSelectNiche} />
        </div>

        {/* Template Gallery */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            {t('templateTitle')}
          </h3>
          {isFiltering ? (
            <GallerySkeleton />
          ) : (
            <TemplateGallery
              frameworks={filteredFrameworks}
              selectedId={selectedFramework?.id || null}
              onSelect={handleFrameworkSelect}
              onHover={setHoveredFramework}
            />
          )}
        </div>
      </div>

      {/* Preview Box - Render bên ngoài modal bằng Portal */}
      {hoveredFramework && previewPosition && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed z-[100] w-80"
          style={{
            left: `${previewPosition.left}px`,
            top: `${previewPosition.top}px`,
            transform: 'translateY(-50%)',
          }}
        >
          <Card className="p-5 bg-card border-border shadow-xl">
            <div className="space-y-3">
              {/* Icon và Title - căn giữa theo chiều dọc */}
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = hoveredFramework.icon;
                  return (
                    <div className={`
                      flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
                      ${selectedFramework?.id === hoveredFramework.id
                        ? 'bg-primary/20 text-primary'
                        : 'bg-primary/10 text-primary'
                      }
                    `}>
                      <Icon className="w-5 h-5" />
                    </div>
                  );
                })()}
                <h3 className="font-bold text-base text-foreground leading-tight">
                  {getFrameworkTitle(hoveredFramework)}
                </h3>
              </div>

              {/* Description đầy đủ */}
              <div className="pt-2 border-t border-border">
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-normal">
                  {getFrameworkDescription(hoveredFramework)}
                </p>
              </div>
            </div>
          </Card>
        </div>,
        document.body
      )}
    </>
  );
}
