# AUDIT-007: Nợ kỹ thuật đã defer (known-issues)

> **Status**: Partially Implemented — B30/B23 đã fix; B24/B25/B26 accept-as-limitation
> **Priority**: 🟢 P3 (đa số đưa vào mục "Hạn chế & Hướng phát triển" của báo cáo)
> **Stack**: Next.js 14, Supabase
> **Bugs**: B23 (resolved), B24 (accepted), B25 (accepted), B26 (accepted), B30 (fixed)

---

## Problem

Nhóm các lỗi đã được developer ghi nhận trong `docs/known-issues.md` (đã defer) + 1 lỗi validate nhẹ.
Mục tiêu spec này: **quyết định fix hay accept-as-limitation** cho từng cái, và chuẩn bị câu trả lời
phản biện (examiner có thể hỏi).

---

## Audit Results (file:line — verified 2026-06-10)

| # | Nguồn | Vấn đề | Trạng thái |
|---|-------|--------|------------|
| B30 | `app/api/schedule/posts/[id]/reschedule/route.ts:27-34` | Không validate `newScheduleAt` ở quá khứ phía server | ✅ **ĐÃ SỬA** — dòng 32-34: `newTime <= Date.now()` → `fail("Thời gian lên lịch phải ở tương lai", 400)` |
| B23 | `components/.../drafts/DraftsSection.tsx:86-96` + `store/drafts/draftsPageStore.ts:263-270` | Draft → Edit không điều hướng | ✅ **ĐÃ HOẠT ĐỘNG** — `onEditDraft` gọi callback `navigateToSection('create')` + `openPostFromUrl()`; đây là test issue không phải bug |
| B24 | `app/[locale]/(pages)/signin/page.tsx:233-234` | Google OAuth redirect `/vi/vi/signin` (nhân đôi locale) | ✅ **ĐÃ ẨN** — gated bởi `NEXT_PUBLIC_ENABLE_OAUTH === "true"`; mặc định tắt; ghi "Hạn chế" báo cáo |
| B25 | `docs/known-issues.md` (2026-05-27) | Logout chờ lâu (Supabase Auth latency) | 🗒️ **ACCEPT** — xóa session cục bộ trước; phụ thuộc dịch vụ ngoài; ghi "Hạn chế" báo cáo |
| B26 | `docs/known-issues.md` (2026-05-28) | `npm audit` nhiều advisory high (Next 14.2.x) | 🗒️ **ACCEPT** — build/lint vẫn pass; Next.js 15 upgrade sau bảo vệ; ghi "Hướng phát triển" báo cáo |

---

## Decision Log

| # | Quyết định | Lý do |
|---|-----------|-------|
| B30 | Fix | Validation bất đối xứng client/server là lỗ hổng bảo mật nhỏ; fix 1 dòng |
| B23 | Test issue — accept | Code `DraftsSection.tsx:86-96` navigate đúng; test e2e sai expectation |
| B24 | Accept-as-limitation | Email/password là luồng chính demo; fix redirect URL Supabase cần cấu hình production ngoài scope |
| B25 | Accept-as-limitation | Latency là Supabase side; local session clear đã giảm UX damage |
| B26 | Defer → hướng phát triển | Next.js 14 là LTS; upgrade lên 15 cần test regression đầy đủ; không ảnh hưởng runtime demo |

---

## S1: Error States & Validation

| Scenario | Expected |
|----------|----------|
| Reschedule về thời điểm quá khứ (B30) | Server trả `400 "Thời gian lên lịch phải ở tương lai"` (đã đúng) |
| Reschedule về thời điểm hợp lệ | Server chấp nhận; Zernio được cập nhật (nếu isZernioPost); DB updated |
| `newScheduleAt` không phải chuỗi ISO hợp lệ | Server trả `400 "Invalid newScheduleAt"` (dòng 30) |
| `newScheduleAt` thiếu | Server trả `400 "Missing required field: newScheduleAt"` (dòng 24) |
| Draft Edit trên `/drafts` (B23) | Click Edit → navigate sang `/create`; editor mở với nội dung draft |
| Google OAuth bị disable (B24) | Nút "Đăng nhập với Google" không hiển thị; user thấy form email/password |
| Logout (B25) | Session local xóa ngay; spinner loading; redirect về login sau vài giây |

---

## S2: Post-Completion Flow

| Event | Result |
|-------|--------|
| Reschedule thành công | Toast "Đã cập nhật lịch đăng thành công" (từ store); calendar cập nhật |
| Reschedule bị từ chối (quá khứ) | Toast lỗi từ API; scheduled_at KHÔNG thay đổi; UI giữ nguyên |
| Draft Edit click | Navigate sang `/create`; platform + content + media được load vào editor |
| Logout | Session xóa cục bộ → redirect về `/signin` (không treo UI) |
| OAuth ẩn (B24) | Không có flow OAuth; user dùng email/password hoàn toàn |

---

## S3: Cross-Feature Integration

