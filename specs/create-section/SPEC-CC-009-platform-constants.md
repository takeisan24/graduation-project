# SPEC-CC-009: Create Platform Constants Single Source of Truth

> **Status**: Draft
> **Stack**: Next.js 14, React 18, TypeScript 5, shadcn/ui, next-intl

---

## Problem

The `platformOptions` array (defining all 8 supported social platforms) is **duplicated in 3 separate files** with slightly different shapes:

| Location | Shape |
|----------|-------|
| `SourceForm.tsx` | `Array<{ id, label, icon, maxLength }>` |
| `PostConfigurationForm.tsx` | `Array<{ type, name, maxLength }>` |
| `AIChatbox.tsx` | `Array<{ type, name }>` |

When a platform is added/removed or its properties change (e.g., new maxLength for Threads), **all 3 files must be updated manually** — creating inconsistency risk.

---

## Root Cause

No shared constants file existed when the components were built. Each component defined its own local array.

---

## Solution

### Step 1: Create `lib/constants/platforms.ts`

```typescript
// lib/constants/platforms.ts

import type { PlatformType } from '@/store/shared/types';

// ─── Platform Definitions ───
export interface PlatformDefinition {
  type: PlatformType;
  /** Display name for UI */
  name: string;
  /** short code for API/internal use */
  code: string;
  /** max character limit for posts */
  maxLength: number;
  /** does platform support media attachments? */
  supportsMedia: boolean;
  /** does platform support hashtags? */
  supportsHashtags: boolean;
  /** shadcn icon component name (from lucide-react) */
  iconName: string;
  /** CSS color token (oklch) */
  color: string;
  /** Tailwind gradient class for brand use */
  gradientClass: string;
  /** UTC brand color name for CSS variable */
  brandColorVar: string;
  /** URL to platform's icon (optional — for cards/avatars) */
  iconUrl?: string;
  /** default post count when selected */
  defaultCount: number;
}

export const PLATFORMS: PlatformDefinition[] = [
  {
    type: 'tiktok',
    name: 'TikTok',
    code: 'tiktok',
    maxLength: 2200,
    supportsMedia: true,
    supportsHashtags: true,
    iconName: 'Video',
    color: '#000000',
    gradientClass: 'bg-gradient-to-br from-black to-gray-800',
    brandColorVar: '--color-tiktok',
    defaultCount: 2,
  },
  {
    type: 'instagram',
    name: 'Instagram',
    code: 'instagram',
    maxLength: 2200,
    supportsMedia: true,
    supportsHashtags: true,
    iconName: 'Instagram',
    color: '#E1306C',
    gradientClass: 'bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600',
    brandColorVar: '--color-instagram',
    defaultCount: 2,
  },
  {
    type: 'youtube',
    name: 'YouTube',
    code: 'youtube',
    maxLength: 5000,
    supportsMedia: true,
    supportsHashtags: true,
    iconName: 'Youtube',
    color: '#FF0000',
    gradientClass: 'bg-gradient-to-r from-red-500 to-red-700',
    brandColorVar: '--color-youtube',
    defaultCount: 1,
  },
  {
    type: 'facebook',
    name: 'Facebook',
    code: 'facebook',
    maxLength: 63206,
    supportsMedia: true,
    supportsHashtags: true,
    iconName: 'Facebook',
    color: '#1877F2',
    gradientClass: 'bg-gradient-to-r from-blue-500 to-blue-700',
    brandColorVar: '--color-facebook',
    defaultCount: 1,
  },
  {
    type: 'twitter',
    name: 'X',
    code: 'twitter',
    maxLength: 280,
    supportsMedia: true,
    supportsHashtags: true,
    iconName: 'Twitter',
    color: '#000000',
    gradientClass: 'bg-black',
    brandColorVar: '--color-twitter',
    defaultCount: 3,
  },
  {
    type: 'threads',
    name: 'Threads',
    code: 'threads',
    maxLength: 500,
    supportsMedia: true,
    supportsHashtags: true,
    iconName: 'MessageCircle',
    color: '#000000',
    gradientClass: 'bg-gradient-to-br from-gray-800 to-gray-900',
    brandColorVar: '--color-threads',
    defaultCount: 2,
  },
  {
    type: 'linkedin',
    name: 'LinkedIn',
    code: 'linkedin',
    maxLength: 3000,
    supportsMedia: true,
    supportsHashtags: true,
    iconName: 'Linkedin',
    color: '#0A66C2',
    gradientClass: 'bg-gradient-to-r from-blue-600 to-blue-800',
    brandColorVar: '--color-linkedin',
    defaultCount: 1,
  },
  {
    type: 'pinterest',
    name: 'Pinterest',
    code: 'pinterest',
    maxLength: 500,
    supportsMedia: true,
    supportsHashtags: true,
    iconName: 'Pin',
    color: '#E60023',
    gradientClass: 'bg-gradient-to-r from-red-500 to-red-700',
    brandColorVar: '--color-pinterest',
    defaultCount: 2,
  },
];

// ─── Lookup Helpers ───
export const platformByType = Object.fromEntries(
  PLATFORMS.map(p => [p.type, p])
) as Record<PlatformType, PlatformDefinition>;

export const platformByCode = Object.fromEntries(
  PLATFORMS.map(p => [p.code, p])
) as Record<string, PlatformDefinition>;

// ─── Computed Helpers ───
export const PLATFORM_TYPES: PlatformType[] = PLATFORMS.map(p => p.type);

export const MAX_POST_LENGTH = Math.max(...PLATFORMS.map(p => p.maxLength));
```

