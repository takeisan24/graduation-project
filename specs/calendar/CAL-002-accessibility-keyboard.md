# CAL-002: Accessibility + Keyboard Navigation — Calendar Section

> **Status**: Draft
> **Stack**: Next.js 14, React 18, TypeScript, Tailwind CSS v4, shadcn/ui, @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, next-intl

## Overview

**Goal**: Make Calendar fully accessible via keyboard and screen readers. Replace custom backdrop-based popup with Radix Dialog for consistent focus management, add keyboard alternative for drag-drop, and improve ARIA labels throughout.
**Trigger**: User navigates to Calendar section with keyboard or screen reader.
**Users affected**: Keyboard-only users, screen reader users, motor-impaired users.

---

## Background

### Accessibility Issues Found

| # | File | Issue | Severity |
|---|------|--------|----------|
| A1 | `MonthlyViewGrid.tsx` | `aria-label` on event buttons `"${label} event on ${event.platform}"` — lacks action context | 🔴 High |
| A2 | `CalendarPopups.tsx` | No keyboard navigation — Tab escapes popup, Escape doesn't close, no focus trap | 🔴 High |
| A3 | `ConfirmDeleteModal.tsx` | No `aria-label` on "Không"/"Xóa" buttons, no `aria-describedby` for dialog context | 🔴 High |
| A4 | Global | No ARIA live regions — status changes (scheduled→publishing→posted) are invisible to screen readers | 🟡 Medium |
| A5 | `CalendarToolbar.tsx` | Platform icons are `draggable` but have **no keyboard alternative** | 🔴 High |
| A6 | `CalendarPopups.tsx` | Backdrop `div` has no `role="dialog"` or `aria-modal="true"` | 🟡 Medium |
| A7 | `MonthlyViewGrid.tsx` | Past date cells have `cursor-not-allowed` but no `aria-disabled="true"` | 🟠 Low |
| A8 | `WeeklyViewGrid.tsx` | Past hour slots muted visually but no tooltip or ARIA describing why disabled | 🟠 Low |
| A9 | Global | No `@media (prefers-reduced-motion)` — animations play for users with motion sensitivity | 🟠 Low |

---

## Design Decisions

### Q4 Decision: Radix Dialog for CalendarPopups

The existing `CalendarPopups.tsx` uses a custom backdrop `div` with `onClick={onClose}`. This is replaced entirely with `@radix-ui/react-dialog` (already in project dependencies). This gives:

- ✅ Focus trap (Tab cycles within dialog)
- ✅ Escape to close
- ✅ `aria-modal="true"`
- ✅ `role="dialog"`
- ✅ Backdrop click to close (Radix handles this)
- ✅ Consistent with other dialogs in app (PublishModal, ImageGenModal, etc.)

**However**, the current popup has **two modes**: main action popup (View/Edit, Edit Time, Delete) and the Time Edit sub-form. These are two different UIs rendered conditionally. Radix Dialog can still handle this — the Time Edit form becomes a child of the DialogContent.

### Q3 Decision: Platform Quick-Add Panel

Instead of requiring mouse drag for platform icons, keyboard users get:

1. **Focus cell** → `Enter` or `Space` → cell becomes "selected" (visual ring)
2. **`+` button appears** in selected cell → click or `Enter` to activate
3. **Platform dropdown menu opens** → `ArrowUp`/`ArrowDown` to navigate, `Enter` to select
4. **Event created** → feedback toast, cell shows new event

Mouse users can still drag or use the `+` button — both methods coexist.

---

## Acceptance Criteria

- [ ] Calendar popup uses `@radix-ui/react-dialog` — focus trap, Escape close, `aria-modal` all work
- [ ] Event buttons have descriptive `aria-label` including action verbs
- [ ] Platform icons have tooltip: `"Phương thức thêm: Kéo thả bằng chuột, hoặc nhấn + trên ngày mong muốn"` (vi) / `"Add method: Drag with mouse, or press + on desired day"` (en)
- [ ] Day cells are keyboard-focusable — `Tab` navigates between cells, `Enter` selects
- [ ] Selected day shows "+" button — keyboard accessible via `Enter`/`Space`
- [ ] Platform dropdown in day cell is keyboard-navigable — `ArrowUp/Down` + `Enter`
- [ ] ARIA live region announces: "Đã thêm lịch cho TikTok" (vi) / "Added schedule for TikTok" (en)
- [ ] `prefers-reduced-motion` respected — no animations play when user prefers reduced motion
- [ ] Screen reader can navigate: Calendar grid → day cells → events → popup → actions
- [ ] Past date cells have `aria-disabled="true"` and tooltip explaining why
- [ ] `npm run lint -- --a11y` passes (if exists) or manual screen reader test passes

---

## S1: Error States & Validation

