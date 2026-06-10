# AUDIT-001: Toàn vẹn luồng đăng bài & tích hợp Zernio

> **Status**: Partially Implemented — B1/B2/B3/B4/B5/B6/B7/B31 fixed; B20 remain (accepted as known limitation)
> **Priority**: 🔴 P0 (chặn demo chính)
> **Stack**: Next.js 14, TypeScript, Supabase, Zernio API
> **Bugs**: B1, B2, B3, B4, B5, B6, B7, B20, B31

---

## Problem

Lõi "đăng bài" hiện là **simulator giả lập**: luôn báo "Đăng thành công" và lưu một **URL bịa**,
nhưng bài chưa từng tới Zernio. Mở URL → nền tảng báo lỗi; Zernio dashboard trống.

Nguyên nhân kép:
1. Gọi sai contract `POST /posts` của Zernio → request bị từ chối.
2. Lỗi bị nuốt rồi rơi xuống **nhánh bịa URL** ở **5 vị trí** khác nhau.
3. Không có cơ chế (webhook hoặc poll) để lấy URL thật về.

---

## Audit Results (file:line)

| # | File:line | Vấn đề | Trạng thái |
|---|-----------|--------|-----------|
| B1 | `lib/zernio.ts:142-164` ~~(cũ: 82-92)~~ | Body gửi `accountIds` — Zernio yêu cầu `platforms:[{platform, accountId}]` | ✅ **ĐÃ SỬA** — `createZernioPost` build đúng contract |
| B2 | `lib/zernio.ts:159` ~~(cũ: 88-90)~~ | Media gửi `media:[{url}]` — Zernio yêu cầu `mediaItems:[{type, url}]` | ✅ **ĐÃ SỬA** — `inferMediaType` + `mediaItems` đúng |
| B3 | `lib/services/posts/lateCompat.ts:185-196` ~~(cũ: 179-182)~~ | `catch` chỉ `console.error` rồi fall-through sang bịa URL | ✅ **ĐÃ SỬA** — lỗi được ném ra (fail loud) |
| B4 | `lib/services/posts/lateCompat.ts:257-283, 366` ~~(cũ: 51-55, 231, 283, 336)~~ | `buildSyntheticPostUrl` → `https://<platform>.com/<user>/post/<id>` | ✅ **ĐÃ SỬA** — `buildSyntheticPostUrl` đã bị xóa; `post_url: null` cho mô phỏng |
| B5 | `store/create/publish.ts:245` ~~(cũ: 238)~~ | Client bịa URL khi thiếu URL | ✅ **ĐÃ SỬA** — `url: data?.latePost?.url \|\| null` (null → nút "Mở bài viết" bị disable) |
| B6 | `lib/services/posts/publishedPostsService.ts:168` ~~(cũ: 124)~~ | Đọc lại bài đã đăng cũng bịa URL | ✅ **ĐÃ SỬA** — `url: postUrl \|\| null` (null, không phải empty string) |
| B7 | `app/api/late/posts/[id]/check-status/route.ts` | `resolveInternalLatePost` không gọi Zernio; không poll `GET /posts/{id}` | ✅ **ĐÃ SỬA** — `getZernioPost` + `pollZernioUntilTerminal` có trong `lib/zernio.ts:211-270` |
| B20 | toàn cục | Không có route webhook nhận callback publishing | ⚠️ **CÒN TỒN TẠI** — chưa có webhook Zernio; phụ thuộc Hướng A/B |
| B31 | `components/features/create/calendar/CalendarSection.tsx:307` ~~(cũ: 306-308)~~ | `handleOpenInEditor` mở `event.url` (synthetic) cho bài "posted" | ✅ **ĐÃ SỬA** — guard `event.url` hoạt động đúng vì B5 đã đổi sang `null` (falsy); `null` không bị `window.open` |

### Tham chiếu contract Zernio (đã đối chiếu docs.zernio.com + llms-full.txt)
```jsonc
// POST https://zernio.com/api/v1/posts  (Authorization: Bearer sk_...)
{
  "content": "string",
  "platforms": [{ "platform": "twitter", "accountId": "acc_xyz" }],
  "publishNow": true,
  "scheduledFor": "ISO-8601",
  "mediaItems": [{ "type": "image", "url": "https://..." }]
}
// Response: { "post": { "_id": "...", "status": "..." } }
// URL thật KHÔNG có ngay (publish async) → phải GET /posts/{_id} đến khi status=published
```

---

## Solution — chọn 1 trong 2 hướng (chưa chốt, cần chủ repo quyết)