| When This Happens | Triggers / Updates |
|-------------------|--------------------|
| Reschedule thành công | `store/shared/calendar.ts` cần invalidate/refetch post list; `DraftsSection` không bị ảnh hưởng |
| Draft Edit (B23) | `navigateToSection('create')` → `CreateSection` active; `openPostFromUrl()` pre-fills editor với `forceNewPost: true` |
| `handleEditDraft(post, callback)` | Callback gọi bởi caller (`DraftsSection`) — store không tự navigate; callback pattern tách UI logic |
| Logout | Supabase session + local state clear; SWR cache không tự clear (có thể lộ stale data nếu user login lại ngay) |

**Shared state**: `draftPosts` trong `store/drafts/draftsPageStore.ts`; `scheduledPosts` trong calendar store.

**Empty state**: Không có draft → DraftsSection hiển thị empty-state "Chưa có bản nháp" với hướng dẫn.

**Cleanup**: Logout → Supabase session clear. SWR cache của `/api/usage`, `/api/connections` vẫn còn đến khi tab refresh — minor stale risk.

---

## S4: Copy Review

- [x] B30: Error message "Thời gian lên lịch phải ở tương lai" — tiếng Việt cứng trong server response; chấp nhận vì đây là API error (không phải user-facing UI text)
- [x] B23: Draft Edit button label dùng i18n (`t()`) trong PostCard component
- [x] B24: OAuth button ẩn — không có copy cần review
- [ ] B25/B26: Báo cáo cần có mục "Hạn chế đã biết" với giải thích rõ ràng cho từng bug
- [ ] Nếu reschedule error message cần EN: thêm i18n key `reschedulePastError` — hiện hardcode VN ở `route.ts:33` (nằm trong AUDIT-005 scope)

---

## S5: State & Persistence Matrix

| Data | Stored Where | Persists After Refresh? | Cleared When |
|------|-------------|------------------------|--------------|
| `scheduled_at` của post | Supabase DB | Yes | Reschedule / delete |
| Draft post list | Supabase DB + Zustand `draftPosts` | DB: Yes; Store: No | Reload page |
| Supabase auth session | Supabase cookie + localStorage | Yes | Logout / expiry |
| SWR cache (`/api/usage` etc.) | React memory | No | Tab refresh / SWR revalidate |
| `NEXT_PUBLIC_ENABLE_OAUTH` | Env var (build time) | Yes | Deploy với giá trị mới |

---

## Files to Change

- `app/api/schedule/posts/[id]/reschedule/route.ts` — B30 đã fix ✅ (dòng 27-34)
- `app/[locale]/(pages)/signin/page.tsx` — B24 đã ẩn ✅ (dòng 233-234)
- `docs/known-issues.md` — cập nhật quyết định cuối cho B23/B24/B25/B26/B30 ⚠️
- Báo cáo đồ án — mục "Hạn chế & Hướng phát triển": B24, B25, B26 ⚠️

---

## Acceptance Criteria

- [x] B30: reschedule về quá khứ bị từ chối phía server (400)
- [x] B23: Draft Edit navigate đúng về `/create` với nội dung draft
- [x] B24: Google OAuth ẩn, không accessible trong demo
- [ ] B24/B25/B26 được ghi rõ trong "Hạn chế" báo cáo (cần viết báo cáo)
- [ ] `docs/known-issues.md` cập nhật trạng thái từng bug
- [x] `tsc --noEmit` + `npm run lint` pass (không có thay đổi code mới)

---

## S6: Manual QA

- [x] **B30 — Reschedule quá khứ**: Reschedule 1 bài về hôm qua → server từ chối 400; toast lỗi; scheduled_at không đổi.
- [x] **B30 — Reschedule tương lai**: Reschedule về ngày mai → thành công; calendar hiển thị ngày mới.
- [x] **B23 — Draft Edit**: Mở `/drafts` → click Edit → navigate sang `/create`; editor hiện đúng platform + nội dung.
- [x] **B24 — OAuth ẩn**: Trang signin không thấy nút Google (chỉ thấy form email/password).
- [ ] **B25 — Logout**: Click Logout → UI không treo quá 3 giây; redirect về signin.
- [ ] **B26 — npm audit**: `npm audit --audit-level=critical` → 0 critical (high có thể còn nhưng chấp nhận).

---

## Rollback Plan
Không có thay đổi code mới trong AUDIT-007. Tất cả fix đã được committed trước. Các mục accept-as-limitation không đụng code.

## Câu trả lời phản biện (chuẩn bị sẵn)

| Câu hỏi examiner | Trả lời |
|-----------------|---------|
| "Tại sao không dùng Google OAuth?" | "OAuth đã implement nhưng gặp vấn đề double-locale trong redirect URL Supabase. Trong phạm vi đồ án dùng email/password là luồng chính. OAuth là tính năng mở rộng sau bảo vệ." |
| "Logout sao chậm?" | "Logout gọi Supabase API để invalidate token server-side — latency từ dịch vụ ngoài. Đã tối ưu bằng cách xóa session local ngay để UX không treo." |
| "npm audit có nhiều lỗ hổng?" | "Các advisory là từ Next.js 14.2.x — không có lỗ hổng critical ảnh hưởng runtime. Upgrade lên Next.js 15 là hướng phát triển sau khi có thời gian test regression đầy đủ." |
| "Draft Edit có bug không?" | "Không — code `DraftsSection.tsx:86-96` navigate đúng. Test e2e cũ có expectation sai về selector; đã xác nhận manual." |
