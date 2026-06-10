# Đợt 1: Dark Mode Fix + Platform Brand Colors + UTC Treatment

> **Status**: Draft
> **Stack**: Next.js 14, React 18, TypeScript, Tailwind CSS v4, shadcn/ui, Zustand, next-intl

## Overview

**Goal**: Fix tất cả dark mode contrast issues và thiết lập hệ thống platform brand colors xuyên suốt app, biến giao diện từ "generic template" thành UTC-branded.
**Trigger**: User ở trong dashboard, bất kỳ section nào, cả light và dark mode.
**Users affected**: Tất cả authenticated users.

---

## Acceptance Criteria

- [ ] Button ghost/outline variants không còn text đen trên dark mode
- [ ] Tạo platform color system: mỗi platform có bg color, text color, border color riêng
- [ ] TabsManager: active tab có color bar theo platform (TikTok=đen, IG=pink, YT=đỏ, FB=blue...)
- [ ] SourcePanel: source type icons có colored circle background
- [ ] Settings cards: mỗi platform card có subtle brand color tint
- [ ] PostCard: platform badge có brand color
- [ ] Tất cả hover states readable trong cả light + dark mode
- [ ] Không hardcode màu — dùng CSS variables hoặc Tailwind classes từ platform config

---

## S1: Error States & Validation

| Scenario | Expected Behavior |
|----------|------------------|
| Platform không có trong color map | Fallback về neutral gray (`bg-muted`) |
| Dark mode + ghost button hover | Text phải `text-foreground` (sáng), không phải `text-accent-foreground` (tối) |
| Dark mode + outline button hover | Background `hover:bg-muted` thay vì `hover:bg-accent` |
| Dark mode + secondary background | Text contrast ratio ≥ 4.5:1 (WCAG AA) |
| Platform icon không load được | Hiện fallback letter (ví dụ: "T" cho TikTok) |
| Custom theme colors conflict | Platform colors dùng Tailwind classes cố định, không phụ thuộc CSS variables |

---

## S2: Post-Completion Flow

| Event | Result |
|-------|--------|
| Đợt 1 hoàn thành | Tất cả buttons, cards, tabs, source items hiện đúng màu trong cả light + dark |
| User toggle dark mode | Platform colors giữ nguyên (TikTok vẫn đen, IG vẫn pink) — chỉ text/background adapt |
| User thêm source mới | Source item hiện với đúng color cho type (YouTube=red, Article=blue...) |
| User chuyển platform tab | Tab indicator đổi sang brand color của platform được chọn |

---

## S3: Cross-Feature Integration

| When This Happens | This Feature | Triggers / Updates |
|-------------------|-------------|-------------------|
| Platform color system được tạo | TabsManager, SourcePanel, Settings, PostCard, Calendar | Tất cả consume cùng 1 color config |
| Button variants fix | Toàn bộ app (ghost/outline buttons) | Hover states readable everywhere |
| PostCard platform badge | DraftsSection, PublishedSection, FailedSection | Cards hiện platform color |
| Settings platform cards | SettingsSection | Each card có brand tint |

**Shared state**: `lib/constants/platforms.ts` — PLATFORM_COLOR_MAP mở rộng thêm text, border, gradient
**Empty state**: N/A — visual changes only
**Cleanup**: N/A

---

## S4: Copy Review

- [ ] Platform names giữ nguyên (TikTok, Instagram, YouTube... — proper nouns)
- [ ] Không thêm text mới — chỉ thay đổi visual
- [ ] Color-blind friendly: platform colors có đủ contrast, không chỉ dựa vào màu sắc

---

## S5: State & Persistence Matrix

| Data | Stored Where | Persists After Refresh? | Cleared When |
|------|-------------|------------------------|--------------|
| Platform colors | Static config (constants file) | N/A (compiled) | N/A |
| Theme (light/dark) | localStorage (next-themes) | Yes | User toggles |
| Button variants | CSS (button.tsx) | N/A (compiled) | N/A |

---

## S6: Manual QA Scenarios

- [ ] **Dark mode buttons**: Toggle dark → hover tất cả ghost buttons trong app → text phải readable (không đen)
- [ ] **Dark mode outline**: Toggle dark → hover Google OAuth button → text không đen
- [ ] **Platform tabs**: Mở CreateSection → tạo posts cho TikTok, Instagram, YouTube → tab active indicator hiện đúng màu mỗi platform
- [ ] **Source panel colors**: Add source YouTube URL → source item hiện icon đỏ YouTube. Add Article → icon xanh. Add TikTok → icon đen
- [ ] **Settings cards**: Vào Settings → mỗi platform card có subtle color tint (Instagram pink border, YouTube red border...)
- [ ] **PostCard badges**: Vào Drafts → mỗi card có platform badge đúng màu
- [ ] **Light mode check**: Toggle light → tất cả platform colors vẫn visible + readable
- [ ] **Mobile 375px**: Platform colors hiện đúng, không bị crop