### Hướng A — Đăng THẬT 1 nền tảng "anh hùng" (stretch, rủi ro thời gian)
Ưu tiên nền tảng ít rào cản doanh nghiệp: **X (twitter) / Threads / LinkedIn**.
1. Sửa B1+B2: `createZernioPost` build đúng `platforms` + `mediaItems` (cần truyền `platform` từ `lateCompat`).
2. Sửa B3: khi `isZernioConfigured()` mà publish lỗi → **ném lỗi ra UI** (fail loud), KHÔNG bịa URL.
3. Sửa B7+B20: thêm bước poll `GET /posts/{_id}` (hoặc route `/api/late/posts/[id]/check-status` gọi Zernio thật) tới khi `status=published`, đọc URL thật, cập nhật `post_url`.
4. Xác minh OAuth callback Zernio (xem AUDIT-003 / B11) để `getlate_account_id` là id thật.

### Hướng B — TRUNG THỰC HÓA simulator (an toàn cho deadline) ✅ khuyến nghị
1. Gỡ toàn bộ 5 điểm bịa URL (B4, B5, B6, và nhánh fallback B3) → khi không có URL thật thì `post_url = null`.
2. UI: đổi nhãn "Đăng" → "Mô phỏng đăng / Xem trước", và **disable/ẩn nút "Mở bài viết"** khi `!post.url` ở **cả** `PublishedDetailModal.tsx:121-128` **và** `CalendarSection.tsx:306-308` (B31).
3. Gắn `PreviewNotice` rõ ràng "Bài đăng ở chế độ mô phỏng — chưa đăng lên nền tảng thật".

> Dù chọn A hay B, **không được để tồn tại link giả mở ra ngoài**.

---

## S1: Error States & Validation

| Scenario | Expected |
|----------|----------|
| Zernio publish trả lỗi (4xx/5xx) | Hiện toast lỗi cụ thể từ Zernio; KHÔNG tạo bản ghi "posted" giả; bài rơi vào mục "Thất bại" |
| Account chưa có `getlate_account_id` thật | Chặn đăng, hướng người dùng kết nối lại (xem AUDIT-003) |
| Publish async chưa có URL | Trạng thái "Đang đăng…"; chỉ chuyển "Đã đăng" + hiện nút mở link khi có URL thật |
| Mất mạng giữa chừng | Toast lỗi; không lưu trạng thái posted giả |

---

## Files to Change

- `lib/zernio.ts` — sửa body `createZernioPost` (B1, B2); thêm `getZernioPost(id)` để poll (B7)
- `lib/services/posts/lateCompat.ts` — bỏ fallback bịa URL (B3, B4); thêm logic poll/cập nhật URL thật
- `store/create/publish.ts` — bỏ nhánh bịa URL dòng 238 (B5)
- `lib/services/posts/publishedPostsService.ts` — bỏ fallback URL dòng 124 (B6)
- `app/api/late/posts/[id]/check-status/route.ts` — gọi Zernio thật thay vì resolve synthetic (B7)
- `components/features/create/published/PublishedDetailModal.tsx` — disable nút mở link khi `!url`
- `components/features/create/calendar/CalendarSection.tsx` — chặn mở `event.url` synthetic (B31)
- **(Hướng A)** New: `app/api/webhooks/zernio/route.ts` HOẶC cơ chế poll định kỳ (B20)

---

## Acceptance Criteria

- [ ] `grep -rn "\.com/post/\|buildSyntheticPostUrl\|\.com/\${" lib store` → 0 nơi sinh URL giả còn dùng
- [ ] (Hướng A) Đăng 1 bài lên X → **xuất hiện trên Zernio dashboard** và URL mở đúng bài thật
- [ ] (Hướng B) Mọi bài "đã đăng" không có URL thật → nút "Mở bài viết" disabled ở Published **và** Calendar
- [ ] Không còn trường hợp UI báo "thành công" trong khi Zernio không có post
- [ ] `tsc --noEmit` và `npm run lint` pass

---

## S6: Manual QA

- [ ] **Happy (A)**: đăng X → toast "đang đăng" → poll → "đã đăng" + nút mở link → mở đúng bài thật trên zernio dashboard.
- [ ] **Honest (B)**: đăng → nhãn "mô phỏng" → nút mở link **disabled** → không có link gãy nào bấm được.
- [ ] **Error**: cấu hình sai key Zernio → đăng → toast lỗi rõ ràng, bài vào "Thất bại", KHÔNG vào "Đã đăng".
- [ ] **Calendar**: bấm 1 event "posted" → không mở link giả (B31).

---

## Rollback Plan
Revert các file trên về commit trước spec; khôi phục hành vi cũ (chấp nhận tạm simulator) nếu hướng A gây regression sát giờ demo.
