# SPEC-CC-014: Implement Keyboard Shortcuts

> **Status**: Draft
> **Stack**: Next.js 14, React 18, TypeScript, next-intl

---

## Problem

Power users expect keyboard shortcuts for common actions. Currently:
- ❌ No `Ctrl+Enter` to send chat
- ❌ No `Ctrl+S` to save draft
- ❌ No `Ctrl+K` to focus AI chat
- ❌ No `Ctrl+Shift+P` to open publish modal

The app lacks these standard productivity shortcuts.

---

## Root Cause

Keyboard shortcuts were not considered during initial development.

---

## Solution

### Step 1: Create Keyboard Shortcuts Hook

**New file: `hooks/useKeyboardShortcuts.ts`**

```typescript
// hooks/useKeyboardShortcuts.ts
"use client";

import { useEffect, useCallback } from 'react';

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Don't trigger shortcuts when typing in input fields (unless Escape)
    const target = e.target as HTMLElement;
    const isTyping = target.tagName === 'INPUT' ||
                     target.tagName === 'TEXTAREA' ||
                     target.isContentEditable;

    for (const shortcut of shortcuts) {
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : true;
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey || shortcut.shift === undefined;
      const altMatch = shortcut.alt ? e.altKey : !e.altKey || shortcut.alt === undefined;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        // Allow Escape even when typing
        if (isTyping && shortcut.key !== 'Escape') continue;

        e.preventDefault();
        shortcut.action();
        return;
      }
    }
  }, [shortcuts, enabled]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
```

### Step 2: Register Shortcuts in CreateSection

```tsx
// CreateSection.tsx
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function CreateSection() {
  const handleSaveDraft = useDraftsStore(s => s.handleSaveDraft);
  const { setWizardStep } = useNavigationStore();

  useKeyboardShortcuts([
    {
      key: 's',
      ctrl: true,
      action: () => handleSaveDraft(),
      description: 'Save draft',
    },
    {
      key: 'k',
      ctrl: true,
      action: () => setIsAIChatOpen(true),
      description: 'Focus AI chat',
    },
    {
      key: 'p',
      ctrl: true,
      shift: true,
      action: () => setIsPublishModalOpen(true),
      description: 'Open publish modal',
    },
    {
      key: 'Escape',
      action: () => {
        if (wizardStep !== 'idle') setWizardStep('idle');
      },
      description: 'Exit wizard',
    },
  ]);

  // ...
}
```

### Step 3: Add AIChatbox Enter Shortcut

```tsx
// AIChatbox.tsx — already has onKeyDown for Enter sending, but improve UX:

const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
    e.preventDefault();
    handleSend();
  }
  // Ctrl+Enter also sends
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    handleSend();
  }
};
```

### Step 4: Add Shortcut Reference (Optional UI)

```tsx
// AIChatbox.tsx — Add small hint below textarea:
{input.length === 0 && (
  <p className="text-[10px] text-muted-foreground px-1">
    {t('shortcutHint')} <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Enter</kbd> {t('toSend')}
  </p>
)}
```

Add i18n keys:
```json
{
  "shortcutHint": "Nhấn",
  "toSend": "để gửi"
}
```

---

## Files to Change

### New Files:
- `hooks/useKeyboardShortcuts.ts` — Reusable keyboard shortcut hook

### Existing Files:
- `components/features/create/CreateSection.tsx` — Register global shortcuts
- `components/features/create/chat/AIChatbox.tsx` — Add Ctrl+Enter shortcut + hint UI

---

## New Files

- `hooks/useKeyboardShortcuts.ts`

---

## Acceptance Criteria

- [ ] `Ctrl+S` / `Cmd+S` saves draft (prevents page reload)
- [ ] `Ctrl+K` / `Cmd+K` focuses AI chat panel
- [ ] `Ctrl+Shift+P` opens publish modal
- [ ] `Escape` exits wizard (if in wizard flow)
- [ ] `Enter` sends chat message
- [ ] `Ctrl+Enter` sends chat message (alternative)
- [ ] Shortcuts don't trigger when user is typing in non-chat inputs
- [ ] All shortcuts have descriptive names for accessibility
- [ ] Works with both Ctrl (Windows/Linux) and Cmd (macOS)

---

## Rollback Plan

1. Remove `useKeyboardShortcuts.ts`
2. Remove all shortcut registrations from `CreateSection.tsx`
3. Revert `AIChatbox.tsx` to remove `Ctrl+Enter` handler
4. No behavior changes — shortcuts were pure enhancement

---

## Cross-Feature Notes

- Consider adding a "Keyboard shortcuts" section in Settings or as a tooltip in the TopBar
- Shortcuts should be documented in the app's help section
- Consider storing shortcut preferences in localStorage for power users
