# AUDIT-007: Nợ kỹ thuật đã defer (known-issues)

> **Status**: Draft
> **Priority**: 🟢 P3 (đa số đưa vào mục "Hạn chế & Hướng phát triển" của báo cáo)
> **Stack**: Next.js 14, Supabase
> **Bugs**: B23, B24, B25, B26, B30

---

## Problem

Nhóm các lỗi đã được developer ghi nhận trong `docs/known-issues.md` (đã defer) + 1 lỗi validate nhẹ.
Mục tiêu spec này: **quyết định fix hay accept-as-limitation** cho từng cái, và chuẩn bị câu trả lời
phản biện (examiner có thể hỏi).

---

## Audit Results

| # | Nguồn | Vấn đề | Hiện trạng |
|---|-------|--------|------------|
| B23 | `docs/known-issues.md` (2026-05-21) + `e2e/create-sections-manual-qa.spec.ts:111` | Drafts → nút **Edit không điều hướng** về `/create` | Chưa kết luận (test issue hay bug thật) |
| B24 | `docs/known-issues.md` (2026-05-27) + `signin/page.tsx:233` | Google OAuth redirect `/vi/vi/signin` (nhân đôi locale) | **Đã ẩn** sau cờ `NEXT_PUBLIC_ENABLE_OAUTH` |
| B25 | `docs/known-issues.md` (2026-05-27) | Logout chờ lâu (Supabase Auth latency) | Defer; xóa session cục bộ trước |
| B26 | `docs/known-issues.md` (2026-05-28) | `npm audit` nhiều advisory high (Next 14.2.x) | Defer; build/lint vẫn pass |
| B30 | `app/api/schedule/posts/[id]/reschedule/route.ts:22` | Không validate `newScheduleAt` ở quá khứ phía server | Client có validate |

---

## Solution (quyết định từng mục)

| # | Quyết định đề xuất | Hành động |
|---|--------------------|-----------|
| B23 | **Điều tra nhanh** trước demo | Mở `/drafts` thật, bấm Edit. Nếu navigate được → test issue (accept). Nếu không → fix nhỏ ở card draft, commit riêng |
| B24 | **Accept-as-limitation** | Giữ ẩn OAuth trong demo (email/password là luồng chính). Ghi vào "Hạn chế: cấu hình redirect URL Supabase" |
| B25 | **Accept-as-limitation** | Đã xóa session cục bộ trước; mô tả là phụ thuộc dịch vụ ngoài |
| B26 | **Accept-as-limitation** | Đưa vào "Hướng phát triển: nâng cấp framework + kiểm thử regression" |
| B30 | **Fix nhẹ** | Thêm validate `newScheduleAt > now` ở server (đối xứng với client) |

---

## S1: Error States & Validation

| Scenario | Expected |
|----------|----------|
| Reschedule về thời điểm quá khứ (B30) | Server trả 400 "Thời gian phải ở tương lai" |
| Logout khi Supabase chậm (B25) | Xóa session cục bộ ngay, không treo UI |

---

## Files to Change

- `app/api/schedule/posts/[id]/reschedule/route.ts` — validate ngày tương lai (B30)
- (B23) component card draft (nếu xác nhận bug)
- `docs/known-issues.md` — cập nhật quyết định cuối cho từng mục
- Báo cáo: mục "Hạn chế & Hướng phát triển" — B24, B25, B26

---

## Acceptance Criteria

- [ ] B23 có kết luận (test issue / đã fix)
- [ ] B30: reschedule quá khứ bị từ chối phía server
- [ ] B24/B25/B26 được ghi rõ trong "Hạn chế" báo cáo
- [ ] `tsc --noEmit` + `npm run lint` pass

---

## S6: Manual QA

- [ ] `/drafts` → Edit → kiểm tra có về `/create` không (B23).
- [ ] Reschedule 1 bài về hôm qua → bị từ chối (B30).
- [ ] Logout → UI không treo (B25).

---

## Rollback Plan
B30 là thay đổi nhỏ, revert an toàn. Các mục accept-as-limitation không đụng code.
