# SPEC-CC-011: Add React.memo + useCallback to Key Components

> **Status**: Draft
> **Stack**: Next.js 14, React 18, TypeScript 5, Zustand

---

## Problem

Three key components (`PostEditor`, `TabsManager`, `SourcePanel`) are **not memoized**, causing unnecessary re-renders on every parent state change:

```tsx
// PostEditor.tsx — NO MEMO
export default function PostEditor({ ... }) { ... }

// TabsManager.tsx — NO MEMO
export default function TabsManager({ ... }) { ... }

// SourcePanel.tsx — NO MEMO
export default function SourcePanel({ ... }) { ... }
```

These components re-render when:
- `CreateSection.tsx` re-renders (wizard state, mobile panel state)
- `wizardStep` changes in the navigation store
- `isSourcesOpen` state changes

---

## Root Cause

Components were built without performance optimization. No `React.memo` or `useCallback` was used during initial development.

---

## Solution

### Step 1: Wrap Components with React.memo

```tsx
// PostEditor.tsx — BEFORE:
export default function PostEditor({ posts, onSelect, onOpenSources }: PostEditorProps) {
  return <div>...</div>;
}

// PostEditor.tsx — AFTER:
import { memo, useCallback } from 'react';

const PostEditor = memo(function PostEditor({ posts, onSelect, onOpenSources }: PostEditorProps) {
  return <div>...</div>;
});

export default PostEditor;
```

### Step 2: Use useCallback for Event Handlers

```tsx
// PostEditor.tsx — AFTER (with useCallback):
const PostEditor = memo(function PostEditor({ posts, onSelect, onOpenSources }: PostEditorProps) {
  const handleTabChange = useCallback((postId: string) => {
    onSelect(postId);
  }, [onSelect]);

  const handleOpenSources = useCallback(() => {
    onOpenSources();
  }, [onOpenSources]);

  // ...
});
```

### Step 3: Memoize Static Props

```tsx
// PostEditorWrapper.tsx — BEFORE:
<PostEditor
  posts={posts}
  onSelect={handleSelect}
  onOpenSources={() => setIsSourcesOpen(true)}
/>

// PostEditorWrapper.tsx — AFTER (with useCallback for inline):
const handleOpenSources = useCallback(() => {
  setIsSourcesOpen(true);
}, []);

const stablePosts = useMemo(() => posts, [posts]);

<PostEditor
  posts={stablePosts}
  onSelect={handleSelect}
  onOpenSources={handleOpenSources}
/>
```

### Step 4: TabsManager Optimization

```tsx
// TabsManager.tsx — AFTER:
import { memo, useCallback } from 'react';

const TabItem = memo(function TabItem({ platform, isActive, onClick }: TabItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn('px-3 py-1.5 text-xs font-medium transition-colors', ...)}
    >
      {platform}
    </button>
  );
});

const TabsManager = memo(function TabsManager({ tabs, activeTab, onTabChange }: TabsManagerProps) {
  const handleChange = useCallback((tabId: string) => {
    onTabChange(tabId);
  }, [onTabChange]);

  return (
    <div className="flex gap-1">
      {tabs.map(tab => (
        <TabItem
          key={tab.id}
          platform={tab.platform}
          isActive={tab.id === activeTab}
          onClick={() => handleChange(tab.id)}
        />
      ))}
    </div>
  );
});
```

---

## Files to Change

- `components/features/create/editor/PostEditor.tsx` — Add `React.memo` + `useCallback`
- `components/features/create/editor/TabsManager.tsx` — Add `React.memo` + `useCallback` + memoize `TabItem`
- `components/features/create/sources/SourcePanel.tsx` — Add `React.memo` + `useCallback`
- `components/features/create/editor/PostEditorWrapper.tsx` — Add `useMemo` for stable props

---

## New Files

None.

---

## Acceptance Criteria

- [ ] All 3 components wrapped with `React.memo`
- [ ] All inline arrow functions in JSX replaced with `useCallback` variables
- [ ] No re-render of `PostEditor` when `CreateSection.tsx` re-renders for unrelated state
- [ ] No re-render of `TabsManager` when only one tab's content changes
- [ ] No re-render of `SourcePanel` when chat state changes
- [ ] Use React DevTools Profiler to verify: opening/closing chat panel should NOT re-render PostEditor
- [ ] `tsc --noEmit` passes with no errors

---

## Rollback Plan

Remove `React.memo()` wrapper and `useCallback` calls. The components work correctly without memoization — this is a pure performance optimization with no behavioral change.
