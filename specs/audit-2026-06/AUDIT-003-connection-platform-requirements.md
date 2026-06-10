# AUDIT-003: Kết nối tài khoản & yêu cầu nền tảng

> **Status**: Draft
> **Priority**: 🟠 P1
> **Stack**: Next.js 14, Supabase, Zernio OAuth
> **Bugs**: B9, B11, + thiếu cảnh báo "tài khoản doanh nghiệp"

---

## Problem

1. Luồng kết nối có "Local preview mode" tạo **connection giả** (`preview-token-...`) lẫn với account thật.
   Nếu connection đang dùng là giả → `getlate_account_id` rỗng → đăng bài bỏ qua Zernio hoàn toàn (liên quan AUDIT-001).
2. Người dùng kết nối Instagram/Facebook bằng **tài khoản cá nhân** → tưởng OK, đến lúc đăng mới vỡ
   (các nền tảng này yêu cầu Business/Creator account để publish qua API). Thiếu cảnh báo trước.
3. `/connect/{platform}` truyền `redirect_url` — chưa xác minh Zernio có hỗ trợ tham số này; OAuth có thể không quay lại app đúng.

---

## Audit Results (file:line)

| # | File:line | Vấn đề |
|---|-----------|--------|
| B9 | `app/api/connections/start/[provider]/route.ts:66-112` | "Local preview" tạo connection mô phỏng (`preview-token-...`, profile_id `preview-...`) |
| B11 | `lib/zernio.ts:38-47` | `getZernioConnectUrl` gắn `redirect_url` vào `/connect/{platform}` — cần xác minh cơ chế callback thật của Zernio |
| — | `lib/constants/platforms.ts` + `SettingsSection.tsx` | Không có metadata/cảnh báo nền tảng nào cần tài khoản doanh nghiệp |

### Yêu cầu tài khoản theo nền tảng (đối chiếu tài liệu nền tảng)
| Nền tảng | Yêu cầu publish qua API |
|----------|------------------------|
| Instagram | Business/Creator + liên kết Facebook Page |
| Facebook | Page (không phải profile cá nhân) |
| TikTok | App được duyệt Content Posting API |
| LinkedIn | Phân biệt personal vs company page |
| Pinterest | Business account |
| X (Twitter), Threads | Ít rào cản nhất — ưu tiên cho demo |

---

## Solution

1. **B9**: Tách bạch demo/preview bằng cờ rõ ràng (`NEXT_PUBLIC_DEMO_MODE`); ở chế độ thật không tạo connection giả. Connection preview phải gắn nhãn "Mô phỏng" trong bảng.
2. **Cảnh báo nền tảng**: thêm field `requiresBusinessAccount` vào `SOCIAL_PLATFORMS`; hiển thị badge/tooltip "Yêu cầu tài khoản doanh nghiệp" ở `SettingsSection` và chặn/cảnh báo sớm khi chọn đăng.
3. **B11**: xác minh cơ chế callback Zernio (đọc docs / test thật). Nếu Zernio dùng callback cấu hình ở dashboard thay vì query `redirect_url`, cập nhật `getZernioConnectUrl` cho đúng.

---

## S1: Error States & Validation

| Scenario | Expected |
|----------|----------|
| Kết nối nền tảng cần business bằng account cá nhân | Cảnh báo sớm "Cần tài khoản doanh nghiệp"; không tạo connection vô dụng |
| OAuth Zernio không quay lại app | Thông báo lỗi rõ ràng; không treo popup |
| Vượt giới hạn profile gói Free | "Profile limit reached" (đã có) |
| Đóng popup giữa chừng | Không tạo connection rác |

---

## Files to Change

- `app/api/connections/start/[provider]/route.ts` — gate preview sau cờ demo (B9)
- `lib/constants/platforms.ts` — thêm `requiresBusinessAccount` (+ i18n key)
- `components/features/create/connections/SettingsSection.tsx` — badge cảnh báo nền tảng
- `components/features/create/modals/PublishModal.tsx` — cảnh báo sớm trước khi đăng
- `lib/zernio.ts` — xác minh/sửa cơ chế connect redirect (B11)

---

## Acceptance Criteria

- [ ] Connection preview có nhãn "Mô phỏng" rõ ràng, không lẫn account thật
- [ ] Nền tảng cần business hiển thị badge cảnh báo trước khi kết nối
- [ ] Cơ chế OAuth callback Zernio được xác minh hoạt động (hoặc ghi rõ là hạn chế)
- [ ] `tsc --noEmit` + `npm run lint` pass

---

## S6: Manual QA

- [ ] Kết nối X → account thật có `getlate_account_id`, không phải `preview-`.
- [ ] Xem nền tảng Instagram → thấy badge "Yêu cầu tài khoản doanh nghiệp".
- [ ] Chế độ thật (cờ demo off) → không tạo connection preview giả.

---

## Rollback Plan
Revert các file; khôi phục luồng preview cũ nếu cờ demo gây lỗi đăng nhập kết nối sát giờ demo.
