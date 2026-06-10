# Phase 1: TopBar + Layout Shell

> **Status**: Draft
> **Stack**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS v4, shadcn/ui, Zustand, next-intl, next-themes, Framer Motion

## Overview

**Goal**: Thêm TopBar ngang phía trên dashboard và tái cấu trúc CreateLayout để chuyển từ layout "sidebar-only" sang layout "TopBar + sidebar + workspace".
**Trigger**: User truy cập bất kỳ route `/[locale]/[section]` (create, calendar, drafts, published, failed, settings, api-dashboard).
**Users affected**: Tất cả authenticated users khi ở trong dashboard.

---

## Acceptance Criteria

- [ ] TopBar hiển thị cố định phía trên, chứa: logo CreatorHub, breadcrumb section hiện tại, theme toggle, language switcher, user avatar dropdown
- [ ] Layout chuyển từ `[Sidebar | Content]` thành `[TopBar] / [Sidebar | Content]`
- [ ] Sidebar cũ vẫn render và hoạt động bình thường (sẽ thay thế ở Phase 2)
- [ ] User dropdown menu có: tên/email, nút Sign Out với dialog xác nhận
- [ ] Breadcrumb cập nhật tự động khi chuyển section
- [ ] Theme toggle chuyển light/dark hoạt động
- [ ] Responsive: trên mobile TopBar thu gọn (ẩn breadcrumb, chỉ hiện logo + avatar)
- [ ] i18n: tất cả text trong TopBar có cả vi + en
- [ ] Cài shadcn components trước khi implement: `npx shadcn@latest add breadcrumb avatar sheet`

---

## S1: Error States & Validation

| Scenario | Expected Behavior |
|----------|------------------|
| User chưa đăng nhập | TopBar không render (useRequireAuth redirect trước khi mount) |
| useAuth loading | Avatar hiện skeleton loader, không hiện dropdown |
| useTheme chưa mount (SSR) | Theme toggle ẩn cho đến khi client mount (tránh hydration mismatch) |
| activeSection không hợp lệ | Breadcrumb fallback về "Dashboard" |
| Sign out thất bại | Toast error "Đăng xuất thất bại", giữ user trên trang hiện tại |
| i18n key thiếu | next-intl fallback về key name (built-in behavior) |

---

## S2: Post-Completion Flow

| Event | Result |
|-------|--------|
| User click Sign Out từ dropdown | Dialog "Đăng xuất thành công!" → auto redirect `/signin` sau 1.5s |
| User chuyển section (via sidebar) | Breadcrumb cập nhật text mới, không re-mount TopBar |
| User toggle theme | Toàn bộ dashboard chuyển theme ngay, preference lưu vào localStorage bởi next-themes |
| User chuyển language | next-intl xử lý, TopBar re-render với text mới |
| User refresh trang | TopBar mount lại, đọc activeSection từ URL params, theme từ localStorage |

---

## S3: Cross-Feature Integration

| When This Happens | This Feature | Triggers / Updates |
|-------------------|-------------|-------------------|
| `useNavigationStore.activeSection` thay đổi | TopBar | Breadcrumb text cập nhật |
| `useAuth` trả về user data | TopBar | Avatar + name hiển thị trong dropdown |
| `useTheme` thay đổi theme | TopBar | Icon Sun/Moon chuyển đổi |
| User click Sign Out trong TopBar | TopBar | Gọi `signOut()` từ useAuth → dialog → redirect |
| Sidebar cũ vẫn có nút Sign Out | Sidebar | Cả hai nơi đều gọi cùng `signOut()` — Phase 2 sẽ xóa từ sidebar |
| Layout thay đổi → OnboardingTour `data-tour` selectors | OnboardingTour | Selectors trỏ vào sidebar elements vẫn OK vì Phase 1 giữ sidebar cũ. Nhưng cần audit ở Phase 2 |

**Shared state**: `useNavigationStore` (activeSection), `useAuth` (user, signOut), `useTheme` (theme, setTheme)
**Empty state**: Nếu user chưa load xong → skeleton avatar, breadcrumb mặc định
**Cleanup**: Không có state riêng cần cleanup — tất cả đọc từ global stores

---

## S4: Copy Review

- [ ] Breadcrumb labels dùng tên section thân thiện: "Tạo bài viết", "Lịch", "Bản nháp", "Đã đăng", "Thất bại", "Dashboard", "Tài khoản MXH"
- [ ] Theme toggle tooltip: "Chuyển giao diện" (không phải "Toggle theme")
- [ ] User dropdown: "Đăng xuất" (không phải "Log out" trong bản vi)
- [ ] Sign out dialog: "Đăng xuất thành công!" + "Đang chuyển đến trang đăng nhập..."
- [ ] Loading state: avatar skeleton, không hiện text "Loading..."

---

## S5: State & Persistence Matrix

| Data | Stored Where | Persists After Refresh? | Cleared When |
|------|-------------|------------------------|--------------|
| activeSection | URL params + Zustand store | Yes (URL is source of truth) | Navigation change |
| theme | localStorage (next-themes) | Yes | User toggles |
| locale | URL path (`/vi/` or `/en/`) | Yes | User switches language |
| user info | Supabase session + useAuth | Yes (session cookie) | Sign out |
| dropdown open state | Component local state | No | Re-render |

---

## S6: Manual QA Scenarios

- [ ] **Happy path**: Login → thấy TopBar với logo, breadcrumb "Tạo bài viết", avatar bên phải → click avatar → dropdown hiện tên + "Đăng xuất"
- [ ] **Breadcrumb update**: Click sidebar "Lịch" → breadcrumb đổi thành "Lịch" → click "Bản nháp" → breadcrumb đổi thành "Bản nháp"
- [ ] **Theme toggle**: Click icon Sun → chuyển dark mode → icon đổi thành Moon → refresh → vẫn dark mode
- [ ] **Language switch**: Đang ở vi → chuyển en → breadcrumb đổi sang English → TopBar text đổi sang English
- [ ] **Sign out**: Click avatar → "Đăng xuất" → dialog "Đăng xuất thành công!" hiện → auto redirect `/signin` sau 1.5s
- [ ] **Mobile (375px)**: TopBar thu gọn → breadcrumb ẩn → chỉ thấy logo + avatar → dropdown vẫn hoạt động
- [ ] **Refresh**: Đang ở `/vi/calendar` → refresh → TopBar hiện breadcrumb "Lịch", theme giữ nguyên
- [ ] **Auth expired**: Session hết hạn → useRequireAuth redirect về signin trước khi TopBar mount
