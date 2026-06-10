# Phase 5: UTC Branding Polish

> **Status**: Draft
> **Stack**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS v4, shadcn/ui, next-themes

## Overview

**Goal**: Final visual polish pass đảm bảo UTC branding nhất quán, dark mode hoạt động đúng, responsive audit, và thêm status bar (optional).
**Trigger**: Sau khi Phase 1-4 hoàn thành, apply branding pass lên toàn bộ dashboard.
**Users affected**: Tất cả users nhìn thấy dashboard.

---

## Acceptance Criteria

- [ ] Tất cả CTA buttons dùng gradient `from-utc-royal to-utc-sky` nhất quán
- [ ] Active states dùng utc-royal/utc-sky gradient indicators
- [ ] Card hover effects dùng `shadow-accent` hoặc `hover:border-utc-royal/30`
- [ ] Section icons dùng gradient backgrounds (utc-royal → utc-sky)
- [ ] Dark mode: tất cả components hiển thị đúng (không có text invisible, không có contrast issues)
- [ ] Responsive: test 375px, 768px, 1024px, 1280px — không có horizontal scroll, không có overlap
- [ ] Transitions: hover lift (`-translate-y-0.5`), fade-in cho section change, smooth panel collapse/expand
- [ ] Optional StatusBar ở bottom: "Hệ thống hoạt động" + UTC branding

---

## S1: Error States & Validation

| Scenario | Expected Behavior |
|----------|------------------|
| Dark mode + gradient text | Gradient vẫn visible trên dark background (check contrast) |
| Dark mode + inverted sections | Sections đã inverted không double-invert trong dark mode |
| Dark mode + card shadows | Shadows vẫn visible nhưng subtle (không quá sáng) |
| Very small screen (320px) | Không break layout, text có thể wrap nhưng không overflow |
| Very large screen (2560px) | Content centered, max-width containers giữ layout |
| prefers-reduced-motion | Disable hover lift animations, giữ instant state changes |

---

## S2: Post-Completion Flow

| Event | Result |
|-------|--------|
| Phase 5 hoàn thành | Toàn bộ dashboard có UTC branding nhất quán từ TopBar → SlimSidebar → Content → Cards |
| User toggle dark mode | Tất cả elements chuyển mượt mà, không flash of wrong color |
| User resize browser | Layout adapt smoothly, không jump layout |

---

## S3: Cross-Feature Integration

| When This Happens | This Feature | Triggers / Updates |
|-------------------|-------------|-------------------|
| Landing page → Dashboard | User | Branding nhất quán — cùng gradient palette, cùng font system |
| Auth pages → Dashboard | User | Split-screen auth panel gradient match dashboard SlimSidebar gradient |
| Dark mode toggle | All components | CSS variables tự switch, shadcn components inherit |

**Shared state**: CSS custom properties (`--utc-*`), Tailwind theme config
**Empty state**: N/A — polish phase
**Cleanup**: N/A

---

## S4: Copy Review

- [ ] StatusBar (nếu có): "Hệ thống đang hoạt động" (vi) / "System is running" (en)
- [ ] Không còn hardcoded English text nào trong dashboard components
- [ ] Tất cả tooltip text có i18n
- [ ] Loading states có descriptive text ("Đang tải bài viết..." không phải "Loading...")

---

## S5: State & Persistence Matrix

| Data | Stored Where | Persists After Refresh? | Cleared When |
|------|-------------|------------------------|--------------|
| theme | localStorage (next-themes) | Yes | User toggles |
| CSS variables | globals.css (:root / .dark) | N/A (compiled) | N/A |
| StatusBar visibility | Render always (if implemented) | N/A | N/A |

---

## S6: Manual QA Scenarios

- [ ] **Dark mode full audit**: Toggle dark → check: TopBar, SlimSidebar, SectionHeaders, Cards, Modals, FilterBar, Calendar grid, AIChatbox, Editor — tất cả readable, no contrast issues
- [ ] **Light mode full audit**: Toggle light → check same components — branding visible, gradients vibrant
- [ ] **Landing → Dashboard continuity**: Từ landing page click "Trải nghiệm" → sign in → dashboard — gradient palette nhất quán
- [ ] **Mobile 375px**: Toàn bộ dashboard — no horizontal scroll, touch targets ≥44px, text readable
- [ ] **Tablet 768px**: Cards 2-col, TopBar full, SlimSidebar hiện
- [ ] **Desktop 1280px**: Cards 3-col, full layout, generous whitespace
- [ ] **Gradient buttons**: Tất cả primary actions (Generate, Publish, Schedule, Save) dùng gradient button
- [ ] **Hover effects**: Cards lift, buttons lift, sidebar items highlight — transitions smooth (200-300ms)
- [ ] **StatusBar (nếu có)**: Hiện ở bottom, green dot + "Hệ thống đang hoạt động", không overlap content
- [ ] **Print/screenshot ready**: Chụp screenshot dashboard cho báo cáo đồ án — trông professional
