# Đợt 3: Calendar + Dashboard + Final Polish

> **Status**: Draft
> **Stack**: Next.js 14, React 18, TypeScript, Tailwind CSS v4, shadcn/ui, Zustand, next-intl, Recharts

## Overview

**Goal**: Redesign Calendar và API Dashboard với UTC branding, platform colors, và visual polish. Final dark mode audit toàn bộ app.
**Trigger**: User vào Calendar hoặc API Dashboard section. Final polish áp dụng toàn app.
**Users affected**: Tất cả authenticated users.

---

## Acceptance Criteria

### Calendar
- [ ] Today's date có accent highlight (utc-royal ring hoặc bg tint)
- [ ] Calendar cells có event indicators dùng platform colors (dots hoặc mini badges)
- [ ] Calendar popup (event detail) có platform icon + brand color header
- [ ] Toolbar buttons (Month/Week, Prev/Next) dùng UTC gradient cho active state
- [ ] Weekly view time blocks có platform color left-border
- [ ] Past dates subtle appearance (opacity-50 hoặc muted bg)
- [ ] CalendarPopups: event items có platform icon to hơn + color-coded status

### API Dashboard
- [ ] Stat cards có gradient background (mỗi card 1 gradient khác nhau)
- [ ] Credits card: gradient utc-royal → utc-sky
- [ ] Posts card: gradient green tint
- [ ] Success card: gradient emerald
- [ ] Plan card: gradient utc-gold → utc-gold-bright
- [ ] Charts (Recharts): platform brand colors thay vì generic
- [ ] Pie chart slices: TikTok=đen, IG=pink, YT=đỏ, FB=blue...
- [ ] Area chart: gradient fill utc-royal/20
- [ ] Activity table: platform icons inline + color-coded type badges
- [ ] Tab buttons: active tab có gradient bottom border

### Final Polish (toàn app)
- [ ] Dark mode full audit pass: tất cả text readable, no invisible elements
- [ ] Hover states consistent: tất cả interactive elements có visual feedback
- [ ] Focus rings: dùng ring-utc-royal thay vì ring-primary where appropriate
- [ ] Loading skeletons: dùng UTC-tinted pulse animation
- [ ] Empty states: tất cả dùng CreatorHubIcon + descriptive text + action button
- [ ] Scrollbar styling: consistent utc-royal tint

---

## S1: Error States & Validation

| Scenario | Expected Behavior |
|----------|------------------|
| Calendar no events | Empty day cells hiện subtle "+" on hover, không có clutter |
| Calendar API thất bại | Toast error, calendar giữ cached data nếu có |
| Dashboard no data (new user) | Stat cards hiện "0" với descriptive text, charts hiện empty state |
| Dashboard API thất bại | Toast error, giữ stale data, retry button |
| Recharts render thất bại | Fallback text "Không có dữ liệu biểu đồ" |
| Dark mode + gradient backgrounds | Gradients đủ subtle để text readable (opacity-based) |
| Platform color trên inverted background | Đảm bảo contrast — TikTok black cần white border on dark mode |

---

## S2: Post-Completion Flow

| Event | Result |
|-------|--------|
| Đợt 3 hoàn thành | Toàn bộ dashboard 100% khác biệt project gốc |
| User mở Calendar | Thấy today highlighted, events color-coded by platform |
| User mở Dashboard | Thấy gradient stat cards, branded charts |
| User toggle dark mode | Gradients adapt, text readable, charts colors maintain contrast |
| User schedule post từ Calendar | Event appear với platform color indicator |

---

## S3: Cross-Feature Integration

| When This Happens | This Feature | Triggers / Updates |
|-------------------|-------------|-------------------|
| Platform color system (Đợt 1) | Calendar events, Dashboard charts | Dùng cùng 1 color config |
| User publish post | Dashboard stats | Stat cards + charts cập nhật |
| User schedule post | Calendar | New event hiện với platform color |
| Credits thay đổi | Dashboard credits card | Gradient intensity thay đổi theo mức |

**Shared state**: `useCalendarStore` (events), `useApiDashboardPageStore` (stats), platform colors from constants
**Empty state**: Calendar trống → subtle "+" icons on hover. Dashboard trống → "Chưa có dữ liệu" + start action.
**Cleanup**: Chart data refetch on section mount, calendar data persists.

---

## S4: Copy Review

- [ ] Calendar today label: "Hôm nay" (vi) / "Today" (en) — nếu hiện
- [ ] Dashboard stat labels: "Tín dụng", "Bài viết", "Tỷ lệ thành công", "Gói" (vi)
- [ ] Dashboard empty: "Chưa có dữ liệu. Tạo bài viết đầu tiên để xem thống kê." (vi)
- [ ] Chart tooltips: platform names + số liệu rõ ràng
- [ ] All loading states: "Đang tải..." với context (ví dụ: "Đang tải lịch...")

---

## S5: State & Persistence Matrix

| Data | Stored Where | Persists After Refresh? | Cleared When |
|------|-------------|------------------------|--------------|
| Calendar events | Zustand store | Yes (localStorage) | Logout |
| Calendar view (month/week) | Component state | No | Section change |
| Dashboard stats | SWR cache + store | No (refetch) | Section leave |
| Dashboard active tab | Component state | No | Section change |
| Chart data | Derived from store | No | Recalculated |

---

## S6: Manual QA Scenarios

### Calendar
- [ ] **Today highlight**: Mở Calendar → ngày hôm nay có ring/bg accent nổi bật
- [ ] **Platform event colors**: Schedule post TikTok → calendar cell hiện dot đen. Schedule Instagram → dot pink.
- [ ] **Event popup**: Click ngày có events → popup hiện list events với platform icon + color header
- [ ] **Toolbar active**: Click "Week" → Week button có gradient active state
- [ ] **Past dates**: Ngày quá khứ hiện muted/subtle, ngày tương lai hiện rõ
- [ ] **Dark mode calendar**: Toggle dark → cells readable, today still highlighted, colors visible

### Dashboard
- [ ] **Stat cards gradient**: Mở Dashboard → 4 cards mỗi cái 1 gradient khác nhau
- [ ] **Chart platform colors**: Charts hiện bars/slices đúng platform color (TikTok=đen, IG=pink...)
- [ ] **Empty dashboard**: User mới → stat cards "0", charts empty state message
- [ ] **Tab switching**: Click Analytics tab → content đổi, tab có gradient indicator
- [ ] **Dark mode dashboard**: Toggle dark → gradient cards visible, charts readable

### Final Polish
- [ ] **Full dark mode audit**: Navigate qua tất cả 7 sections trong dark mode → KHÔNG có text invisible
- [ ] **Hover consistency**: Hover tất cả interactive elements → visual feedback rõ ràng
- [ ] **Empty states audit**: Mỗi section khi trống → có CreatorHubIcon + descriptive text
- [ ] **Mobile audit 375px**: Tất cả sections → no overflow, no invisible elements, touch targets ≥ 44px
