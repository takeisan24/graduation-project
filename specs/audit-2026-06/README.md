# Audit Fix Specs — 2026-06

> Bộ specs gom các phát hiện từ đợt audit toàn diện codebase (2026-06-09), phục vụ
> sửa lỗi trước buổi bảo vệ đồ án (demo: thứ 6 2026-06-12, deadline fix: tối thứ 5 2026-06-11).
> Mỗi spec = 1 nhóm issue quản lý độc lập, có thể làm trên branch riêng để review sạch.

## Status Overview

| Spec | Nhóm | Ưu tiên | Trạng thái | Tóm tắt |
|------|------|---------|------------|---------|
| [AUDIT-001](./AUDIT-001-publishing-integrity.md) | Luồng đăng bài & Zernio | 🔴 P0 | ✅ **Đã code (polling) — cần test live** | Đăng thật qua Zernio + poll URL thật; gỡ 5 điểm bịa URL; fail-loud |
| [AUDIT-002](./AUDIT-002-payment-credit-security.md) | Thanh toán & bảo mật credit | 🔴 P0 | 🔒 **Giữ mô phỏng (khớp báo cáo)** | Báo cáo ghi webhook thanh toán "mô phỏng/làm tay" → KHÔNG làm webhook thật |
| [AUDIT-003](./AUDIT-003-connection-platform-requirements.md) | Kết nối tài khoản & yêu cầu nền tảng | 🟠 P1 | 🟡 Một phần | Đã chặn đăng khi nền tảng cần media mà thiếu ảnh/video; badge business chưa làm |
| [AUDIT-004](./AUDIT-004-ai-source-content-honesty.md) | Trung thực nội dung AI & nguồn | 🟠 P1 | 🟡 Một phần | ✅ Bỏ placeholder AI; prompt khớp điều kiện đăng; YouTube metadata vẫn stub |
| [AUDIT-005](./AUDIT-005-i18n-localization.md) | i18n & nội địa hóa | 🟡 P2 | 🟡 Một phần | ✅ Sửa typo "Artile"→"Article"; còn 41 toast VN + 29 `vi-VN` (chỉ lộ khi đổi sang EN — defer sau bảo vệ) |
| [AUDIT-006](./AUDIT-006-create-source-ui-ux.md) | UI/UX màn tạo nguồn | 🟡 P2 | 🟡 Một phần | ✅ B16 icon dark-mode (dùng `needsInversion`); B14 layout defer (tránh rủi ro sát demo) |
| [AUDIT-007](./AUDIT-007-deferred-known-issues.md) | Nợ kỹ thuật đã defer | 🟢 P3 | 🟡 Một phần | ✅ B30 validate reschedule; còn lại giữ làm "Hạn chế" báo cáo |

> **Bonus đã làm thêm:** sửa prompt Gemini cho 8 nền tảng ra nội dung **đăng được ngay** (IG→caption, TikTok→caption, YouTube→description, bỏ kịch bản); sửa bug đọc username Zernio thật; tài liệu `docs/DEMO-GUIDE-platforms.md`.

---

## Bối cảnh điều tra

Hệ thống ban đầu xây cho **getlate.dev** theo mô hình **webhook-callback**: nền tảng đăng xong
gọi ngược về app điền URL thật vào `webhook_data`/`late_dev_response`/`status_check_response`.
Ba sự thật cốt lõi phát hiện khi audit:

1. **Không tồn tại endpoint webhook publishing** (chỉ có `app/api/payment/webhook/route.ts` rỗng).
2. Vì webhook không bao giờ được gọi, toàn hệ thống chạy bằng **nhánh fallback bịa URL giả**.
3. Zernio lắp vào sau nhưng **sai body API** nên chưa từng tạo được post.

→ Lõi "đăng bài" về bản chất là **simulator giả lập**: luôn báo thành công + luôn sinh link giả.
Đây là gốc rễ của triệu chứng "link bài đăng mở ra báo lỗi, Zernio dashboard trống".

### Điểm sáng (giữ nguyên)
- Không có lỗ hổng XSS (`dangerouslySetInnerHTML`/`eval`/`innerHTML` = 0).
- Có kiểm tra quyền sở hữu chống IDOR ở reschedule/payment/posts.
- AI (sinh text/chat/trích URL) là thật qua Gemini.
- i18n key parity hoàn hảo (vi 1449 = en 1449). Lỗi i18n là rò rỉ cục bộ, không phải thiếu hệ thống.
- UX/UI chất lượng cao: skeleton, animation, empty-state, a11y, keyboard shortcuts.

