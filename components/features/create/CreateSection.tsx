"use client"

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { MessageSquare, X, ChevronDown, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

import AIChatbox from './chat/AIChatbox';
import SourcePanel from './sources/SourcePanel';
import PostEditorWrapper from './editor/PostEditorWrapper';
import OnboardingTour from './layout/OnboardingTour';

import { useNavigationStore, useCreateSourcesStore, useCreatePostsStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';

/**
 * CreateSection — Hybrid Typefully + Gemini layout
 *
 * Desktop:
 * ┌──────────────────────────────────┬───────────────────┐
 * │ [Sources ▾ (3)]  [Platform tabs] │                   │
 * ├──────────────────────────────────┤ AI Chat (slide-in)│
 * │                                  │                   │
 * │  EDITOR (spacious, centered)     │ Messages...       │
 * │  Content + Media                 │                   │
 * │                                  │ [Input] [Send]    │
 * ├──────────────────────────────────┤                   │
 * │ [🖼️][🎬][📝]    [Draft][Publish]│                   │
 * └──────────────────────────────────┴───────────────────┘
 *
 * Mobile: Tab-based (Sources | Editor | Chat)
 */
export default function CreateSection() {
  const t = useTranslations('CreatePage.createSection.mobileTabs');
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [manualChatToggle, setManualChatToggle] = useState(false);
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
    if (wizardStep === 'idle' && savedSources.length > 0) {
      if (!localStorage.getItem('hasCompletedFirstFlow')) {
        localStorage.setItem('hasCompletedFirstFlow', 'true');
      }
    }
  }, [wizardStep, savedSources.length]);

  // Auto-open AI Chat when posts appear
  useEffect(() => {
    if (openPosts.length > 0 && !isAIChatOpen) {
      setIsAIChatOpen(true);
    } else if (openPosts.length === 0 && isAIChatOpen && !manualChatToggle) {
      setIsAIChatOpen(false);
    }
  }, [openPosts.length, isAIChatOpen, manualChatToggle]);

  // Wizard opens sources panel automatically
  useEffect(() => {
    if (wizardStep === 'addingSource') setIsSourcesOpen(true);
  }, [wizardStep]);

  const isAddingSource = wizardStep === 'addingSource';
  const isConfiguringPosts = wizardStep === 'configuringPosts';
  const isInWizard = wizardStep !== 'idle';

  const [activeMobilePanel, setActiveMobilePanel] = useState<'sources' | 'editor' | 'chat'>('editor');

  const toggleChat = () => {
    setIsAIChatOpen(!isAIChatOpen);
    setManualChatToggle(!isAIChatOpen);
  };

  return (
    <>
      {/* ═══ MOBILE: Tab navigation ═══ */}
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

      {/* ═══ DESKTOP: Hybrid layout ═══ */}
      <div className="flex h-full w-full relative">

        {/* ─── Main content area (editor + sources dropdown) ─── */}
        <div className="flex-1 min-w-0 flex flex-col h-full relative">

          {/* Top bar: Sources dropdown toggle */}
          <div className="hidden lg:flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-card/30">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs"
              onClick={() => setIsSourcesOpen(!isSourcesOpen)}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {t('sources')}
              {savedSources.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-utc-royal/10 text-utc-royal text-[10px] font-semibold">
                  {savedSources.length}
                </span>
              )}
              <ChevronDown className={`h-3 w-3 transition-transform ${isSourcesOpen ? 'rotate-180' : ''}`} />
            </Button>

            {/* AI Chat toggle (desktop) */}
            <div className="flex-1" />
            <Button
              variant={isAIChatOpen ? "default" : "outline"}
              size="sm"
              className={`gap-2 text-xs ${isAIChatOpen ? 'bg-gradient-to-r from-utc-royal to-utc-sky text-white' : ''}`}
              onClick={toggleChat}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {t('aiChat')}
            </Button>
          </div>

          {/* Sources dropdown panel (collapsible) */}
          <div className={`hidden lg:block transition-all duration-300 ease-in-out overflow-hidden border-b border-border/50 ${
            isSourcesOpen ? (isAddingSource ? 'max-h-[500px]' : 'max-h-[280px]') : 'max-h-0'
          }`}>
            <div className={`${isAddingSource ? 'h-[500px]' : 'h-[280px]'}`}>
              <SourcePanel mode={isAddingSource ? 'form' : 'list'} />
            </div>
          </div>

          {/* Editor area (spacious, takes remaining space) */}
          <div className={`flex-1 min-h-0 relative ${isConfiguringPosts ? 'z-30' : 'z-10'}
            ${activeMobilePanel === 'editor' ? 'block' : 'hidden lg:block'}`}>
            <div className={`relative ${isConfiguringPosts ? 'z-30' : 'z-0'} h-full w-full`}>
              <PostEditorWrapper mode={isConfiguringPosts ? 'configure' : 'normal'} />
            </div>
            {/* Wizard overlay */}
            {isInWizard && !isConfiguringPosts && (
              <div className="absolute inset-0 bg-black/70 z-40 pointer-events-auto animate-in fade-in duration-300 cursor-not-allowed" />
            )}
          </div>
        </div>

        {/* ─── AI Chat slide-in panel (desktop) ─── */}
        <div className={`hidden lg:flex flex-col transition-all duration-300 ease-in-out border-l border-border/50 bg-card/30 ${
          isAIChatOpen ? 'w-[380px]' : 'w-0'
        } overflow-hidden`}>
          {/* Chat header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-gradient-to-br from-utc-royal to-utc-sky flex items-center justify-center">
                <MessageSquare className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-medium">AI Assistant</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleChat}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {/* Chat content */}
          <div className="flex-1 min-h-0 w-[380px]">
            <AIChatbox />
          </div>

          {/* Wizard overlay */}
          {isInWizard && (
            <div className="absolute inset-0 bg-black/70 z-40 pointer-events-auto cursor-not-allowed" />
          )}
        </div>

        {/* ─── Mobile panels ─── */}
        <div className={`lg:hidden ${activeMobilePanel === 'sources' ? 'flex-1' : 'hidden'}`}>
          <SourcePanel mode={isAddingSource ? 'form' : 'list'} />
        </div>
        <div className={`lg:hidden ${activeMobilePanel === 'chat' ? 'flex-1' : 'hidden'}`}>
          <AIChatbox />
        </div>
      </div>

      <OnboardingTour />
    </>
  )
}
