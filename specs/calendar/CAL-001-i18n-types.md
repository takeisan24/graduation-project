# CAL-001: i18n + Type Safety — Calendar Section

> **Status**: Draft
> **Stack**: Next.js 14, React 18, TypeScript, Tailwind CSS v4, shadcn/ui, next-intl, Zustand

## Overview

**Goal**: Fix all hardcoded Vietnamese strings and type safety violations in Calendar components, leveraging existing `ConfirmModal` (shared) base component instead of creating new hardcoded modals.
**Trigger**: User navigates to Calendar section.
**Users affected**: All users (i18n impacts all locales; type safety impacts developer experience).

---

## Background

### Existing ConfirmModal Inventory

| Component | File | Props | i18n | Status |
|-----------|------|-------|------|--------|
| `ConfirmModal` | `components/shared/ConfirmModal.tsx` | `title`, `description`, `confirmText`, `cancelText`, `variant` | ✅ Full props | **Base component — USE THIS** |
| `ConfirmDeleteModal` | `components/features/create/calendar/ConfirmDeleteModal.tsx` | None (hardcoded) | ❌ Hardcoded VN | **Migrate → ConfirmModal** |
| `ConfirmDeleteFailedPostModal` | `components/features/create/failed/ConfirmDeleteFailedPostModal.tsx` | None (hardcoded) | ❌ Hardcoded VN | **Migrate → ConfirmModal** |

### Violations Found

| # | File | Violation | Severity |
|---|------|-----------|----------|
| V1 | `ConfirmDeleteModal.tsx` | Hardcoded: "Xác nhận xóa?", "Bạn có chắc...", "Không", "Xóa" | 🔴 High |
| V2 | `ConfirmDeleteModal.tsx` | Props interface defines `deleteModal.title/message` in i18n but component accepts **zero props** | 🔴 High |
| V3 | `ConfirmDeleteModal.tsx` | `deleteModal.no` key exists in `vi.json`/`en.json` but **never used** | 🟡 Medium |
| V4 | `CalendarToolbar.tsx` | `getWeekRangeLabel()` hardcoded date format `"${d}/${m}"` — no `Intl.DateTimeFormat` | 🔴 High |
| V5 | `CalendarSection.tsx` | `getNoteTextWithT` — case `'yellow'` fallback `t('empty')` inconsistent with semantic (`'yellow'` = scheduled) | 🟠 Low |
| V6 | `store/shared/calendar.ts` | `status: 'Trống'` hardcoded string — should use constant | 🟠 Low |
| V7 | `WeeklyViewGrid.tsx` | `weekDays` map uses `getDate()`, `getMonth()`, `getFullYear()` — no timezone handling | 🟠 Low |

---

## Acceptance Criteria

- [ ] `ConfirmDeleteModal` (Calendar) is **removed** — replaced by inline `ConfirmModal` usage
- [ ] `ConfirmDeleteFailedPostModal` (FailedSection) is **removed** — replaced by inline `ConfirmModal` usage
- [ ] `getWeekRangeLabel()` uses `Intl.DateTimeFormat` with locale from `next-intl`
- [ ] All 7 violations fixed (V1–V7)
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] `npm run lint` passes with 0 errors
- [ ] i18n keys in `messages/vi.json` and `messages/en.json` match exactly what components consume

---

## S1: Error States & Validation

| Scenario | Expected Behavior |
|----------|------------------|
| i18n key missing | `next-intl` falls back to key name — no crash, text shows as `"CreatePage.calendarSection.deleteModal.title"` |
| Invalid date in `getWeekRangeLabel()` | Returns `"--"` placeholder |
| `calendarEvents` from localStorage corrupted | `loadFromLocalStorage` catches error, returns `{}`, no crash |
| API returns invalid status | `normalizeLateLifecycleStatus` falls back to `'scheduled'` |
| `supabaseClient.auth.getSession()` returns null | Toast error `"Bạn cần đăng nhập"`, operation blocked |

