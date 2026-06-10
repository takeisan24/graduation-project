# SPEC-CC-006: Fix All Hardcoded Vietnamese Strings (i18n Violation)

> **Status**: Draft → Updated after accurate audit
> **Stack**: Next.js 14, React 18, TypeScript, Tailwind CSS v4, shadcn/ui, next-intl

---

## Problem

Hardcoded Vietnamese strings exist across 5 component files in the Create Section, violating the MEMORY.md requirement that all UI text MUST use i18n (vi.json + en.json).

> **IMPORTANT — SPEC UPDATE**: Credits system has been removed. The 67-string estimate from the initial audit was inflated. This spec reflects the **actual accurate count** found via grep + code review.

---

## Accurate Audit Results

After reading all component files and grepping for Vietnamese patterns, here is the **precise inventory**:

### `ActionBar.tsx` — 6 user-facing hardcoded strings

| # | Line | Current | Key | Notes |
|---|------|---------|-----|-------|
| 1 | 138 | `title="Tín dụng AI còn lại"` | REMOVE | Credits badge removed per user decision |
| 2 | 245 | `title="Tự động định dạng lại bài viết cho đẹp mắt"` | `actionBar.formatTitle` | |
| 3 | 250 | `Đang sửa...` | `actionBar.formatting` | Inside Format button |
| 4 | 255 | `Format` | `actionBar.format` | Inside Format button |
| 5 | 269 | `title="Dịch bài viết"` | `actionBar.translateTitle` | |
| 6 | 274 | `Đang dịch...` | `actionBar.translating` | Inside Translate button |
| 7 | 279 | `Translate` | `actionBar.translate` | Inside Translate button |
| 8 | 353 | `Chọn ngôn ngữ đích` | `actionBar.selectTargetLanguage` | Dialog title |
| 9 | 355 | `Bạn muốn dịch bài viết sang ngôn ngữ nào?` | `actionBar.translatePrompt` | Dialog description |
| 10 | 357 | `Chi phí: 1 Credit` | `actionBar.translationCost` | ⚠️ Credit removed — update to just show "1 Credit" as text |
| 11 | 368 | `Tiếng Việt` | `actionBar.vietnamese` | In language select |
| 12 | 384 | `Hủy` | `actionBar.cancel` | Dialog cancel button |
| 13 | 393 | `Dịch ngay` | `actionBar.translateNow` | Dialog confirm button |

> **Note**: Lines 14-18 (`Tiếng Anh`, `Tiếng Nhật`, etc.) are inside `<option>` elements with **already-correct i18n** keys — those use `{t('lang-en')}` etc. from a different namespace. Verify with `grep "Tiếng"`.

**Total ActionBar**: ~13 strings (1 removed with credits badge, 12 confirmed)

---

### `SourceModal.tsx` — 7 user-facing hardcoded strings

| # | Line | Current | Key | Notes |
|---|------|---------|-----|-------|
| 1 | 70 | `Văn bản: ${sourceValue}` | `sourceModal.textLabel` | Dynamic — needs interpolation |
| 2 | 73 | `Đang tải lên file ${selectedFile.name}...` | `sourceModal.uploadingFile` | Dynamic — needs interpolation |
| 3 | 83 | `'Upload file PDF thất bại.'` | `sourceModal.uploadFailed` | |
| 4 | 108 | `Đã thêm nguồn "${sourceType}" thành công!` | `sourceModal.sourceAdded` | toast message |
| 5 | 139 | `Chỉnh sửa nguồn` | `sourceModal.editSource` | Modal title |
| 6 | 168 | `{selectedSourceType === 'text' ? 'Văn bản' : 'URL'}` | `sourceModal.inputTypeLabel` | Dynamic label |
| 7 | — | `Thêm` button text | `sourceModal.add` | Button label |

**Total SourceModal**: ~7 strings confirmed

---

### `SourceForm.tsx` — 8 hardcoded strings (validation + fallback)

