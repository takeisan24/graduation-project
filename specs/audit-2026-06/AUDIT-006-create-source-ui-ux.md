# AUDIT-006: UI/UX màn tạo nguồn & polish

> **Status**: Partially Implemented — B16 đã fix; B14 layout grid và count cap chưa làm
> **Priority**: 🟡 P2
> **Stack**: Next.js 14, Tailwind CSS v4, shadcn/ui
> **Bugs**: B14 (partial), B16 (fixed)

---

## Problem

Màn "Thêm nguồn / chọn nền tảng" (ảnh chụp khi demo) chưa tối ưu thị giác: banner quá to,
danh sách nền tảng dạng checkbox dọc full-width tốn không gian, và logo nền tảng bị đảo màu
xấu ở dark mode do `dark:invert`.

---

## Audit Results (file:line — verified 2026-06-10)

| # | File:line | Vấn đề | Trạng thái |
|---|-----------|--------|-----------|
| B16 | `components/.../forms/PostConfigurationForm.tsx:160` | Logo nhiều màu bị invert ở dark mode | ✅ **ĐÃ SỬA** — dùng `needsInversion(option.name)` có điều kiện; chỉ logo đơn sắc mới invert |
| B14a | `PostConfigurationForm.tsx:114-193` | Danh sách nền tảng dạng `space-y-3` dọc full-width — tốn không gian, 8 platform chiếm nhiều scroll | ⚠️ **CHƯA SỬA** — vẫn là vertical list |
| B14b | `PostConfigurationForm.tsx:179-186` | Nút `+` tăng số bài không có giới hạn trên — user có thể chọn 99 bài/platform, hết credit ngay | ⚠️ **CHƯA SỬA** — không có `disabled` khi đạt max |
| B14c | `PostConfigurationForm.tsx:221` | Nút "Tạo bài đăng" disabled đúng khi 0 platform | ✅ **ĐÃ ĐÚNG** — `disabled={isGenerating || selectedPlatforms.length === 0}` |

---

## Solution

1. **B14a — layout grid**:
   Chuyển platform list từ `space-y-3` dọc sang **grid 2 cột** (mobile: 1 cột, tablet+: 2 cột).
   Mỗi cell: checkbox + logo + tên + counter (nếu selected). Tham chiếu `SettingsSection` đã có grid card đẹp.
   Kích thước cell nhỏ gọn hơn — không cần full-width row cho mỗi platform.

2. **B14b — count cap**:
   Thêm `MAX_COUNT_PER_PLATFORM = 5` (hoặc giá trị hợp lý). Disable nút `+` khi đạt max.
   Hiển thị tooltip hoặc text nhỏ "tối đa 5 bài/nền tảng" để user hiểu.

3. **B16 — đã xong**: Không cần làm thêm.

---

## S1: Error States & Validation

| Scenario | Expected |
|----------|----------|
| Chọn 0 platform | Nút "Tạo bài đăng" disabled + mờ; không gửi request (đã đúng) |
| Count = 0 cho 1 platform | Không xảy ra — `-` disabled khi count = 1 (dòng 172); uncheck platform xóa khỏi list |
| Count > MAX trên 1 platform | Nút `+` disabled; tooltip "Tối đa N bài/nền tảng" (sau khi fix B14b) |
| Tổng bài > credit còn lại | Credit check xảy ra ở API layer — UI hiện modal "Không đủ credit" từ `contentGenerationService` |
| Logo platform không load | `<Image>` fallback — không bị broken layout vì có alt text |
| Dark mode | Logo đơn sắc (X, Threads) invert thành trắng ✅; logo màu (Instagram, TikTok, YouTube) giữ nguyên màu ✅ |

---

## S2: Post-Completion Flow

| Event | Result |
|-------|--------|
| Nhấn "Tạo bài đăng" | Button hiện spinner "Đang tạo..." (đã có); `onComplete` callback được gọi với `selectedPlatforms` + model |
| Generate thành công | Modal đóng; bài đăng được điền vào editor từng platform; user thấy nội dung đã tạo |
| User nhấn Cancel | Modal đóng; không lưu gì; `selectedPlatforms` state reset |
| User đóng modal (click outside) | Tương tự Cancel — `onCancel` prop |
| User quay lại chọn platform | `selectedPlatforms` state còn trong modal cho đến khi đóng |

---

## S3: Cross-Feature Integration