---

## S2: Post-Completion Flow

| Event | Result |
|-------|--------|
| ConfirmDeleteModal removed | Calendar deletion uses `ConfirmModal` — same UX, now i18n |
| `getWeekRangeLabel()` updated | Week range shows in user locale (VD: "4/4 - 10/4" vi, "4/4 - 10/4" en) |
| Type safety improved | Refactoring Calendar components — TypeScript catches type errors at compile time |
| Page refresh | Calendar state persists in localStorage — no data loss |

---

## S3: Cross-Feature Integration

| When This Happens | This Feature | Triggers / Updates |
|-------------------|-------------|-------------------|
| FailedSection uses `ConfirmModal` | `ConfirmDeleteFailedPostModal` removed | Delete failed post → same `ConfirmModal` with `variant="danger"` |
| `ConfirmModal` shared across features | Single source of truth | All confirm dialogs now use same component |
| `getWeekRangeLabel()` locale-aware | CalendarToolbar | Weekly view label adapts to user locale |
| `useShallow` in CalendarSection | Calendar state subscription | Only re-renders when relevant fields change |

**Shared state**: `useCalendarStore` — shared across CalendarSection, statusCheck.ts, published/failed stores
**Empty state**: N/A for this spec (handled in CAL-003)
**Cleanup**: Deleted `ConfirmDeleteModal.tsx` and `ConfirmDeleteFailedPostModal.tsx` files — no orphan references

---

## S4: Copy Review

- [ ] All user-facing text in Calendar components uses `t('CreatePage.calendarSection.X')`
- [ ] ConfirmModal text: `"Xác nhận xóa?"` → `t('CreatePage.calendarSection.deleteModal.title')`
- [ ] ConfirmModal description: `"Bạn có chắc..."` → `t('CreatePage.calendarSection.deleteModal.message')`
- [ ] ConfirmModal cancel: `"Không"` → `t('CreatePage.calendarSection.deleteModal.no')` (key already exists)
- [ ] ConfirmModal confirm: `"Xóa"` → `t('CreatePage.calendarSection.deleteModal.yes')` (add key)
- [ ] `getWeekRangeLabel()`: locale-aware formatting
- [ ] No hardcoded `'Trống'` — use `CALENDAR_STATUS.EMPTY` constant
- [ ] Error messages use plain language, no developer jargon in user-facing text

---

## S5: State & Persistence Matrix

| Data | Stored Where | Persists After Refresh? | Cleared When |
|------|-------------|------------------------|--------------|
| `calendarEvents` | Zustand store → localStorage | ✅ Yes | Logout / `handleClearCalendarEvents()` |
| Calendar view (month/week) | Component `useState` | ❌ No | Section unmount |
| Week navigation (`currentWeekStart`) | Component `useState` | ❌ No | Section unmount |
| Popup state (`popup`, `eventToDelete`) | Component `useState` | ❌ No | Modal close / section unmount |
| Deleted confirm modal files | N/A — removed | ❌ N/A | N/A |

---

## S6: Manual QA Scenarios

- [ ] **Calendar delete event (mouse)**: Click event → popup opens → click delete → `ConfirmModal` appears with "Xác nhận xóa?" → click "Không" → modal closes, event preserved
- [ ] **Calendar delete event (keyboard)**: Focus event button → `Enter` → popup opens → `Tab` to delete → `Enter` → `ConfirmModal` appears → `Tab` to cancel → `Enter` → modal closes
- [ ] **FailedSection delete (mouse)**: Click delete on failed post → `ConfirmModal` appears → confirm → post removed
- [ ] **Weekly view label locale**: Switch to English → weekly label shows `"4/4 - 10/4"` (locale-aware date format)
- [ ] **TypeScript refactor**: Change `CalendarCell.dayNum` type → TypeScript errors in all consuming files at compile time
- [ ] **Deleted files removed**: `grep "ConfirmDeleteModal"` returns 0 results (import only, not usage)

