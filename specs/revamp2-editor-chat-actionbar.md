# Đợt 2: Editor + Chat + ActionBar Redesign

> **Status**: Draft
> **Stack**: Next.js 14, React 18, TypeScript, Tailwind CSS v4, shadcn/ui, Zustand, next-intl

## Overview

**Goal**: Redesign core workspace (Editor, AI Chat, ActionBar) từ "functional template" thành "polished, branded product" — message bubbles có màu, editor có visual hierarchy, ActionBar có grouped icons.
**Trigger**: User ở CreateSection — viết/edit content, dùng AI Chat, dùng action tools.
**Users affected**: Tất cả authenticated users đang tạo nội dung.

---

## Acceptance Criteria

### Editor (PostEditor + PostEditorWrapper)
- [ ] Editor card có subtle gradient top border (utc-royal → utc-sky) khi active
- [ ] Empty state cải thiện: CreatorHubIcon thay generic icons, animated illustration
- [ ] Character counter đổi màu: xanh (< 80%), vàng (80-95%), đỏ (> 95%)
- [ ] Version navigation có visual polish (gradient badge cho version number)
- [ ] Textarea focus state có ring-utc-royal thay vì ring mặc định

### AI Chatbox
- [ ] User messages: bubble phải (bg-utc-royal/10 border border-utc-royal/20), text trái-aligned
- [ ] AI messages: bubble trái (bg-muted border border-border), icon AI bên trái
- [ ] Model selector button có subtle gradient indicator cho model đang dùng
- [ ] Send button gradient (utc-royal → utc-sky) thay vì primary flat
- [ ] Example suggestions (khi chat rỗng) có hover effect + icon
- [ ] Copy button trên AI messages rõ ràng hơn (outline style, show on hover)

### ActionBar
- [ ] Buttons grouped bằng separator visual (không chỉ gap)
- [ ] Generate dropdown button có gradient (utc-royal → utc-sky) — nổi bật nhất
- [ ] Format/Translate buttons có icon + text (không chỉ icon trên desktop)
- [ ] Credit display có icon Zap + color (xanh/vàng/đỏ theo mức)
- [ ] Save/Publish button ở right có gradient accent

### TabsManager
- [ ] Active tab có bottom border gradient theo platform color (từ Đợt 1)
- [ ] Tab close button (X) chỉ hiện on hover, smooth transition
- [ ] "Add platform" button có dashed border + plus icon

---

## S1: Error States & Validation

| Scenario | Expected Behavior |
|----------|------------------|
| Chat API thất bại | AI bubble hiện error message styled (red tint), retry button |
| Chat gửi message khi offline | Toast "Không có kết nối", message không mất |
| Editor textarea rỗng + bấm Save | Toast warning "Nội dung trống" |
| Character limit vượt quá | Counter đỏ + border textarea đổi sang destructive |
| Credits = 0, bấm Generate | Toast "Hết credits", Generate button disabled |
| Model selector không load models | Fallback về model mặc định, không crash |
| Copy message thất bại | Toast error "Không thể copy" |

---

## S2: Post-Completion Flow

| Event | Result |
|-------|--------|
| User gửi chat message | Message bubble xuất hiện bên phải, AI typing indicator, AI response xuất hiện bên trái |
| User click Copy trên AI message | Toast "Đã copy!", button đổi thành checkmark 2s |
| User bấm Generate Image | ActionBar dropdown đóng, ImageGenModal mở |
| User thay đổi content trong editor | Character counter cập nhật real-time, color thay đổi theo threshold |
| User chuyển platform tab | Editor content đổi, character limit đổi theo platform |
| User bấm Save Draft | Toast "Đã lưu bản nháp", button flash success |

---

## S3: Cross-Feature Integration

| When This Happens | This Feature | Triggers / Updates |
|-------------------|-------------|-------------------|
| Platform colors (Đợt 1) đã cài | TabsManager | Active tab indicator dùng platform color |
| User generate content → credits giảm | ActionBar credit display | Cập nhật realtime via useDashboardUsage |
| AI Chat response chứa content suggestion | AIChatbox | User có thể copy → paste vào editor |
| Editor content thay đổi | ActionBar | Character counter cập nhật |
| openPosts thay đổi | CreateSection | AI Chat auto-open/close (đã fix bug) |

**Shared state**: `useCreatePostsStore` (content, selectedPostId), `useCreateChatStore` (messages), `useDashboardUsage` (credits)
**Empty state**: Editor trống → empty state illustration + 2-step guide. Chat trống → example suggestion chips.
**Cleanup**: Chat messages giữ trong store khi chuyển section, clear khi logout.

---

## S4: Copy Review

- [ ] Chat example suggestions: "Viết caption hài hước", "Tạo hook mở đầu", "Rút gọn nội dung" (vi) / "Write funny caption", "Create opening hook", "Shorten content" (en)
- [ ] Character counter: "0/280" format, không cần label "Characters:"
- [ ] Generate button: "Tạo" (vi) / "Generate" (en) + dropdown arrow
- [ ] Copy success: "Đã copy!" (vi) / "Copied!" (en)
- [ ] AI typing indicator: 3 dots animation, không text

---

## S5: State & Persistence Matrix

| Data | Stored Where | Persists After Refresh? | Cleared When |
|------|-------------|------------------------|--------------|
| Chat messages | Zustand (useCreateChatStore) + localStorage | Yes | User clears / logout |
| Selected model | Zustand (useCreateChatStore) | Yes | Manual change |
| Editor content | Zustand (useCreatePostsStore) | Yes | Post closed |
| Character count | Derived (computed from content) | N/A | Real-time |
| Active tab | Zustand (useCreatePostsStore.selectedPostId) | Yes | Post closed |

---

## S6: Manual QA Scenarios

- [ ] **Chat bubbles**: Gõ message "Hello" → bubble phải, bg xanh nhạt → AI response → bubble trái, bg muted, icon AI
- [ ] **Chat empty state**: Mở chat lần đầu, không có posts → thấy example suggestions → click suggestion → message tự fill vào input
- [ ] **Model selector**: Click model dropdown → thấy list models → chọn Gemini → header cập nhật
- [ ] **Character counter colors**: Gõ text ngắn → counter xanh → gõ đến 80% → counter vàng → gõ đến 95% → counter đỏ
- [ ] **ActionBar generate**: Click Generate dropdown → thấy Image/Video/Library options → click Image → modal mở
- [ ] **Tab platform colors**: Tạo post TikTok → tab indicator đen → tạo Instagram → tab indicator pink
- [ ] **Editor empty state**: Không có posts → thấy CreatorHubIcon + "Bước 1: Thêm nguồn" + "Bước 2: Tạo nội dung"
- [ ] **Dark mode**: Toggle dark → chat bubbles readable → editor card visible → ActionBar buttons contrast OK
- [ ] **Mobile 375px**: Chat full-screen khi tab active → editor full-screen khi tab active → ActionBar responsive
