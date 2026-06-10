# Phase 2: SlimSidebar Replacement

> **Status**: Draft
> **Stack**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS v4, shadcn/ui, Zustand, next-intl, SWR

## Overview

**Goal**: Thay thế Sidebar 715 dòng (79px, expand-on-hover) bằng SlimSidebar 64px icon-only với tooltip, và extract logic credits/storage ra hook riêng.
**Trigger**: User ở trong dashboard — SlimSidebar luôn hiển thị trên desktop, Sheet slide-in trên mobile.
**Users affected**: Tất cả authenticated users trong dashboard.

---

## Acceptance Criteria

- [ ] SlimSidebar hiển thị 64px, chỉ icon, không expand on hover
- [ ] Hover icon hiện shadcn Tooltip với label text
- [ ] Active section có left-border gradient indicator (utc-royal → utc-sky)
- [ ] 3 nav groups giữ nguyên: Menu (Create, Calendar), Management (Drafts, Published, Failed), Account (API Dashboard, Settings)
- [ ] Bottom: credits indicator icon + số, hover tooltip hiện chi tiết
- [ ] Mobile: hamburger button mở shadcn Sheet slide-in từ trái, hiện full nav + labels + credits
- [ ] `useDashboardUsage` hook mới chứa SWR calls cho credits + storage, chia sẻ giữa SlimSidebar tooltip và TopBar
- [ ] Sidebar cũ (715 lines) bị xóa sau khi verify
- [ ] Wizard blocking logic hoạt động: khi `wizardStep !== 'idle'`, nav items bị disable
- [ ] OnboardingTour `data-tour` selectors cập nhật để trỏ vào SlimSidebar nav items mới (hoặc disable tour nếu selectors quá khác)
- [ ] Mobile Sheet dùng shadcn Sheet built-in swipe/backdrop (không cần custom touch handlers)

---

## S1: Error States & Validation

| Scenario | Expected Behavior |
|----------|------------------|
| Credits API `/api/usage` thất bại | Tooltip hiện "—" thay vì số, không crash |
| Storage API `/api/usage/storage` thất bại | Tương tự, hiện "—" |
| Credits cạn (0 remaining) | Icon credits chuyển đỏ, tooltip cảnh báo |
| Credits thấp (≤20%) | Icon credits chuyển vàng |
| Wizard đang active (`wizardStep !== 'idle'`) | Nav items có `pointer-events-none opacity-50`, chỉ active section clickable |
| Mobile Sheet đang mở + user chuyển section | Sheet tự đóng sau khi navigate |
| Window resize từ mobile → desktop | Sheet ẩn, SlimSidebar hiện |
| OnboardingTour `data-tour` selectors không tìm thấy target | Tour step skip hoặc tour disable — không crash |
| Swipe gesture trên mobile | shadcn Sheet xử lý native (swipe-to-close), không cần custom handlers |

---

## S2: Post-Completion Flow

| Event | Result |
|-------|--------|
| User click nav item | `router.push` + `setActiveSection` + Sheet đóng (mobile) |
| User hover credits icon | Tooltip hiện: "45/100 Credits\n1.2/5.0 GB\n2/3 Profiles" |
| User refresh trang | SlimSidebar mount lại, SWR refetch credits, active section từ URL |
| User navigate away từ dashboard | SlimSidebar unmount, SWR cache giữ (stale-while-revalidate) |
| Credits thay đổi (sau generate) | SWR auto-revalidate, tooltip cập nhật |

---

## S3: Cross-Feature Integration

| When This Happens | This Feature | Triggers / Updates |
|-------------------|-------------|-------------------|
| `useNavigationStore.activeSection` thay đổi | SlimSidebar | Active indicator di chuyển sang nav item tương ứng |
| `useNavigationStore.wizardStep` thay đổi | SlimSidebar | Nav items enable/disable |
| User generate content (credits giảm) | useDashboardUsage | SWR revalidate → tooltip cập nhật |
| TopBar sign out | SlimSidebar | Cả hai unmount khi redirect |
| `useNavigationStore.isSidebarOpen` (mobile) | SlimSidebar | Sheet open/close |
| Sidebar.tsx bị xóa | OnboardingTour | `data-tour` selectors trỏ vào nav items cần update hoặc disable tour |

**Shared state**: `useNavigationStore` (activeSection, wizardStep, isSidebarOpen), `useDashboardUsage` hook (credits, storage, profiles)
**Empty state**: Khi SWR loading, credits icon hiện skeleton pulse
**Cleanup**: Khi unmount, SWR subscription cleanup tự động

---

## S4: Copy Review

- [ ] Tooltip labels dùng cùng text với sidebar cũ: "Tạo bài viết", "Lịch", "Bản nháp", "Đã đăng", "Thất bại", "API Dashboard", "Tài khoản MXH"
- [ ] Credits tooltip format: "45/100 Tín dụng" (vi) / "45/100 Credits" (en)
- [ ] Storage tooltip format: "1.2/5.0 GB"
- [ ] Mobile Sheet header: "Menu" hoặc brand "CreatorHub"
- [ ] Credits cảnh báo: "Tín dụng sắp hết!" (vi) / "Credits running low!" (en)

---

## S5: State & Persistence Matrix

| Data | Stored Where | Persists After Refresh? | Cleared When |
|------|-------------|------------------------|--------------|
| activeSection | URL + Zustand | Yes | Section change |
| wizardStep | Zustand (localStorage via persist) | Yes | Wizard complete/cancel |
| isSidebarOpen (mobile) | Zustand | No (resets to false) | Section change, resize |
| credits/storage data | SWR cache (memory) | No (refetch on mount) | Page leave |
| Sheet open state | Derived from isSidebarOpen | No | Close action |

---

## S6: Manual QA Scenarios

- [ ] **Happy path desktop**: Thấy SlimSidebar 64px bên trái → hover "Tạo bài viết" → tooltip hiện → click → navigate → active indicator chuyển
- [ ] **All nav items**: Click lần lượt 7 items → mỗi lần breadcrumb (TopBar) + active indicator (SlimSidebar) cập nhật đúng
- [ ] **Credits tooltip**: Hover icon Zap ở bottom → tooltip hiện credits/storage/profiles data
- [ ] **Credits low**: Set credits ≤20% → icon chuyển vàng → hover → tooltip có cảnh báo
- [ ] **Wizard blocking**: Bắt đầu wizard (Add Source) → các nav items khác bị disable, không click được → hoàn thành wizard → nav items enable lại
- [ ] **Mobile (375px)**: SlimSidebar ẩn → hamburger button hiện → tap → Sheet slide-in từ trái → thấy full nav + labels → tap item → Sheet đóng + navigate
- [ ] **Mobile Sheet close**: Mở Sheet → tap backdrop → Sheet đóng
- [ ] **Refresh**: Đang ở `/calendar` → refresh → SlimSidebar hiện, calendar active indicator đúng vị trí
- [ ] **Window resize**: Đang ở mobile với Sheet mở → kéo rộng thành desktop → Sheet ẩn, SlimSidebar hiện
- [ ] **OnboardingTour**: Nếu tour đang active → SlimSidebar nav items có `data-tour` attributes đúng → tour highlight đúng element
- [ ] **Swipe mobile**: Mở Sheet → swipe left → Sheet đóng smoothly (shadcn Sheet native)
