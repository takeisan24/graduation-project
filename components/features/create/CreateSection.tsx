"use client"

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { PanelLeftClose, PanelLeftOpen, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

import AIChatbox from './chat/AIChatbox';
import SourcePanel from './sources/SourcePanel';
import PostEditorWrapper from './editor/PostEditorWrapper';
import OnboardingTour from './layout/OnboardingTour';

import { useNavigationStore, useCreateSourcesStore, useCreatePostsStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';

export default function CreateSection() {
  const t = useTranslations('CreatePage.createSection.mobileTabs');
  const [isSourcePanelOpen, setIsSourcePanelOpen] = useState(true);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [manualChatToggle, setManualChatToggle] = useState(false); // user tự bấm mở
  const hasResetOnMount = useRef(false);

  const { wizardStep, setWizardStep } = useNavigationStore(useShallow(state => ({
    wizardStep: state.wizardStep,
    setWizardStep: state.setWizardStep
  })));
  const savedSources = useCreateSourcesStore(state => state.savedSources);
  const openPosts = useCreatePostsStore(state => state.openPosts);
  const sourceToGenerate = useCreateSourcesStore(state => state.sourceToGenerate);
  const isSourceModalOpen = useCreateSourcesStore(state => state.isSourceModalOpen);

  // Reset wizardStep on mount if stuck
  useEffect(() => {
    if (hasResetOnMount.current) return;
    hasResetOnMount.current = true;
    if (wizardStep === 'configuringPosts' && !sourceToGenerate) setWizardStep('idle');
    if (wizardStep === 'addingSource' && !isSourceModalOpen) setWizardStep('idle');
  }, [wizardStep, sourceToGenerate, isSourceModalOpen, setWizardStep]);

  useEffect(() => {
    if (wizardStep === 'configuringPosts' && !sourceToGenerate) setWizardStep('idle');
  }, [sourceToGenerate, wizardStep, setWizardStep]);

  useEffect(() => {
    const hasCompleted = localStorage.getItem('hasCompletedFirstFlow');
    if (!hasCompleted && savedSources.length > 0) { /* noop */ }
  }, [savedSources.length]);

  useEffect(() => {
    if (wizardStep === 'idle' && savedSources.length > 0) {
      if (!localStorage.getItem('hasCompletedFirstFlow')) {
        localStorage.setItem('hasCompletedFirstFlow', 'true');
      }
    }
  }, [wizardStep, savedSources.length]);

  // Auto-open AI Chat when posts appear, auto-close only if user didn't manually open
  useEffect(() => {
    if (openPosts.length > 0 && !isAIChatOpen) {
      setIsAIChatOpen(true);
    } else if (openPosts.length === 0 && isAIChatOpen && !manualChatToggle) {
      setIsAIChatOpen(false);
    }
  }, [openPosts.length, isAIChatOpen, manualChatToggle]);

  const isAddingSource = wizardStep === 'addingSource';
  const isConfiguringPosts = wizardStep === 'configuringPosts';
  const isInWizard = wizardStep !== 'idle';

  const [activeMobilePanel, setActiveMobilePanel] = useState<'sources' | 'editor' | 'chat'>('editor');

  const sourcePanelWidth = isAddingSource ? 'w-[700px]' : 'w-[241px]';

  return (
    <>
      {/* Mobile Navigation Tabs */}
      <div className="lg:hidden flex border-b border-border bg-background">
        {(['sources', 'editor', 'chat'] as const).map((panel) => (
          <Button
            key={panel}
            variant="ghost"
            onClick={() => setActiveMobilePanel(panel)}
            className={`flex-1 py-3 rounded-none text-sm font-medium ${
              activeMobilePanel === panel
                ? 'text-utc-royal border-b-2 border-utc-royal'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {panel === 'sources' ? t('sources') : panel === 'editor' ? t('posts') : t('aiChat')}
          </Button>
        ))}
      </div>

      {/* Desktop layout: top area (Sources + Editor) + bottom area (AI Chat) */}
      <div className="flex flex-col h-full w-full">
        {/* Top: Sources + Editor */}
        <div className="flex flex-1 min-h-0 relative">
          {/* Left Panel - Sources */}
          <div
            className={`transition-all duration-300 ease-in-out ${
              isSourcePanelOpen ? sourcePanelWidth : 'w-0'
            } overflow-hidden relative ${isAddingSource ? 'z-30' : 'z-10'}
            ${activeMobilePanel === 'sources' ? 'flex-1 w-full lg:w-auto' : 'hidden lg:block lg:flex-none'}`}
          >
            <div className={`h-full ${isAddingSource ? 'w-full lg:w-[700px]' : 'w-full lg:w-[241px]'} transition-all duration-300 relative ${isAddingSource ? 'z-30' : 'z-0'}`}>
              <SourcePanel mode={isAddingSource ? 'form' : 'list'} />
            </div>
            {isInWizard && !isAddingSource && (
              <div className="absolute inset-0 bg-black/70 z-40 pointer-events-auto animate-in fade-in duration-300 cursor-not-allowed" />
            )}
            {isSourcePanelOpen && !isAddingSource && !isInWizard && (
              <Button
                variant="secondary"
                size="icon"
                className="hidden lg:flex absolute right-2 top-2 z-10 h-7 w-7"
                onClick={() => setIsSourcePanelOpen(false)}
              >
                <PanelLeftClose className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Toggle - Left Panel (when closed) */}
          {!isSourcePanelOpen && !isInWizard && (
            <Button
              size="icon"
              className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 z-15 rounded-l-none h-10 w-8 bg-gradient-to-r from-utc-royal to-utc-sky text-white"
              onClick={() => setIsSourcePanelOpen(true)}
            >
              <PanelLeftOpen className="w-4 h-4" />
            </Button>
          )}

          {/* Main Panel - Editor */}
          <div className={`flex-1 min-w-0 relative transition-all duration-300 ease-in-out ${isConfiguringPosts ? 'z-30' : 'z-10'}
            ${activeMobilePanel === 'editor' ? 'block' : 'hidden lg:block'}`}>
            <div className={`relative ${isConfiguringPosts ? 'z-30' : 'z-0'} h-full w-full`}>
              <PostEditorWrapper mode={isConfiguringPosts ? 'configure' : 'normal'} />
            </div>
            {isInWizard && !isConfiguringPosts && (
              <div className="absolute inset-0 bg-black/70 z-40 pointer-events-auto animate-in fade-in duration-300 cursor-not-allowed" />
            )}
          </div>
        </div>

        {/* Bottom Panel - AI Chat (desktop only, mobile uses tabs) */}
        <div className={`hidden lg:block relative ${isInWizard ? 'z-0' : 'z-10'}`}>
          {/* Toggle bar */}
          <Button
            variant="ghost"
            onClick={() => { setIsAIChatOpen(!isAIChatOpen); setManualChatToggle(!isAIChatOpen); }}
            className="w-full h-10 rounded-none flex items-center justify-center gap-2 border-t border-border/50 bg-muted/30 hover:bg-muted/50 text-sm text-muted-foreground"
          >
            <MessageSquare className="h-4 w-4" />
            <span>{t('aiChat')}</span>
            {isAIChatOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </Button>

          {/* Chat content */}
          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
            isAIChatOpen ? 'h-[250px]' : 'h-0'
          }`}>
            <div className="h-[250px] border-t border-border/50">
              <AIChatbox />
            </div>
          </div>

          {/* Wizard overlay for bottom panel */}
          {isInWizard && isAIChatOpen && (
            <div className="absolute inset-0 bg-black/70 z-40 pointer-events-auto cursor-not-allowed" />
          )}
        </div>

        {/* Mobile AI Chat (full panel when chat tab active) */}
        <div className={`lg:hidden ${activeMobilePanel === 'chat' ? 'flex-1' : 'hidden'}`}>
          <AIChatbox />
        </div>
      </div>

      <OnboardingTour />
    </>
  )
}
