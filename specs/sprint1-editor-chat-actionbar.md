# Sprint 1: Editor + Chat + ActionBar Polish

> **Status**: ✅ Implemented (2026-04-05)
> **Stack**: Next.js 14, TypeScript, Tailwind CSS v4, shadcn/ui, Zustand, next-intl

---

## Baseline (as-is)

- `AIChatbox.tsx`: message bubbles đã có user/AI style riêng, send button gradient, copy outline-on-hover ✅
- `TabsManager.tsx`: platform color indicator đáy tab, close btn on-hover ✅
- `PostEditor.tsx`: textarea focus ring `utc-royal` ✅
- `ActionBar.tsx`: Generate gradient btn, Format/Translate icon+text ✅

---

## S1-A: Editor Polish

**File**: `components/features/create/editor/PostEditor.tsx`

### A-1: Editor card — gradient top border khi active
```
Chỉnh: Card bao bọc editor
- Thêm: border-t-2 border-transparent
- Khi selectedPostId != 0: border-t-2 border-transparent → bg-gradient-to-r from-utc-royal to-utc-sky
```
→ Class: `border-t-2 border-transparent ${selectedPostId ? 'border-t-[3px] bg-gradient-to-r from-utc-royal/5 to-utc-sky/5' : ''}`

### A-2: Character counter — đổi màu theo threshold
```
Tính % = currentChar / charLimit
- < 80%: text-green-500
- 80-95%: text-yellow-500
- > 95%: text-red-500
```
→ Logic mới trong ActionBar.tsx (vì counter đang ở đó)

### A-3: Version navigation — gradient badge
```
Thay đổi: "v1/3" badge
- Background: bg-gradient-to-r from-utc-royal to-utc-sky
- Text: text-white
- Font: font-bold text-xs
```

---

## S1-B: AI Chatbox Polish

**File**: `components/features/create/chat/AIChatbox.tsx`

### B-1: AI message — thêm icon AI bên trái bubble
```
Trong AI message bubble (role === "assistant"):
- Thêm SparklesIcon hoặc Bot icon nhỏ (w-3.5 h-3.5) bên trái, phía trên content
- Màu: text-primary
- Cách: <SparklesIcon className="w-3.5 h-3.5 text-primary flex-shrink-0 mr-1.5 mt-0.5" />
```

### B-2: Model selector — gradient indicator cho model đang dùng
```
Thay đổi: button trong model selector header
- Mặc định: border border-border rounded-md px-2.5 py-1.5
- Active: bg-gradient-to-r from-utc-royal/10 to-utc-sky/10 border border-utc-royal/30
```

### B-3: Empty state strings — hardcoded → i18n
```
Kiểm tra: emptyState title, description, examplesTitle, example1/2/3, hint
→ Đảm bảo tất cả đã dùng t() keys
```

### B-4: Typing indicator — bỏ text, chỉ còn dots
```
Thay đổi: bỏ "{t('aiTyping')}" text
→ Chỉ hiện 3 dots animation (đã có rồi, verify)
```

---

## S1-C: ActionBar Polish

**File**: `components/features/create/editor/ActionBar.tsx`

### C-1: Buttons grouped bằng vertical separator
```
Thêm divider giữa các nhóm:
Nhóm 1 (Add Image + Generate + Format + Translate)
  | ← separator
Nhóm 2 (Clone + Save + Publish)

Separator: <div className="w-px h-6 bg-border mx-1" />
Lý do: Groups nên có visual boundary rõ ràng, không chỉ relying on spacing.
```

### C-2: Generate button — gradient nổi bật
```
Đã có: bg-gradient-to-r from-utc-royal to-utc-sky ✅
→ Verify đúng như spec
```

### C-3: Format/Translate — icon + text
```
Đã có icon + text ✅ (Wand2 + Languages, text label)
```

### C-4: Save/Publish — gradient accent
```
Thay đổi: Save btn
- Mặc định: border-primary text-foreground
- Save active: bg-primary/10 border-primary/50 text-primary

Thay đổi: Publish btn
- Đã gradient ✅ (from-utc-royal to-utc-sky)
→ Verify đúng
```

### C-5: Character counter — màu theo threshold
```
Thêm logic trong ActionBar:
const charCount = (postContents[selectedPostId] ?? "").length;
const charLimit = getCharLimit();
const pct = charCount / charLimit;
const color = pct > 0.95 ? 'text-red-500' : pct > 0.8 ? 'text-yellow-500' : 'text-green-500';

<span className={`text-xs text-muted-foreground tabular-nums ${color}`}>
  {charCount}/{charLimit} {t('characterCount')}
</span>
```

---

## S1-D: TabsManager Polish

**File**: `components/features/create/editor/TabsManager.tsx`

### D-1: Active tab — hybrid indicator (gradient / platform color)
```
Thay đổi: indicator theo chế độ collapsed/expanded

- Collapsed (icon-only, index >= 4): gradient brand
  <div className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-gradient-to-r from-utc-royal to-utc-sky`} />

