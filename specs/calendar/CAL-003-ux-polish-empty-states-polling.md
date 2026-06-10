# CAL-003: UX Polish + Empty States + Polling Optimization — Calendar Section

> **Status**: Draft
> **Stack**: Next.js 14, React 18, TypeScript, Tailwind CSS v4, shadcn/ui, @radix-ui/react-dropdown-menu, next-intl, Zustand, date-fns, luxon

## Overview

**Goal**: Polish Calendar UX across 3 dimensions — (1) emotionally intelligent empty states, (2) loading skeletons + sync indicator, (3) visibility-aware intelligent polling.
**Trigger**: User navigates to Calendar section.
**Users affected**: All users — new users get guided onboarding, returning users get gentle reminders, active users get fast sync feedback.

---

## Background

### Design Principles

> **"Empty = Canvas, Not Absence"**
>
> Calendar is sparse by design — most days are empty. Empty states should feel like opportunity, not failure. Every empty state message is rephrased from "you're missing" to "you have room for".

### Emotional States Matrix

| User State | Frequency | Empty State Needed? | Emotional Risk |
|-----------|-----------|--------------------|----------------|
| New user, zero events | 1x per account | ✅ Yes — full tutorial | Overwhelm if too much info |
| Has events past, empty this week | Very common | ✅ Yes — gentle reminder | Guilt if framed negatively |
| Active week (3+ events) | Common | ❌ No — overlay too much | N/A |
| Day-level empty | Always | ❌ No — cell hover only | N/A |
| No connected accounts | 1x per platform | ✅ Yes — CTA to connect | Confusion if can't schedule |

---

## Part 1: Empty States

### Layer Architecture

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  LAYER 0: Zero State (L0) — New user, 0 events ever     │
│  ────────────────────────────────────────────────────  │
│  Type:    Full overlay on calendar grid                  │
│  Tone:    Instructional + Motivational                   │
│  Visual:  Minimal illustration + descriptive text        │
│  CTA:     Connect accounts (priority) + Quick schedule  │
│  Logic:   Show when totalEvents (30 days) === 0        │
│  Dismiss: Auto-hide after first event added             │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  LAYER 1: Periodic Empty (L1) — Week/month is sparse     │
│  ────────────────────────────────────────────────────  │
│  Type:    Inline hint banner (below header)             │
│  Tone:    Motivational, non-pressuring                  │
│  Visual:  Minimalist icon + 1 line                      │
│  CTA:     Conditional — only if week is near-empty      │
│  Logic:   Show when currentWeek events < 3             │
│  Dismiss: Auto-hide when week has 3+ events           │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  LAYER 2: Cell Hover Hint (L2) — How to add events     │
│  ────────────────────────────────────────────────────  │
│  Type:    Per-cell, on hover only                        │
│  Tone:    Functional — just the + affordance            │
│  Visual:  Minimal "+" icon appears on hover              │
│  CTA:     Opens platform dropdown on click              │
│  Logic:   Show "+" on cell hover when cell is empty     │
│  Dismiss: Hidden when cell has events                  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Q5 Decisions (Locked)

```
Q5a: B — L0 vs L1 treated differently
Q5b: E (Layer 2) + C (Layer 1) + B (Layer 0 overlay)
Q5c: Motivational for Layer 1, Instructional for Layer 0
Q5d: D (Layer 0) + conditional (Layer 1)
Q5e: A (Layer 0) + B (Layer 1)
```

---

## Part 2: Loading States

### Q6 Decision: Both — Skeleton + Sync Spinner

```
- Initial load: Skeleton (from localStorage — nearly instant, but smoothes visual)
- Status sync: Small spinner badge in toolbar corner (non-blocking)
```

---

## Part 3: Polling Optimization

### Q7 Decision: Visibility-Aware 15s Polling + Event-Driven

Current: `setInterval(..., 3000)` — too aggressive, no visibility awareness, no visual feedback.

Proposed:
| Layer | Current | Proposed |
|-------|---------|----------|
| Interval | 3 seconds | 15 seconds (foreground only) |
| Visibility | None | Pause when tab hidden |
| On tab visible | N/A | Debounce 2s before sync |
| Event-driven | None | Trigger immediate sync on schedule/publish |
| Visual feedback | None | Sync badge in toolbar |