| Scenario | Expected Behavior |
|----------|------------------|
| Screen reader opens Calendar | Announces: "Calendar section. Monthly view. Today is [date]. Use arrow keys to navigate days." |
| Screen reader navigates to empty cell | Announces: "April 21, 2026. No scheduled posts. Press Enter to add." |
| Screen reader navigates to cell with events | Announces: "April 21, 2026. 2 scheduled posts. TikTok scheduled 9 AM, Instagram scheduled 2 PM." |
| Screen reader opens popup | Announces: "Event options dialog. TikTok, posted at 9 AM. Actions: View or edit post, Delete event." |
| Keyboard user tries to drag icon | Tooltip shows: "Use mouse to drag. For keyboard: select day with Tab, press + to add." |
| User with motion sensitivity visits Calendar | All animations disabled — no pulse, no fade, no transition |
| Screen reader + keyboard: past date | Announces: "April 10. Past date. Cannot add events. April 11." |

---

## S2: Post-Completion Flow

| Event | Result |
|-------|--------|
| Keyboard user opens Calendar | Focus lands on today's date cell — announced by screen reader |
| User Tabs through calendar | Each cell announced: date + event count + status |
| User selects empty day with `Enter` | `+` button appears in cell, focused |
| User opens platform menu with `Enter` | Dropdown opens, focus trapped, `ArrowUp/Down` navigates |
| User selects platform | Menu closes, toast announces event added, event appears in cell |
| Screen reader user: status changes | ARIA live region announces: "Post status changed to posted" |
| User with `prefers-reduced-motion` | No animations — cells are static, no pulse effects |
| Page refresh mid-keyboard-nav | Focus resets to top of calendar (component remount) |

---

## S3: Cross-Feature Integration

| When This Happens | This Feature | Triggers / Updates |
|-------------------|-------------|-------------------|
| User adds event via keyboard | Calendar grid + ARIA live region | Announces `"Đã thêm lịch cho ${platform}"` |
| Post status changes (scheduled→posted) | Calendar grid + ARIA live region | Announces `"${platform} post status changed to posted"` |
| User opens post editor from popup | Calendar popup closes | Focus returns to triggering event button (Radix Dialog handles this) |
| Global `prefers-reduced-motion` set | All Calendar animations | Disabled — pulse effects on today, hover transitions, popup animations |

**Shared state**: `calendarEvents` (Zustand), platform icons (constants)
**Empty state**: Empty cell announces: "No scheduled posts. Press Enter to add."
**Cleanup**: Focus restored on modal close, keyboard nav state reset on section unmount

---

## S4: Copy Review

- [ ] Event button aria-label: `"Lên lịch TikTok 9:00 AM. Nhấn Enter để xem/soạn, kéo để di chuyển."` (vi) / `"Scheduled TikTok 9:00 AM. Press Enter to view/edit, drag to move."` (en)
- [ ] Platform icon tooltip (keyboard hint): `"Kéo biểu tượng vào ngày hoặc nhấn + trên ngày để thêm"` (vi) / `"Drag icon to day or press + on day to add"` (en)
- [ ] Empty cell: `"Không có bài đăng. Nhấn Enter để thêm."` (vi) / `"No posts scheduled. Press Enter to add."` (en)
- [ ] Past cell: `"Ngày đã qua. Không thể thêm sự kiện."` (vi) / `"Past date. Cannot add events."` (en)
- [ ] ARIA live region announcements are short (max 100 chars), action-oriented
- [ ] No developer jargon in screen reader text — no "noteType", "scheduled_post_id", etc.
- [ ] All loading/syncing states announced: "Đang đồng bộ..." / "Syncing..."

---

## S5: State & Persistence Matrix

| Data | Stored Where | Persists After Refresh? | Cleared When |
|------|-------------|------------------------|--------------|
| Keyboard navigation focus state | DOM focus (ephemeral) | ❌ No | Section unmount / refresh |
| Selected cell (keyboard "picked up") | Component `useState` | ❌ No | `Escape` / click outside |
| `prefers-reduced-motion` | Browser preference | ✅ Yes (browser) | Browser setting change |
| ARIA live region updates | In-memory (DOM) | ❌ No | Status change clears |

---

## S6: Manual QA Scenarios

### Keyboard Navigation
- [ ] **Tab to calendar**: `Tab` → focus lands on today cell → screen reader announces date + event count
- [ ] **Arrow key grid navigation**: In grid, `ArrowLeft/Right/Up/Down` navigates between cells
- [ ] **Select empty day**: `Enter` on empty cell → `+` button appears → `Tab` reaches it → `Enter` opens platform menu
- [ ] **Platform menu keyboard**: `ArrowUp/Down` navigates platforms → `Enter` selects → event created, toast shown
- [ ] **Select day with events**: `Enter` on cell with events → popup opens → `Tab` through actions
- [ ] **Popup keyboard**: `Escape` closes popup → focus returns to triggering element
- [ ] **Drag with keyboard**: Not supported → tooltip explains `+` button alternative

