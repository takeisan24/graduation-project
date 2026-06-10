# SPEC-CC-001: Remove Credits Badge + Fix CSS Token

> **Status**: Draft → Updated: credits badge removed entirely (user decision)
> **Stack**: Next.js 14, React 18, TypeScript, Tailwind CSS v4, shadcn/ui, next-intl

---

## Problem

**2 issues combined:**

1. `ActionBar.tsx:138` references `text-brand-yellow` and `bg-brand-yellow/10` — these CSS classes are **undefined** and cause the credits badge to render without visible text color.

2. **Credits system is fully removed** per user decision. The `creditsRemaining` store returns `0` everywhere, the credits badge shows a meaningless `0`, and the entire cost display in `PostConfigurationForm` is dead UI.

---

## Root Cause

1. `brand-yellow` was never defined in the design system CSS variables.
2. Credits store was removed but the credits badge UI was left behind as dead code.

---

## Solution

### Option A — Remove Credits Badge Entirely (Recommended)

Since the credits system is gone, the cleanest solution is to **remove all credits-related code**:

```tsx
// ActionBar.tsx — REMOVE the credits badge entirely:
// Line 15: const creditsRemaining = 0; // REMOVE
// Line 16: // Credits store removed — REMOVE this comment
// Lines 138-141: REMOVE the entire span
// Coins import: REMOVE Coins from lucide-react import
```

Also remove from `PostConfigurationForm.tsx`:
```tsx
// Lines 209-217: REMOVE the entire credits display div
// The total post count display can stay (it shows "N posts" not credits)
```

### After Credits Removal, `brand-yellow` Is Irrelevant

The `brand-yellow` CSS class issue only matters if we keep the credits badge. Since we're removing it entirely, **SPEC-CC-001 for the CSS class is resolved by removing the code that uses it**.

---

## Files to Change

### ActionBar.tsx — REMOVE:
- `const creditsRemaining = 0;` — line 15
- `import { Coins }` from lucide-react — remove Coins from import
- Credits badge span at lines 138-141

### PostConfigurationForm.tsx — REMOVE:
- Estimated cost display (credits) at lines 209-217

---

## New Files

None.

---

## Acceptance Criteria

- [ ] No `creditsRemaining` variable in ActionBar
- [ ] No `Coins` import in ActionBar
- [ ] No `text-brand-yellow` or `bg-brand-yellow` in ActionBar
- [ ] No credits cost display in PostConfigurationForm
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] No `brand-yellow` reference remains anywhere in create section

---

## Rollback Plan

Restore the removed lines from Git. Simple revert — credits badge will reappear.
