# AUDIT-003: Kết nối tài khoản & yêu cầu nền tảng

> **Status**: Partially Implemented — B9 partially fixed (Zernio path fail loud); business-account warnings and B11 verification remain
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

## Audit Results (file:line — verified 2026-06-10)

| # | File:line | Vấn đề | Trạng thái |
|---|-----------|--------|-----------|
| B9a | `app/api/connections/start/[provider]/route.ts:43-68` | Zernio path: khi lỗi KHÔNG fallback sang tạo preview giả nữa → báo 502 rõ ràng | ✅ **ĐÃ SỬA** — dòng 62-66 có comment "KHÔNG fallback" |
| B9b | `app/api/connections/start/[provider]/route.ts:83-91` | `shouldComplete` path: khi Zernio configured → không tạo preview, trả lỗi | ✅ **ĐÃ SỬA** |
| B9c | `app/api/connections/start/[provider]/route.ts:93-128` | Preview mode vẫn tồn tại khi `!isZernioConfigured()` — tạo connection giả `preview-token-...` | ⚠️ **CÒN TỒN TẠI** — chỉ xảy ra khi Zernio chưa cấu hình; chấp nhận cho demo |
| B11 | `lib/zernio.ts:38-47` | `getZernioConnectUrl` gắn `redirect_url` — callback mechanism chưa được xác minh | ⚠️ **CHƯA XÁC MINH** — code dùng `redirect_url` query param; cần test thật |
| — | `lib/constants/platforms.ts:21-51` | Không có `requiresBusinessAccount` field trong `PLATFORM_DISPLAY_MAP` | ❌ **CHƯA SỬA** |
| — | `components/features/create/connections/SettingsSection.tsx:586-630` | Không có badge cảnh báo nền tảng cần business account | ❌ **CHƯA SỬA** |

### Yêu cầu tài khoản theo nền tảng
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

1. **B9c**: Gắn nhãn rõ "Mô phỏng" trên connection preview trong `SettingsSection.tsx` — dùng `profile_id.startsWith('preview-')` để detect. Chế độ preview vẫn OK cho demo khi Zernio chưa config.
2. **Business-account warnings**: thêm field `requiresBusinessAccount: boolean` vào `PLATFORM_DISPLAY_MAP`; hiển thị badge/tooltip trong `SettingsSection.tsx` khi render platform card.
3. **B11**: Xác minh thực tế bằng cách test OAuth flow với Zernio. Nếu `redirect_url` không được hỗ trợ, sửa `getZernioConnectUrl` dùng cơ chế đúng.

---

## S1: Error States & Validation

| Scenario | Expected |
|----------|----------|
| Kết nối nền tảng cần business bằng account cá nhân | Cảnh báo sớm "Cần tài khoản doanh nghiệp" trước khi bắt đầu OAuth; không tạo connection vô dụng |
| OAuth Zernio không quay lại app (B11) | Popup không treo; timeout sau 5 phút → toast "Kết nối thất bại, thử lại" |
| Zernio free tier vượt 2 accounts | Toast "Tài khoản Zernio gói miễn phí chỉ cho phép kết nối tối đa 2 tài khoản..." (đã có dòng 63-65) |
| Vượt giới hạn profile gói Free | "Profile limit reached (N/N)" (đã có dòng 99-105) |
| Đóng popup giữa chừng | Không tạo connection rác (pending state cleanup) |
| Kết nối preview khi Zernio đã configured | Không xảy ra — route trả lỗi trước (đã fix B9a/B9b) |

---

## S2: Post-Completion Flow

| Event | Result |
|-------|--------|
| Kết nối thành công (Zernio) | Popup đóng; `SettingsSection` reload danh sách connections; hiển thị account mới với avatar + username |
| Kết nối thành công (preview) | Tương tự nhưng card hiển thị nhãn "Mô phỏng"; `getlate_account_id` = null |
| Ngắt kết nối | Connection bị xóa khỏi DB; card trở về trạng thái "Chưa kết nối"; nếu đang có bài scheduled dùng connection này → cần xử lý (hiện chưa có warning) |
| User đóng popup giữa chừng | Không lưu gì; state `actionId` reset |

---

## S3: Cross-Feature Integration