| When This Happens | Triggers / Updates |
|-------------------|--------------------|
| `onComplete(platforms, model)` được gọi | `SourcePanel` → `generatePostsFromSource` trong `store/create/sources.ts` |
| Generation thành công | `PostConfigurationForm` modal đóng; editor nhận nội dung từng platform |
| Credit không đủ | `contentGenerationService` trả 403 → modal nâng cấp hoặc toast lỗi; form không đóng |
| `SOCIAL_PLATFORMS` thay đổi | Danh sách platform trong form tự cập nhật (import trực tiếp từ `lib/constants/platforms.ts`) |

**Shared state**: `selectedPlatforms` là local React state trong `PostConfigurationForm` — không shared với store. `SOCIAL_PLATFORMS` từ `lib/constants/platforms.ts` là source of truth.

**Empty state**: 0 platform selected → nút disabled + badge "0/8 đã chọn"; user thấy rõ chưa chọn gì.

**Cleanup**: Khi modal đóng (`onCancel`/`onComplete`), `selectedPlatforms` reset về `[]` (React unmount/remount).

---

## S4: Copy Review

- [x] Nút "Tạo bài đăng" dùng `t('createButton')` — không hardcode
- [x] "Đang tạo..." dùng `t('isCreating')`
- [x] Counter dùng `t('postsUnit')`, `t('selected')`, `t('estimatedOutput')`, `t('outputsUnit')`
- [x] Model label hiển thị "Gemini" — đúng theo báo cáo (chỉ Gemini)
- [ ] Max count tooltip/label: cần i18n key `maxPostsPerPlatform` — "Tối đa N bài/nền tảng" (vi) / "Max N posts/platform" (en) ❌
- [ ] Grid layout: kiểm tra label platform vừa đủ trong cell nhỏ (tên dài như "Pinterest", "LinkedIn") — không bị truncate ❌

---

## S5: State & Persistence Matrix

| Data | Stored Where | Persists After Refresh? | Cleared When |
|------|-------------|------------------------|--------------|
| `selectedPlatforms` | React local state (PostConfigurationForm) | No | Modal unmount / Cancel / Complete |
| `isGenerating` | React local state | No | Request completes or fails |
| `selectedModel` | Const "Gemini" (không có state) | N/A | — |
| `SOCIAL_PLATFORMS` list | `lib/constants/platforms.ts` (module import) | Yes (module cache) | Build |
| Platform icons | `/public/icons/...` (static) | Yes | Deploy |

---

## Files to Change

- `components/features/create/forms/PostConfigurationForm.tsx` — layout grid 2 cột + count cap MAX_COUNT (B14a, B14b) ⚠️
- `messages/vi.json` + `messages/en.json` — thêm key `maxPostsPerPlatform` ⚠️
- `lib/utils/platform.ts` — không cần thay đổi (`needsInversion` đã đúng) ✅

---

## Acceptance Criteria

- [x] Dark mode: logo TikTok/IG/YouTube đúng màu, không bị đảo; logo X/Threads đảo thành trắng đúng
- [x] Nút "Tạo bài đăng" disabled khi chọn 0 platform
- [ ] Platform list hiển thị dạng grid 2 cột (tablet+) — không còn scroll dài dọc ❌
- [ ] Nút `+` disabled khi count đạt MAX_COUNT_PER_PLATFORM ❌
- [ ] Có label/tooltip "Tối đa N bài/nền tảng" khi đạt cap ❌
- [ ] `npm run lint` pass; không lỗi layout ở 375px (mobile — 1 cột)

---

## S6: Manual QA

- [x] **Dark mode logos**: Mở `PostConfigurationForm` ở dark mode → Instagram/TikTok/YouTube logo giữ màu gốc; X/Threads logo hiện trắng.
- [x] **Disable button**: Chọn 0 platform → nút "Tạo bài đăng" mờ không bấm được.
- [ ] **Grid layout**: Mở form → 8 platform hiển thị dạng 2 cột (không còn list dọc 8 dòng full-width).
- [ ] **Count cap**: Chọn Instagram → nhấn `+` liên tục → dừng ở MAX; nút `+` disabled; label "Tối đa X bài" hiện.
- [ ] **Mobile 375px**: 1 cột; tất cả platform đều bấm được; không tràn ngang; counter vừa vặn.
- [ ] **Cancel flow**: Chọn 3 platform → Cancel → mở lại form → không nhớ lựa chọn cũ (state reset).

---

## Rollback Plan
Revert `PostConfigurationForm.tsx`; thay đổi chỉ đụng layout/UI nên rollback an toàn, không ảnh hưởng logic generate.
