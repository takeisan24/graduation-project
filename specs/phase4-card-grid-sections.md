# Phase 4: List → Card Grid (Drafts, Published, Failed)

> **Status**: Draft
> **Stack**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS v4, shadcn/ui, Zustand, next-intl

## Overview

**Goal**: Chuyển 3 sections (Drafts, Published, Failed) từ vertical list layout sang responsive card grid layout để tạo giao diện khác biệt với project gốc.
**Trigger**: User truy cập Drafts, Published, hoặc Failed section.
**Users affected**: Tất cả authenticated users có drafts/published/failed posts.

---

## Acceptance Criteria

- [ ] PostCard component reusable cho cả 3 sections, dùng shadcn Card
- [ ] Card hiển thị: platform icon, content preview (line-clamp-3), ngày tạo, action buttons
- [ ] Grid responsive: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4`
- [ ] Card hover: `hover:border-utc-royal/30 hover:shadow-lg hover:-translate-y-0.5 transition-all`
- [ ] Drafts cards: action buttons Edit + Delete
- [ ] Published cards: hiện engagement stats footer (nếu có data)
- [ ] Failed cards: error badge + Retry + Delete actions
- [ ] Empty state: illustration/icon + text "Chưa có bài viết nào" + action button
- [ ] Pagination (Load More) giữ nguyên logic
- [ ] FilterBar giữ nguyên (platform filter, date filter, search)
- [ ] Tất cả store interactions giữ nguyên (không thay đổi business logic)

---

## S1: Error States & Validation

| Scenario | Expected Behavior |
|----------|------------------|
| Posts list rỗng | Empty state card hiện: icon + "Chưa có bản nháp nào" + "Tạo bài viết đầu tiên →" |
| API load posts thất bại | Toast error, giữ UI trước đó (stale data từ SWR) |
| Delete post thất bại | Toast error "Xóa thất bại", giữ card trong grid |
| Delete post thành công | Card remove khỏi grid với animation (fade out) |
| Retry failed post thất bại | Toast error, card giữ nguyên trạng thái |
| Post content quá dài | line-clamp-3 cắt text, không break layout |
| Post không có media | Card không hiện thumbnail area, chỉ text content |
| Load More thất bại | Toast error, button giữ nguyên, user có thể retry |

---

## S2: Post-Completion Flow

| Event | Result |
|-------|--------|
| User click Edit draft | Navigate đến CreateSection với draft loaded (logic giữ nguyên) |
| User click Delete draft | Confirm dialog → xóa → card biến mất khỏi grid |
| User click Retry failed post | RetryDetailModal mở (logic giữ nguyên) |
| User click Load More | Thêm cards vào grid, scroll giữ vị trí |
| User thay đổi filter | Grid cập nhật, hiện filtered results |
| User navigate away | Grid state giữ trong store, quay lại thấy data cũ |
| User refresh | Store rehydrate từ localStorage, SWR refetch |

---

## S3: Cross-Feature Integration

| When This Happens | This Feature | Triggers / Updates |
|-------------------|-------------|-------------------|
| User publish draft thành công | DraftsSection | Draft card biến mất, xuất hiện trong PublishedSection |
| User generate content ở CreateSection | DraftsSection | Draft mới xuất hiện khi quay lại Drafts |
| User retry failed post thành công | FailedSection | Failed card biến mất |
| Calendar schedule post | DraftsSection | Draft có scheduled badge |
| FilterBar filter thay đổi | All 3 sections | Grid re-render với filtered data |

**Shared state**: `useDraftsStore`, `usePublishedPostsStore`, `useFailedPostsStore` — tất cả giữ nguyên
**Empty state**: Grid hiện empty state card to, centered, với action button
**Cleanup**: Không thay đổi — stores quản lý data lifecycle

---

## S4: Copy Review

- [ ] Empty state drafts: "Chưa có bản nháp nào. Tạo bài viết đầu tiên →"
- [ ] Empty state published: "Chưa có bài đăng nào. Tạo và xuất bản bài viết đầu tiên →"
- [ ] Empty state failed: "Không có bài đăng thất bại. Tuyệt vời!"
- [ ] Card date format: "2 giờ trước", "Hôm qua", "15/03/2026" (dùng date utils hiện tại)
- [ ] Delete confirm: "Bạn có chắc muốn xóa bài viết này?"
- [ ] Load more button: "Tải thêm" (không phải "Load More" trong bản vi)
- [ ] Failed error badge: hiện error reason ngắn gọn (line-clamp-1)

---

## S5: State & Persistence Matrix

| Data | Stored Where | Persists After Refresh? | Cleared When |
|------|-------------|------------------------|--------------|
| drafts list | Zustand store + SWR | Yes (store persist) + refetch | Logout |
| published list | Zustand store + SWR | Yes (store persist) + refetch | Logout |
| failed list | Zustand store + SWR | Yes (store persist) + refetch | Logout |
| selected filters | Component local state | No | Section change |
| pagination cursor | Store (offset/page) | Yes (store persist) | Filter change |
| grid vs list view toggle | localStorage (optional) | Yes | Manual toggle |

---

## S6: Manual QA Scenarios

- [ ] **Happy path Drafts**: Vào Drafts → thấy grid cards 3 cột (desktop) → mỗi card có platform icon + preview + date + Edit/Delete
- [ ] **Happy path Published**: Vào Published → grid cards → mỗi card có platform icon + content + date
- [ ] **Happy path Failed**: Vào Failed → grid cards → mỗi card có error badge đỏ + Retry + Delete
- [ ] **Empty state**: Xóa hết drafts → thấy empty state card "Chưa có bản nháp nào" + button "Tạo bài viết"
- [ ] **Filter**: Chọn platform filter "TikTok" → chỉ thấy TikTok cards → bỏ filter → thấy tất cả
- [ ] **Delete draft**: Click Delete trên card → confirm dialog → xác nhận → card biến mất
- [ ] **Edit draft**: Click Edit → navigate về CreateSection, draft loaded trong editor
- [ ] **Retry failed**: Click Retry → RetryDetailModal mở → retry → thành công → card biến mất
- [ ] **Load More**: Scroll xuống → "Tải thêm" button → click → thêm cards xuất hiện
- [ ] **Mobile (375px)**: Cards hiện 1 cột → scroll vertical → actions vẫn hoạt động
- [ ] **Responsive (768px)**: Cards hiện 2 cột
- [ ] **Responsive (1280px+)**: Cards hiện 3 cột