| When This Happens | Triggers / Updates |
|-------------------|--------------------|
| Kết nối thành công | `SettingsSection` invalidate/refetch connections list; `useDashboardUsage` không cần invalidate |
| `getlate_account_id` rỗng (preview) | `lateCompat.ts:176` → `useRealZernio = false` → bỏ qua Zernio khi đăng (AUDIT-001) |
| Ngắt kết nối | Scheduled posts dùng connection đó không có warning hiện tại (gap) |
| Preview connection | `SettingsSection` cần check `profile_id.startsWith('preview-')` để hiển thị nhãn "Mô phỏng" |

**Shared state**: `connected_accounts` table trong Supabase; được đọc bởi `checkProfileLimit`, `countConnectedAccounts`, và publish flow.

**Empty state**: User chưa kết nối nền tảng nào → SettingsSection hiển thị tất cả platform cards trạng thái "Chưa kết nối".

**Cleanup**: Popup window đóng sau OAuth; `pending_connections` state (trong `zernioState.ts`) expire sau thời gian nhất định.

---

## S4: Copy Review

- [ ] Badge cảnh báo business account: "Yêu cầu tài khoản doanh nghiệp" (vi) / "Requires business account" (en) — cần i18n key
- [ ] Nhãn preview: "Mô phỏng" (vi) / "Simulated" (en)
- [ ] Toast lỗi Zernio free tier — đã có text tiếng Việt dài ở `start/[provider]/route.ts:64`; cần i18n key thay vì hardcode
- [ ] Tooltip cảnh báo nền tảng: dùng ngôn ngữ dễ hiểu, không dùng "API access", "Business account type" — nên là "Cần trang Facebook Page / Instagram Business để đăng"
- [ ] Trạng thái loading khi kết nối: hiện dùng spinner — OK

---

## S5: State & Persistence Matrix

| Data | Stored Where | Persists After Refresh? | Cleared When |
|------|-------------|------------------------|--------------|
| `connected_accounts` | Supabase DB | Yes | User ngắt kết nối thủ công |
| `preview-token-...` | Supabase DB (access_token column) | Yes | Không tự xóa — tồn tại indefinitely |
| OAuth pending state | `zernioState.ts` in-memory / signed cookie | No (in-memory) | Callback hoàn thành hoặc timeout |
| `actionId` (loading state) | React local state | No | Component unmount / action complete |
| Profile limit count | Computed từ DB mỗi request | No | — |

---

## Files to Change

- `lib/constants/platforms.ts` — thêm `requiresBusinessAccount` field vào `PLATFORM_DISPLAY_MAP` ❌
- `components/features/create/connections/SettingsSection.tsx` — badge cảnh báo + nhãn "Mô phỏng" cho preview connection ❌
- `lib/zernio.ts:38-47` — xác minh/sửa cơ chế `redirect_url` (B11) ⚠️
- `messages/en.json` + `messages/vi.json` — i18n keys: `requiresBusinessAccount`, `previewBadge`, và lỗi Zernio free tier ❌

---

## Acceptance Criteria

- [ ] Connection preview có nhãn "Mô phỏng" rõ ràng, không lẫn với account thật
- [ ] Nền tảng cần business (Instagram, Facebook, TikTok, Pinterest, LinkedIn) hiển thị badge cảnh báo trước khi kết nối
- [ ] Cơ chế OAuth callback Zernio được xác minh hoạt động (hoặc ghi rõ là hạn chế đã biết)
- [ ] Lỗi Zernio free tier dùng i18n key thay vì hardcode string
- [ ] `tsc --noEmit` + `npm run lint` pass

---

## S6: Manual QA

- [ ] **Zernio configured**: Kết nối X → card hiển thị avatar thật, `getlate_account_id` có giá trị, không phải `preview-`.
- [ ] **Preview mode**: Zernio chưa config → Kết nối Instagram → card hiển thị nhãn "Mô phỏng", không có avatar thật.
- [ ] **Business warning**: Xem card Instagram / Facebook / TikTok trong SettingsSection → thấy badge "Yêu cầu tài khoản doanh nghiệp".
- [ ] **Free tier limit**: Zernio gói free, đã có 2 accounts → kết nối thêm → toast lỗi rõ ràng, không tạo connection.
- [ ] **Popup close**: Mở OAuth popup → đóng tay → không tạo connection rác, không có lỗi JS.
- [ ] **Profile limit**: Gói Free, đã có 5 connections → kết nối thêm → "Profile limit reached".

---

## Rollback Plan
Revert `platforms.ts` và `SettingsSection.tsx`; bỏ badge cảnh báo. B9a/B9b đã fix và an toàn, không cần rollback.
