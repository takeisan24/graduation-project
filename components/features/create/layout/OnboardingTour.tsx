"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface OnboardingStep {
  /** Danh sách selector ưu tiên; chọn element đầu tiên đang HIỂN THỊ */
  targets: string[];
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Trả về element đầu tiên đang hiển thị (có kích thước thật, không display:none)
 * theo thứ tự ưu tiên selector. Tránh việc trỏ vào element ẩn (rect = 0) làm
 * spotlight/khung lệch khỏi mục tiêu.
 */
function findVisibleTarget(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));
    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      const visible = el.offsetParent !== null && rect.width > 0 && rect.height > 0;
      if (visible) return el;
    }
  }
  return null;
}

export default function OnboardingTour() {
  const t = useTranslations('Onboarding');
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<number | null>(null);

  const steps: OnboardingStep[] = useMemo(() => [
    {
      // Nút "Thêm nguồn" hiển thị — ưu tiên panel nguồn (góc trái) để khung trỏ đúng,
      // tránh trỏ vào nút empty-state ở GIỮA màn (khung bị lệch giữa-dưới, rời rạc).
      targets: ['[data-tour="add-source"]', '[data-testid="create-add-source-button"]', '[data-testid="empty-state-add-source-button"]'],
      title: t('steps.addSource.title'),
      description: t('steps.addSource.description'),
      position: 'bottom',
    },
    {
      targets: ['[data-tour="create-post"]'],
      title: t('steps.createPost.title'),
      description: t('steps.createPost.description'),
      position: 'top',
    },
  ], [t]);

  const calculatePosition = useCallback((rect: DOMRect, position: string) => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return { top: 0, left: 0 };

    const tooltipRect = tooltip.getBoundingClientRect();
    const gap = 20; // Khoảng cách giữa tooltip và mục tiêu

    let top = 0;
    let left = 0;

    switch (position) {
      case 'right':
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.right + gap;
        break;
      case 'left':
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.left - tooltipRect.width - gap;
        break;
      case 'top':
        top = rect.top - tooltipRect.height - gap;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
      default:
        top = rect.bottom + gap;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        break;
    }

    // Giữ tooltip trong viewport
    const padding = 10;
    if (left < padding) left = padding;
    if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding;
    }
    if (top < padding) top = padding;
    if (top + tooltipRect.height > window.innerHeight - padding) {
      top = window.innerHeight - tooltipRect.height - padding;
    }

    return { top, left };
  }, []);

  /** Cập nhật vị trí; trả về true nếu tìm thấy target hiển thị */
  const updatePosition = useCallback((): boolean => {
    const currentStepData = steps[currentStep];
    const targetElement = findVisibleTarget(currentStepData.targets);

    if (targetElement && tooltipRef.current) {
      const rect = targetElement.getBoundingClientRect();
      setTargetRect(rect);
      setTooltipPosition(calculatePosition(rect, currentStepData.position));
      return true;
    }
    return false;
  }, [currentStep, calculatePosition, steps]);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenTour) {
      // Chờ DOM render xong rồi mới hiện tour
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Cập nhật vị trí khi đổi bước/hiện tour; retry tới khi target hiển thị
  useEffect(() => {
    if (!isVisible) return;

    let attempts = 0;
    const maxAttempts = 20; // ~4s

    const tryUpdate = () => {
      const found = updatePosition();
      if (found) return;
      attempts += 1;
      if (attempts >= maxAttempts) {
        // Không tìm thấy mục tiêu hiển thị: ẩn tour thay vì vẽ khung lệch
        setIsVisible(false);
        return;
      }
      retryRef.current = window.setTimeout(tryUpdate, 200);
    };

    retryRef.current = window.setTimeout(tryUpdate, 50);
    return () => {
      if (retryRef.current) window.clearTimeout(retryRef.current);
    };
  }, [isVisible, currentStep, updatePosition]);

  // Cập nhật khi scroll/resize (debounce)
  useEffect(() => {
    if (!isVisible) return;

    let timeoutId: NodeJS.Timeout;
    const handleUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        requestAnimationFrame(() => updatePosition());
      }, 100);
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isVisible, updatePosition]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setIsVisible(false);
  };

  const handleSkip = () => {
    handleComplete();
  };

  if (!isVisible) return null;

  const currentStepData = steps[currentStep];
  // Padding của khung spotlight quanh mục tiêu
  const pad = 6;

  return (
    <>
      {/* Lớp chặn click toàn màn hình (trong suốt) */}
      <div
        className="fixed inset-0 z-40"
        style={{ pointerEvents: 'auto', cursor: 'not-allowed' }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      />

      {/* Spotlight CHỮ NHẬT khớp đúng khung mục tiêu (dùng box-shadow tạo vùng tối xung quanh) */}
      {targetRect && (
        <div
          className="fixed z-[41] rounded-lg pointer-events-none"
          style={{
            top: targetRect.top - pad,
            left: targetRect.left - pad,
            width: targetRect.width + pad * 2,
            height: targetRect.height + pad * 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.82)',
            transition: 'all 300ms ease-out',
          }}
        />
      )}

      {/* Viền + glow quanh mục tiêu (khớp đúng rect) */}
      {targetRect && (
        <>
          <div
            className="fixed z-[45] rounded-lg pointer-events-none animate-pulse"
            style={{
              top: targetRect.top - pad,
              left: targetRect.left - pad,
              width: targetRect.width + pad * 2,
              height: targetRect.height + pad * 2,
              boxShadow: '0 0 0 4px hsl(var(--primary) / 0.3), 0 0 30px hsl(var(--primary) / 0.4)',
              transition: 'all 300ms ease-out',
            }}
          />
          <div
            className="fixed z-[45] border-2 border-primary rounded-lg pointer-events-none"
            style={{
              top: targetRect.top - pad,
              left: targetRect.left - pad,
              width: targetRect.width + pad * 2,
              height: targetRect.height + pad * 2,
              transition: 'all 300ms ease-out',
            }}
          />
        </>
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-50 bg-gradient-to-br from-card to-background rounded-xl shadow-2xl border border-border p-6 max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300"
        style={{
          top: `${tooltipPosition.top}px`,
          left: `${tooltipPosition.left}px`,
        }}
      >
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-foreground pr-2">
            {currentStepData.title}
          </h3>
          <button
            onClick={handleSkip}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            aria-label={t('buttons.skip')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          {currentStepData.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground font-medium">
            {currentStep + 1} {t('of')} {steps.length}
          </div>

          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                className="text-sm bg-secondary border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {t('buttons.previous')}
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleNext}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
            >
              {currentStep === steps.length - 1 ? t('buttons.finish') : t('buttons.next')}
              {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-5 pt-4 border-t border-border">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentStep
                  ? 'bg-primary w-6'
                  : index < currentStep
                    ? 'bg-primary/40 w-2'
                    : 'bg-muted w-2'
              }`}
            />
          ))}
        </div>
      </div>
    </>
  );
}
