# SPEC-CC-005: Fix Tablet Breakpoint Gap (Sources Panel Inaccessible)

> **Status**: Draft
> **Stack**: Next.js 14, React 18, TypeScript, Tailwind CSS v4, shadcn/ui, next-intl

---

## Problem

The Sources panel is **completely inaccessible** at tablet viewport widths (~768px–1024px):

```tsx
// CreateSection.tsx:97 — Mobile tabs hidden ABOVE 1024px
<div className="lg:hidden flex border-b border-border bg-background">

// CreateSection.tsx:121 — Desktop dropdown hidden BELOW 1024px
<div className="hidden lg:flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-card/30">
```

| Viewport | Mobile tabs (`lg:hidden`) | Desktop dropdown (`hidden lg:flex`) | **Result** |
|----------|--------------------------|----------------------------------|-----------|
| < 768px | ✅ Visible | ❌ Hidden | OK |
| **768px–1024px** | **❌ Hidden** | **❌ Hidden** | **SOURCES INACCESSIBLE** |
| > 1024px | ❌ Hidden | ✅ Visible | OK |

**Impact**: Users on tablets (~768px–1024px) cannot access the core source management feature. This is a **critical UX blocker**.

---

## Root Cause

Tailwind breakpoint mismatch:
- `lg:` = 1024px (Large)
- `md:` = 768px (Medium)

The desktop dropdown uses `hidden lg:flex` (show at ≥1024px), while mobile tabs use `lg:hidden` (hide at ≥1024px). This leaves a **gap at 768px–1023px**.

---

## Solution

Change the desktop Sources dropdown toggle from `hidden lg:flex` to `hidden md:flex`:

```tsx
// CreateSection.tsx — BEFORE:
<div className="hidden lg:flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-card/30">

// CreateSection.tsx — AFTER:
<div className="hidden md:flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-card/30">
```

This creates the correct viewport behavior:

| Viewport | Mobile tabs (`lg:hidden`) | Desktop dropdown (`hidden md:flex`) | **Result** |
|----------|--------------------------|-------------------------------------|-----------|
| < 768px | ✅ Visible | ❌ Hidden | OK |
| 768px–1023px | ❌ Hidden | ✅ Visible | ✅ **Sources accessible** |
| ≥ 1024px | ❌ Hidden | ✅ Visible | OK |

Also update the `isSourcesOpen` click-outside overlay detection (line 156):

```tsx
// CreateSection.tsx — BEFORE:
<div className="hidden lg:block fixed inset-0 z-20"

// CreateSection.tsx — AFTER:
<div className="hidden md:block fixed inset-0 z-20"
```

---

## Files to Change

- `components/features/create/CreateSection.tsx` — Line 121: `hidden lg:flex` → `hidden md:flex`
- `components/features/create/CreateSection.tsx` — Line 156: `hidden lg:block` → `hidden md:block`

---

## New Files

None.

---

## Acceptance Criteria

- [ ] Sources panel dropdown toggle is visible at viewport ≥ 768px (md breakpoint)
- [ ] Sources panel is accessible on tablet (768px–1024px)
- [ ] Mobile tabs still hide at ≥ 1024px (lg breakpoint)
- [ ] No overlap or conflict between mobile tabs and desktop dropdown at any viewport
- [ ] Responsive behavior verified at: 375px, 768px, 1024px, 1280px, 1920px

---

## Rollback Plan

Simple string replacement: `hidden md:flex` → `hidden lg:flex` and `hidden md:block` → `hidden lg:block`. Revert both locations.

---

## Cross-Feature Notes

- The `lg:` breakpoint was likely chosen intentionally to match the Sidebar visibility breakpoint. Verify SlimSidebar hasn't been removed.
- This change also affects the Sources panel's `max-h-[220px]` in the dropdown — at tablet size, the panel may need more height. Monitor after implementation.
