"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { SparklesIcon, ChevronDownIcon } from 'lucide-react';

const platformOptions = [
  { name: "TikTok", icon: "/icons/platforms/tiktok.png" },
  { name: "Instagram", icon: "/icons/platforms/instagram.png" },
  { name: "YouTube", icon: "/icons/platforms/ytube.png" },
  { name: "Facebook", icon: "/icons/platforms/fb.svg" },
  { name: "Twitter", icon: "/icons/platforms/x.png" },
  { name: "Threads", icon: "/icons/platforms/threads.png" },
  { name: "LinkedIn", icon: "/icons/platforms/link.svg" },
  { name: "Pinterest", icon: "/icons/platforms/pinterest.svg" }
];

interface PostConfigurationFormProps {
  source?: { type: string; value: string; label: string };
  onComplete?: (selectedPlatforms: { platform: string; count: number }[], selectedModel: string) => void;
  onCancel?: () => void;
}

export default function PostConfigurationForm({
  source,
  onComplete,
  onCancel
}: PostConfigurationFormProps) {
  const t = useTranslations('CreatePage.createSection.createFromSourceModal');

  const [selectedPlatforms, setSelectedPlatforms] = useState<{ platform: string; count: number }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Model selector state (giống phần Chat AI)
  const modelOptions = [
    "ChatGPT",
    "Gemini Pro",
    "Claude Sonnet 4",
    "gpt-4.1",
    "o4-mini",
    "o3",
    "gpt-4o"
  ];
  const [selectedModel, setSelectedModel] = useState<string>("ChatGPT");
  const [showModelMenu, setShowModelMenu] = useState<boolean>(false);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    if (!showModelMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setShowModelMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showModelMenu]);

  const handlePlatformToggle = (platformName: string) => {
    setSelectedPlatforms((prev) => {
      const existing = prev.find((p) => p.platform === platformName);
      if (existing) {
        return prev.filter((p) => p.platform !== platformName);
      } else {
        return [...prev, { platform: platformName, count: 1 }];
      }
    });
  };

  const handleCountChange = (platformName: string, delta: number) => {
    setSelectedPlatforms((prev) =>
      prev.map((p) =>
        p.platform === platformName
          ? { ...p, count: Math.max(1, p.count + delta) }
          : p
      )
    );
  };

  const handleGenerate = async () => {
    if (selectedPlatforms.length === 0) return;
    setIsGenerating(true);

    if (onComplete) {
      // Truyền thêm selectedModel để BE quyết định dùng ChatGPT hay Gemini giống phần chat AI
      await onComplete(selectedPlatforms, selectedModel);
    }

    setIsGenerating(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 md:px-6 md:py-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">{t('title')}</h2>
        {source && (
          <p className="text-muted-foreground mt-2 text-sm">
            {t('sourceInfo')} <span className="font-medium text-foreground">
              {source.type === 'text' ? t('sourceType.text') :
                source.type === 'article' ? t('sourceType.article') :
                  source.type === 'youtube' ? t('sourceType.youtube') :
                    source.type === 'text-source' ? t('sourceType.text-source') :
                      source.type}
            </span> - <span className="text-muted-foreground italic">
              {source.value.length > 50 ? source.value.substring(0, 50) + '...' : source.value}
            </span>
          </p>
        )}
      </div>

      {/* Body - Scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center justify-between mb-3 gap-3">
          <p className="text-foreground">{t('subtitle')}</p>

          {/* Model selector - giống Chat AI, mặc định ChatGPT */}
          <div className="relative" ref={modelMenuRef}>
            <button
              type="button"
              onClick={() => setShowModelMenu((v) => !v)}
              className="inline-flex items-center gap-2 text-xs font-semibold leading-none text-foreground/90 hover:text-foreground bg-background border border-border rounded-md px-2.5 py-1.5"
            >
              <SparklesIcon className="w-3.5 h-3.5" />
              <span>{selectedModel}</span>
              <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${showModelMenu ? 'rotate-180' : ''}`} />
            </button>
            {showModelMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-md shadow-[0_0_0_1px_rgba(255,255,255,0.08)] py-1.5 z-20">
                {modelOptions.map((model) => (
                  <button
                    key={model}
                    onClick={() => {
                      setSelectedModel(model);
                      setShowModelMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-secondary ${selectedModel === model ? 'text-foreground' : 'text-foreground/80'
                      }`}
                  >
                    {model}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="space-y-3">
          {platformOptions.map((option) => {
            const platformEntry = selectedPlatforms.find(p => p.platform === option.name);
            const isSelected = !!platformEntry;

            return (
              <div
                key={option.name}
                className="flex items-center justify-between py-2 px-3 bg-background rounded-lg border border-border"
              >
                <label className="flex items-center gap-3 cursor-pointer flex-grow">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handlePlatformToggle(option.name)}
                    className="accent-primary w-4 h-4"
                  />
                  <img
                    src={option.icon}
                    alt={option.name}
                    className={`w-6 h-6 ${["Twitter", "Threads"].includes(option.name)
                        ? "dark:filter dark:brightness-0 dark:invert"
                        : ""
                      }`}
                  />
                  <span className="text-foreground">{option.name}</span>
                </label>

                {isSelected && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCountChange(option.name, -1)}
                      className="text-foreground hover:bg-secondary px-2 py-1"
                      disabled={platformEntry?.count === 1}
                    >
                      -
                    </Button>
                    <span className="text-foreground font-medium w-6 text-center">
                      {platformEntry?.count}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCountChange(option.name, 1)}
                      className="text-foreground hover:bg-secondary px-2 py-1"
                    >
                      +
                    </Button>
                    <span className="text-muted-foreground ml-1 text-sm">bài</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 md:px-6 md:py-4 border-t border-border flex items-center justify-between bg-background/30">
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Chi phí dự tính</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-primary font-bold text-lg">
              {selectedPlatforms.reduce((acc, p) => acc + p.count, 0)}
            </span>
            <span className="text-muted-foreground text-sm">Credits</span>
          </div>
        </div>
        <div className="flex gap-3">
          {onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
              className="border-border text-foreground hover:bg-secondary"
            >
              {t('cancelButton')}
            </Button>
          )}
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all"
            onClick={handleGenerate}
            disabled={isGenerating || selectedPlatforms.length === 0}
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                {t('isCreating')}
              </>
            ) : (
              <>
                <SparklesIcon className="w-4 h-4 mr-2" />
                {t('createButton')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
