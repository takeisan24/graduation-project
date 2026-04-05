"use client"

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

import AIChatbox from './chat/AIChatbox';
import SourcePanel from './sources/SourcePanel';
import PostEditorWrapper from './editor/PostEditorWrapper';
import OnboardingTour from './layout/OnboardingTour';
import TopBarActions from './layout/TopBarActions';
import CreateSectionErrorBoundary from './shared/CreateSectionErrorBoundary';

import { useNavigationStore, useCreateSourcesStore, useCreatePostsStore, useDraftsStore, useCreateMediaStore, usePublishModalStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { toast } from 'sonner';

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

  const postContents = useCreatePostsStore(state => state.postContents);
  const selectedPostId = useCreatePostsStore(state => state.selectedPostId);
  const handleSaveDraft = useDraftsStore(state => state.handleSaveDraft);
  const isSavingDraft = useDraftsStore(state => state.isSavingDraft);
  const postMedia = useCreateMediaStore(state => state.postMedia);
  const currentPost = openPosts.find(p => p.id === selectedPostId);

  const tChat = useTranslations('CreatePage.createSection.chatPanel');

  // S-014: Keyboard Shortcuts
  useKeyboardShortcuts('k', () => {
    if (!isAIChatOpen) {
      toggleChat();
    }
  }, { ctrl: true });

  useKeyboardShortcuts('s', () => {
    if (!selectedPostId || !currentPost || isSavingDraft) return;
    const content = postContents[selectedPostId] || '';
    if (!content.trim()) {
      toast.warning(tChat('emptyContentWarning'));
      return;
    }
    const media = postMedia[selectedPostId] || [];
    handleSaveDraft(selectedPostId, content, media, currentPost.type);
  }, { ctrl: true, ignoreInputFields: true });

  const setIsPublishModalOpen = usePublishModalStore(state => state.setIsPublishModalOpen);

  useKeyboardShortcuts('p', () => {
    if (!selectedPostId) return;
    setIsPublishModalOpen(true);
  }, { ctrl: true, shift: true });

  useKeyboardShortcuts('Escape', () => {
    if (wizardStep !== 'idle') {
      setWizardStep('idle');
    }
  }, {});

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

  const [activeMobilePanel, setActiveMobilePanel] = useState<'sources' | 'editor' | 'chat'>('editor');

  const toggleChat = () => {
    setIsAIChatOpen(!isAIChatOpen);
    setManualChatToggle(!isAIChatOpen);
  };

  return (
    <CreateSectionErrorBoundary>
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
      <div className="flex h-full w-full relative overflow-hidden">

        {/* ─── Main content area ─── */}
        <div className="flex-1 min-w-0 flex flex-col h-full relative">

          {/* FIX S-004: Combined top bar with wizard breadcrumb (S-005: md: breakpoint) */}
          <TopBarActions
            isSourcesOpen={isSourcesOpen}
            onToggleSources={() => setIsSourcesOpen(!isSourcesOpen)}
            isAIChatOpen={isAIChatOpen}
            onToggleChat={toggleChat}
          />

          {/* Sources dropdown panel */}
          {isSourcesOpen && (
            <>
              {!isAddingSource && (
                <div
                  className="hidden md:block fixed inset-0 z-20"
                  onClick={() => setIsSourcesOpen(false)}
                />
              )}
              <div className={`hidden md:block absolute left-0 right-0 top-[41px] z-30 border-b border-border/50 bg-card shadow-lg overflow-y-auto ${
                isAddingSource ? 'max-h-[calc(100vh-120px)]' : 'max-h-[220px]'
              }`}>
                <SourcePanel mode={isAddingSource ? 'form' : 'list'} />
              </div>
            </>
          )}

          {/* Editor area */}
          <div className={`flex-1 min-h-0 relative z-10
            ${activeMobilePanel === 'editor' ? 'block' : 'hidden lg:block'}`}>
            <div className="relative z-0 h-full w-full">
              <PostEditorWrapper mode={isConfiguringPosts ? 'configure' : 'normal'} onOpenSources={() => setIsSourcesOpen(true)} />
            </div>
          </div>
        </div>

        {/* ─── AI Chat slide-in panel (desktop) ─── */}
        <div className={`hidden lg:flex flex-col transition-all duration-300 ease-in-out border-l border-border/50 bg-background shrink-0 w-[min(380px,30vw)] overflow-hidden ${
          isAIChatOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 pointer-events-none'
        }`}>
          {/* Chat header — compact, just close button */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-card/50 shrink-0">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground">AI</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={toggleChat}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          {/* Chat content */}
          <div className="flex-1 min-h-0 w-full overflow-hidden">
            <AIChatbox />
          </div>
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
    </CreateSectionErrorBoundary>
  )
}
