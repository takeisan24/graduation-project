# Thesis Cleanup Specs

> These specs address issues found during graduation thesis audit (2026-04-05).

## Status Overview

| Spec | Priority | Status | Notes |
|------|----------|--------|-------|
| [THESIS-001](./THESIS-001-inappropriate-images.md) | 🔴 HIGH | Draft | Replace shego.jpg |
| [THESIS-002](./THESIS-002-i18n-hardcoded-strings.md) | 🟡 MEDIUM | Draft | ~34 hardcoded strings |
| [THESIS-003](./THESIS-003-pricing-academic-rewrite.md) | 🟢 LOW | Draft | Verify only — mostly clean |

---

## Audit Summary — Actual Findings

Sau khi điều tra kỹ lưỡng, kết quả khác với báo cáo ban đầu:

### ❌ Cần xử lý

| Issue | Severity | Chi tiết |
|-------|----------|----------|
| `shego.jpg` | 🔴 HIGH | Ảnh người thật dùng làm mock avatar — cần thay bằng placeholder |
| Hardcoded i18n | 🟡 MEDIUM | ~34 strings trong 5 files |
| `maiovo_icon.png` | 🟢 LOW | Không có code references — có thể xóa |

### ✅ Đã clean — Không cần làm gì

| Item | Kết quả |
|------|---------|
| Pricing page | ✅ **Không có** trang pricing trong app |
| BuyCredits modal | ✅ **Không có** BuyCredits/payment flow |
| Footer | ✅ **Đã dùng i18n** (`t('thesis')`, `t('university')`, `t('student')`) |
| Commercial text | ✅ **Không có** "Buy Now", "Get Started", "Plans", "$29/month" |
| Footer copyright | ✅ `"© {year} CreatorHub"` — không có "Inc." |

### ⚠️ Giữ nguyên — Không phải commercial

| Feature | Lý do giữ |
|---------|-----------|
| Credits system (AI quota) | Đây là **AI generation quota**, không phải payment. Hợp lệ cho thesis. |

---

## Quick Summary — Từng Spec

### THESIS-001 🔴
- **Thay `/shego.jpg` → `/placeholder-user.jpg`** tại 10 locations trong 6 files:
  - `testimonial-section.tsx` (landing page)
  - `PublishModal.tsx`
  - `RetryDetailModal.tsx`
  - `failedPostsService.ts`
  - `publishedPostsService.ts`
  - `failedPageStore.ts`
  - `publishedPageStore.ts`
- **Xóa** `public/images/shego.jpg`
- **Xóa** `public/images/maiovo_icon.png` (unused)

### THESIS-002 🟡
- **~34 hardcoded strings** trong 5 files → chuyển sang `useTranslations()`
- Files: `ActionBar.tsx`, `SourceModal.tsx`, `SourceForm.tsx`, `PublishModal.tsx`, `AIChatbox.tsx`
- Thêm keys mới vào `messages/vi.json` và `messages/en.json`

### THESIS-003 🟢
- **Verify only** — app gốc hầu như đã clean
- Kiểm tra footer text trong `messages/vi.json` (`HomePage.footer.*`)
- Không cần xóa features hay rewrite landing page

---

## Recommended Order

1. **THESIS-001** (reputation/ethics risk — ảnh người thật)
2. **THESIS-002** (i18n completeness)
3. **THESIS-003** (verify only)

Each spec can be implemented in its own branch for clean review workflow.
