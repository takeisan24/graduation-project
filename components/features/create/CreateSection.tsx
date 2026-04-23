"use client"

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { GripVertical, MessageSquare, X } from 'lucide-react';
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
  const CHAT_PANEL_MIN_WIDTH = 340;
  const CHAT_PANEL_MAX_WIDTH = 520;
  const CHAT_PANEL_DEFAULT_WIDTH = 380;
  const CHAT_STORAGE_KEY = 'create-ai-chat-open';
  const CHAT_WIDTH_STORAGE_KEY = 'create-ai-chat-width';
  const t = useTranslations('CreatePage.createSection.mobileTabs');
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [manualChatToggle, setManualChatToggle] = useState(false);
  const [chatPanelWidth, setChatPanelWidth] = useState(CHAT_PANEL_DEFAULT_WIDTH);
  const [isResizingChat, setIsResizingChat] = useState(false);
  const hasResetOnMount = useRef(false);
  const hasLoadedChatPreference = useRef(false);

  const { wizardStep, setWizardStep } = useNavigationStore(useShallow(state => ({
    wizardStep: state.wizardStep,
    setWizardStep: state.setWizardStep
  })));
  const previousWizardStep = useRef(wizardStep);
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

  useEffect(() => {
    if (hasLoadedChatPreference.current || typeof window === 'undefined') return;
    hasLoadedChatPreference.current = true;
    const saved = window.localStorage.getItem(CHAT_STORAGE_KEY);
    const savedWidth = window.localStorage.getItem(CHAT_WIDTH_STORAGE_KEY);
    if (saved === 'true') {
      setIsAIChatOpen(true);
      setManualChatToggle(true);
    }
    if (savedWidth) {
      const parsedWidth = Number(savedWidth);
      if (!Number.isNaN(parsedWidth)) {
        setChatPanelWidth(Math.min(CHAT_PANEL_MAX_WIDTH, Math.max(CHAT_PANEL_MIN_WIDTH, parsedWidth)));
      }
    }
  }, []);

  useEffect(() => {
    if (!isAIChatOpen || !isResizingChat || typeof window === 'undefined') return;

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (event: MouseEvent) => {
      const nextWidth = window.innerWidth - event.clientX;
      setChatPanelWidth(Math.min(CHAT_PANEL_MAX_WIDTH, Math.max(CHAT_PANEL_MIN_WIDTH, nextWidth)));
    };

    const handleMouseUp = () => {
      setIsResizingChat(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isAIChatOpen, isResizingChat]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CHAT_WIDTH_STORAGE_KEY, String(chatPanelWidth));
  }, [chatPanelWidth]);

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
    if (wizardStep === 'addingSource') {
      setIsSourcesOpen(true);
      setActiveMobilePanel('sources');
    }
    if (wizardStep === 'configuringPosts') {
      setActiveMobilePanel('editor');
    }
  }, [wizardStep]);

  useEffect(() => {
    if (previousWizardStep.current !== 'idle' && wizardStep === 'idle') {
      setIsSourcesOpen(false);
    }

    previousWizardStep.current = wizardStep;
  }, [wizardStep]);

  const isAddingSource = wizardStep === 'addingSource';
  const isConfiguringPosts = wizardStep === 'configuringPosts';

  const [activeMobilePanel, setActiveMobilePanel] = useState<'sources' | 'editor' | 'chat'>('editor');

  const toggleChat = useCallback(() => {
    setIsAIChatOpen((prev) => {
      const next = !prev;
      setManualChatToggle(next);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CHAT_STORAGE_KEY, String(next));
      }
      return next;
    });
  }, []);

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
      <div className="lg:hidden flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-card/30">
        <Button
          variant={activeMobilePanel === 'sources' ? 'default' : 'outline'}
          size="sm"
          className={`gap-2 text-xs ${activeMobilePanel === 'sources' ? 'bg-utc-royal text-white' : ''}`}
          onClick={() => setActiveMobilePanel('sources')}
        >
          {t('sources')}
          {savedSources.length > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              activeMobilePanel === 'sources' ? 'bg-white/20 text-white' : 'bg-utc-royal/10 text-utc-royal'
            }`}>
              {savedSources.length}
            </span>
          )}
        </Button>
        {wizardStep !== 'idle' && (
          <div className="rounded-full bg-utc-royal/10 px-2 py-1 text-[11px] font-medium text-utc-royal">
            {isAddingSource ? '1/3' : '2/3'}
          </div>
        )}
        <div className="flex-1" />
        <Button
          variant={activeMobilePanel === 'chat' ? 'default' : 'outline'}
          size="sm"
          className={`gap-2 text-xs ${activeMobilePanel === 'chat' ? 'bg-gradient-to-r from-utc-royal to-utc-sky text-white' : ''}`}
          onClick={() => setActiveMobilePanel('chat')}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {t('aiChat')}
        </Button>
      </div>

      {/* ═══ DESKTOP: Hybrid layout ═══ */}
      <div className="relative flex h-full min-h-0 w-full overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(76,184,232,0.08),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.4),transparent_24%)]">

        {/* ─── Main content area ─── */}
        <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background/70">

          {/* FIX S-004: Combined top bar with wizard breadcrumb (S-005: md: breakpoint) */}
          <TopBarActions
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
          <div className={`relative z-10 flex-1 min-h-0 bg-transparent ${
            activeMobilePanel === 'editor' ? 'block' : 'hidden lg:block'
          }`}>
            <div
              className="hidden h-full min-h-0 lg:grid lg:items-stretch transition-[grid-template-columns] duration-300 ease-out"
              style={{
                gridTemplateColumns: `minmax(0, 1fr) ${isAIChatOpen ? `${chatPanelWidth}px` : '0px'}`,
              }}
            >
              <div className="min-w-0">
                <PostEditorWrapper mode={isConfiguringPosts ? 'configure' : 'normal'} onOpenSources={() => setIsSourcesOpen(true)} />
              </div>
              <div
                className={`min-h-0 overflow-hidden transition-all duration-300 ease-out ${
                  isAIChatOpen
                    ? 'translate-x-0 border-l border-border/60 opacity-100'
                    : 'translate-x-full border-l border-transparent opacity-0 pointer-events-none'
                }`}
                aria-hidden={!isAIChatOpen}
              >
                <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-l-2xl bg-card/95 shadow-[-18px_0_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
                  <button
                    type="button"
                    className={`absolute inset-y-0 left-0 z-20 hidden w-4 -translate-x-1/2 cursor-col-resize lg:block ${
                      isResizingChat ? 'bg-primary/10' : ''
                    }`}
                    aria-label="Resize AI chat panel"
                    onMouseDown={() => setIsResizingChat(true)}
                    onDoubleClick={() => setChatPanelWidth(CHAT_PANEL_DEFAULT_WIDTH)}
                  >
                    <span className="absolute left-1/2 top-1/2 flex h-20 w-2.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-background/95 shadow-sm transition-colors hover:border-primary/40 hover:bg-card">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </span>
                  </button>
                  <div className="flex items-center justify-between border-b border-border/50 bg-card/70 px-3 py-1.5 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold text-foreground">AI</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={toggleChat}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex-1 min-h-0 w-full overflow-hidden bg-transparent">
                    <AIChatbox />
                  </div>
                </div>
              </div>
            </div>

            <div className="h-full w-full lg:hidden">
              <PostEditorWrapper mode={isConfiguringPosts ? 'configure' : 'normal'} onOpenSources={() => setIsSourcesOpen(true)} />
            </div>
          </div>
        </div>

        {/* ─── Mobile panels ─── */}
        <div className={`lg:hidden min-h-0 bg-background ${activeMobilePanel === 'sources' ? 'flex-1' : 'hidden'}`}>
          <SourcePanel mode={isAddingSource ? 'form' : 'list'} />
        </div>
        <div className={`lg:hidden min-h-0 bg-background ${activeMobilePanel === 'chat' ? 'flex-1' : 'hidden'}`}>
          <AIChatbox />
        </div>
      </div>

      <OnboardingTour />
    </CreateSectionErrorBoundary>
  )
}
