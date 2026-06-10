# SPEC-CC-013: Fix Mobile Keyboard Covering Chat Input

> **Status**: Draft
> **Stack**: Next.js 14, React 18, TypeScript, Tailwind CSS v4, shadcn/ui

---

## Problem

On mobile devices, when the AI Chat input textarea is focused, the **onscreen keyboard may cover the input field**, forcing the user to dismiss the keyboard to see what they're typing:

```
┌─────────────────────────────────┐
│                                 │
│   Chat messages                  │
│   (visible above keyboard)       │
│                                 │
├─────────────────────────────────┤ ← Viewport bottom
│   [Keyboard covers here]        │
│   [User can't see input]        │
└─────────────────────────────────┘
```

---

## Root Cause

The `AIChatbox.tsx` textarea doesn't use `scrollIntoView()` or any behavior to ensure the input is visible when focused on mobile.

---

## Solution

Add `scrollIntoView` behavior when the chat textarea is focused:

```tsx
// AIChatbox.tsx — BEFORE:
<textarea
  value={input}
  onChange={(e) => setInput(e.target.value)}
  onFocus={() => setIsFocused(true)}
  onBlur={() => setIsFocused(false)}
  placeholder={t('placeholder')}
  rows={1}
  className="..."
/>

// AIChatbox.tsx — AFTER:
import { useRef } from 'react';

const textareaRef = useRef<HTMLTextAreaElement>(null);

const handleInputFocus = () => {
  setIsFocused(true);
  // Smooth scroll the input into view on mobile
  textareaRef.current?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });
};

const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
};

return (
  <textarea
    ref={textareaRef}
    value={input}
    onChange={(e) => setInput(e.target.value)}
    onFocus={handleInputFocus}
    onBlur={() => setIsFocused(false)}
    onKeyDown={handleInputKeyDown}
    placeholder={t('placeholder')}
    rows={1}
    className="..."
  />
);
```

Also add CSS `scroll-padding-bottom` to ensure proper behavior:

```tsx
// AIChatbox.tsx container — ensure smooth scroll behavior
<div className="flex flex-col h-full scroll-smooth">
  <div className="flex-1 overflow-y-auto scroll-smooth">
    {/* Messages */}
  </div>
  {/* Input pinned to bottom */}
  <div ref={textareaRef} className="flex-shrink-0 p-3 border-t border-border/50">
    <textarea ... />
  </div>
</div>
```

**Important**: Add `scroll-padding-bottom` to the chat container to prevent the keyboard from overlapping:

```css
/* In the component or globals.css */
.chat-container {
  scroll-padding-bottom: env(keyboard-inset-height, 16px);
}
```

---

## Files to Change

- `components/features/create/chat/AIChatbox.tsx` — Add `scrollIntoView` + ref

---

## New Files

None.

---

## Acceptance Criteria

- [ ] On mobile (iOS Safari, Android Chrome), focusing the chat textarea scrolls the input into view
- [ ] Input is visible above the onscreen keyboard
- [ ] Smooth scroll animation (not jarring snap)
- [ ] No layout overflow when keyboard is dismissed
- [ ] Works on iOS and Android devices
- [ ] Chat messages above the input remain visible when keyboard is open

---

## Rollback Plan

Remove the `ref`, `handleInputFocus` function, and `onFocus` prop from the textarea. The textarea will revert to default browser behavior.

---

## Testing Note

**Manual testing required** — automated Playwright tests can't reliably simulate mobile keyboard behavior. Test on:
- iOS Safari (iPhone)
- Android Chrome (Samsung, Pixel)
- Android WebView (if app is embedded)
