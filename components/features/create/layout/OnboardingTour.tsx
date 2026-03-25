"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface OnboardingStep {
  target: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

export default function OnboardingTour() {
  const t = useTranslations('Onboarding');
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const steps: OnboardingStep[] = [
    {
      target: '[data-tour="add-source"]',
      title: t('steps.addSource.title'),
      description: t('steps.addSource.description'),
      position: 'bottom',
    },
    {
      target: '[data-tour="create-post"]',
      title: t('steps.createPost.title'),
      description: t('steps.createPost.description'),
      position: 'top',
    },
  ];

  const calculatePosition = useCallback((targetElement: HTMLElement, position: string) => {
    const rect = targetElement.getBoundingClientRect();
    setTargetRect(rect);
    
    const tooltip = tooltipRef.current;
    if (!tooltip) return { top: 0, left: 0 };

    const tooltipRect = tooltip.getBoundingClientRect();
    const gap = 20; // Gap between tooltip and target

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
        top = rect.bottom + gap;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        break;
    }

    // Ensure tooltip stays within viewport
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

  const updatePosition = useCallback(() => {
    const currentStepData = steps[currentStep];
    const targetElement = document.querySelector(currentStepData.target) as HTMLElement;
    
    if (targetElement && tooltipRef.current) {
      const pos = calculatePosition(targetElement, currentStepData.position);
      setTooltipPosition(pos);
    }
  }, [currentStep, calculatePosition]);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenOnboarding');
    
    // Chỉ hiện tour nếu chưa xem (bỏ điều kiện hasCompletedFirstFlow)
    if (!hasSeenTour) {
      // Delay to ensure DOM is ready
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Update position when step changes or visibility changes
  useEffect(() => {
    if (isVisible) {
      // Small delay to ensure DOM is updated
      const timer = setTimeout(() => {
        updatePosition();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isVisible, currentStep, updatePosition]);

  // Handle scroll and resize with debouncing
  useEffect(() => {
    if (!isVisible) return;

    let timeoutId: NodeJS.Timeout;
    const handleUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        requestAnimationFrame(updatePosition);
      }, 100); // Debounce by 100ms
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

  return (
    <>
      {/* Overlay with spotlight effect - Block all clicks outside */}
      <div 
        className="fixed inset-0 z-40 transition-all duration-500 ease-out"
        style={{
          background: targetRect 
            ? `radial-gradient(circle at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px, transparent ${Math.max(targetRect.width, targetRect.height) / 2 + 10}px, rgba(0,0,0,0.85) ${Math.max(targetRect.width, targetRect.height) / 2 + 100}px)`
            : 'rgba(0,0,0,0.85)',
          pointerEvents: 'auto',
          cursor: 'not-allowed'
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // Không làm gì cả - chặn click
        }}
      />
      
      {/* Highlight border around target */}
      {targetRect && (
        <>
          {/* Animated glow effect */}
          <div
            className="fixed z-[45] rounded-lg pointer-events-none animate-pulse"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              boxShadow: '0 0 0 4px hsl(var(--primary) / 0.3), 0 0 30px hsl(var(--primary) / 0.4)',
              transition: 'all 500ms ease-out'
            }}
          />
          {/* Solid border */}
          <div
            className="fixed z-[45] border-2 border-primary rounded-lg pointer-events-none"
            style={{
              top: targetRect.top - 4,
              left: targetRect.left - 4,
              width: targetRect.width + 8,
              height: targetRect.height + 8,
              transition: 'all 500ms ease-out'
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
