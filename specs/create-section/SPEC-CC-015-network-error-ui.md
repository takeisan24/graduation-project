# SPEC-CC-015: Add Network Error Dedicated UI

> **Status**: Draft
> **Stack**: Next.js 14, React 18, TypeScript, Tailwind CSS v4, shadcn/ui, next-intl, Framer Motion

---

## Problem

When API calls fail completely (network timeout, server error), the app shows:
- **Option A**: An **indefinite loading spinner** — user doesn't know if it's loading or broken
- **Option B**: A **generic toast** — dismisses quickly, user may miss it

There is **no dedicated error state UI** with:
- Friendly error message
- Retry button
- Explanation of what went wrong
- Option to contact support

```
┌─────────────────────────────────┐
│   ❌                            │
│   Không thể kết nối             │
│                                 │
│   Kiểm tra kết nối mạng của bạn│
│   hoặc thử lại sau.             │
│                                 │
│   [Thử lại]    [Báo lỗi]       │
└─────────────────────────────────┘
```

---

## Root Cause

Error handling was implemented as toast notifications only. No dedicated ErrorBoundary or error state component exists in the Create Section.

---

## Solution

### Step 1: Create Error State Component

**New file: `components/features/create/shared/ErrorState.tsx`**

```tsx
// components/features/create/shared/ErrorState.tsx
"use client";

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Mail } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error | string;
  onRetry?: () => void;
  onReport?: () => void;
  variant?: 'inline' | 'card' | 'full';
  className?: string;
}

export default function ErrorState({
  title,
  description,
  error,
  onRetry,
  onReport,
  variant = 'card',
  className = '',
}: ErrorStateProps) {
  const t = useTranslations('CreatePage.createSection.errorState');

  const defaultTitle = title || t('defaultTitle');
  const defaultDescription = description || t('defaultDescription');

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg ${className}`}>
        <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
        <p className="text-sm text-destructive flex-1">{defaultDescription}</p>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} className="h-7 text-xs">
            <RefreshCw className="h-3 w-3 mr-1" />
            {t('retry')}
          </Button>
        )}
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center justify-center h-full min-h-[300px] gap-4 p-8 ${className}`}>
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-foreground">{defaultTitle}</h3>
          <p className="text-sm text-muted-foreground max-w-sm">{defaultDescription}</p>
          {error && (
            <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-2 rounded-lg">
              {typeof error === 'string' ? error : error.message}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onRetry && (
            <Button onClick={onRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {t('retry')}
            </Button>
          )}
          {onReport && (
            <Button variant="outline" onClick={onReport} className="gap-2">
              <Mail className="h-4 w-4" />
              {t('report')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Default: card variant
  return (
    <div className={`flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-xl ${className}`}>
      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{defaultTitle}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{defaultDescription}</p>
        {error && (
          <p className="text-xs text-muted-foreground/60 font-mono mt-1 truncate">
            {typeof error === 'string' ? error : error.message}
          </p>
        )}
        <div className="flex gap-2 mt-2">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="h-7 text-xs gap-1">
              <RefreshCw className="h-3 w-3" />
              {t('retry')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Create CreateSection Error Boundary

**New file: `components/features/create/shared/CreateSectionErrorBoundary.tsx`**

```tsx
// components/features/create/shared/CreateSectionErrorBoundary.tsx
"use client";

import { Component, ReactNode } from 'react';
import ErrorState from './ErrorState';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class CreateSectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[CreateSectionErrorBoundary]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <ErrorState
          variant="full"
          error={this.state.error}
          onRetry={this.handleRetry}
          title="Đã xảy ra lỗi"
          description="Một lỗi không mong muốn đã xảy ra trong phần tạo bài viết. Vui lòng thử lại."
        />
      );
    }

    return this.props.children;
  }
}
```

### Step 3: Integrate Error States

```tsx
// PostEditorWrapper.tsx — Add inline error state:
{isError && (
  <ErrorState
    variant="inline"
    error={error}
    onRetry={handleRetry}
    className="mx-[15px] mt-[15px]"
  />
)}

// CreateSection.tsx — Wrap editor area:
<CreateSectionErrorBoundary>
  <div className="relative z-0 h-full w-full">
    <PostEditorWrapper ... />
  </div>
</CreateSectionErrorBoundary>
```

### Step 4: Add i18n Keys

```json
{
  "CreatePage": {
    "createSection": {
      "errorState": {
        "defaultTitle": "Đã xảy ra lỗi",
        "defaultDescription": "Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.",
        "networkError": "Không thể kết nối. Kiểm tra kết nối mạng của bạn.",
        "serverError": "Máy chủ đang bận. Vui lòng thử lại sau.",
        "retry": "Thử lại",
        "report": "Báo lỗi"
      }
    }
  }
}
```

---

## Files to Change

### New Files:
- `components/features/create/shared/ErrorState.tsx` — Reusable error state component
- `components/features/create/shared/CreateSectionErrorBoundary.tsx` — React ErrorBoundary

### Existing Files:
- `components/features/create/editor/PostEditorWrapper.tsx` — Integrate ErrorState for API errors
- `components/features/create/CreateSection.tsx` — Wrap editor with ErrorBoundary
- `components/features/create/chat/AIChatbox.tsx` — Integrate ErrorState for chat API errors
- `messages/vi.json` — Add error state translations
- `messages/en.json` — Add error state translations

---

## New Files

- `components/features/create/shared/ErrorState.tsx`
- `components/features/create/shared/CreateSectionErrorBoundary.tsx`

---

## Acceptance Criteria

- [ ] When AI generation API fails, user sees `ErrorState` instead of indefinite spinner
- [ ] `ErrorState` shows friendly message with retry button
- [ ] Clicking "Thử lại" re-triggers the failed action
- [ ] Network errors show specific message ("Kiểm tra kết nối mạng")
- [ ] Server errors (500) show different message ("Máy chủ đang bận")
- [ ] If entire CreateSection crashes, ErrorBoundary shows fallback UI
- [ ] All text internationalized (vi + en)
- [ ] Error states use `destructive` color from design system

---

## Rollback Plan

1. Remove `ErrorState.tsx` and `CreateSectionErrorBoundary.tsx`
2. Remove ErrorBoundary wrapper from `CreateSection.tsx`
3. Revert error handling in components to toast-only approach
4. No broken state — rollback is safe
