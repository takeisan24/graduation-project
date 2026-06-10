# SPEC-CC-010: Fix AI Chat Panel Layout Reflow

> **Status**: Draft
> **Stack**: Next.js 14, React 18, TypeScript, Tailwind CSS v4, Framer Motion, shadcn/ui

---

## Problem

The AI Chat panel in `CreateSection.tsx` uses `w-0` → `w-[min(380px,30vw)]` transition to toggle visibility:

```tsx
// CreateSection.tsx:178-180 — CAUSES LAYOUT SHIFT
<div className={`hidden lg:flex flex-col border-l border-border/50 bg-background flex-shrink-0 ${
  isAIChatOpen ? 'w-[min(380px,30vw)]' : 'w-0'
} overflow-hidden`}>
```

When the panel opens/closes:
1. Editor area width changes from `flex-1` to `flex-1 - 380px`
2. Post tabs, textarea, and content **reflow** (shift position)
3. User loses cursor position or scroll position
4. The 300ms transition helps but doesn't prevent the reflow itself

---

## Root Cause

The container div uses `w-0` when closed, which removes its width entirely. When opened, it expands — causing the sibling editor div to shrink.

---

## Solution

**Always reserve 380px** for the AI Chat panel, but hide content via `opacity-0` + `pointer-events-none` when closed:

```tsx
// CreateSection.tsx — BEFORE:
<div className={`hidden lg:flex flex-col transition-all duration-300 ease-in-out border-l border-border/50 bg-background flex-shrink-0 ${
  isAIChatOpen ? 'w-[min(380px,30vw)]' : 'w-0'
} overflow-hidden`}>
  <AIChatbox />
</div>

// CreateSection.tsx — AFTER:
<div className="hidden lg:flex flex-col border-l border-border/50 bg-background flex-shrink-0 w-[380px]">
  {/* Always present — content hidden when panel closed */}
  <div
    className={`flex flex-col h-full transition-all duration-300 ease-in-out ${
      isAIChatOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
    }`}
  >
    {/* Chat header */}
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-card/50 flex-shrink-0">
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

  {/* Placeholder when closed — shows the panel "socket" */}
  {!isAIChatOpen && (
    <div className="flex-1 flex items-center justify-center">
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleChat}
        className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground gap-1.5"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {t('aiChat')}
      </Button>
    </div>
  )}
</div>
```

### Key Changes

1. **Container width is always `w-[380px]`** — no reflow
2. **Inner content fades via `opacity-0 pointer-events-none`** — invisible but space reserved
3. **Close button stays accessible** via the inner wrapper being behind a `pointer-events-none` overlay
4. **Collapsed state shows a mini "open chat" button** — visual cue that chat panel is available

---

## Files to Change

- `components/features/create/CreateSection.tsx` — Refactor AI Chat panel layout (lines 177–195)

---

## New Files

None.

---

## Acceptance Criteria

- [ ] Editor area width never changes when AI Chat panel toggles
- [ ] AI Chat panel occupies exactly 380px at all times (open or closed)
- [ ] Smooth 300ms fade transition when panel opens/closes (opacity animation)
- [ ] Close button is accessible when panel is open
- [ ] "Open chat" button visible as placeholder when panel is closed
- [ ] No layout shift on PostEditor, PostEditorWrapper, or TabsManager when toggling
- [ ] Mobile layout (`lg:hidden`) unchanged

---

## Rollback Plan

Revert the AI Chat panel JSX in `CreateSection.tsx` back to the `w-0` / `w-[380px]` conditional width approach. This will restore the reflow behavior but keeps the component functional.
