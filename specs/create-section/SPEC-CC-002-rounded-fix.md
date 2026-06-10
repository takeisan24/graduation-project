# SPEC-CC-002: Fix rounded-[5px] Design System Violation

> **Status**: Draft
> **Stack**: Next.js 14, React 18, TypeScript, Tailwind CSS v4, shadcn/ui, next-intl

---

## Problem

Three files use `rounded-[5px]` — an arbitrary value that **breaks the shadcn/ui design system** and creates inconsistent border radius across the UI:

| File | Line | Current |
|------|------|---------|
| `PostEditorWrapper.tsx` | 70 | `rounded-[5px]` |
| `PostEditorWrapper.tsx` | 85 | `rounded-[5px]` |
| `PostEditor.tsx` | 121 | `rounded-[5px]` |

The `--radius: 0.625rem` (10px) is defined in `globals.css` and corresponds to shadcn/ui's `rounded-xl` class. `rounded-[5px]` uses a non-standard 5px radius that visually clashes with all other components.

---

## Root Cause

1. Developer used arbitrary Tailwind value `rounded-[5px]` for a specific visual preference
2. This value was never audited against the design system
3. It creates visual inconsistency — most cards use `rounded-xl` (10px), these use 5px

---

## Solution

Replace all `rounded-[5px]` occurrences with `rounded-xl`:

```tsx
// PostEditorWrapper.tsx — Before:
className="... rounded-[5px] ..."

// PostEditorWrapper.tsx — After:
className="... rounded-xl ..."
```

The `rounded-xl` maps to the design system's `--radius: 0.625rem` (≈ 10px) which is the standard shadcn/ui card radius.

---

## Files to Change

- `components/features/create/editor/PostEditorWrapper.tsx` — Lines 70, 85: `rounded-[5px]` → `rounded-xl`
- `components/features/create/editor/PostEditor.tsx` — Line 121: `rounded-[5px]` → `rounded-xl`

---

## New Files

None.

---

## Acceptance Criteria

- [ ] All card elements use consistent `rounded-xl` (10px) border radius
- [ ] No `rounded-[5px]` or other arbitrary radius values remain in the create section editor components
- [ ] Visual comparison: PostEditor, PostEditorWrapper, and other card components look identical in terms of border radius
- [ ] Run `grep -r "rounded-\[" components/features/create/` returns zero results

---

## Rollback Plan

Use `Edit` tool to replace `rounded-xl` back to `rounded-[5px]` in all three locations. This is a one-line change per location.
