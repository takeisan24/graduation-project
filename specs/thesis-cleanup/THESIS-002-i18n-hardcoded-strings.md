# THESIS-002: Complete i18n Hardcoded Strings

> **Status**: Draft
> **Stack**: Next.js 14, next-intl, React

## Overview

**Goal**: Replace all remaining hardcoded Vietnamese strings with `useTranslations()` calls across the Create section.
**Trigger**: Graduation thesis audit found ~34 hardcoded strings remaining in ActionBar, SourceModal, SourceForm, PublishModal, AIChatbox.
**Users affected**: End users (all UI text must be translatable)

---

## Acceptance Criteria

- [ ] All user-facing strings in `ActionBar.tsx` use `useTranslations()`
- [ ] All user-facing strings in `SourceModal.tsx` use `useTranslations()`
- [ ] All user-facing strings in `SourceForm.tsx` use `useTranslations()`
- [ ] All user-facing strings in `PublishModal.tsx` use `useTranslations()`
- [ ] All user-facing strings in `AIChatbox.tsx` use `useTranslations()`
- [ ] All new translation keys added to `messages/vi.json` AND `messages/en.json`
- [ ] `npm run build` passes with 0 errors
- [ ] No string literals (Vietnamese or English) appear directly in JSX text content

---

## S1: Error States & Validation

| Scenario | Expected Behavior |
|----------|-------------------|
| New key not added to both vi.json and en.json | English fallback shows missing key warning, app still works |
| Key added to wrong nesting level | `t('key')` returns undefined → show as blank → caught in QA |
| `||` fallback pattern like `t('key') \|\| 'hardcoded'` | Hardcoded always wins when t() returns empty string → remove fallback |

---

## S2: Post-Completion Flow

| Event | Result |
|-------|--------|
| All strings migrated | User can switch language, all text updates |
| Missing key in en.json | English text falls back to Vietnamese (next-intl behavior) |
| Missing key in both | Empty string shown → must be caught in QA |

---

## S3: Cross-Feature Integration

| When This Happens | Other Features | Effect |
|-------------------|---------------|--------|
| New keys added to messages/ | App-wide reload needed | No runtime breakage |
| SourceModal labels changed | SourceForm, CreateSection | Text changes cascade |
| AIChatbox tooltips changed | AIChatbox, CreateSection | Text changes cascade |

**Shared state**: `messages/vi.json` and `messages/en.json` — both must be updated atomically

---

## S4: Copy Review

- [ ] All Vietnamese strings reviewed for proper tone (formal, professional)
- [ ] All English strings reviewed (no machine-translation artifacts)
- [ ] Error messages use plain language
- [ ] No developer jargon in user-facing text
- [ ] No hardcoded "2025", year-specific references unless intentional

---

## S5: State & Persistence Matrix

| Data | Stored Where | Persists After Refresh? | Cleared When |
|------|-------------|------------------------|--------------|
| Translation keys | `messages/vi.json`, `messages/en.json` | Yes (JSON files) | Manual edit |
| Hardcoded string removal | Source files (.tsx) | Yes | Manual edit |

---

## S6: Manual QA Scenarios

- [ ] Toggle locale between Vietnamese and English → all text changes accordingly
- [ ] SourceModal: open modal → all labels/toasts in current locale
- [ ] ActionBar: hover tooltips → all show correct text
- [ ] PublishModal: date/time labels → locale-aware formatting
- [ ] AIChatbox: button labels → in current locale
- [ ] `npm run build` → 0 errors
- [ ] `npm run lint` → 0 errors in modified files

---

## Implementation Notes

**Pattern to eliminate:**
```tsx
// ❌ BAD — hardcoded fallback bypasses i18n
t('errors.pleaseEnterText') || 'Vui lòng nhập mô tả ý tưởng của bạn'

// ✅ GOOD — just use the translation key
t('errors.pleaseEnterText')
```

**Pattern to eliminate:**
```tsx
// ❌ BAD — locale hardcoded
.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })

// ✅ GOOD — use Intl.DateTimeFormat with locale from next-intl
new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' })
```

**File-specific inventory (audit result):**

| File | Count | Type |
|------|-------|------|
| `ActionBar.tsx` | ~12 | Tooltips, labels |
| `SourceModal.tsx` | ~7 | Modal text, toasts |
| `SourceForm.tsx` | ~8 | Error messages, placeholders |
| `PublishModal.tsx` | ~4 + locale | Date format, labels |
| `AIChatbox.tsx` | ~2 | Tooltips |
