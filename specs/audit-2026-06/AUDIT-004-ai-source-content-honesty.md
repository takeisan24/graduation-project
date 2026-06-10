# AUDIT-004: Trung thực nội dung AI & nguồn

> **Status**: Partially Implemented — B8 đã fix; B19 vẫn còn (fallback path YouTube vẫn dùng stub)
> **Priority**: 🟠 P1
> **Stack**: Next.js 14, Google Gemini 2.5 Flash
> **Bugs**: B8 (fixed), B19 (partially — fallback path)

---

## Problem

1. Khi Gemini lỗi/timeout, hệ thống trả **placeholder lộ liễu** làm nội dung bài → examiner có thể thấy chữ
   `"Auto-generated content for instagram"` trong bài đăng demo.
2. "Thêm nguồn YouTube" thực chất **không hiểu gì về video** khi video quá dài: hàm trích metadata là stub giả,
   chỉ trả lại videoId. AI sinh nội dung từ gần như không có thông tin → dễ bịa nội dung không liên quan.

---

## Audit Results (file:line — verified 2026-06-10)

| # | File:line | Vấn đề | Trạng thái |
|---|-----------|--------|-----------|
| B8 | `lib/services/ai/contentGenerationService.ts:97-104` | Catch lỗi → trả `text: ""` + `error: "Generation failed"`, không còn placeholder | ✅ **ĐÃ SỬA** — comment "KHÔNG chèn placeholder lừa mắt" tại dòng 97 |
| B19 (primary) | `lib/ai/prompts/generate-from-source.ts:67-70` | YouTube URL truyền trực tiếp vào Gemini qua `fileData: { mimeType: 'video/*' }` — Gemini tự phân tích video | ✅ **ĐƯỜNG CHÍNH HOẠT ĐỘNG** — không dùng stub |
| B19 (fallback) | `lib/services/ai/multimodalGenerationService.ts:228-254` | Khi Gemini báo token limit (video quá dài) → fallback gọi `extractYouTubeMetadata` — stub chỉ trả `title: "YouTube Video (videoId)"`, description rỗng | ⚠️ **VẪN CÒN** — chỉ kích hoạt khi video dài; AI tạo nội dung từ gần như không có thông tin |
| B19 (fallback2) | `lib/services/ai/multimodalGenerationService.ts:648-696` | Đường multimodal generation cũng có fallback stub tương tự | ⚠️ **VẪN CÒN** |
| B19 (stub) | `lib/services/youtube/extractMetadata.ts:20-36` | `extractYouTubeMetadata` chỉ trả `title: "YouTube Video (${videoId})"`, `description: ''`, không transcript | ⚠️ **VẪN CÒN** — được gọi làm fallback |

> Luồng chính (video ngắn): URL → Gemini `fileData` → Gemini phân tích video thật ✅
> Luồng fallback (video dài / token limit): URL → `extractYouTubeMetadata` stub → AI bịa nội dung ⚠️

---

## Solution

### B8 — đã xong
Placeholder đã bị loại. Khi generation lỗi: `text: ""` + `error: "Generation failed"` → UI cần hiện trạng thái lỗi + Retry.

### B19 — chọn 1 trong 2 hướng
- **Hướng A (thật)**: Thay stub bằng YouTube oEmbed API (`https://www.youtube.com/oembed?url=...&format=json`) — miễn phí, không cần API key, trả `title` và `author_name`. Đủ để Gemini biết video nói về gì khi fallback.
- **Hướng B (trung thực — ưu tiên cho demo)**: Giữ stub. Thêm nhãn rõ ràng trong `SourceForm.tsx` tab YouTube: "Lưu ý: Với video dài, hệ thống chỉ dùng link làm ngữ cảnh thay vì phân tích nội dung video." Đưa vào mục "Hạn chế đã biết" của báo cáo.

---

## S1: Error States & Validation

| Scenario | Expected |
|----------|----------|
| Gemini timeout / API key sai | Ô nội dung trống + thông báo lỗi + Retry; không có placeholder; không trừ credit (đã đúng) |
| Video quá dài (token limit) → fallback stub | Fallback sinh ra nội dung kém chất lượng — hiện tại: không báo gì cho user. Cần: toast/nhãn "Video quá dài, nội dung dựa trên link thay vì phân tích video" |
| YouTube URL private / không hợp lệ | Gemini trả lỗi → rethrow → UI hiện lỗi; `extractVideoId` trả null → stub trả null → `multimodalGenerationService:244` dùng URL fallback |
| Hết credit trước khi generate | 403 + modal nâng cấp (đã có — `contentGenerationService.ts:72-83`) |
| Gemini lỗi nhưng một số platform thành công | Trừ credit chỉ cho platform thành công (đã đúng — dòng 116-131) |

---

## S2: Post-Completion Flow

| Event | Result |
|-------|--------|
| Generate thành công (tất cả platforms) | Kết quả điền vào editor từng platform; `successCount === platforms.length` |
| Generate thành công một phần (1/3 platforms lỗi) | Platform lỗi: ô trống + badge lỗi; platform thành công: có nội dung; credit trừ chỉ cho platform thành công |
| Generate thất bại hoàn toàn (Gemini lỗi) | Tất cả ô trống; 0 credit bị trừ; toast lỗi + Retry |
| Video YouTube quá dài (fallback) | Nội dung được tạo từ context gần như rỗng — AI có thể tạo ra nội dung không liên quan đến video |
| User retry sau lỗi | Gọi lại API generate từ đầu; credit chưa trừ từ lần trước |