| # | Line | Current | Key | Notes |
|---|------|---------|-----|-------|
| 1 | 189 | `t('errors.pleaseEnterText') \|\| 'Vui lòng nhập mô tả ý tưởng của bạn'` | `actionBar.errors.pleaseEnterText` | ⚠️ `||` fallback is violation |
| 2 | 195 | `t('errors.pleaseEnterUrl') \|\| 'Vui lòng nhập URL YouTube'` | `actionBar.errors.pleaseEnterUrl` | ⚠️ `||` fallback |
| 3 | 198 | `'Link không hợp lệ. Vui lòng nhập link video cụ thể...'` | `actionBar.errors.invalidYoutubeLink` | |
| 4 | 203 | `'Vui lòng nhập URL TikTok'` | `actionBar.errors.pleaseEnterTiktok` | |
| 5 | 206 | `'Link TikTok không hợp lệ...'` | `actionBar.errors.invalidTiktokLink` | |
| 6 | 211 | `'Vui lòng nhập URL bài viết'` | `actionBar.errors.pleaseEnterArticleUrl` | |
| 7 | 214 | `'Đây có vẻ là link mạng xã hội...'` | `actionBar.errors.socialLinkWarning` | |
| 8 | — | Input placeholder for URL fields | `actionBar.errors.pleaseEnterUrl` | |

> **Note**: Many validation strings are already in `t('errors.X')` but use `|| 'hardcoded fallback'` — that's the violation pattern. Fix: remove the `||` fallback entirely.

**Total SourceForm**: ~8 strings (all are error fallbacks)

---

### `PublishModal.tsx` — 6 hardcoded strings

| # | Line | Current | Key | Notes |
|---|------|---------|-----|-------|
| 1 | 322 | `Đăng dưới hình thức Shorts` | `publishModal.shortsLabel` | Checkbox label |
| 2 | 351 | `Chọn thời gian` | `publishModal.selectTime` | Date picker label |
| 3 | 355 | `Ngày` | `publishModal.dateLabel` | |
| 4 | 360 | `{selectedDate.toLocaleDateString('vi-VN', {...})}` | `publishModal.dateFormat` | ⚠️ Hardcoded `vi-VN` locale |
| 5 | 97 | `{t('publishNow')}` | — | ✅ Already i18n'd |
| 6 | 98 | `{t('nextFreeSlot')}` | — | ✅ Already i18n'd |
| 7 | 99 | `{t('pickTime')}` | — | ✅ Already i18n'd |

> **Critical**: `toLocaleDateString('vi-VN', ...)` — this MUST use `useLocale()` instead of hardcoded `'vi-VN'`.

**Total PublishModal**: ~4 strings confirmed + 1 critical vi-VN fix

---

### `AIChatbox.tsx` — 2 hardcoded strings

| # | Line | Current | Key | Notes |
|---|------|---------|-----|-------|
| 1 | 201 | `title="Tạo cuộc trò chuyện mới"` | `chatPanel.newChatTitle` | |
| 2 | 298 | `title="Sao chép nội dung này để Format"` | `chatPanel.copyToFormat` | |

> **Good news**: Most AIChatbox strings already use `t('chatPanel.X')` ✅

**Total AIChatbox**: ~2 strings confirmed

---

### `PostEditor.tsx` — 0 user-facing hardcoded strings

All confirmed text uses `t()`:
- `{t('or')}` ✅
- `{t('versionHistory', { defaultMessage: 'Lịch sử chỉnh sửa AI' })}` ✅

**Total PostEditor**: 0 strings

---

### `PostConfigurationForm.tsx` — 2 hardcoded strings

| # | Line | Current | Key | Notes |
|---|------|---------|-----|-------|
| 1 | 199 | `bài` | `postConfig.postUnit` | Already noted in SPEC-CC-003 |
| 2 | 216 | `Credits` | REMOVE | Credits display removed per SPEC-CC-003 |

**Total PostConfigurationForm**: ~1 string confirmed (credits removed)

---

## Summary — Actual Count

| File | Hardcoded Strings | Notes |
|------|-----------------|-------|
| `ActionBar.tsx` | **~12** | Credits badge removed (1 gone) |
| `SourceModal.tsx` | **~7** | All user-facing text |
| `SourceForm.tsx` | **~8** | `||` fallback violations |
| `PublishModal.tsx` | **~4 + 1 vi-VN** | Locale fix critical |
| `AIChatbox.tsx` | **~2** | Only 2 tooltips |
| `PostEditor.tsx` | **0** | Already clean |
| `PostConfigurationForm.tsx` | **~1** | Credits removed |
| **TOTAL** | **~34 strings** | Down from 67 (agent overcounted) |

---

## Solution — Fix Each File

### Fix `|| 'hardcoded'` Pattern (SourceForm.tsx)

```tsx
// BEFORE (violation):
return t('errors.pleaseEnterText') || 'Vui lòng nhập mô tả ý tưởng của bạn';

// AFTER (correct):
return t('errors.pleaseEnterText');
```

