# SPEC-CC-004: Add Wizard Step Indicator — Combined Top Bar

> **Status**: Draft → Updated after user review
> **Stack**: Next.js 14, React 18, TypeScript, Tailwind CSS v4, shadcn/ui, next-intl, Framer Motion

---

## Problem

The `CreateSection.tsx` drives a 3-step wizard via `wizardStep` state (`idle | addingSource | configuringPosts`), but **users have NO visual indicator** showing where they are in the flow. Additionally, the TopBar and WizardStepIndicator were 2 separate rows — wasting vertical space.

---

## Root Cause

1. The wizard was implemented as a state machine without a UI progress component
2. Wizard indicator was planned as a separate row below the TopBar
3. The auto-reset logic suggests this was a known pain point but never addressed

---

## Solution — Combined Top Bar Row

**Design decision**: Instead of 2 separate rows (WizardStepIndicator + TopBar), merge into **1 unified top bar row** that adapts based on wizard state.

### Layout Design

**When `wizardStep === 'idle'` (normal mode):**
```
┌──────────────────────────────────────────────────────────────────────┐
│ [Sources ▾ (3)]        [AI 💬]                        [User Avatar ▾] │
└──────────────────────────────────────────────────────────────────────┘
```

**When `wizardStep !== 'idle'` (wizard mode):**
```
┌──────────────────────────────────────────────────────────────────────┐
│ [← Quay lại] ● Nguồn ○ Cấu hình ● Bài viết  [Sources ▾] [✕ Thoát]  │
└──────────────────────────────────────────────────────────────────────┘
```

**Key benefits:**
- Single row = saves vertical space
- When in wizard: Back + Steps + Exit visible — no wasted space
- When idle: Just normal TopBar controls
- Mobile: Adapts to mobile tabs (still `lg:hidden`)

---

### Implementation

**New file: `components/features/create/shared/TopBarActions.tsx`** (replaces inline top bar logic)

```tsx
"use client";

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, MessageSquare } from 'lucide-react';
import { useNavigationStore } from '@/store';

interface TopBarActionsProps {
  className?: string;
}

export default function TopBarActions({ className }: TopBarActionsProps) {
  const t = useTranslations('CreatePage.createSection.topBar');
  const { wizardStep, setWizardStep } = useNavigationStore();

  const isInWizard = wizardStep !== 'idle';
  const steps = [
    { key: 'addingSource', label: t('source') },
    { key: 'configuringPosts', label: t('configure') },
    { key: 'done', label: t('posts') },
  ];

  const currentIndex = steps.findIndex(s => s.key === wizardStep);
  const maxIndex = 2; // addingSource=0, configuringPosts=1, done=2

  const handleBack = () => {
    if (wizardStep === 'configuringPosts') {
      setWizardStep('addingSource');
    } else if (wizardStep === 'addingSource') {
      setWizardStep('idle');
    }
  };

  const handleClose = () => {
    setWizardStep('idle');
  };

  const handleNext = () => {
    if (wizardStep === 'addingSource') {
      // Don't auto-advance — user must complete the form
      // This is for visual indication only
    }
  };

  return (
    <div className={`hidden lg:flex items-center gap-2 px-4 py-2 border-b border-border/50 ${
      isInWizard ? 'bg-utc-sky/5' : 'bg-card/30'
    } ${className || ''}`}>

      {/* LEFT: Wizard controls OR normal Sources button */}
      {isInWizard ? (
        /* ── Wizard Mode: Back button + Step breadcrumb ── */
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3 w-3" />
            {t('back')}
          </Button>

          {/* Step breadcrumb */}
          <div className="flex items-center gap-1.5">
            {steps.map((step, index) => (
              <div key={step.key} className="flex items-center gap-1">
                {index > 0 && (
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                )}
                <span className={`text-xs font-medium ${
                  index === currentIndex
                    ? 'text-utc-royal font-bold'
                    : index < currentIndex
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                }`}>
                  {index === currentIndex ? '●' : index < currentIndex ? '●' : '○'}{' '}
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* ── Normal Mode: Sources dropdown button ── */
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          onClick={() => {/* existing sources toggle logic */}}
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

      {/* SPACER */}
      <div className="flex-1" />

      {/* RIGHT: AI Chat + Exit (wizard) / normal actions */}
      {isInWizard ? (
        /* ── Wizard Mode: Exit button ── */
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
        >
          <X className="h-3 w-3 mr-1" />
          {t('exit')}
        </Button>
      ) : (
        /* ── Normal Mode: AI Chat toggle ── */
        <Button
          variant={isAIChatOpen ? "default" : "outline"}
          size="sm"
          className={`gap-2 text-xs ${isAIChatOpen ? 'bg-gradient-to-r from-utc-royal to-utc-sky text-white' : ''}`}
          onClick={toggleChat}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {t('aiChat')}
        </Button>
      )}
    </div>
  );
}
```

### Integration into CreateSection

Replace the existing top bar section (`CreateSection.tsx` lines ~120-149) with the new component:

```tsx
// CreateSection.tsx — REPLACE this block:
{/* OLD: 2 separate sections */}
{/* WizardStepIndicator (separate) */}
{/* Top bar: Sources dropdown + AI Chat toggle */}

// NEW: Single combined component
<TopBarActions />
```

### i18n Keys Required

Add to `messages/vi.json` and `messages/en.json`:

```json
{
  "CreatePage": {
    "createSection": {
      "topBar": {
        "sources": "Nguồn",
        "aiChat": "AI",
        "back": "Quay lại",
        "exit": "Thoát",
        "source": "Nguồn",
        "configure": "Cấu hình",
        "posts": "Bài viết"
      }
    }
  }
}
```

---

## Files to Change

### New Files:
- `components/features/create/shared/TopBarActions.tsx`

### Existing Files:
- `components/features/create/CreateSection.tsx` — Replace inline top bar with `<TopBarActions />`

---

## Acceptance Criteria

- [ ] **Normal mode (`wizardStep === 'idle'`)**: Shows Sources button + AI Chat toggle — same as before
- [ ] **Wizard mode**: Shows Back + Step breadcrumb + Exit button — single row
- [ ] `Back` button: configuringPosts → addingSource → idle
- [ ] `Exit` button: resets `wizardStep` to `'idle'`
- [ ] Step breadcrumb shows correct step (● Nguồn / ● Cấu hình / ○ Bài viết)
- [ ] Background color subtly changes in wizard mode (`bg-utc-sky/5`)
- [ ] All text internationalized (vi + en)
- [ ] Mobile: mobile tabs still work independently (no change)
- [ ] No breaking changes to existing wizard flow logic
- [ ] Mobile tabs NOT replaced — they remain the mobile navigation

---

## Rollback Plan

1. Delete `TopBarActions.tsx`
2. Restore the inline top bar JSX in `CreateSection.tsx`
3. All wizard state logic remains unchanged

---

## Cross-Feature Notes

- This component needs `isAIChatOpen`, `toggleChat`, `savedSources` from CreateSection — pass as props or use a lighter approach
- Alternative: `TopBarActions` only handles the **left** section (Sources or wizard controls), keep AI Chat toggle inline in `CreateSection`
- This avoids prop drilling and keeps the split clean:
  ```
  ┌─ TopBarActions (left: wizard OR sources) ─┐
  │ Right section stays inline in CreateSection │
  └────────────────────────────────────────────┘
  ```