---

## Acceptance Criteria

### Empty States
- [ ] **L0 Zero State**: Shows when user has 0 events in last 30 days. Overlay with illustration + tutorial text + CTA buttons. Auto-dismisses after first event.
- [ ] **L1 Periodic Reminder**: Shows when current week has < 3 events. Minimal inline banner below header. Auto-hides when week reaches 3+ events.
- [ ] **L2 Cell Hover**: Empty cells show "+" button on hover. Click opens platform dropdown.
- [ ] **Account check**: If 0 connected accounts, L0 CTA is "Kết nối tài khoản MXH" first, "Lên lịch bài viết" second.
- [ ] **No false positives**: L0/L1 never show when user is actively using calendar (3+ events/week).

### Loading States
- [ ] **Initial skeleton**: Calendar grid shows shimmer skeleton on first mount (even though localStorage is fast).
- [ ] **Sync badge**: Toolbar shows small spinning indicator when status sync is in progress.
- [ ] **Last synced**: Badge shows "Đã đồng bộ X phút trước" (vi) / "Synced X minutes ago" (en).
- [ ] **Sync badge hidden**: When not syncing and last sync was < 1 minute ago, badge hidden.

### Polling
- [ ] **15s interval**: Status checks happen every 15 seconds (not 3s).
- [ ] **Visibility-aware**: Tab hidden → polling pauses. Tab visible → debounce 2s → sync.
- [ ] **Event-driven trigger**: When user schedules or publishes post, immediate sync fires.
- [ ] **No spam**: `document.visibilityState` check prevents calls when tab not visible.
- [ ] **Graceful degradation**: If API fails, silent retry on next interval — no error toast for background sync.

---

## S1: Error States & Validation

### Empty States

| Scenario | Expected Behavior |
|----------|------------------|
| L0 + 0 connected accounts | CTA "Kết nối tài khoản MXH" shown first. "Lên lịch bài viết" shown as secondary. |
| L0 + connected accounts exist | CTA "Lên lịch bài viết" shown first. "Kết nối thêm" shown as secondary. |
| L0 first event added | Overlay fades out smoothly. Never shows again for this user. |
| L1 + week already has 3 events | L1 banner does NOT show. User is active, no reminder needed. |
| L2 + cell already has events | "+" button does NOT show. Only on empty cells. |
| L2 + cell is past date | "+" button does NOT show. Past dates cannot be modified. |
| L1 + navigating to past weeks | L1 shows for any week with < 3 events (not just current week). |

### Loading States

| Scenario | Expected Behavior |
|----------|------------------|
| Initial page load | Skeleton shimmer in calendar grid area. Skeleton shows days × weekday structure. |
| Sync starts | Badge in toolbar turns spinning. |
| Sync completes (< 1 min ago) | Badge shows "Đã đồng bộ vừa xong" (vi) / "Just synced" (en). |
| Sync completes (> 1 min ago) | Badge hidden. |
| Sync fails (background) | Silent retry on next interval. No toast for background failures. |
| Sync fails (foreground — user initiated) | Toast error: "Không thể đồng bộ. Thử lại." (vi) / "Sync failed. Try again." (en). |

### Polling

| Scenario | Expected Behavior |
|----------|------------------|
| Tab becomes hidden | `visibilitychange` event → pause interval timer |
| Tab becomes visible after 5 minutes | Debounce 2s → fire sync → resume 15s interval |
| User schedules post | `calendar:event-scheduled` event fires → immediate sync |
| User publishes post | `calendar:post-published` event fires → immediate sync |
| Tab switch every 30 seconds | Debounce prevents API spam — max 1 sync per 2s per visibility change |
| Network offline | `navigator.onLine === false` → pause all polling. Resume when online. |
| localStorage quota exceeded | `try/catch` in `saveToLocalStorage` → warning logged → sync continues |

---

## S2: Post-Completion Flow

### Empty States