### Screen Reader
- [ ] **Calendar page**: Navigate to Calendar → screen reader announces full section header + view type
- [ ] **Navigate events**: `Tab` to event button → announces: platform + time + status
- [ ] **Open popup**: `Enter` on event → dialog opens → screen reader announces dialog title + first action
- [ ] **Live region**: Event added → screen reader announces: "Đã thêm lịch cho TikTok" (automatic via aria-live)

### Reduced Motion
- [ ] **Enable reduced motion in OS settings**: Visit Calendar → today cell has NO pulse animation
- [ ] **Popup open/close**: No fade/scale animation — instant appear/dismiss
- [ ] **Hover effects**: No transition — instant color change

### Past Dates
- [ ] **Tab to past date**: Screen reader announces: "April 1, 2026. Past date. Cannot add events."
- [ ] **Enter on past date**: Nothing happens (cell not selectable)
- [ ] **Visual**: Past cells have muted background, no visual affordance for interaction

---

## Files to Change

### Modify
- `components/features/create/calendar/CalendarPopups.tsx` — replace custom backdrop with Radix Dialog
- `components/features/create/calendar/MonthlyViewGrid.tsx` — add `aria-label`, `aria-disabled`, cell keyboard navigation, `+` button
- `components/features/create/calendar/CalendarToolbar.tsx` — add keyboard hint tooltip on platform icons
- `components/features/create/calendar/CalendarSection.tsx` — add ARIA live region, selected cell state, platform menu state
- `components/features/create/calendar/WeeklyViewGrid.tsx` — add `aria-disabled` on past hours, tooltip on why disabled
- `components/features/create/calendar/WeeklyViewGrid.tsx` — event overlap — add `aria-describedby` when events stack

### New Files
- None (reuse existing Radix components from `components/ui/dialog.tsx` and `components/ui/dropdown-menu.tsx`)

### Delete
- None

---

## Component Changes Detail

### CalendarPopups → Radix Dialog

**Before (custom backdrop):**
```tsx
{/* Backdrop */}
<div className="fixed inset-0 z-[99]" onClick={onClose} />
{/* Popup */}
<div className="fixed z-[100] ..." onClick={(e) => e.stopPropagation()}>
```

**After (Radix Dialog):**
```tsx
<Dialog open={!!popupData} onOpenChange={(open) => !open && onClose()}>
  <DialogOverlay className="bg-black/50" />
  <DialogContent
    className={`bg-card border rounded-lg shadow-lg ${platformColors.border}`}
    onOpenAutoFocus={(e) => e.preventDefault()} // Don't auto-focus first button
  >
    {/* Platform color top border */}
    <div className={`h-1 w-full ${platformColors.bg} rounded-t-lg -mt-6 -mx-6 mb-4`} />
    {/* Actions */}
    <DialogBody>
      {/* View/Edit, Edit Time, Delete buttons */}
    </DialogBody>
  </DialogContent>
</Dialog>
```

### MonthlyViewGrid → Cell Keyboard Navigation

**Selected cell state (CalendarSection):**
```tsx
const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);
const [showPlatformMenu, setShowPlatformMenu] = useState(false);
```

**Cell keyboard handler:**
```tsx
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (!isPast && !isSelected) {
      setSelectedCellKey(cell.clickedKey);
    } else if (isSelected && !showPlatformMenu) {
      setShowPlatformMenu(true);
    }
  }
  if (e.key === 'Escape') {
    setSelectedCellKey(null);
    setShowPlatformMenu(false);
  }
}}
```

**Selected cell shows + button:**
```tsx
{isSelected && !isPast && (
  <button
    aria-label={t('addToDay')}
    className="absolute top-1 right-1 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-xs"
    onClick={() => setShowPlatformMenu(true)}
  >
    +
  </button>
)}
```

### Platform Icon Tooltip (Toolbar)

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <img draggable onDragStart={...} />
  </TooltipTrigger>
  <TooltipContent>
    <p>{t('platformIconTooltip')}</p>
  </TooltipContent>
</Tooltip>
```

### ARIA Live Region (CalendarSection)

```tsx
// In render, visible to screen readers:
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
>
  {liveAnnouncement && <span>{liveAnnouncement}</span>}
</div>
```

---

## Rollback Plan

1. Revert `CalendarPopups.tsx` to custom backdrop version
2. Revert `MonthlyViewGrid.tsx` — remove `aria-*` attributes, keyboard handlers, `+` button
3. Revert `CalendarToolbar.tsx` — remove tooltip
4. Revert `CalendarSection.tsx` — remove live region, selected cell state
5. Revert `WeeklyViewGrid.tsx` — remove `aria-disabled`
6. Run `npm run dev` — no broken renders
7. Manual keyboard test — confirm Tab/Escape still work (basic)
