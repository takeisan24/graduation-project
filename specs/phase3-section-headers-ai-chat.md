# Phase 3: Section Headers + AI Chat Repositioning

> **Status**: Draft
> **Stack**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS v4, shadcn/ui, Zustand, next-intl

## Overview

**Goal**: (A) Tạo SectionHeader component thống nhất cho tất cả sections. (B) Di chuyển AI Chat từ right panel (350px) sang bottom collapsible panel trong CreateSection.
**Trigger**: User vào bất kỳ section nào → thấy header thống nhất. User ở CreateSection → AI Chat hiện ở bottom thay vì bên phải.
**Users affected**: Tất cả authenticated users trong dashboard.

---

## Acceptance Criteria

### A. Section Headers
- [ ] SectionHeader component nhận: icon, title, description, actions (ReactNode optional)
- [ ] Icon hiển thị trong gradient container (utc-royal → utc-sky)
- [ ] Title dùng font-semibold, description dùng text-muted-foreground
- [ ] 7 sections đều dùng SectionHeader: Create, Calendar, Drafts, Published, Failed, API Dashboard, Settings
- [ ] i18n đầy đủ: mỗi section có title + description trong cả vi + en

### B. AI Chat Bottom Panel
- [ ] AI Chat chuyển từ right panel (350px cố định) → bottom collapsible panel
- [ ] Panel height mặc định ~250px, collapse/expand bằng nút toggle (không drag resize — giữ đơn giản)
- [ ] Khi collapse: panel ẩn hoàn toàn, chỉ còn thanh toggle bar (h-10) ở bottom với icon + "AI Chat"
- [ ] CreateSection layout đổi từ `[Sources | Editor | Chat]` → `[Sources | Editor]` trên + `[Chat]` dưới
- [ ] AIChatbox component bên trong không thay đổi logic — chỉ thay đổi container
- [ ] Auto-open logic giữ nguyên: `openPosts.length > 0` → mở, `openPosts.length === 0` → đóng
- [ ] Mobile giữ nguyên: tab-based switching (sources/editor/chat), không dùng bottom panel

---

## S1: Error States & Validation

| Scenario | Expected Behavior |
|----------|------------------|
| Section không có actions | SectionHeader render icon + title + description, bỏ qua actions area |
| AI Chat API thất bại | Xử lý bên trong AIChatbox (không đổi), bottom panel vẫn render container |
| AI Chat panel expand khi viewport nhỏ | Panel height max 50vh, scroll nội bộ trong AIChatbox |
| openPosts rỗng | AI Chat panel tự collapse, toggle bar vẫn hiện để user mở thủ công |
| Mobile view | Bottom panel không render, giữ tab-based switching |

---

## S2: Post-Completion Flow

| Event | Result |
|-------|--------|
| User tạo post mới | openPosts.length tăng → AI Chat panel auto-expand |
| User xóa tất cả posts | openPosts.length = 0 → AI Chat panel auto-collapse |
| User thủ công collapse panel | Panel ẩn, toggle bar hiện ở bottom |
| User thủ công expand panel | Panel hiện lại với height trước đó |
| User chuyển section (ví dụ Create → Calendar) | AI Chat panel unmount (SectionsManager unmount CreateSection) |
| User quay lại Create | AI Chat panel mount lại, kiểm tra openPosts → auto-open/close |
| User refresh | CreateSection mount lại, AI Chat kiểm tra openPosts state |

---

## S3: Cross-Feature Integration

| When This Happens | This Feature | Triggers / Updates |
|-------------------|-------------|-------------------|
| `useCreatePostsStore.openPosts` thay đổi | CreateSection | Auto-open/close AI Chat bottom panel |
| `useCreateChatStore` messages thay đổi | AIChatbox (bên trong panel) | Scroll to bottom trong chat area |
| User click "Generate" trong ActionBar | Editor panel | Có thể trigger AI Chat open nếu chưa mở |
| SectionsManager unmount CreateSection | CreateSection | Bottom panel unmount, chat state giữ trong store |
| Wizard overlay active (z-30/z-40) | CreateSection | Bottom panel cũng cần `z-40 pointer-events-none` overlay khi wizard active, giống right panel cũ |

**Shared state**: `useCreatePostsStore` (openPosts → trigger auto-open), `useCreateChatStore` (messages, input)
**Empty state**: Không có posts → AI Chat collapsed, toggle bar text "AI Chat" hiện ở bottom
**Cleanup**: Panel height preference có thể lưu localStorage, chat messages giữ trong Zustand store

---

## S4: Copy Review

- [ ] SectionHeader titles: "Tạo bài viết", "Lịch", "Bản nháp", "Đã đăng", "Bài đăng thất bại", "Dashboard API", "Tài khoản MXH"
- [ ] SectionHeader descriptions: ngắn gọn, mô tả chức năng section
- [ ] AI Chat toggle bar text: "AI Chat" (cả vi + en, brand name)
- [ ] Collapse icon: ChevronDown khi expanded, ChevronUp khi collapsed

---

## S5: State & Persistence Matrix

| Data | Stored Where | Persists After Refresh? | Cleared When |
|------|-------------|------------------------|--------------|
| isAIChatOpen | Component state + derived from openPosts | No (re-derived on mount) | Section change |
| chatPanelCollapsed | Component state (derived from openPosts) | No | Section change |
| openPosts | Zustand store | Yes (localStorage persist) | User closes posts |
| chat messages | Zustand store (useCreateChatStore) | Yes (localStorage persist) | User clears / logout |
| SectionHeader data | i18n keys (static) | N/A | N/A |

---

## S6: Manual QA Scenarios

- [ ] **Section headers**: Vào từng section (7 cái) → mỗi section có header đúng icon + title + description
- [ ] **AI Chat auto-open**: Ở CreateSection, không có posts → AI Chat collapsed → tạo source + generate → posts xuất hiện → AI Chat auto-expand
- [ ] **AI Chat auto-close**: Xóa tất cả posts → AI Chat auto-collapse
- [ ] **Manual toggle**: AI Chat expanded → click collapse → panel ẩn, toggle bar hiện → click expand → panel hiện lại
- [ ] **Chat functionality**: Trong bottom panel, gõ message → gửi → nhận response → scroll to bottom hoạt động
- [ ] **Mobile (375px)**: Không thấy bottom panel → thấy 3 tabs (Sources/Editor/Chat) → tap Chat tab → thấy AIChatbox full screen
- [ ] **Section change**: Đang ở Create với AI Chat open → click Calendar → AI Chat unmount → quay lại Create → AI Chat kiểm tra openPosts và auto-open/close đúng
- [ ] **Refresh**: Có posts, AI Chat open → refresh → mount lại → kiểm tra openPosts → auto-open lại