| Event | Result |
|-------|--------|
| User clicks "Lên lịch bài viết" on L0 | `setActiveSection('create')` → navigate to Create section |
| User clicks "Kết nối tài khoản MXH" on L0 | `setActiveSection('settings')` → navigate to Settings |
| User adds first event | L0 overlay fades out (300ms) → never shows again |
| User navigates to week with < 3 events | L1 banner slides in below header |
| User adds event → week now has 3 events | L1 banner fades out immediately |
| User hovers empty cell | "+" icon fades in (150ms) |
| User clicks "+" | Platform dropdown opens |
| User selects platform | Dropdown closes, event created, toast shown, "+" icon hidden |
| User hovers cell with events | "+" icon does NOT show |

### Loading States

| Event | Result |
|-------|--------|
| Calendar mounts | Skeleton shows → data loads from localStorage → skeleton fades → grid renders |
| Sync fires | Badge spins → sync completes → badge shows time → fades out after 60s |
| Multiple syncs within 60s | Badge stays visible, timestamp updates |

### Polling

| Event | Result |
|-------|--------|
| User switches to Calendar tab after absence | 2s debounce → sync fires → badge shows "vừa xong" |
| User schedules post via Create section | Immediate sync fires within 1 second |
| User opens Calendar in new tab | Both tabs have independent visibility tracking |
| User's session expires mid-poll | `supabaseClient.auth.getSession()` returns null → sync pauses, toast "Bạn cần đăng nhập" shown |

---

## S3: Cross-Feature Integration

| When This Happens | This Feature | Triggers / Updates |
|-------------------|-------------|-------------------|
| User schedules post (CreateSection) | Calendar polling + empty state | Fires `calendar:event-scheduled` event → immediate sync + L1 dismiss |
| User publishes post (any section) | Calendar polling + empty state | Fires `calendar:post-published` event → immediate sync |
| User connects new account (Settings) | L0 empty state | CTA order updates — "Kết nối" moves to secondary |
| Tab visibility changes | Polling engine | Pause/resume based on `visibilityState` |
| Global network offline | Polling + sync badge | `navigator.onLine` check → pause polling, badge shows "Offline" |
| Calendar unmounts | Polling interval | `clearInterval` → no background polling |

**Shared state**: `useCalendarStore.calendarEvents`, `pendingScheduledPosts` (localStorage), connected accounts (store)
**Empty state**: L0/L1 handle all empty cases; no per-cell empty UI needed.
**Cleanup**: On Calendar unmount → clear polling interval, remove event listeners. On user logout → clear all calendar localStorage.

---

## S4: Copy Review

### Empty State Copy

**L0 — Zero State:**
```
Heading:    "Lịch của bạn, canvas sáng tạo tiếp theo"
            (vi) / "Your calendar, canvas for your next creation" (en)

Subheading: "Kéo biểu tượng nền tảng (TikTok, Instagram, YouTube...)
             vào ngày bạn muốn đăng bài"
            (vi) / "Drag platform icons (TikTok, Instagram, YouTube...)
             onto the day you want to post" (en)

CTA Primary (accounts connected):
            "Lên lịch bài viết mới"
            (vi) / "Schedule a new post" (en)

CTA Secondary:
            "Kết nối thêm tài khoản"
            (vi) / "Connect more accounts" (en)

CTA Primary (no accounts):
            "Kết nối tài khoản MXH"
            (vi) / "Connect social accounts" (en)
```

**L1 — Periodic Reminder:**
```
Banner:     "Tuần này có {count} ngày trống — cơ hội để plan thêm content mới"
            (vi) / "This week has {count} open days — room for more content" (en)

CTA:        "Lên lịch bài viết ↓"
            (vi) / "Schedule a post ↓" (en)

Threshold:  Only show when week has < 3 events AND ≥ 1 empty day
```

**L2 — Cell Hover Hint:**
```
Icon:       "+" ⊕ button — no text
Tooltip:    "Thêm vào ngày này"
            (vi) / "Add to this day" (en)
```

### Sync Badge Copy

```
Syncing:    Spinner icon only (no text)
Just now:   "Đã đồng bộ vừa xong" / "Just synced"
X min ago:  "Đã đồng bộ {n} phút trước" / "Synced {n} min ago"
Offline:    "Đang offline" / "Offline"
Error:      "Đồng bộ thất bại" / "Sync failed"
```

