# AUDIT-006: UI/UX màn tạo nguồn & polish

> **Status**: Draft
> **Priority**: 🟡 P2
> **Stack**: Next.js 14, Tailwind CSS v4, shadcn/ui
> **Bugs**: B14, B16

---

## Problem

Màn "Thêm nguồn / chọn nền tảng" (ảnh chụp khi demo) chưa tối ưu thị giác: banner quá to,
danh sách nền tảng dạng checkbox dọc full-width tốn không gian, và logo nền tảng bị đảo màu
xấu ở dark mode do `dark:invert`.

---

## Audit Results (file:line)

| # | File:line | Vấn đề |
|---|-----------|--------|
| B14 | `components/features/create/forms/PostConfigurationForm.tsx` (toàn file) + `SourcePanel.tsx` | Banner "Thêm nguồn" quá lớn; checkbox nền tảng dọc full-width; bố cục rời rạc |
| B16 | `PostConfigurationForm.tsx:166-173` (`dark:filter dark:brightness-0 dark:invert`) | Logo nhiều màu bị invert → màu sai ở dark mode |

> Lưu ý: nút "Tạo bài đăng" ĐÃ disable đúng khi chọn 0 nền tảng (`PostConfigurationForm.tsx:233`).
> Cần verify lại trên runtime vì ảnh demo trông như nút vẫn sáng.

---

## Solution

1. **B14**: 
   - Thu gọn banner "Thêm nguồn"; gộp trực quan với khối "Nguồn đã lưu".
   - Chuyển danh sách nền tảng sang **grid 2–4 cột** (tham chiếu `SettingsSection` đã làm grid đẹp).
   - Thêm trần `count` hợp lý (vd tối đa 10/nền tảng) để tránh tốn credit.
2. **B16**: chỉ invert các logo đơn sắc; với logo nhiều màu dùng `needsInversion(platform)` (đã có helper ở `lib/utils/platform.ts`) thay vì invert tất cả.
3. Verify nút "Tạo bài đăng" disable đúng khi 0 nền tảng (manual).

---

## S2: Post-Completion / Empty States

| Event | Result |
|-------|--------|
| Chọn 0 nền tảng | Nút "Tạo bài đăng" disabled (xác minh) |
| Chưa có nguồn nào | Empty-state có hướng dẫn thêm nguồn (đã có) |
| Dark mode | Logo nền tảng hiển thị đúng màu, không đảo |

---

## Files to Change

- `components/features/create/forms/PostConfigurationForm.tsx` — layout grid + dark-mode icon (B14, B16)
- `components/features/create/sources/SourcePanel.tsx` — gộp banner/nguồn (B14)
- (dùng helper sẵn có) `lib/utils/platform.ts` `needsInversion`

---

## Acceptance Criteria

- [ ] Màn tạo nguồn dùng grid, không còn checkbox dọc full-width tốn không gian
- [ ] Dark mode: logo TikTok/IG/YouTube... đúng màu, không bị đảo
- [ ] Nút "Tạo bài đăng" disabled khi chọn 0 nền tảng (verified)
- [ ] Có giới hạn trên hợp lý cho số bài/nền tảng
- [ ] `npm run lint` pass; không lỗi layout ở 375px (mobile)

---

## S6: Manual QA

- [ ] Mở màn tạo nguồn ở light + dark → bố cục gọn, logo đúng màu.
- [ ] Chọn 0 nền tảng → nút "Tạo bài đăng" mờ/disabled.
- [ ] 375px width → không tràn ngang, các nền tảng vẫn bấm được.

---

## Rollback Plan
Revert 2 component; chỉ đụng layout/UI nên rollback an toàn.
