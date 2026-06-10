# AUDIT-002: Thanh toán & bảo mật credit

> **Status**: Draft
> **Priority**: 🔴 P0 (lỗ hổng bảo mật)
> **Stack**: Next.js 14, Supabase, VietQR
> **Bugs**: B17, B18, B10

---

## Problem

Luồng nạp credit **không xác thực giao dịch thật**: bất kỳ user đăng nhập nào cũng có thể tự
gọi API xác nhận đơn và **được cộng credit miễn phí**. Đây là câu hỏi examiner dễ chạm nhất
("verify tiền vào kiểu gì?").

---

## Audit Results (file:line)

| # | File:line | Vấn đề |
|---|-----------|--------|
| B17a | `app/api/payment/webhook/route.ts:1-5` | Webhook là **stub rỗng** — `return {success:true}`, không verify chữ ký, không xử lý |
| B17b | `app/api/payment/confirm-order/route.ts:7-56` | Client gọi với `orderCode` (do client tự tạo) → set `PAID` + `addPurchasedCredits` **không cần bằng chứng thanh toán** |
| B17c | `app/api/payment/check-order/route.ts` | Chỉ đọc status, không phải verifier thật |
| B18 | `lib/auth.ts:20-24` | `requireAuth` nhận token từ `?token=` query → rủi ro lộ qua log/referer/cache |
| B10 | `lib/zernioState.ts:20-23` | `ZERNIO_STATE_SECRET` rỗng → ký state OAuth bằng `SUPABASE_SERVICE_ROLE_KEY` (chạy được nhưng không tường minh) |

> Idempotency có (`PENDING→PAID` guard + early-return khi `PAID`) nhưng vô nghĩa khi gốc xác thực vắng mặt.

---

## Solution — chọn 1 trong 2 (theo phạm vi đồ án)

### Hướng A — Trung thực hóa (khuyến nghị cho thesis)
- Gắn nhãn rõ "Thanh toán mô phỏng (demo)" ở UI nạp credit; trình bày trong báo cáo là **chưa tích hợp cổng thanh toán thật**.
- Chặn `confirm-order` tự cộng credit ở môi trường production-like: chỉ cho phép khi có cờ `ENABLE_MANUAL_CONFIRM` (demo) — tránh examiner coi là lỗ hổng "thật".

### Hướng B — Xác thực thật (stretch)
- Triển khai webhook VietQR/bank thật: verify chữ ký + đối chiếu `amount` + `addInfo` (orderCode) trước khi set `PAID`.
- `confirm-order` chỉ được set `PAID` khi đã có bản ghi giao dịch khớp từ webhook.

### Sửa kèm (cả 2 hướng)
- **B18**: hạn chế token-in-URL — chỉ chấp nhận `?token=` cho route media GET (image/video tag), KHÔNG cho route ghi/giao dịch; thêm ghi chú bảo mật.
- **B10**: set `ZERNIO_STATE_SECRET` trong `.env.local` (secret riêng), không mượn service-role key.

---

## S1: Error States & Validation

| Scenario | Expected |
|----------|----------|
| `confirm-order` không có bằng chứng thanh toán (Hướng B) | Trả 402/409, KHÔNG cộng credit |
| Webhook chữ ký sai (Hướng B) | 401, bỏ qua, log cảnh báo |
| `orderCode` không thuộc user | 404 (đã có scope `user_id`) |
| Cộng credit trùng | Idempotent — không cộng 2 lần (giữ guard hiện có) |

---

## Files to Change

- `app/api/payment/confirm-order/route.ts` — chặn tự xác nhận / gate sau cờ demo (B17b)
- `app/api/payment/webhook/route.ts` — implement verify thật (Hướng B) hoặc xóa/ghi rõ là mô phỏng (B17a)
- `lib/auth.ts` — giới hạn phạm vi token-in-URL (B18)
- `.env.local` + `.env.example` — thêm `ZERNIO_STATE_SECRET`, `ENABLE_MANUAL_CONFIRM` (B10)
- UI nạp credit (`CreditTopUp.tsx`) — nhãn "mô phỏng" nếu chọn Hướng A

---

## Acceptance Criteria

- [ ] (A) UI nạp credit hiển thị rõ "mô phỏng/demo"; (B) credit chỉ cộng sau giao dịch verify
- [ ] `confirm-order` không thể tự cộng credit ở chế độ mặc định (không bật cờ demo)
- [ ] Token-in-URL không dùng được cho route giao dịch/ghi
- [ ] `ZERNIO_STATE_SECRET` được set tường minh
- [ ] `tsc --noEmit` + `npm run lint` pass

---

## S6: Manual QA

- [ ] Gọi `confirm-order` thủ công (curl) với orderCode hợp lệ khi KHÔNG bật cờ demo → bị từ chối, credit không tăng.
- [ ] (B) Webhook giả chữ ký sai → 401, không cộng credit.
- [ ] Nạp credit qua UI demo → nhãn "mô phỏng" hiển thị.

---

## Rollback Plan
Revert route + env; khôi phục hành vi cũ. Lưu ý: hành vi cũ là lỗ hổng — chỉ rollback nếu chặn demo.
