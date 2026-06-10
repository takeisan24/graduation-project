# Calendar Section — Specs

> Collection of UI/UX improvement specs for the Calendar section.
> Generated via deep codebase audit + Socratic brainstorming.

## Specs Overview

| Spec | Focus | Priority | Dependencies |
|------|--------|----------|--------------|
| **[CAL-001](CAL-001-i18n-types.md)** | i18n + Type Safety | 🔴 High | None |
| **[CAL-002](CAL-002-accessibility-keyboard.md)** | Accessibility + Keyboard | 🔴 High | None |
| **[CAL-003](CAL-003-ux-polish-empty-states-polling.md)** | UX Polish + Empty States + Polling | 🟡 Medium | CAL-001, CAL-002 |

## Audit Summary

**Total issues found**: 40
| Severity | Count | Examples |
|----------|-------|---------|
| 🔴 High | 9 | Hardcoded i18n, no keyboard nav, timezone bug |
| 🟡 Medium | 15 | Type safety, UX feedback, accessibility |
| 🟠 Low | 16 | Dead code, animation issues, minor bugs |

## Spec Decisions Locked

| Question | Decision | Rationale |
|----------|----------|-----------|
| Q1 — ConfirmModal | **Approach B** | `ConfirmModal` already exists in `shared/` — migrate 2 hardcoded modals to reuse it |
| Q2 — CalendarCell types | **Component file only** | Type only used in calendar views, no cross-feature reuse needed |
| Q3 — Keyboard drag alternative | **D + ARIA + tooltip** | Hybrid: Platform Quick-Add Panel (+ button in cell) + improved aria-labels + hint tooltip |
| Q4 — Popup keyboard | **Radix Dialog** | Already in deps, consistent with other dialogs, gives focus trap + Escape for free |
| Q5 — Empty state | **3-layer approach** | L0 (zero state overlay) + L1 (periodic reminder) + L2 (cell hover hint) |
| Q6 — Loading state | **Both** | Skeleton for initial + sync spinner badge for background polling |
| Q7 — Polling | **Visibility-aware 15s + event-driven** | Pause when hidden, debounce on tab switch, immediate sync on schedule/publish |
| Q8 — Library migration | **Keep custom** | Custom implementation meets all current needs; spec documents when to reconsider |

## Emotional Design Principles

> **"Empty = Canvas, Not Absence"**

All empty state copy uses positive framing:
- ❌ "Bạn chưa có bài đăng nào" → implies absence/failure
- ✅ "Lịch của bạn, canvas sáng tạo tiếp theo" → implies opportunity

## Implementation Order

```
Week 1: CAL-001 (i18n + Type Safety)
  ├── Step 1: Add missing i18n keys to vi.json/en.json
  ├── Step 2: Migrate FailedSection → ConfirmModal
  ├── Step 3: Migrate CalendarSection → ConfirmModal
  ├── Step 4: Fix CalendarToolbar date format
  ├── Step 5: Add CalendarCell types
  └── Step 6: Add CALENDAR_STATUS constant

Week 2: CAL-002 (Accessibility + Keyboard)
  ├── Step 1: CalendarPopups → Radix Dialog
  ├── Step 2: MonthlyViewGrid: aria-label + keyboard nav + "+" button
  ├── Step 3: CalendarToolbar: tooltip on platform icons
  ├── Step 4: CalendarSection: ARIA live region
  └── Step 5: WeeklyViewGrid: aria-disabled on past hours

Week 3: CAL-003 (UX Polish + Empty States + Polling)
  ├── Step 1: CalendarEmptyState.tsx (L0 + L1)
  ├── Step 2: L2 "+" button in grid cells
  ├── Step 3: CalendarSkeleton loading state
  ├── Step 4: SyncBadge.tsx in toolbar
  ├── Step 5: Visibility-aware polling + event-driven sync
  └── Step 6: navigator.onLine listener

Week 4: CAL-003 Polish + Integration Testing
  ├── Verify all 3 layers work together
  ├── Test keyboard nav end-to-end
  ├── Screen reader test
  ├── Reduced motion test
  └── Cross-feature integration test
```

## Key Design Decisions

### Empty State — 3 Layers

```
Layer 0 (Zero State):  User new, 0 events ever
  → Full overlay, illustration + tutorial + CTA
  → Auto-dismiss after first event

Layer 1 (Periodic):    Week has < 3 events
  → Inline banner below header, minimalist
  → Motivational copy, no pressure
  → Auto-dismiss when 3+ events/week

Layer 2 (Cell):         Per-cell hover affordance
  → "+" button on empty cell hover
  → Keyboard accessible (Tab → Enter)
  → Opens platform dropdown
```

### Polling Strategy

```
Before:  setInterval(..., 3000) — too aggressive, no visibility check
After:
  ├── 15s interval (5x reduction)
  ├── Visibility-aware: pause when tab hidden
  ├── Debounce 2s on tab switch
  ├── Event-driven: immediate sync on schedule/publish
  └── Visual: sync badge in toolbar
```

## Files Changed Per Spec

### CAL-001
- **Delete**: `ConfirmDeleteModal.tsx`, `ConfirmDeleteFailedPostModal.tsx`
- **Modify**: `CalendarSection.tsx`, `CalendarToolbar.tsx`, `MonthlyViewGrid.tsx`, `FailedSection.tsx`, `store/shared/calendar.ts`
- **New i18n keys**: `calendarSection.deleteModal.yes`

### CAL-002
- **Modify**: `CalendarPopups.tsx`, `MonthlyViewGrid.tsx`, `CalendarToolbar.tsx`, `CalendarSection.tsx`, `WeeklyViewGrid.tsx`
- **New**: None (reuse Radix components)

### CAL-003
- **Modify**: `CalendarSection.tsx`, `MonthlyViewGrid.tsx`, `WeeklyViewGrid.tsx`, `CalendarToolbar.tsx`
- **New**: `CalendarEmptyState.tsx`, `SyncBadge.tsx`

## Notes

- All specs are **behavioral specs** — they define *what* the user sees/does, not *how* to implement it
- Code examples in specs are **illustrative**, not final implementation
- All user-facing text must be in `messages/vi.json` and `messages/en.json`
- Rollback plans included in each spec
