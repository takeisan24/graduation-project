# SPEC-CC-003: Remove -top-[31px] Negative Margin + Remove Credits System

> **Status**: Draft → Updated after user review
> **Stack**: Next.js 14, React 18, TypeScript, Tailwind CSS v4, shadcn/ui, next-intl

---

## Problem

**2 issues combined:**

1. **`ActionBar.tsx` line 137** uses a **fragile negative margin** to position the character count badge above the border:
```tsx
<div className="absolute -top-[31px] right-0 flex items-center gap-3 pr-[10px]">
```

2. **Credits system is fully removed** — `creditsRemaining = 0` everywhere and comment says "Credits store removed". Keeping the credits badge with hardcoded `0` is dead UI that clutters the interface.

---

## Root Cause

1. Character count was placed inside the ActionBar component but needs to appear ABOVE the top border. Instead of restructuring, a negative margin was used.
2. Credits store was removed but the credits badge UI was left behind.

---

## Solution

### Step 1: Remove Credits Badge Completely

**Remove** the entire credits span and `Coins` icon from `ActionBar.tsx:138-141`:

```tsx
// BEFORE (line 138-141):
<span className="flex items-center gap-1.5 text-xs font-medium text-brand-yellow bg-brand-yellow/10 px-2 py-0.5 rounded-full" title="Tín dụng AI còn lại">
  <Coins className="w-3.5 h-3.5" />
  {creditsRemaining}
</span>

// AFTER — remove entirely, also remove:
// const creditsRemaining = 0; (line 15)
// import { Coins } from 'lucide-react' (remove Coins from import)
```

Also remove from `PostConfigurationForm.tsx` (cost/credits section):
```tsx
// Remove the entire estimated cost block at lines 209-217:
// <div className="flex flex-col">
//   <span className="text-muted-foreground text-xs">Chi phí dự tính</span>
//   ...Credits text...
// </div>
```

### Step 2: Refactor ActionBar Layout

Replace the fragile `absolute -top-[31px]` with a clean **2-row flex layout**:

```tsx
// BEFORE (fragile):
<div className="sticky bottom-0 left-0 right-0 bg-muted">
  <div className="relative border-t border-border pt-[15px] pb-0 flex items-center justify-between">
    {/* FRAGILE: Character count above border via negative margin */}
    <div className="absolute -top-[31px] right-0 flex items-center gap-3 pr-[10px]">
      <span className="...text-brand-yellow...">...</span> {/* credits REMOVE */}
      <span className="text-xs text-muted-foreground">{charCount}/{charLimit}</span>
    </div>
    {/* All buttons */}
  </div>
</div>

// AFTER (clean — 2 rows):
<div className="sticky bottom-0 left-0 right-0 bg-muted flex flex-col">
  {/* Row 1: Char count only — compact, no negative margin */}
  <div className="flex items-center justify-end px-4 py-1.5 border-b border-border/30">
    <span className="text-xs text-muted-foreground tabular-nums">
      {charCount}/{charLimit}
    </span>
  </div>
  {/* Row 2: All action buttons */}
  <div className="flex items-center justify-between px-4 py-3">
    {/* Left: Media buttons */}
    <div className="flex items-center gap-2 pl-[10px] pb-[10px]">
      ...
    </div>
    {/* Right: Action buttons */}
    <div className="flex items-center gap-2 pr-[10px] pb-[10px]">
      ...
    </div>
  </div>
</div>
```

Key changes:
- **Row 1** is only the character count — compact `px-4 py-1.5`, subtle `border-b border-border/30`
- **Row 2** contains all buttons — same button positions as before, no `absolute` or `relative`
- **No negative margin** anywhere
- **No credits badge** — removed entirely
- Character count aligned to the right (same visual position as before)

### Step 3: Also Fix PostConfigurationForm

Remove the "Chi phí dự tính / Credits" block — no credits system means this display is meaningless:

```tsx
// BEFORE (PostConfigurationForm.tsx lines 209-217):
<div className="flex flex-col">
  <span className="text-muted-foreground text-xs uppercase tracking-wider">Chi phí dự tính</span>
  <div className="flex items-center gap-1.5 mt-0.5">
    <span className="text-primary font-bold text-lg">{totalPosts}</span>
    <span className="text-muted-foreground text-sm">Credits</span>
  </div>
</div>

// AFTER — remove entirely
// This div can be deleted. The count display below it (total posts) stays.
```

Also update the "bài" unit text at line 199:
```tsx
// BEFORE:
<span className="text-muted-foreground ml-1 text-sm">bài</span>

// AFTER (i18n):
<span className="text-muted-foreground ml-1 text-sm">{t('postUnit')}</span>
```

---

## Files to Change

- `components/features/create/editor/ActionBar.tsx` — Remove credits badge + refactor to 2-row layout
- `components/features/create/forms/PostConfigurationForm.tsx` — Remove credits cost display + i18n 'bài'

---

## New Files

None.

---

## Acceptance Criteria

- [ ] No `-top-` or negative margin anywhere in ActionBar
- [ ] No `text-brand-yellow`, `bg-brand-yellow`, or `Coins` component in ActionBar
- [ ] Character count badge renders in Row 1 (top), above action buttons
- [ ] All action buttons render in Row 2 (bottom)
- [ ] Layout looks correct at browser zoom 50%, 100%, 125%, 150%
- [ ] PostConfigurationForm has no "Credits" or "Chi phí" text
- [ ] No `Credits` / `Tín dụng` / `chi phí` string anywhere in create section
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] No `Coins` import remaining in ActionBar.tsx

---

## Rollback Plan

Revert `ActionBar.tsx` and `PostConfigurationForm.tsx` from Git. Simple rollback — the credits badge will reappear.

---

## Cross-Feature Notes

- Removing credits from ActionBar also removes the dependency on `Coins` import — clean up the import statement
- PostConfigurationForm's post count display (e.g., "3 bài") is separate from credits — keep that display, just i18n the "bài" unit
- After removing credits from PostConfigurationForm, the button may need centering or re-alignment — test visually