next-intl's `useTranslations` already falls back to the key name if missing — no explicit fallback needed.

### Fix `vi-VN` Locale (PublishModal.tsx)

```tsx
// BEFORE (violation):
{selectedDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}

// AFTER (correct):
{selectedDate.toLocaleDateString(useLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' })}
```

### Fix Translation Keys Needed

```json
{
  "CreatePage": {
    "createSection": {
      "actionBar": {
        "formatTitle": "Tự động định dạng lại bài viết cho đẹp mắt",
        "formatting": "Đang sửa...",
        "format": "Format",
        "translateTitle": "Dịch bài viết",
        "translating": "Đang dịch...",
        "translate": "Dịch",
        "selectTargetLanguage": "Chọn ngôn ngữ đích",
        "translatePrompt": "Bạn muốn dịch bài viết sang ngôn ngữ nào?",
        "translationCost": "1 Credit",
        "vietnamese": "Tiếng Việt",
        "cancel": "Hủy",
        "translateNow": "Dịch ngay"
      },
      "errors": {
        "pleaseEnterText": "Vui lòng nhập mô tả ý tưởng của bạn",
        "pleaseEnterUrl": "Vui lòng nhập URL",
        "invalidYoutubeLink": "Link không hợp lệ. Vui lòng nhập link video cụ thể (VD: youtube.com/watch?v=... hoặc youtu.be/...)",
        "pleaseEnterTiktok": "Vui lòng nhập URL TikTok",
        "invalidTiktokLink": "Link TikTok không hợp lệ. Vui lòng nhập URL TikTok hợp lệ.",
        "pleaseEnterArticleUrl": "Vui lòng nhập URL bài viết",
        "socialLinkWarning": "Đây có vẻ là link mạng xã hội hoặc video. Vui lòng dán link bài viết."
      },
      "sourceModal": {
        "textLabel": "Văn bản",
        "uploadingFile": "Đang tải lên file {fileName}...",
        "uploadFailed": "Upload file thất bại. Vui lòng thử lại.",
        "sourceAdded": "Đã thêm nguồn {type} thành công!",
        "editSource": "Chỉnh sửa nguồn",
        "inputTypeLabel": "Văn bản",
        "add": "Thêm"
      },
      "publishModal": {
        "shortsLabel": "Đăng dưới hình thức Shorts",
        "selectTime": "Chọn thời gian",
        "dateLabel": "Ngày"
      },
      "chatPanel": {
        "newChatTitle": "Tạo cuộc trò chuyện mới",
        "copyToFormat": "Sao chép nội dung này"
      },
      "postConfig": {
        "postUnit": "bài"
      }
    }
  }
}
```

### Add ESLint Rule (CI/CD Prevention)

```js
// .eslintrc.json
{
  "rules": {
    "no-restricted-patterns": [
      "error",
      {
        "message": "Hardcoded Vietnamese fallback in t() call. Remove || 'hardcoded' pattern — next-intl handles missing keys.",
        "selector": "CallExpression[callee.name='t'] > LogicalExpression[operator='||']"
      }
    ]
  }
}
```

---

## Files to Change

- `components/features/create/editor/ActionBar.tsx` — ~12 strings → i18n
- `components/features/create/modals/SourceModal.tsx` — ~7 strings → i18n
- `components/features/create/forms/SourceForm.tsx` — ~8 strings → remove `||` fallbacks + i18n
- `components/features/create/modals/PublishModal.tsx` — ~4 strings → i18n + fix `vi-VN`
- `components/features/create/chat/AIChatbox.tsx` — ~2 strings → i18n
- `components/features/create/forms/PostConfigurationForm.tsx` — ~1 string → i18n (credits removed)
- `messages/vi.json` — Add all ~40 missing keys
- `messages/en.json` — Add all ~40 English equivalents

---

## New Files

None.

---

## Acceptance Criteria

- [ ] **0 hardcoded Vietnamese strings** visible to users in create section
- [ ] `grep -r "|| '" components/features/create/` returns 0 results (no `|| 'fallback'` pattern)
- [ ] `toLocaleDateString(useLocale(), ...)` replaces `toLocaleDateString('vi-VN', ...)` in PublishModal
- [ ] `vi.json` and `en.json` both contain all ~40 new keys
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] `npm run lint` passes with 0 errors

---

## Rollback Plan

1. Revert all component files to pre-spec commit
2. Restore `messages/vi.json` and `messages/en.json`
3. Run `npm run dev` — no broken renders
