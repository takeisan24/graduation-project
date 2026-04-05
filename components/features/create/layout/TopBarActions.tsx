"use client"

import { Button } from '@/components/ui/button'
import { useNavigationStore, useCreateSourcesStore } from '@/store'
import { useShallow } from 'zustand/react/shallow'
import { useTranslations } from 'next-intl'
import { FolderOpen, MessageSquare, X, ChevronLeft, ChevronRight } from 'lucide-react'

interface TopBarActionsProps {
  isSourcesOpen: boolean
  onToggleSources: () => void
  isAIChatOpen: boolean
  onToggleChat: () => void
}

export default function TopBarActions({
  isSourcesOpen,
  onToggleSources,
  isAIChatOpen,
  onToggleChat,
}: TopBarActionsProps) {
  const t = useTranslations('CreatePage.createSection.topBarActions')
  const savedSources = useCreateSourcesStore(state => state.savedSources)
  const { wizardStep, setWizardStep } = useNavigationStore(useShallow(state => ({
    wizardStep: state.wizardStep,
    setWizardStep: state.setWizardStep,
  })))

  const isAddingSource = wizardStep === 'addingSource'
  const isConfiguringPosts = wizardStep === 'configuringPosts'
  const isInWizard = wizardStep !== 'idle'

  return (
    /* FIX S-005: Changed lg: → md: for tablet breakpoint */
    <div className="hidden md:flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-card/30">

      {/* Wizard breadcrumb — only visible during wizard flow */}
      {isInWizard && (
        <div className="flex items-center gap-1.5 text-xs">
          {/* Step 1 indicator */}
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${isAddingSource ? 'bg-utc-royal text-white' : 'text-muted-foreground'}`}>
            <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px] font-bold">1</span>
            <span className="hidden lg:inline">{t('wizard.step1')}</span>
          </div>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          {/* Step 2 indicator */}
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${isConfiguringPosts ? 'bg-utc-royal text-white' : 'text-muted-foreground'}`}>
            <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px] font-bold">2</span>
            <span className="hidden lg:inline">{t('wizard.step2')}</span>
          </div>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          {/* Step 3 indicator */}
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${isConfiguringPosts ? 'bg-utc-royal/50 text-white/80' : 'text-muted-foreground'}`}>
            <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px] font-bold">3</span>
            <span className="hidden lg:inline">{t('wizard.step3')}</span>
          </div>
        </div>
      )}

      {/* Sources toggle */}
      {!isInWizard && (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          onClick={onToggleSources}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          {t('sources')}
          {savedSources.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-utc-royal/10 text-utc-royal text-[10px] font-semibold">
              {savedSources.length}
            </span>
          )}
        </Button>
      )}

      {/* Wizard nav: back */}
      {isInWizard && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setWizardStep('idle')}
          title={t('wizard.exit')}
        >
          <X className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">{t('wizard.exit')}</span>
        </Button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* AI Chat toggle */}
      <Button
        variant={isAIChatOpen ? "default" : "outline"}
        size="sm"
        className={`gap-2 text-xs ${isAIChatOpen ? 'bg-gradient-to-r from-utc-royal to-utc-sky text-white' : ''}`}
        onClick={onToggleChat}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {t('aiChat')}
      </Button>
    </div>
  )
}
