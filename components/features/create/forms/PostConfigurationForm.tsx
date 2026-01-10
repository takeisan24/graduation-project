"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { SparklesIcon, ChevronDownIcon } from 'lucide-react';

const platformOptions = [
  { name: "Twitter", icon: "/x.png" },
  { name: "Instagram", icon: "/instagram.png" },
  { name: "LinkedIn", icon: "/link.svg" },
  { name: "Facebook", icon: "/fb.svg" },
  { name: "Pinterest", icon: "/pinterest.svg" },
  { name: "TikTok", icon: "/tiktok.png" },
  { name: "Threads", icon: "/threads.png" },
  { name: "Bluesky", icon: "/bluesky.png" },
  { name: "YouTube", icon: "/ytube.png" }
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
      <div className="px-4 py-3 md:px-6 md:py-4 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white">{t('title')}</h2>
        {source && (
          <p className="text-gray-300 mt-2 text-sm">
            {t('sourceInfo')} <span className="font-medium text-white">
              {source.type === 'text' ? t('sourceType.text') :
                source.type === 'article' ? t('sourceType.article') :
                  source.type === 'youtube' ? t('sourceType.youtube') :
                    source.type === 'text-source' ? t('sourceType.text-source') :
                      source.type}
            </span> - <span className="text-gray-400 italic">
              {source.value.length > 50 ? source.value.substring(0, 50) + '...' : source.value}
            </span>
          </p>
        )}
      </div>

      {/* Body - Scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center justify-between mb-3 gap-3">
          <p className="text-white">{t('subtitle')}</p>

          {/* Model selector - giống Chat AI, mặc định ChatGPT */}
          <div className="relative" ref={modelMenuRef}>
            <button
              type="button"
              onClick={() => setShowModelMenu((v) => !v)}
              className="inline-flex items-center gap-2 text-xs font-semibold leading-none text-white/90 hover:text-white bg-[#1E1E23] border border-white/10 rounded-md px-2.5 py-1.5"
            >
              <SparklesIcon className="w-3.5 h-3.5" />
              <span>{selectedModel}</span>
              <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${showModelMenu ? 'rotate-180' : ''}`} />
            </button>
            {showModelMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-[#2A2A30] border border-[#3A3A42] rounded-md shadow-[0_0_0_1px_rgba(255,255,255,0.08)] py-1.5 z-20">
                {modelOptions.map((model) => (
                  <button
                    key={model}
                    onClick={() => {
                      setSelectedModel(model);
                      setShowModelMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 ${selectedModel === model ? 'text-white' : 'text-white/80'
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
                className="flex items-center justify-between py-2 px-3 bg-[#1E1E23] rounded-lg border border-[#3A3A42]"
              >
                <label className="flex items-center gap-3 cursor-pointer flex-grow">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handlePlatformToggle(option.name)}
                    className="accent-[#E33265] w-4 h-4"
                  />
                  <img
                    src={option.icon}
                    alt={option.name}
                    className={`w-6 h-6 ${["Twitter", "Threads"].includes(option.name)
                        ? "filter brightness-0 invert"
                        : ""
                      }`}
                  />
                  <span className="text-white">{option.name}</span>
                </label>

                {isSelected && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCountChange(option.name, -1)}
                      className="text-white hover:bg-white/10 px-2 py-1"
                      disabled={platformEntry?.count === 1}
                    >
                      -
                    </Button>
                    <span className="text-white font-medium w-6 text-center">
                      {platformEntry?.count}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCountChange(option.name, 1)}
                      className="text-white hover:bg-white/10 px-2 py-1"
                    >
                      +
                    </Button>
                    <span className="text-gray-400 ml-1 text-sm">bài</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 md:px-6 md:py-4 border-t border-white/10 flex items-center justify-between bg-[#1E1E23]/30">
        <div className="flex flex-col">
          <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">Chi phí dự tính</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[#E33265] font-bold text-lg">
              {selectedPlatforms.reduce((acc, p) => acc + p.count, 0)}
            </span>
            <span className="text-gray-300 text-sm">Credits</span>
          </div>
        </div>
        <div className="flex gap-3">
          {onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
              className="border-white/10 text-white hover:bg-white/5"
            >
              {t('cancelButton')}
            </Button>
          )}
          <Button
            className="bg-[#E33265] hover:bg-[#c52b57] text-white shadow-lg shadow-[#E33265]/20 transition-all"
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
