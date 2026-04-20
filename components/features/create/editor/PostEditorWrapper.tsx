"use client";

import { useState } from 'react';
import PostEditor from './PostEditor';
import PostConfigurationForm from '../forms/PostConfigurationForm';
import ErrorState from '../shared/ErrorState';
import { useCreateSourcesStore, useNavigationStore, useCreatePostsStore, useCreateChatStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PostEditorWrapperProps {
  mode?: 'normal' | 'configure';
  onOpenSources?: () => void;
}

export default function PostEditorWrapper({ mode = 'normal', onOpenSources }: PostEditorWrapperProps) {
  const t = useTranslations('CreatePage.createSection.postEditorWrapper');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<Error | null>(null);
  const [lastConfig, setLastConfig] = useState<{ platforms: { platform: string; count: number }[]; model: string } | null>(null);

  const {
    sourceToGenerate,
    generatePostsFromSource,
    closeCreateFromSourceModal
  } = useCreateSourcesStore(useShallow(state => ({
    sourceToGenerate: state.sourceToGenerate,
    generatePostsFromSource: state.generatePostsFromSource,
    closeCreateFromSourceModal: state.closeCreateFromSourceModal,
  })));
  const setWizardStep = useNavigationStore(state => state.setWizardStep);

  const runGeneration = async (selectedPlatforms: { platform: string; count: number }[], selectedModel: string) => {
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const postsStore = useCreatePostsStore.getState();
      const success = await generatePostsFromSource(selectedPlatforms, selectedModel, {
        onPostCreate: postsStore.handlePostCreate,
        onPostContentChange: postsStore.handlePostContentChange,
        onAddChatMessage: (message) => {
          useCreateChatStore.setState((state) => ({
            chatMessages: [...state.chatMessages, message],
          }));
        },
        onSetTyping: (isTyping) => {
          useCreateChatStore.setState({ isTyping });
        },
      });

      if (success) {
        setWizardStep('idle');
        closeCreateFromSourceModal();
      }
    } catch (err) {
      setGenerationError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfigComplete = async (selectedPlatforms: { platform: string; count: number }[], selectedModel: string) => {
    setLastConfig({ platforms: selectedPlatforms, model: selectedModel });
    await runGeneration(selectedPlatforms, selectedModel);
  };

  const handleRetry = () => {
    if (lastConfig) {
      runGeneration(lastConfig.platforms, lastConfig.model);
    }
  };

  const handleConfigCancel = () => {
    setWizardStep('idle');
    closeCreateFromSourceModal();
  };

  if (mode === 'configure' && sourceToGenerate) {
    // Show error state when generation failed
    if (generationError && !isGenerating) {
      const isNetworkError = typeof navigator !== 'undefined' && !navigator.onLine
        ? true
        : generationError.message.toLowerCase().includes('network') || generationError.message.toLowerCase().includes('fetch');

      return (
        <div className="flex-1 min-w-0 p-[15px] h-full flex flex-col">
          <div className="flex-1 bg-card border border-border rounded-xl flex flex-col items-center justify-center gap-4 p-8">
            <ErrorState
              variant="full"
              isNetworkError={isNetworkError}
              error={generationError}
              onRetry={handleRetry}
            />
          </div>
        </div>
      );
    }

    // Show loading indicator while generating
    if (isGenerating) {
      return (
        <div className="flex-1 min-w-0 p-[15px] h-full flex flex-col">
          <div className="flex-1 bg-card border border-border rounded-xl flex items-center justify-center">
            <div className="text-center space-y-4 animate-in fade-in duration-500">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
              <div className="space-y-2">
                <p className="text-lg font-semibold text-foreground">{t('creatingContent')}</p>
                <p className="text-sm text-muted-foreground">{t('analyzingSource')}</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 min-w-0 p-[15px] h-full flex flex-col animate-in fade-in duration-300">
        <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden">
          <PostConfigurationForm
            source={sourceToGenerate}
            onComplete={handleConfigComplete}
            onCancel={handleConfigCancel}
          />
        </div>
      </div>
    );
  }

  return <PostEditor onOpenSources={onOpenSources} />;
}