### Step 2: Refactor Components to Import

```tsx
// PostConfigurationForm.tsx — BEFORE:
const platformOptions = [
  { type: 'tiktok', name: 'TikTok', maxLength: 2200 },
  { type: 'instagram', name: 'Instagram', maxLength: 2200 },
  // ... duplicate
];

// PostConfigurationForm.tsx — AFTER:
import { PLATFORMS } from '@/lib/constants/platforms';

// Use PLATFORMS directly
```

```tsx
// SourceForm.tsx — BEFORE:
const platformOptions = [
  { id: 'tiktok', label: 'TikTok', icon: Video, maxLength: 2200 },
  // ... duplicate
];

// SourceForm.tsx — AFTER:
import { PLATFORMS } from '@/lib/constants/platforms';

// Map to the shape needed by SourceForm
const sourceFormPlatforms = PLATFORMS.map(p => ({
  id: p.type,
  label: p.name,
  icon: p.iconName, // resolve lucide component
  maxLength: p.maxLength,
}));
```

### Step 3: Export from a Central Index

```typescript
// lib/constants/index.ts
export * from './platforms';
// Future exports: export * from './goals'; export * from './niches';
```

---

## Files to Change

### New Files:
- `lib/constants/platforms.ts` — Platform definitions + lookup helpers
- `lib/constants/index.ts` — Central export index

### Existing Files:
- `components/features/create/forms/SourceForm.tsx` — Replace local platformOptions with import
- `components/features/create/forms/PostConfigurationForm.tsx` — Replace local platformOptions with import
- `components/features/create/chat/AIChatbox.tsx` — Replace local platformOptions with import

---

## New Files

- `lib/constants/platforms.ts`
- `lib/constants/index.ts`

---

## Acceptance Criteria

- [ ] `lib/constants/platforms.ts` exports `PLATFORMS` array with all 8 platforms
- [ ] All 3 component files import from `lib/constants/platforms` instead of defining local arrays
- [ ] `grep -r "platformOptions" components/features/create/ | wc -l` returns 0 results (no local duplicates)
- [ ] `PLATFORMS.find(p => p.type === 'tiktok')` returns the TikTok platform definition
- [ ] All components render correctly (manual test)
- [ ] Adding a new platform only requires editing `lib/constants/platforms.ts`
- [ ] TypeScript compiles without errors

---

## Rollback Plan

1. Revert component files to pre-spec commit (restore local arrays)
2. Delete `lib/constants/platforms.ts` and `lib/constants/index.ts`
3. All components work with local arrays (no breaking change)

---

## Cross-Feature Notes

- `lib/constants/platforms.ts` can be imported in `store/shared/types.ts` for type consistency
- Consider adding `lib/constants/goals.ts` and `lib/constants/niches.ts` as a follow-up (Sprint 2)
- Platform colors should be added to `globals.css` under `@theme inline`:
  ```css
  --color-tiktok: #000000;
  --color-instagram: #E1306C;
  /* etc. */
  ```