### All text must be:
- [ ] No developer jargon in user-facing text
- [ ] Motivational tone (L0/L1) — "canvas", "opportunity", "room for" — not "missing", "empty", "gap"
- [ ] All translated in `messages/vi.json` and `messages/en.json`
- [ ] Consistent with app's existing voice (tool-like but approachable)

---

## S5: State & Persistence Matrix

| Data | Stored Where | Persists After Refresh? | Cleared When |
|------|-------------|------------------------|--------------|
| `calendarEvents` | Zustand store → localStorage | ✅ Yes | Logout |
| L0 dismissed (first event added) | localStorage flag | ✅ Yes (per user) | Never (one-time) |
| L1 dismissed (user navigated away) | Ephemeral state | ❌ No | Page navigation |
| Sync badge state | Component `useState` | ❌ No | Auto-clear 60s |
| Last synced timestamp | Component `useState` | ❌ No | Component unmount |
| Polling interval | JavaScript timer | ❌ No | Component unmount |
| `calendar:event-scheduled` listeners | Window event | ❌ No | Component unmount |
| `prefers-reduced-motion` | Browser preference | ✅ Yes | Browser setting |
| `navigator.onLine` | Browser API | ✅ Yes (live) | Network change |

---

## S6: Manual QA Scenarios

### Empty States — L0 Zero State
- [ ] **L0 shows on fresh account**: Login as new user → navigate to Calendar → L0 overlay appears with tutorial + CTAs
- [ ] **L0 + no accounts**: Settings shows 0 connected accounts → Calendar L0 shows "Kết nối tài khoản MXH" as primary CTA
- [ ] **L0 + accounts exist**: Settings shows ≥ 1 connected account → Calendar L0 shows "Lên lịch bài viết" as primary CTA
- [ ] **L0 dismiss**: Drag platform icon to day → event created → L0 fades out (300ms) → never shows again
- [ ] **L0 dismiss (refresh)**: Add event → refresh page → L0 does NOT show (localStorage flag persists)
- [ ] **L0 CTA navigation**: Click "Kết nối tài khoản MXH" → navigate to Settings section

### Empty States — L1 Periodic Reminder
- [ ] **L1 shows on sparse week**: Navigate to week with 2 events → L1 banner appears below header
- [ ] **L1 hides on active week**: Navigate to week with 3+ events → L1 banner does NOT show
- [ ] **L1 hides on add**: View week with 2 events → add 3rd event → L1 fades out immediately
- [ ] **L1 dismiss on navigate**: View week with L1 → navigate to another section → navigate back → L1 shows again (no persistence — expected)

### Empty States — L2 Cell Hover
- [ ] **L2 shows on hover**: Hover empty cell → "+" button fades in (150ms) at cell corner
- [ ] **L2 + click**: Hover empty cell → click "+" → platform dropdown opens
- [ ] **L2 keyboard**: Focus empty cell with `Tab` → `Enter` → platform dropdown opens
- [ ] **L2 + past cell**: Hover past cell → "+" button does NOT show
- [ ] **L2 + cell with events**: Hover cell with events → "+" button does NOT show
- [ ] **L2 + event created**: Hover empty cell → click "+" → select TikTok → event created → "+" disappears

### Loading States — Skeleton
- [ ] **Initial skeleton**: Hard refresh page → skeleton shimmer → grid renders → smooth transition
- [ ] **Skeleton matches layout**: Skeleton shows 7-column weekday grid + day cells structure (not random)

### Loading States — Sync Badge
- [ ] **Badge on sync**: Sync fires → badge spins → completes → badge shows "Đã đồng bộ vừa xong"
- [ ] **Badge fades**: Badge visible → wait 60s → badge fades out
- [ ] **Multiple syncs**: Sync fires → completes → sync fires again within 60s → badge stays, timestamp updates
- [ ] **Badge hidden (no sync)**: No sync activity for 2+ minutes → badge hidden (clean UI)

