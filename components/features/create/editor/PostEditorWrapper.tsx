"use client";

import { useState } from 'react';
import PostEditor from './PostEditor';
import PostConfigurationForm from '../forms/PostConfigurationForm';
import { useCreateSourcesStore, useNavigationStore, useCreatePostsStore, useCreateChatStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PostEditorWrapperProps {
  mode?: 'normal' | 'configure';
}

export default function PostEditorWrapper({ mode = 'normal' }: PostEditorWrapperProps) {
  const t = useTranslations('CreatePage.createSection.postEditorWrapper');
  const [isGenerating, setIsGenerating] = useState(false);

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

  const handleConfigComplete = async (selectedPlatforms: { platform: string; count: number }[], selectedModel: string) => {
    setIsGenerating(true);
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

      // Chỉ đóng modal/wizard khi thành công (tránh bị thoát ra khi lỗi/hết credit)
      if (success) {
        setWizardStep('idle');
        closeCreateFromSourceModal();
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfigCancel = () => {
    // Reset wizard step và đóng modal
    // User có thể click lại vào source để mở lại
    setWizardStep('idle');
    closeCreateFromSourceModal();
  };

  if (mode === 'configure' && sourceToGenerate) {
    // Show loading indicator while generating
    if (isGenerating) {
      return (
        <div className="flex-1 min-w-0 p-[15px] h-full flex flex-col">
          <div className="flex-1 bg-[#2A2A30] border border-[#3A3A42] rounded-[5px] flex items-center justify-center">
            <div className="text-center space-y-4 animate-in fade-in duration-500">
              <Loader2 className="w-12 h-12 text-[#E33265] animate-spin mx-auto" />
              <div className="space-y-2">
                <p className="text-lg font-semibold text-white">{t('creatingContent')}</p>
                <p className="text-sm text-gray-400">{t('analyzingSource')}</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 min-w-0 p-[15px] h-full flex flex-col animate-in fade-in duration-300">
        <div className="flex-1 bg-[#2A2A30] border border-[#3A3A42] rounded-[5px] overflow-hidden">
          <PostConfigurationForm
            source={sourceToGenerate}
            onComplete={handleConfigComplete}
            onCancel={handleConfigCancel}
          />
        </div>
      </div>
    );
  }

  return <PostEditor />;
}