---

## Files to Change

### Delete
- `components/features/create/calendar/ConfirmDeleteModal.tsx` — replaced by inline `ConfirmModal`
- `components/features/create/failed/ConfirmDeleteFailedPostModal.tsx` — replaced by inline `ConfirmModal`

### Modify
- `components/features/create/calendar/CalendarSection.tsx` — use `ConfirmModal` inline, fix `getNoteTextWithT` empty fallback
- `components/features/create/calendar/CalendarToolbar.tsx` — `getWeekRangeLabel()` → `Intl.DateTimeFormat`
- `components/features/create/calendar/MonthlyViewGrid.tsx` — add `CalendarCell` type
- `components/features/create/failed/FailedSection.tsx` — use `ConfirmModal` inline instead of `ConfirmDeleteFailedPostModal`
- `components/features/create/failed/RetryDetailModal.tsx` — check for hardcoded strings
- `store/shared/calendar.ts` — define `CALENDAR_STATUS` constant, replace hardcoded `'Trống'`
- `store/shared/constants.ts` — add `CALENDAR_STATUS` export
- `messages/vi.json` — add missing i18n keys
- `messages/en.json` — add missing English equivalents

### New Files
- None

---

## i18n Keys to Add/Update

```jsonc
// messages/vi.json — CreatePage.calendarSection
{
  "calendarSection": {
    "deleteModal": {
      "title": "Xác nhận xóa?",
      "message": "Bạn có chắc chắn muốn xóa sự kiện này khỏi lịch không?",
      "yes": "Xóa",
      "no": "Không"
    }
  }
}

// messages/en.json — CreatePage.calendarSection
{
  "calendarSection": {
    "deleteModal": {
      "title": "Confirm deletion?",
      "message": "Are you sure you want to delete this event from the calendar?",
      "yes": "Delete",
      "no": "No"
    }
  }
}
```

> **Note**: `deleteModal.no` key already exists in both files — no change needed. `title` and `message` already exist — confirm they match exactly. Only `yes` key is new.

---

## Migration Plan

### Step 1: Add missing i18n keys
Add `deleteModal.yes` to both `vi.json` and `en.json`.

### Step 2: Migrate FailedSection first (simpler, smaller)
1. Import `ConfirmModal` in `FailedSection.tsx`
2. Replace `<ConfirmDeleteFailedPostModal>` usage with inline `<ConfirmModal>`
3. Add state `const [deleteConfirm, setDeleteConfirm] = useState<{ postId: string } | null>(null)`
4. Delete `ConfirmDeleteFailedPostModal.tsx`

### Step 3: Migrate CalendarSection (more complex)
1. Import `ConfirmModal` in `CalendarSection.tsx`
2. Replace `<ConfirmDeleteModal>` with inline `<ConfirmModal>`
3. State `eventToDelete` stays same shape — just pass to `ConfirmModal`
4. Delete `ConfirmDeleteModal.tsx`

### Step 4: Fix CalendarToolbar date format
Replace hardcoded `getWeekRangeLabel()` with `Intl.DateTimeFormat`.

### Step 5: Add CalendarCell type
Define `CalendarCell` type inside `MonthlyViewGrid.tsx`, apply to `calendarGrid` prop and `cell` param.

### Step 6: Cleanup
- Remove unused imports
- `tsc --noEmit` → fix any errors
- `npm run lint` → fix any warnings
- `grep "ConfirmDeleteModal"` → confirm no orphan references

---

## Rollback Plan

1. Restore `ConfirmDeleteModal.tsx` and `ConfirmDeleteFailedPostModal.tsx` from git
2. Revert changes to `FailedSection.tsx` and `CalendarSection.tsx`
3. Revert i18n key additions
4. Run `npm run dev` — no broken renders