### Polling — Visibility-Aware
- [ ] **Tab hidden → pause**: Open Calendar → switch to another tab → verify no sync API calls (check Network tab)
- [ ] **Tab visible → sync**: Hide tab for 5 minutes → switch back → verify debounced sync fires after 2s
- [ ] **Rapid tab switching**: Switch tabs every 5 seconds for 1 minute → verify at most ~8 syncs (2s debounce × 8 = 16s effective minimum between syncs)
- [ ] **Event-driven sync**: Schedule post in Create section → verify Calendar syncs within 1 second
- [ ] **Offline**: Go offline (DevTools → Network → Offline) → Calendar syncing → badge shows "Đang offline" → come back online → badge disappears, sync resumes

---

## Files to Change

### Modify

- `components/features/create/calendar/CalendarSection.tsx`
  - Add L0 ZeroState overlay component
  - Add L1 PeriodicReminder inline banner
  - Add `selectedCellKey` and `showPlatformMenu` state for L2
  - Add sync badge state (`isSyncing`, `lastSyncedAt`)
  - Add visibility-aware polling with `useEffect`
  - Add `calendar:event-scheduled` and `calendar:post-published` event listeners
  - Add `navigator.onLine` listener

- `components/features/create/calendar/MonthlyViewGrid.tsx`
  - Add L2 "+" button on empty cell hover
  - Add platform dropdown (or call parent's handler)
  - Add `aria-label` for "+" button

- `components/features/create/calendar/CalendarToolbar.tsx`
  - Add sync badge component (spinning when syncing, timestamp when idle)
  - Add `navigator.onLine` indicator

- `components/features/create/calendar/WeeklyViewGrid.tsx`
  - Add L2 "+" button on empty cell hover (for weekly view too)

- `components/features/create/calendar/CalendarPopups.tsx`
  - Consider: After successful delete → dispatch `calendar:event-deleted` event

- `store/shared/calendar.ts`
  - Consider: After `handleEventAdd` → `window.dispatchEvent(new Event('calendar:event-scheduled'))`

- `components/features/create/calendar/CalendarSection.tsx` — skeleton:
  - Add `CalendarSkeleton` loading state for initial mount

### New Files

- `components/features/create/calendar/CalendarEmptyState.tsx`
  - L0: ZeroState overlay component (illustration + CTAs)
  - L1: PeriodicReminder inline banner component
  - Logic: decides which layer to show based on `calendarEvents`

- `components/features/create/calendar/SyncBadge.tsx`
  - Sync badge with spinner / timestamp display
  - Props: `isSyncing: boolean`, `lastSyncedAt: Date | null`, `isOnline: boolean`

### Delete

- None

---

## Component Structure

### CalendarEmptyState.tsx

```tsx
// Logic flow:
// 1. Compute: total events in last 30 days
// 2. Compute: events in current week
// 3. Compute: has connected accounts (from settings store)

// If totalEvents === 0 → L0 ZeroState
// Else if weekEvents < 3 AND weekEvents < totalWeekDays → L1 PeriodicReminder
// Else → null (no empty state overlay)

// CalendarEmptyState wraps CalendarSection grid area
// L2 "+" button lives inside MonthlyViewGrid/WeeklyViewGrid (per-cell)

// Props:
//   calendarEvents: Record<string, CalendarEvent[]>
//   hasConnectedAccounts: boolean
//   onNavigateToCreate: () => void
//   onNavigateToSettings: () => void
```

### SyncBadge.tsx

```tsx
// States:
// 1. Syncing → spinning icon only
// 2. Just synced (< 1 min ago) → icon + "Đã đồng bộ vừa xong"
// 3. Older (> 1 min ago) → hidden
// 4. Offline → icon + "Đang offline"

// Visually: small pill in toolbar corner, subtle
// Accessibility: aria-live="polite" announces sync status
```

---

## Rollback Plan

1. Revert `CalendarSection.tsx` — remove L0, L1, sync badge, visibility polling, event listeners
2. Revert `MonthlyViewGrid.tsx` — remove L2 "+" button
3. Revert `WeeklyViewGrid.tsx` — remove L2 "+" button
4. Revert `CalendarToolbar.tsx` — remove sync badge
5. Delete `CalendarEmptyState.tsx`
6. Delete `SyncBadge.tsx`
7. Restore polling to `setInterval(..., 3000)` in `CalendarSection.tsx`
8. Run `npm run dev` — no broken renders
9. Test: Calendar opens, drag-drop works, delete works
