# AUDIT-004: Trung thực nội dung AI & nguồn

> **Status**: Draft
> **Priority**: 🟠 P1
> **Stack**: Next.js 14, Google Gemini
> **Bugs**: B8, B19

---

## Problem

1. Khi Gemini lỗi/timeout, hệ thống trả **placeholder lộ liễu** làm nội dung bài → examiner có thể thấy chữ
   `"Auto-generated content for instagram"` trong bài đăng demo.
2. "Thêm nguồn YouTube" thực chất **không hiểu gì về video**: hàm trích metadata là stub giả, chỉ trả lại videoId.
   AI sinh nội dung từ gần như không có thông tin → dễ bịa nội dung không liên quan.

---

## Audit Results (file:line)

| # | File:line | Vấn đề |
|---|-----------|--------|
| B8 | `lib/services/ai/contentGenerationService.ts:95-104` | Catch lỗi → trả `text: "Auto-generated content for ${platform}"`, `success:false` |
| B19 | `lib/services/youtube/extractMetadata.ts:20-36` | `extractYouTubeMetadata` chỉ trả `title: "YouTube Video (${videoId})"`, description rỗng, không transcript |

> `extractContent` (URL/text qua `lib/ai/generator-v2`) là **thật** — chỉ riêng YouTube là stub.

---

## Solution

### B8 — bỏ placeholder lừa mắt
- Khi generation lỗi: **không** chèn text placeholder vào bài. Thay bằng trạng thái lỗi rõ ("Tạo nội dung thất bại, thử lại"), giữ ô trống + nút Retry. (Không trừ credit — đã đúng.)

### B19 — chọn 1
- **Hướng A (thật)**: tích hợp lấy metadata/transcript YouTube thật (YouTube Data API hoặc oEmbed lấy title/author tối thiểu) rồi đưa vào prompt.
- **Hướng B (trung thực)**: nếu chưa kịp, ghi rõ trong UI "Nguồn YouTube chỉ dùng đường link làm ngữ cảnh, hệ thống chưa phân tích nội dung video" + đưa vào "Hạn chế" báo cáo. Tránh để AI bịa như thể đã xem video.

---

## S1: Error States & Validation

| Scenario | Expected |
|----------|----------|
| Gemini timeout/lỗi | Ô nội dung trống + thông báo lỗi + Retry; KHÔNG có placeholder; không trừ credit |
| YouTube URL private/không lấy được metadata | Thông báo rõ ràng, không bịa nội dung |
| Hết credit | 403 + modal nâng cấp (đã có) |

---

## Files to Change

- `lib/services/ai/contentGenerationService.ts` — bỏ placeholder, trả trạng thái lỗi (B8)
- `lib/services/youtube/extractMetadata.ts` — (A) lấy metadata thật / (B) ghi rõ giới hạn (B19)
- UI editor/generate — hiển thị trạng thái lỗi + Retry thay vì placeholder
- (B) nhãn giới hạn ở `SourceForm.tsx` tab YouTube

---

## Acceptance Criteria

- [ ] `grep -rn "Auto-generated content for" lib` → 0 (không còn placeholder lừa mắt)
- [ ] Gemini lỗi → UI báo lỗi + Retry, ô nội dung không chứa text rác
- [ ] (A) Thêm nguồn YouTube → nội dung sinh ra phản ánh đúng title/nội dung video, HOẶC (B) có nhãn giới hạn rõ ràng
- [ ] `tsc --noEmit` + `npm run lint` pass

---

## S6: Manual QA

- [ ] Tắt mạng / sai GEMINI_API_KEY → generate → UI báo lỗi, KHÔNG hiện "Auto-generated content for...".
- [ ] Thêm nguồn YouTube hợp lệ → (A) nội dung khớp video / (B) thấy nhãn "chưa phân tích nội dung video".

---

## Rollback Plan
Revert 2 file dịch vụ; khôi phục placeholder cũ chỉ khi cần (không khuyến khích — placeholder gây hiểu nhầm).