---

## Bản đồ bug → spec

| Bug | Mô tả ngắn | Spec |
|-----|------------|------|
| B1 | Zernio body sai: `accountIds` thay vì `platforms:[{platform,accountId}]` | AUDIT-001 |
| B2 | Zernio media sai: `media:[{url}]` thay vì `mediaItems:[{type,url}]` | AUDIT-001 |
| B3 | Nuốt lỗi Zernio rồi fallback bịa link | AUDIT-001 |
| B4 | `buildSyntheticPostUrl` bịa link (lateCompat) | AUDIT-001 |
| B5 | Client bịa link (`publish.ts:238`) | AUDIT-001 |
| B6 | Service đọc bài đã đăng bịa link (`publishedPostsService:124`) | AUDIT-001 |
| B7 | Không poll `GET /posts/{id}` lấy URL thật | AUDIT-001 |
| B20 | Không có endpoint webhook publishing | AUDIT-001 |
| B31 | Calendar mở `event.url` (synthetic) cho bài posted | AUDIT-001 |
| B17 | Client tự xác nhận thanh toán → credit miễn phí; webhook rỗng | AUDIT-002 |
| B18 | Auth nhận token qua `?token=` URL (rủi ro lộ log/referer) | AUDIT-002 |
| B10 | `ZERNIO_STATE_SECRET` rỗng → fallback service-role key | AUDIT-002 |
| B9 | "Local preview" tạo connection giả lẫn account thật | AUDIT-003 |
| B11 | `/connect` truyền `redirect_url` chưa chắc Zernio hỗ trợ | AUDIT-003 |
| — | Thiếu cảnh báo "yêu cầu tài khoản doanh nghiệp" | AUDIT-003 |
| B8 | AI lỗi → nội dung thành placeholder `"Auto-generated content for ..."` | AUDIT-004 |
| B19 | `extractYouTubeMetadata` là stub giả (chỉ trả videoId) | AUDIT-004 |
| B12,B13,B15,B22 | Toast/error/aria hardcode tiếng Việt (store + components) | AUDIT-005 |
| B21 | `vi-VN`/`Intl.DateTimeFormat('vi-VN')` cứng (29 chỗ/14 file) | AUDIT-005 |
| B27 | Validation tiếng Việt cứng trong SourceForm | AUDIT-005 |
| B28 | Typo UI "Artile" → "Article" | AUDIT-005 |
| B29 | Tooltip/context AIChatbox hardcode VN | AUDIT-005 |
| B14 | Layout màn "Thêm nguồn" chưa tối ưu | AUDIT-006 |
| B16 | Logo nền tảng + `dark:invert` đảo màu xấu ở dark mode | AUDIT-006 |
| B23 | Drafts → nút Edit không điều hướng (chưa kết luận) | AUDIT-007 |
| B24 | Google OAuth redirect `/vi/vi/signin` (đã ẩn sau flag) | AUDIT-007 |
| B25 | Logout chờ lâu (Supabase latency) | AUDIT-007 |
| B26 | `npm audit` nhiều advisory high (Next 14.2.x) | AUDIT-007 |
| B30 | Reschedule không validate ngày quá khứ phía server | AUDIT-007 |

---

## Thứ tự thực hiện đề xuất (theo deadline thứ 5)

1. **AUDIT-001** — quyết định luồng demo (làm thật 1 nền tảng / trung thực hóa simulator). Quan trọng nhất.
2. **AUDIT-002** — chặn lỗ thanh toán (hoặc gắn nhãn "thanh toán mô phỏng").
3. **AUDIT-005** — dọn i18n rò rỉ + typo (rẻ, tác động lớn về độ chỉn chu khi phản biện).
4. **AUDIT-004** — trung thực hóa AI/nguồn.
5. **AUDIT-003** — UX kết nối + cảnh báo tài khoản doanh nghiệp.
6. **AUDIT-006** — polish UI tạo nguồn.
7. **AUDIT-007** — defer/known-issues, đa số đưa vào mục "Hạn chế" của báo cáo.

## Ràng buộc commit (BẮT BUỘC)
- Khi đẩy lên GitHub: **TUYỆT ĐỐI KHÔNG** thêm trailer `Co-Authored-By` hay bất kỳ dòng Claude/Anthropic nào.
- Committer duy nhất: `Tuan Anh Vu <vutanh507@gmail.com>`.
- Không commit/đẩy bất kỳ thay đổi nào khi chưa có lệnh cho phép từ chủ sở hữu repo.
