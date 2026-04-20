"use client"

import { Button } from '@/components/ui/button'
import { useNavigationStore, useCreateSourcesStore, useCreatePostsStore, useCreateWorkspaceStore } from '@/store'
import { useShallow } from 'zustand/react/shallow'
import { useTranslations } from 'next-intl'
import { FolderOpen, MessageSquare, X, Check, ChevronRight, Route, FolderKanban } from 'lucide-react'
import { deriveWorkspaceSeed } from '@/store/create/workspace'

interface TopBarActionsProps {
  onToggleSources: () => void
  isAIChatOpen: boolean
  onToggleChat: () => void
}

export default function TopBarActions({
  onToggleSources,
  isAIChatOpen,
  onToggleChat,
}: TopBarActionsProps) {
  const t = useTranslations('CreatePage.createSection.topBarActions')
  const savedSources = useCreateSourcesStore(state => state.savedSources)
  const { selectedPostId, postContextMap } = useCreatePostsStore(useShallow(state => ({
    selectedPostId: state.selectedPostId,
    postContextMap: state.postContextMap,
  })))
  const { projectName, projectId } = useCreateWorkspaceStore(useShallow((state) => ({
    projectName: state.projectName,
    projectId: state.projectId,
  })))
  const { wizardStep, setWizardStep } = useNavigationStore(useShallow(state => ({
    wizardStep: state.wizardStep,
    setWizardStep: state.setWizardStep,
  })))

  const isAddingSource = wizardStep === 'addingSource'
  const isConfiguringPosts = wizardStep === 'configuringPosts'
  const isInWizard = wizardStep !== 'idle'
  const step1Done = isConfiguringPosts
  const step2Active = isConfiguringPosts
  const activePostContext = selectedPostId ? postContextMap[selectedPostId] : undefined
  const inferredWorkspace = deriveWorkspaceSeed()
  const workspaceLabel = projectName || (savedSources.length > 0 ? inferredWorkspace.name : null)

  const contextLabel = activePostContext?.source === 'drafts'
    ? 'Từ bản nháp'
    : activePostContext?.source === 'calendar'
      ? 'Từ lịch'
      : activePostContext?.source === 'failed'
        ? 'Từ bài lỗi'
        : activePostContext?.source === 'published'
          ? 'Từ bài đã đăng'
          : null

  return (
    /* FIX S-005: Changed lg: → md: for tablet breakpoint */
    <div className="hidden md:flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-card/30">

      {/* Wizard breadcrumb — only visible during wizard flow */}
      {isInWizard && (
        <div className="flex items-center gap-1.5 text-xs">
          {/* Step 1 indicator */}
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
            isAddingSource ? 'bg-utc-royal text-white' : step1Done ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
          }`}>
            <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px] font-bold">
              {step1Done ? <Check className="h-3 w-3" /> : '1'}
            </span>
            <span className="hidden lg:inline">{t('wizard.step1')}</span>
          </div>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          {/* Step 2 indicator */}
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${step2Active ? 'bg-utc-royal text-white' : 'text-muted-foreground'}`}>
            <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px] font-bold">2</span>
            <span className="hidden lg:inline">{t('wizard.step2')}</span>
          </div>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          {/* Step 3 indicator */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-muted-foreground">
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

      {!isInWizard && contextLabel && (
        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
          <Route className="h-3.5 w-3.5 text-primary" />
          <span>{contextLabel}</span>
        </div>
      )}

      {!isInWizard && workspaceLabel && (
        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
          <FolderKanban className="h-3.5 w-3.5 text-primary" />
          <span className="max-w-[220px] truncate">
            {projectId ? `Du an: ${workspaceLabel}` : `Du an nhap: ${workspaceLabel}`}
          </span>
        </div>
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