- Expanded (full name, index < 4): giữ nguyên platform color
  <div className={`absolute bottom-0 left-1 right-1 h-[2px] rounded-full ${pColors.dot}`} />

Lý do: Collapsed mode mất platform name → dùng gradient brand thay thế. Expanded mode có không gian → giữ platform color tận dụng visual distinction.
```

### D-2: Tab close button — smooth transition
```
Đã có: opacity-0 group-hover:opacity-100 ✅
→ Thêm transition-all vào class
```

### D-3: Add platform button — dashed border + plus icon
```
Thay đổi: Button variant/outline
- Hiện tại: border-2 border-accent
- Mới: border-2 border-dashed border-primary/50 text-muted-foreground hover:border-primary hover:text-primary
→ Plus icon đã có ✅
```

---

## S1-E: Error States & Validation

### E-1: Chat API fail → styled error + retry
```
File: AIChatbox.tsx

→ Thêm AI error message bubble:
{role === 'assistant' && message.isError && (
  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl rounded-bl-sm p-3 flex items-start gap-2">
    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
    <p className="text-sm text-red-500 flex-1">{message.content}</p>
  </div>
)}

→ Retry button trên error bubble:
<button
  onClick={() => handleRetry(message.content)}
  className="text-xs text-red-400 hover:text-red-300 mt-1 flex items-center gap-1"
>
  <RefreshCw className="w-3 h-3" /> Thử lại
</button>

→ Retry logic:
const handleRetry = (content: string) => {
  // Gọi lại submitChat với nội dung message cũ, cùng model và options
  submitChat(content, selectedChatModel, options);
};

→ Store update: thêm optional field isError vào ChatMessage type
```

### E-2: Offline send → toast + không mất message
```
File: AIChatbox.tsx
→ Trong handleSend, check navigator.onLine:
if (!navigator.onLine) {
  toast.error(t('offlineError'));
  return;
}
```

### E-3: Empty editor → Save warning toast
```
File: ActionBar.tsx (Save Draft handler)
→ if (!content.trim()) { toast.warning(t('emptyContentWarning')); return; }
```

### E-4: Char limit exceeded → red border + toast
```
File: ActionBar.tsx
→ Trong shouldShowFormatButton hoặc khi char > limit:
- Textarea border → border-red-500
- Toast: toast.error(t('charLimitExceeded'))
```

### E-5: Copy fail → toast error
```
File: AIChatbox.tsx (handleCopyMessage)
→ try/catch around navigator.clipboard.writeText:
catch { toast.error(t('copyFailed')); }
```

---

## S1-F: Copy Review + i18n Audit

### F-1: Chat copy success toast
```
Đã có: t('copiedToClipboard') → "Đã copy!"
→ Verify key tồn tại trong cả vi.json và en.json
```

### F-2: Verify all hardcoded strings
```
Audit toàn bộ strings trong:
- AIChatbox.tsx (confirm dialog: "Xóa cuộc trò chuyện?", "Toàn bộ lịch sử chat...", "Xóa", "Hủy")
- TabsManager.tsx ("Thu gọn", tên platform labels)
- ActionBar.tsx (tất cả đã i18n ở Sprint 0)
```

### F-3: i18n keys mới cần thêm
```json
// vi.json + en.json
chatPanel:
  offlineError: "Không có kết nối mạng. Vui lòng thử lại."
  copyFailed: "Không thể sao chép. Vui lòng thử lại."
  charLimitExceeded: "Đã vượt quá giới hạn ký tự."
  emptyContentWarning: "Nội dung trống. Vui lòng nhập nội dung trước."
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `PostEditor.tsx` | Gradient top border, version badge gradient |
| `AIChatbox.tsx` | AI icon, model selector gradient, typing indicator, error states, i18n |
| `ActionBar.tsx` | Button separators, character counter colors, error toasts |
| `TabsManager.tsx` | Gradient tab indicator, dashed add button, i18n |
| `messages/vi.json` | Add E-series + F-3 keys |
| `messages/en.json` | Add E-series + F-3 keys |

---

## Verification

```bash
# 1. TypeScript — 0 errors
npx tsc --noEmit

# 2. i18n — all keys exist in both locales
node -e "
  const vi = JSON.parse(require('fs').readFileSync('messages/vi.json','utf8').replace(/^\uFEFF/,''));
  const en = JSON.parse(require('fs').readFileSync('messages/en.json','utf8').replace(/^\uFEFF/,''));
  const keys = ['offlineError','copyFailed','charLimitExceeded','emptyContentWarning'];
  keys.forEach(k => {
    const ok = vi.CreatePage.createSection.chatPanel[k] && en.CreatePage.createSection.chatPanel[k];
    console.log(ok ? '✅' : '❌', k);
  });
"

# 3. Manual QA — Sprint 1 checklist (from spec S6)
```