---

## S3: Cross-Feature Integration

| When This Happens | Triggers / Updates |
|-------------------|--------------------|
| Generate thành công | `store/create/sources.ts:164-167` set `extractedContent` nếu YouTube; `PostConfigurationForm` hiển thị tên source type |
| Generate lỗi (B8 path) | `results[i].error` truthy → UI phải check và hiển thị trạng thái lỗi thay vì ô trống |
| Source type = youtube (primary path) | `buildPromptParts` dùng `fileData` Gemini — KHÔNG gọi `extractYouTubeMetadata` |
| Source type = youtube, video quá dài | `multimodalGenerationService:228` gọi `extractYouTubeMetadata` stub → kết quả nghèo |
| Credit deduction | Chỉ trừ sau khi `success: true` — đã đúng, không liên quan B8/B19 |

**Shared state**: `extractedContent` trong `store/create/sources.ts` — dùng làm preview nội dung trích xuất từ YouTube.

**Empty state**: Chưa generate → ô nội dung trống + placeholder hint (không phải AI-generated placeholder).

**Cleanup**: Không có — `extractedContent` tồn tại trong store đến khi navigate away hoặc reset.

---

## S4: Copy Review

- [x] B8 đã bỏ placeholder `"Auto-generated content for ${platform}"` — không còn lộ kỹ thuật
- [ ] Trạng thái lỗi generate: hiện text gì trong ô? Cần check `PostConfigurationForm`/editor — không được để ô trắng không giải thích
- [ ] YouTube fallback (video dài): không có UI thông báo — user thấy nội dung AI "bịa" mà không biết tại sao
  - Cần: nhãn/toast dịch theo i18n: "Video quá dài để phân tích — nội dung được tạo dựa trên link" (vi) / "Video too long to analyze — content based on URL only" (en)
- [ ] Khi `successCount < platforms.length`: message `"Generated text content for X/Y platform(s)"` — OK về mặt kỹ thuật nhưng nên dịch ra i18n thay vì hardcode

---

## S5: State & Persistence Matrix

| Data | Stored Where | Persists After Refresh? | Cleared When |
|------|-------------|------------------------|--------------|
| Generated content (per platform) | React state / Zustand store | No | Navigate away / reset |
| `extractedContent` (YouTube) | `store/create/sources.ts` | No | Navigate away hoặc source type thay đổi |
| Credit balance sau deduction | Supabase DB | Yes | Không tự xóa |
| Generation error state | React local state | No | Component unmount / retry |
| `successCount` | Trả về trong API response | No | — |

---

## Files to Change

- `lib/services/ai/contentGenerationService.ts` — B8 đã fix ✅; dòng 97-104 trả `text: ""` thay vì placeholder
- `lib/services/youtube/extractMetadata.ts` — (A) thay stub bằng oEmbed thật / (B) giữ nguyên ⚠️
- `lib/services/ai/multimodalGenerationService.ts:224,645` — (A) nếu dùng oEmbed: cập nhật fallback dùng data thật / (B) thêm log warning rõ hơn + trả `extractedContent` có nhãn "video quá dài"
- `components/features/create/forms/SourceForm.tsx` — (B) thêm nhãn giới hạn tab YouTube ❌ (nếu chọn Hướng B)
- `messages/en.json` + `messages/vi.json` — i18n key cho nhãn giới hạn YouTube ❌

---

## Acceptance Criteria

- [x] `grep -rn "Auto-generated content for" lib` → 0 kết quả (đã đạt)
- [x] Gemini lỗi → `text: ""` + `error: "Generation failed"` trong response; 0 credit bị trừ
- [ ] UI kiểm tra `results[i].error` và hiển thị trạng thái lỗi + Retry (cần verify)
- [ ] (A) Thêm nguồn YouTube ngắn → nội dung sinh ra phản ánh đúng nội dung video thật (Gemini native), HOẶC (B) YouTube dài → thấy nhãn giới hạn rõ ràng
- [ ] `tsc --noEmit` + `npm run lint` pass

---

## S6: Manual QA

- [x] **B8 — Tắt GEMINI_API_KEY** → generate → UI báo lỗi (ô trống hoặc error state), KHÔNG hiện "Auto-generated content for...".
- [ ] **B8 — UI error state**: Sau khi generate thất bại, mỗi platform card hiện gì? Cần xác nhận UI check `results[i].error`.
- [ ] **B19 — YouTube ngắn (<10 phút)**: Thêm nguồn YouTube hợp lệ → nội dung phản ánh đúng chủ đề video (Gemini đọc được video).
- [ ] **B19 — YouTube dài (>30 phút)**: Thêm nguồn YouTube video dài → (A) nội dung vẫn chính xác nếu dùng oEmbed / (B) thấy nhãn "video quá dài, nội dung từ link" nếu giữ stub.
- [ ] **B19 — YouTube private**: URL video private → Gemini lỗi → UI báo lỗi, không sinh nội dung giả.
- [ ] **Credit deduction**: Generate 3 platforms, 1 lỗi → credit trừ đúng 2 lần (không trừ cho platform lỗi).

---

## Rollback Plan
B8 đã fix và không có rủi ro rollback. B19 fallback stub đã tồn tại từ trước — không cần rollback trừ khi Hướng A làm hỏng primary path (không có rủi ro vì fallback là catch block độc lập).
