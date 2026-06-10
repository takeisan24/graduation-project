# THESIS-003: Remove Commercial Elements — Academic Thesis Rewrite

> **Status**: Draft
> **Stack**: Next.js 14, Footer, Landing Page

## Overview

**Goal**: Remove all commercial/SaaS elements so the app is clearly an academic graduation thesis project, not a commercial product.
**Trigger**: Graduation thesis audit found commercial pricing and SaaS patterns that are inappropriate for a thesis defense.
**Users affected**: Landing page visitors, app users, thesis examiners

---

## Findings (Audit Result)

| Item | Status |
|------|--------|
| Pricing page | ✅ **Không có trang pricing** trong app — clean |
| Mock payment / BuyCredits | ✅ **Không có** BuyCredits modal hoặc payment flow trong app — clean |
| Footer | ✅ **Đã dùng i18n** (`t('thesis')`, `t('university')`, `t('student')`) — clean |
| Credits system | ⚠️ **Credits là AI quota system** (generate text/image) — phần của thesis, không phải commercial |
| Copyright | ⚠️ `"© {year} CreatorHub"` — không có "Inc." — chỉ cần thêm attribution |

---

## Acceptance Criteria

- [ ] Footer giữ nguyên cấu trúc i18n hiện tại, chỉ cập nhật text nếu cần
- [ ] Không có trang Pricing, BuyCredits, hay payment flow — đã clean
- [ ] Credits system (AI quota) giữ nguyên — là phần hợp lệ của thesis
- [ ] Landing page testimonial: author photo đã được xử lý trong THESIS-001
- [ ] `npm run build` passes

---

## S1: Error States & Validation

| Scenario | Expected Behavior |
|----------|-----------------|
| Không có changes cần thiết | Footer đã i18n, không có pricing/buy pages → almost clean |

---

## S2: Post-Completion Flow

| Event | Result |
|-------|--------|
| Footer giữ nguyên | Attribution học thuật đã có qua i18n keys |
| KHÔNG có pricing/buy pages | Examiner không thấy commercial elements |

---

## S3: Cross-Feature Integration

| Element | App-wide Impact | Action |
|---------|----------------|--------|
| Footer | Tất cả pages | Đã dùng i18n → chỉ cần verify |
| Pricing page | Navigation | Không tồn tại → no action needed |
| BuyCredits modal | Không tồn tại | No action needed |
| Credits (AI quota) | API routes, UI | Giữ nguyên — academic use case hợp lệ |

---

## S4: Copy Review

Kiểm tra các text trong `messages/vi.json` và `messages/en.json`:
- [ ] Footer keys (`thesis`, `university`, `student`, `builtWith`) → verify nội dung đúng academic
- [ ] Không có text nào mang tính commercial ("Buy Now", "Get Started", "Plans", "Pricing")
- [ ] Không có text nào giả định đây là sản phẩm thương mại

---

## S5: State & Persistence Matrix

| Data | Stored Where | Persists After Refresh? | Cleared When |
|------|-------------|------------------------|--------------|
| Footer i18n text | `messages/vi.json`, `messages/en.json` | Yes | Manual edit |

---

## S6: Manual QA Scenarios

- [ ] Visit landing page → no pricing, no buy buttons, no commercial text
- [ ] Footer shows academic attribution (Vũ Tuấn Anh, CNTT4 K63, ĐH GTVT)
- [ ] "Built with" text is academic-appropriate
- [ ] Navigate through all pages → no commercial SaaS patterns
- [ ] `npm run build` → 0 errors

---

## Actual Changes Needed (Minimal)

 Sau khi audit kỹ:

| Change | Priority | Notes |
|--------|----------|-------|
| **THESIS-001**: Replace shego.jpg | 🔴 HIGH | Author photo trong testimonial |
| **THESIS-002**: Fix hardcoded i18n | 🟡 MEDIUM | ~34 strings còn hardcode |
| **THESIS-003**: Verify footer text | 🟢 LOW | Footer đã clean — chỉ verify i18n content |

**Kết luận**: App gốc **không có vấn đề commercial nghiêm trọng**. Không có trang Pricing, không có BuyCredits modal. Credits system là AI quota — hợp lệ cho thesis. Chỉ cần:
1. THESIS-001: Thay shego.jpg bằng placeholder
2. THESIS-002: Hoàn thiện i18n
3. THESIS-003: Verify footer text trong messages/

Không cần rewrite landing page hay xóa features.
