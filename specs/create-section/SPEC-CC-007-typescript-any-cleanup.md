# SPEC-CC-007: Replace All `any` Types with Proper TypeScript Interfaces

> **Status**: Draft
> **Stack**: Next.js 14, React 18, TypeScript 5, shadcn/ui, Zustand, next-intl

---

## Problem

**10+ `any` types** exist across the create section's Zustand stores and components. This creates:
- **No type safety** — runtime errors from wrong data structures
- **No IntelliSense** — developers can't discover available properties
- **Hard to refactor** — changing a property name doesn't trigger compile errors

### Examples Found

```tsx
// sources.ts — AI prompt response typed as `any`
interface GeneratePostsResponse {
  posts: any[];                    // ← Should be PostContent[]
  metadata: any;                   // ← Should be GenerationMetadata
}

// PostEditorWrapper.tsx — props potentially typed as `any`
const handleMediaUpload = (files: any[]) => { ... }

// AIChatbox.tsx — message typed as `any`
const messages: any[] = [];
```

---

## Root Cause

1. Zustand store actions use `any` for complex nested state shapes
2. API response types from AI providers (Gemini, OpenAI) were left as `any`
3. Event handler types for media/files were simplified to `any`

---

## Solution

### Step 1: Define Shared Type Interfaces

Create `store/shared/types.ts`:

```typescript
// store/shared/types.ts

// ─── Platform Types ───
export type PlatformType =
  | 'tiktok' | 'instagram' | 'youtube'
  | 'facebook' | 'twitter' | 'threads'
  | 'linkedin' | 'pinterest';

export interface PlatformConfig {
  type: PlatformType;
  name: string;
  maxLength: number;
  supportsMedia: boolean;
  supportsHashtags: boolean;
  color: string;       // oklch value
  gradient: string;    // Tailwind gradient class
}

// ─── Post Types ───
export interface PostContent {
  id: string;
  platform: PlatformType;
  content: string;
  mediaUrls: string[];
  hashtags: string[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
  status: 'draft' | 'generated' | 'edited' | 'published' | 'failed';
}

export interface PostVersion {
  id: string;
  content: string;
  mediaUrls: string[];
  timestamp: Date;
}

// ─── Source Types ───
export type SourceType = 'text' | 'youtube' | 'tiktok' | 'article' | 'file';

export interface SourceContent {
  type: SourceType;
  text?: string;
  url?: string;
  fileName?: string;
  fileSize?: number;
}

export interface SavedSource {
  id: string;
  name: string;
  goal: string;
  niche: string;
  framework: string;
  content: SourceContent;
  createdAt: Date;
  updatedAt: Date;
}

// ─── AI Generation Types ───
export interface GenerationRequest {
  source: SourceContent;
  platforms: PlatformType[];
  countPerPlatform: number;
  model: string;
  framework: string;
  userIdea?: string;
}

export interface GenerationResult {
  posts: PostContent[];
  creditsUsed: number;
  generatedAt: Date;
  model: string;
}

export interface GenerationError {
  code: string;
  message: string;
  retryable: boolean;
}

// ─── AI Chat Types ───
export type AIModel = 'chatgpt' | 'gemini' | 'claude' | 'gpt-4' | 'gpt-4o' | 'o3' | 'o4-mini';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model: AIModel;
  actions?: AIAction[];
}

export interface AIAction {
  type: 'create_post' | 'edit_post' | 'suggest_improvement' | 'generate_image' | 'generate_video';
  payload: Record<string, unknown>;
}

// ─── Media Types ───
export interface MediaFile {
  id: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  thumbnailUrl?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}

// ─── Form Types ───
export interface SourceFormData {
  goal: string;
  niche: string;
  framework: string;
  idea: string;
  sourceType: SourceType;
  sourceUrl?: string;
  sourceFile?: File;
}

export interface PostConfigFormData {
  platforms: PlatformType[];
  countPerPlatform: Record<PlatformType, number>;
  model: AIModel;
}
```

### Step 2: Update Zustand Stores

```typescript
// Before — sources.ts
generateFromSource(source: any, platforms: any[], count: any, model: any) {
  const response: any = await callAPI({ source, platforms, count, model });
  // no type checking
}

// After — sources.ts
generateFromSource(source: SourceContent, platforms: PlatformType[], count: number, model: AIModel): Promise<GenerationResult> {
  const response = await callAPI<GenerationResult>({
    source,
    platforms,
    count,
    model
  });
  // full type safety
}
```

### Step 3: Update Components

```tsx
// Before — AIChatbox.tsx
const messages: any[] = [];

// After — AIChatbox.tsx
const messages: ChatMessage[] = [];

// Before — PostEditor.tsx
interface Props { posts: any[]; }

// After — PostEditor.tsx
interface Props { posts: PostContent[]; }
```

### Step 4: Replace Media Handler Types

```tsx
// Before
const handleMediaUpload = (files: any[]) => { ... }

// After
const handleMediaUpload = (files: File[]) => { ... }
```

---

## Files to Change

### New Files:
- `store/shared/types.ts` — All shared type definitions

### Existing Files:
- `store/useCreateSourcesStore.ts` — Add typed imports, replace `any`
- `store/useCreatePostsStore.ts` — Add typed imports, replace `any`
- `components/features/create/editor/PostEditor.tsx` — Add typed props
- `components/features/create/editor/PostEditorWrapper.tsx` — Add typed event handlers
- `components/features/create/chat/AIChatbox.tsx` — Add typed message array

---

## New Files

- `store/shared/types.ts`

---

## Acceptance Criteria

- [ ] `store/shared/types.ts` exports all interfaces used across create section
- [ ] `tsc --noEmit` returns **0 errors** with zero `any` usage
- [ ] All Zustand store actions have explicit return types
- [ ] All component props have explicit interfaces (no `any` in props)
- [ ] `grep -r ": any" components/features/create/ store/` returns 0 results
- [ ] VS Code / LSP shows type hints for all store properties
- [ ] API response shapes are typed (no `as any` assertions)

---

## Rollback Plan

1. Revert all changes to `store/shared/types.ts`
2. Revert store files to pre-spec commit
3. `tsc --noEmit` should pass (old code had 0 errors — only type safety was missing)
4. Type checking degrades back to `any` but no runtime breakage