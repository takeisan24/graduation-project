"use client"

import { useState, useEffect, useRef } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

//Import component UI
import AIChatbox from './chat/AIChatbox';
import SourcePanel from './sources/SourcePanel';
import PostEditorWrapper from './editor/PostEditorWrapper';
import OnboardingTour from './layout/OnboardingTour';

// Import modal manager

// Import store for wizard state
import { useNavigationStore, useCreateSourcesStore, useCreatePostsStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';

/**
 * Create section component with collapsible three-panel layout:
 * 1. Left panel (241px) - Sources management (collapsible)
 * 2. Main panel (flex-1) - Post creation editor (always visible)
 * 3. Right panel (350px) - AI chatbox (collapsible)
 */
export default function CreateSection() {
  const [isSourcePanelOpen, setIsSourcePanelOpen] = useState(true);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false); // Ẩn ở lúc đầu, chỉ mở khi có posts
  const hasResetOnMount = useRef(false); // Flag to ensure mount reset only runs once
  
  // Get wizard state and actions from store
  const { wizardStep, setWizardStep } = useNavigationStore(useShallow(state => ({
    wizardStep: state.wizardStep,
    setWizardStep: state.setWizardStep
  })));
  const savedSources = useCreateSourcesStore(state => state.savedSources);
  const openPosts = useCreatePostsStore(state => state.openPosts);
  const sourceToGenerate = useCreateSourcesStore(state => state.sourceToGenerate);
  const isSourceModalOpen = useCreateSourcesStore(state => state.isSourceModalOpen);
  
  // Reset wizardStep to 'idle' when component mounts if wizardStep is stuck
  // This handles cases where user refreshes page or navigates back to create page
  // with wizardStep still set in localStorage from a previous session
  useEffect(() => {
    // Only run once on mount
    if (hasResetOnMount.current) return;
    hasResetOnMount.current = true;
    
    // Reset if we're in configuringPosts but no sourceToGenerate (modal was closed/refreshed)
    if (wizardStep === 'configuringPosts' && !sourceToGenerate) {
      setWizardStep('idle');
    }
    // Reset if we're in addingSource but no modal is open (user refreshed during form)
    // This allows user to start fresh if they refresh during the add source flow
    if (wizardStep === 'addingSource' && !isSourceModalOpen) {
      setWizardStep('idle');
    }
  }, [wizardStep, sourceToGenerate, isSourceModalOpen, setWizardStep]);
  
  // Auto-reset wizardStep to 'idle' when sourceToGenerate becomes null
  // This handles cases where modal is closed without going through onCancel/onComplete
  useEffect(() => {
    // If we're in configuringPosts step but sourceToGenerate is null, reset to idle
    // This can happen if modal is closed unexpectedly
    // Note: When in 'addingSource' step, sourceToGenerate is expected to be null,
    // so we only check for 'configuringPosts' step
    if (wizardStep === 'configuringPosts' && !sourceToGenerate) {
      setWizardStep('idle');
    }
  }, [sourceToGenerate, wizardStep, setWizardStep]);
  
  // Check if user has completed first flow
  useEffect(() => {
    const hasCompleted = localStorage.getItem('hasCompletedFirstFlow');
    // If already completed or has sources, don't trigger wizard automatically
    if (hasCompleted || savedSources.length > 0) {
      // Do nothing, user can trigger wizard manually
    }
  }, [savedSources.length]);
  
  // Save completion when wizard finishes
  useEffect(() => {
    if (wizardStep === 'idle' && savedSources.length > 0) {
      const hasCompleted = localStorage.getItem('hasCompletedFirstFlow');
      if (!hasCompleted) {
        localStorage.setItem('hasCompletedFirstFlow', 'true');
      }
    }
  }, [wizardStep, savedSources.length]);
  
  // Auto-open/close AI Chat Panel based on posts
  useEffect(() => {
    if (openPosts.length > 0 && !isAIChatOpen) {
      // Open when posts are created
      setIsAIChatOpen(true);
    } else if (openPosts.length === 0 && isAIChatOpen) {
      // Close when all posts are closed
      setIsAIChatOpen(false);
    }
  }, [openPosts.length, isAIChatOpen]); // Track both length and panel state
  
  // Determine panel states based on wizard step
  const isAddingSource = wizardStep === 'addingSource';
  const isConfiguringPosts = wizardStep === 'configuringPosts';
  const isInWizard = wizardStep !== 'idle';
  
  // Mobile panel state (mobile only shows one panel at a time)
  const [activeMobilePanel, setActiveMobilePanel] = useState<'sources' | 'editor' | 'chat'>('editor');
  
  const expandedWidth = 'w-[700px]'; // Bạn có thể tăng lên w-[700px] nếu muốn rộng hơn nữa
  const collapsedWidth = 'w-[241px]';

  const sourcePanelWidth = isAddingSource ? expandedWidth : collapsedWidth;

  return (
    <>
      {/* Mobile Navigation Tabs (Only visible on mobile) */}
      <div className="lg:hidden flex border-b border-white/10 bg-[#1A0F30]">
        <button
          onClick={() => setActiveMobilePanel('sources')}
          className={`flex-1 py-3 text-base font-medium transition-colors ${
            activeMobilePanel === 'sources' 
              ? 'text-[#E33265] border-b-2 border-[#E33265]' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Nguồn
        </button>
        <button
          onClick={() => setActiveMobilePanel('editor')}
          className={`flex-1 py-3 text-base font-medium transition-colors ${
            activeMobilePanel === 'editor' 
              ? 'text-[#E33265] border-b-2 border-[#E33265]' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Bài viết
        </button>
        <button
          onClick={() => setActiveMobilePanel('chat')}
          className={`flex-1 py-3 text-base font-medium transition-colors ${
            activeMobilePanel === 'chat' 
              ? 'text-[#E33265] border-b-2 border-[#E33265]' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          AI Chat
        </button>
      </div>

      <div className="flex h-full w-full relative">
        {/* Left Panel - Sources */}
        <div
          className={`transition-all duration-300 ease-in-out ${
            isSourcePanelOpen ? sourcePanelWidth : 'w-0'
          } overflow-hidden relative ${isAddingSource ? 'z-30' : 'z-10'}
          ${activeMobilePanel === 'sources' ? 'flex-1 w-full lg:w-auto' : 'hidden lg:block lg:flex-none'}`}
        >
          {/* Wrapper với width cố định để content co lại đúng */}
          <div className={`h-full ${isAddingSource ? 'w-full lg:w-[700px]' : 'w-full lg:w-[241px]'} transition-all duration-300 relative ${isAddingSource ? 'z-30' : 'z-0'}`}>
            <SourcePanel mode={isAddingSource ? 'form' : 'list'} />
          </div>
          
          {/* Spotlight overlay - OUTSIDE wrapper để cover toàn bộ panel kể cả scroll */}
          {isInWizard && !isAddingSource && (
            <div className="absolute inset-0 bg-black/70 z-40 pointer-events-auto animate-in fade-in duration-300 cursor-not-allowed" />
          )}
          {/* Toggle Button inside Source Panel (Desktop only) */}
          {isSourcePanelOpen && !isAddingSource && !isInWizard && (
            <button
              onClick={() => setIsSourcePanelOpen(false)}
              className="hidden lg:block absolute right-2 top-2 z-10 bg-[#2A2A30] hover:bg-[#3A3A42] text-white p-1.5 rounded-lg shadow-lg border border-white/10 transition-all"
              title="Close Sources Panel"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Toggle Button - Left Panel (when closed, Desktop only) */}
        {!isSourcePanelOpen && !isInWizard && (
          <button
            onClick={() => setIsSourcePanelOpen(true)}
            className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 z-15 bg-[#E33265] hover:bg-[#c52b57] text-white p-2 rounded-r-lg shadow-lg transition-all"
            title="Open Sources Panel"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>
        )}

        {/* Main Panel - Editor (Always visible on desktop, conditional on mobile) */}
        <div className={`flex-1 min-w-0 relative transition-all duration-300 ease-in-out ${isConfiguringPosts ? 'z-30' : 'z-10'}
          ${activeMobilePanel === 'editor' ? 'block' : 'hidden lg:block'}`}>
          <div className={`relative ${isConfiguringPosts ? 'z-30' : 'z-0'} h-full w-full`}>
            <PostEditorWrapper mode={isConfiguringPosts ? 'configure' : 'normal'} />
          </div>
          
          {/* Spotlight overlay - OUTSIDE wrapper để cover toàn bộ panel kể cả scroll */}
          {isInWizard && !isConfiguringPosts && (
            <div className="absolute inset-0 bg-black/70 z-40 pointer-events-auto animate-in fade-in duration-300 cursor-not-allowed" />
          )}
        </div>

        {/* Right Panel - AI Chat */}
        <div
          className={`transition-all duration-300 ease-in-out ${
            isAIChatOpen ? 'w-[350px]' : 'w-0'
          } overflow-hidden relative z-10
          ${activeMobilePanel === 'chat' ? 'flex-1 w-full lg:w-[350px]' : 'hidden lg:block lg:flex-none'}`}
        >
          {/* Wrapper với width cố định để content co lại đúng */}
          <div className="h-full w-full lg:w-[350px] transition-all duration-300 relative z-0">
            <AIChatbox />
          </div>
          
          {/* Spotlight overlay - OUTSIDE wrapper để cover toàn bộ panel kể cả scroll */}
          {isInWizard && (
            <div className="absolute inset-0 bg-black/70 z-40 pointer-events-auto animate-in fade-in duration-300 cursor-not-allowed" />
          )}
        </div>
      </div>
      
      {/* 
        Note: ModalManager has been moved to CreateLayout to work across all sections.
        It's no longer needed here.
      */}
      
      {/* Onboarding tour for first-time users */}
      <OnboardingTour />
    </>
  )
}   
