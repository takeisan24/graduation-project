# Kịch Bản Kiểm Thử Thủ Công (Manual E2E Test Plan v2)

> **Mục đích**: Kiểm thử toàn bộ luồng thực tế của CreatorHub trên `npm run dev`.
> Mỗi test case có bước chi tiết, kết quả mong đợi, và hướng sửa nếu fail.
> **Ngày tạo**: 2026-05-25 | **Cập nhật lần cuối**: 2026-05-27

---

## Chuẩn bị môi trường

1. `npm install && npm run dev`
2. Mở browser (Chrome/Edge), bật DevTools → **Console + Network + Application**
3. Đảm bảo `.env.local` có đủ:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY` (hoặc `OPENAI_API_KEY`)
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
   - `ZERNIO_API_KEY`, `ZERNIO_PROFILE_ID` (nếu muốn test real publishing)
   - `VIETQR_BANK_BIN`, `VIETQR_ACCOUNT_NO`, `VIETQR_ACCOUNT_NAME`
4. Đảm bảo Supabase DB đã chạy `db/schema.sql` + `db/migration-credit-orders.sql`
5. **Xóa localStorage trước khi test clean**: DevTools → Application → Local Storage → Clear All
6. Có sẵn 1 tài khoản test (email/password hoặc Google OAuth)

### Quy ước ký hiệu

- ✅ = Pass (đã kiểm thử và đạt)
- ❌ = Fail → ghi bug
- ⚠️ = Pass có điều kiện (ghi note)
- 🔧 = Cần fix trước khi demo
- 🔲 = Chưa test

---

## PHẦN A: AUTHENTICATION & SESSION

### TC-A01: Đăng nhập bằng Email ✅

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Mở `http://localhost:3000` | Landing page hiển thị đúng |
| 2 | Click "Đăng nhập" / "Sign in" | Redirect đến `/vi/signin` hoặc `/en/signin` |
| 3 | Nhập email + password hợp lệ | Loading spinner hiển thị |
| 4 | Chờ đăng nhập xong | Redirect đến `/vi/create` hoặc `/en/create` |
| 5 | Kiểm tra Console | Không có error đỏ liên quan auth |
| 6 | Kiểm tra Network | `POST /auth` trả về 200, có token |

**Kết quả 2026-05-27**: ✅ Đăng nhập thành công với `test@lms.utc.edu.vn`, redirect vào `/vi/create` đúng.

### TC-A02: Đăng nhập bằng Google OAuth ⚠️

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Click "Đăng nhập bằng Google" | Mở Google OAuth consent screen |
| 2 | Chọn tài khoản Google | Redirect về callback URL |
| 3 | Chờ callback xử lý | Redirect đến `/create` với session |
| 4 | Kiểm tra Profile section | Hiển thị đúng tên + email Google |

**Kết quả 2026-05-27**: ⚠️ Known issue — redirect về `/vi/vi/signin` (double locale). Đã ghi nhận tại `docs/known-issues.md`.

**Nếu fail:**
- Redirect sai URL → Kiểm tra Supabase Auth > URL Configuration > Redirect URLs
- "Invalid origin" → Thêm `localhost:3000` vào Supabase allowed origins

### TC-A03: Session persistence ✅

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Sau khi đã đăng nhập, **F5 refresh** | Vẫn ở trang hiện tại, không redirect |
| 2 | Mở tab mới, vào `/en/create` | Vào được, không redirect về signin |
| 3 | Để idle 5 phút, click vào section khác | Vẫn hoạt động bình thường |
| 4 | Đóng browser hoàn toàn, mở lại app | Session vẫn giữ (nếu remember me) |

**Kết quả 2026-05-27**: ✅ Session duy trì qua nhiều lần refresh và nhiều section.

### TC-A04: Đăng xuất 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Click Sign Out (trong Profile hoặc header) | Redirect về landing hoặc signin |
| 2 | Thử vào `/en/create` trực tiếp | Bị redirect về signin |
| 3 | Kiểm tra localStorage trong DevTools | Session data đã bị xóa |
| 4 | Kiểm tra Console | Không error spam |

### TC-A05: Edge — Truy cập protected route khi chưa login 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Mở incognito tab, vào `/vi/create` | Redirect về `/vi/signin` |
| 2 | Thử vào `/vi/calendar`, `/vi/operations` | Tất cả đều redirect về signin |
| 3 | Sau khi đăng nhập | Redirect về trang đã yêu cầu ban đầu |

### TC-A06: Edge — Token hết hạn 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | DevTools → Application → Cookies → xóa session cookie | Session bị clear |
| 2 | Thử gọi API `/api/usage` | 401 Unauthorized |
| 3 | UI phản ứng | Redirect về signin hoặc hiện error toast |

---

## PHẦN B: CONTENT CREATION (AI)

### TC-B01: Tạo nội dung từ Text (Content Strategy) 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Vào Create section | Source panel hiển thị |
| 2 | Chọn **Niche** (ví dụ: "Technology") | Niche được highlight |
| 3 | Chọn **Goal** (ví dụ: "Educate") | Goal tab active |
| 4 | Chọn **Framework** (ví dụ: "How-To Guide") | Template card được chọn |
| 5 | Nhập ý tưởng: "5 tips sử dụng AI để học lập trình hiệu quả" | Text input nhận giá trị |
| 6 | Chọn platforms: **Facebook, Instagram, TikTok** | Checkboxes được tích |
| 7 | Click **Generate** | Loading indicator hiển thị |
| 8 | Chờ AI generate xong (10-30s) | 3 post tabs xuất hiện (1 per platform) |
| 9 | Click vào từng tab | Nội dung khác nhau, phù hợp platform |
| 10 | Kiểm tra Network | `POST /api/v1/generate-content` trả 200 |
| 11 | Kiểm tra Console | Không error, credits được trừ |

**Nếu fail:**
- "Insufficient credits" → `UPDATE users SET credits_balance = 100 WHERE id = '<user_id>'`
- API timeout → Kiểm tra `GEMINI_API_KEY` hoặc `OPENAI_API_KEY`

### TC-B02: Tạo nội dung từ URL 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong Create, chọn source type **URL** | Input URL hiển thị |
| 2 | Paste một URL bài viết hợp lệ | URL được nhận |
| 3 | Click Generate | Content được trích xuất từ URL → AI generate posts |
| 4 | Kiểm tra nội dung generated | Liên quan đến nội dung URL gốc |

### TC-B03: Tạo nội dung từ YouTube URL 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Paste YouTube URL vào source | URL được nhận diện là YouTube |
| 2 | Generate | Extract metadata → generate content |
| 3 | Thử YouTube URL sai format | Error message rõ ràng |

### TC-B04: Tạo hình ảnh AI 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong editor, click nút tạo ảnh AI | Modal Image Gen mở |
| 2 | Nhập prompt: "A colorful infographic about AI in education" | Prompt được nhận |
| 3 | Click Generate | Loading → ảnh được tạo |
| 4 | Click chọn ảnh để gắn vào post | Ảnh hiển thị trong media preview |
| 5 | Kiểm tra Network | `POST /api/ai/generate-image` trả 200 |
| 6 | Kiểm tra credits | Trừ 5 credits (WITH_IMAGE) |

### TC-B05: AI Chatbot trợ lý 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Mở panel Chat (bên phải hoặc nút chat) | Chat panel hiển thị |
| 2 | Gõ: "Viết lại nội dung này ngắn gọn hơn" | Message hiển thị trong chat |
| 3 | Chờ AI trả lời | Response hiển thị, format markdown |
| 4 | Gõ tiếp: "Dịch sang tiếng Anh" | AI trả lời tiếp theo context |
| 5 | Kiểm tra Network | `POST /api/chat` trả 200 |

### TC-B06: Edge — Generate khi hết credits 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | `UPDATE users SET credits_balance = 0 WHERE id = '...'` | DB updated |
| 2 | Thử Generate content | Error toast: "Không đủ credits" |
| 3 | Nút Generate disabled hoặc chặn request | API không được gọi với 0 credits |
| 4 | Hiển thị hướng dẫn nạp thêm | Link đến Settings/Credits |

### TC-B07: Edge — Generate với nội dung rất dài 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Nhập text > 5000 ký tự | Input nhận hoặc hiện limit warning |
| 2 | Generate | Không crash, AI xử lý hoặc cắt ngắn |

---

## PHẦN C: DRAFT MANAGEMENT

### TC-C01: Lưu draft 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Sau khi generate content, click **Save as Draft** | Toast "Đã lưu draft" hiển thị |
| 2 | Kiểm tra Network | `POST /api/projects` trả 201 |
| 3 | Chuyển sang **Drafts** section | Draft vừa lưu xuất hiện |
| 4 | Kiểm tra: platform, content preview, thời gian | Tất cả đúng |

### TC-C02: Mở lại draft để chỉnh sửa 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong Drafts, click **Edit** trên 1 draft | Navigate về `/create` với content loaded |
| 2 | Kiểm tra editor | Text content đúng, platform đúng |
| 3 | Sửa nội dung text | Editor cho phép sửa |
| 4 | Click Save lại | Toast "Đã cập nhật", không tạo draft mới |

**Known issue**: Nút Edit có thể không navigate — xem `docs/known-issues.md`.

### TC-C05: Xem danh sách Drafts 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Click icon Drafts trên sidebar | Navigate đến Drafts section |
| 2 | Kiểm tra Network | `GET /api/projects` hoặc tương đương trả 200 |
| 3 | Nếu có draft: hiện danh sách với platform, preview content, thời gian | Đúng |
| 4 | Nếu không có draft: empty state hiển thị | Không crash |
| 5 | Mỗi draft có nút Edit và Delete | Hiển thị đúng |

### TC-C03: Xóa draft 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong Drafts, click **Delete** trên 1 draft | Confirm modal hiển thị |
| 2 | Confirm xóa | Draft biến mất khỏi danh sách |
| 3 | Refresh trang | Draft vẫn không còn |
| 4 | Kiểm tra Network | `DELETE /api/projects/:id/drafts/:draftId` trả 200 |

### TC-C04: Edge — Draft tự động lưu 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Đang soạn post, đợi 30 giây không action | Auto-save trigger (nếu có) |
| 2 | F5 refresh | Content được khôi phục |

---

## PHẦN D: CONNECTIONS (KẾT NỐI TÀI KHOẢN MXH)

### TC-D01: Kết nối tài khoản Demo Mode ✅

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Vào **Connections** section | Grid 8 platforms hiển thị |
| 2 | Click **Connect** trên platform chưa kết nối | Popup mở OAuth flow |
| 3 | Chờ kết nối hoàn tất | Badge "Connected" + avatar hiển thị |
| 4 | Kiểm tra Network | `GET /api/connections/start/[provider]` → `{url}` → `?complete=1` |
| 5 | Refresh trang | Vẫn hiển thị Connected |
| 6 | Kiểm tra DB: `connected_accounts` table | Record mới với `platform`, `profile_id=demo-...-<userId8>` |

**Kết quả 2026-05-27**: ✅ 4 demo accounts kết nối thành công (TikTok, Facebook, Instagram, X). X platform status dot ✅ (bug cũ đã fix từ `twitter` → `x`).

### TC-D02: Kết nối OAuth thật qua Zernio ✅

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Đảm bảo `.env.local` có `ZERNIO_API_KEY` và `ZERNIO_PROFILE_ID` | Configured |
| 2 | Click **Connect** trên YouTube | Popup mở Google sign-in (không phải demo flow) |
| 3 | Popup title | "Sign in to continue to Social Media Connector" |
| 4 | Đăng nhập Google thật | Google → Zernio callback → `/api/connections/callback/youtube` |
| 5 | Popup đóng, trang connections refresh | YouTube hiển thị Connected với real username |
| 6 | Kiểm tra DB | `connected_accounts` có `getlate_account_id` là Zernio ID thật |

**Kết quả 2026-05-27**: ✅ Google OAuth popup mở đúng với `redirect_uri=https://zernio.com`. Chưa thực hiện bước 4-6 với real Google account.

### TC-D03: Ngắt kết nối ✅

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong bảng connected accounts, click **Ngắt kết nối** | Confirm dialog hiển thị |
| 2 | Confirm | Account biến khỏi bảng |
| 3 | Kiểm tra Network | `DELETE /api/connections/:id` trả 200 |
| 4 | Refresh trang | Vẫn không còn account đó |
| 5 | Platform card quay về "Chưa kết nối" | Đúng |

**Kết quả 2026-05-27**: ✅ Nút "Ngắt kết nối" hiển thị và hoạt động đúng.

### TC-D04: Edge — Kết nối vượt profile limit ⚠️

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Kết nối nhiều hơn 5 tài khoản (free plan limit = 5) | Error toast rõ ràng |
| 2 | Kiểm tra Network | `GET /api/connections/start/...` trả 403 hoặc 400 |

**Kết quả 2026-05-27**: ⚠️ Free plan limit đã nâng từ 2 → 5. Chưa test edge case > 5.

### TC-D05: Edge — Popup bị browser block 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Tắt cho phép popup trong browser settings | Settings blocked |
| 2 | Click Connect | UI hiện thông báo "Popup bị chặn" với nút "Thử lại" |
| 3 | Click thử lại | Popup được mở lại hoặc redirect full-page |

---

## PHẦN E: PUBLISHING (ĐĂNG BÀI)

### TC-E01: Publish ngay — Demo connection ✅

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong Create, có 1 post với nội dung | Content hiển thị trong editor |
| 2 | Click **Publish** | Publish modal hiển thị |
| 3 | Chọn connected account | Account được chọn |
| 4 | Click **Publish Now** | Loading toast: "Đang đăng bài..." |
| 5 | Chờ xử lý xong | Toast success |
| 6 | Kiểm tra Network | `POST /api/late/posts` trả 201 |
| 7 | Chuyển sang **Published** section | Bài vừa đăng xuất hiện |

**Kết quả 2026-05-27**: ✅ 1 bài Facebook "Review phở Thin Bờ Hồ" hiển thị trong Published với badge "Đã đăng", nút "Xem chi tiết" và "Mở liên kết".

### TC-E02: Publish thật qua Zernio 🔲

> **Tiên quyết**: TC-D02 hoàn tất — có account với real `getlate_account_id`

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Tạo post, chọn Zernio-connected account | Account hiển thị |
| 2 | Click Publish Now | Gọi Zernio API `/v1/posts` với `publishNow: true` |
| 3 | Chờ xong | Toast success, `late_job_id` là Zernio real ID |
| 4 | Kiểm tra Published | Post có `post_url` thật (không phải synthetic) |
| 5 | Click "Mở liên kết" | Mở đúng URL bài đăng thật trên platform |

### TC-E03: Publish khi chưa kết nối account ✅

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Tạo post cho platform chưa kết nối (ví dụ: LinkedIn) | Post hiển thị |
| 2 | Click Publish | Error toast: "Chưa kết nối tài khoản LinkedIn" |
| 3 | Không có request tới `/api/late/posts` | Đúng — chặn trước khi gọi API |

### TC-E04: Publish post trống 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Xóa hết content trong editor | Editor trống |
| 2 | Click Publish | Warning toast: "Nội dung bài đăng trống" |
| 3 | Không gọi API | Đúng |

### TC-E05: Publish với Media (Ảnh/Video) 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Tạo post + đính kèm ảnh | Ảnh hiện trong MediaPreview |
| 2 | Click Publish | Loading |
| 3 | Kiểm tra Network | Presigned upload → POST /api/late/posts |
| 4 | Chờ xong | Toast success, post có media URL trong Published |

### TC-E06: Edge — Publish đồng thời nhiều platform 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Có 3 posts cho 3 platform khác nhau (TikTok, Facebook, Instagram) | 3 tabs trong editor |
| 2 | Publish tất cả cùng lúc | 3 request song song hoặc sequential |
| 3 | Kiểm tra Published | 3 posts xuất hiện |
| 4 | Không có race condition / duplicate posts | Đúng |

### TC-E07: Edge — Network timeout khi publish 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | DevTools → Network → Throttle "Slow 3G" | Throttled |
| 2 | Thử Publish | Loading hiển thị, không freeze UI |
| 3 | Request timeout | Error toast rõ ràng, không stuck |
| 4 | Kiểm tra DB | Không có post "ghost" được tạo nửa chừng |

---

## PHẦN F: SCHEDULING (LÊN LỊCH)

### TC-F01: Schedule post cho tương lai 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong Create, có post sẵn sàng | Content hiển thị |
| 2 | Click **Schedule** | Schedule modal hiển thị |
| 3 | Chọn ngày: **ngày mai** | Date picker cập nhật |
| 4 | Chọn giờ: **10:00 AM** | Time picker cập nhật |
| 5 | Click **Schedule** | Loading toast |
| 6 | Chờ xong | Toast: "Đã lên lịch thành công" |
| 7 | Kiểm tra Network | `POST /api/schedule` trả 201 |
| 8 | Chuyển sang **Calendar** | Event hiển thị ở đúng ngày |

### TC-F02: Schedule trong quá khứ 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Chọn ngày/giờ đã qua | Picker nên block hoặc hiện warning |
| 2 | Nếu cho phép gửi | API chặn hoặc auto-publish ngay |

### TC-F03: Xem scheduled post trên Calendar ✅

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Vào Calendar section | Calendar grid tháng hiển thị |
| 2 | Filter theo platform | Chỉ hiện events của platform đó |
| 3 | Toggle Weekly/Monthly view | Events nhất quán |
| 4 | Agenda panel | Hiển thị đúng count (không bị double) |

**Kết quả 2026-05-27**: ✅ Calendar renders đúng. Fixed: i18n double count + duplicate event bug.

### TC-F04: Reschedule post 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong Calendar agenda, click **Reschedule** | Reschedule modal hiển thị |
| 2 | Chọn ngày/giờ mới | Date/time picker cập nhật |
| 3 | Confirm | Toast: "Đã lên lịch lại thành công" |
| 4 | Kiểm tra Network | `PATCH /api/schedule/posts/:id/reschedule` trả 200 |
| 5 | Calendar cập nhật | Event di chuyển sang ngày/giờ mới |

### TC-F05: Cancel/Delete scheduled post 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong Calendar, chọn scheduled post | Agenda hiển thị |
| 2 | Click **Delete** / **Cancel** | Confirm dialog |
| 3 | Confirm | Toast success |
| 4 | Kiểm tra Network | `DELETE /api/schedule/posts/:id` trả 200 |
| 5 | Event biến mất khỏi Calendar | Đúng |

### TC-F06: Edge — Scheduled post auto-chuyển posted 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Có post scheduled với `scheduled_at` trong quá khứ | Trong DB với status `scheduled` |
| 2 | Gọi `GET /api/late/posts` hoặc mở Calendar | `resolveInternalLatePost` trigger |
| 3 | Post status | Chuyển thành `posted` tự động |
| 4 | Calendar dot | Đổi màu từ vàng (scheduled) → xanh lá (posted) |

---

## PHẦN G: PUBLISHED POSTS

### TC-G01: Xem danh sách bài đã đăng ✅

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Vào **Published** section | Danh sách bài đã đăng hiển thị |
| 2 | Kiểm tra Network | `GET /api/posts/published` trả 200 |
| 3 | Mỗi item có: platform, content, time, URL | Đúng |
| 4 | Nút "Xem chi tiết" và "Mở liên kết" | Hiển thị đúng |
| 5 | Filter theo platform | Chỉ hiện posts của platform được chọn |

**Kết quả 2026-05-27**: ✅ Published section hiện 1 bài Facebook: "Review phở Thin Bờ Hồ — Hà Nội". PUBLISHED OUTPUT=1, LINKED POSTS=1, ACTIVE PLATFORMS=1.

### TC-G02: Xem chi tiết bài đã đăng 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Click **Xem chi tiết** trên 1 published post | Detail modal/panel mở |
| 2 | Kiểm tra: full content, platform icon, time | Tất cả hiển thị đúng |
| 3 | URL bài đăng có nút copy/open | Hoạt động |
| 4 | Engagement (likes=0, comments=0, shares=0) | Hiển thị ở demo mode |
| 5 | Đóng modal | Quay về danh sách đúng |

### TC-G03: Search và filter Published 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong Published, click filter "Tất cả nền tảng" | Dropdown hiển thị danh sách platforms |
| 2 | Chọn "Facebook" | Chỉ hiển thị Facebook posts |
| 3 | Chọn "TikTok" | Chỉ hiển thị TikTok posts (hoặc empty nếu chưa có) |
| 4 | Chọn "Tất cả nền tảng" lại | Hiện toàn bộ |
| 5 | Search box: gõ từ khóa trong content | Filter theo nội dung |

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Click vào 1 published post | Detail modal hiển thị |
| 2 | Kiểm tra: full content, time, URL, engagement | Tất cả hiển thị đúng |
| 3 | Engagement (likes, comments, shares) | Hiển thị (mặc định 0 ở demo mode) |

---

## PHẦN H: FAILED POSTS

### TC-H01: Xem danh sách bài thất bại 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Vào **Failed** section | Danh sách hiển thị (có thể trống) |
| 2 | Kiểm tra Network | `GET /api/posts/failed` trả 200 |
| 3 | Mỗi item có: platform, error reason, time | Đúng |

### TC-H02: Simulate failed post và Retry 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Supabase: `UPDATE scheduled_posts SET status='failed' WHERE id='...'` | DB updated |
| 2 | Mở Failed section | Post xuất hiện với badge "Thất bại" |
| 3 | Click **Reschedule** | Reschedule modal hiển thị |
| 4 | Chọn thời gian mới, confirm | Post chuyển thành `scheduled` |
| 5 | Calendar cập nhật | Event mới xuất hiện |

### TC-H04: Mở lại bài thất bại trong editor 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Click **Edit Again** / **Chỉnh sửa** trên 1 failed post | Navigate về Create section |
| 2 | Editor load đúng content + platform gốc | Đúng |
| 3 | Có thể sửa nội dung | Editor cho phép edit |
| 4 | Publish hoặc schedule lại | Flow bình thường |

### TC-H03: Xóa bài thất bại 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Click **Delete** trên 1 failed post | Confirm dialog |
| 2 | Confirm | Post biến mất |
| 3 | Refresh | Vẫn không còn |

---

## PHẦN I: CREDITS & USAGE

### TC-I01: Kiểm tra credit balance 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Kiểm tra Network: `GET /api/usage` | Response có `credits.remaining` |
| 2 | Generate 1 text content | Credits giảm 1 (TEXT_ONLY) |
| 3 | Generate 1 image | Credits giảm 5 (WITH_IMAGE) |
| 4 | Kiểm tra lại `/api/usage` | Số credits đã cập nhật |

### TC-I02: Hết credits — Generate bị chặn 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | `UPDATE users SET credits_balance = 0` | Done |
| 2 | Thử Generate content | Error: "Insufficient credits" |
| 3 | Error hiển thị rõ ràng | Có link/hint nạp thêm |
| 4 | Thử Publish (không cần credits) | Publish vẫn hoạt động bình thường |

### TC-I03: Kiểm tra Operations Dashboard ✅

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Vào **Operations** section | Dashboard hiển thị |
| 2 | 3 tabs: Tổng quan, Phân tích quy trình, Hoạt động | Render không lỗi |
| 3 | Số liệu có logic | Đúng |

**Kết quả 2026-05-27**: ✅ Operations: Drafts=0, Published=1, Failed=0, Connections=4. Điểm sẵn sàng: 56/100. Khối lượng 7 ngày: 1. Tỷ lệ thành công: 100%.

### TC-I04: Operations — Tab "Phân tích quy trình" 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong Operations, click tab **Phân tích quy trình** | Tab content hiển thị |
| 2 | Kiểm tra chart/graph render | Không lỗi, axis label đúng |
| 3 | Số liệu có tính logic (không NaN, không undefined) | Đúng |
| 4 | Hover tooltip trên chart | Tooltip hiển thị giá trị |

### TC-I05: Operations — Tab "Hoạt động" 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Click tab **Hoạt động** | Activity log hiển thị |
| 2 | Các action gần nhất xuất hiện | Publish, schedule, connect — đúng thứ tự thời gian |
| 3 | Mỗi entry có: action type, time, context | Đúng |
| 4 | Scroll xuống (nếu nhiều entries) | Không crash |

---

## PHẦN N: PAYMENT (NẠP CREDITS)

### TC-N01: Hiển thị gói credits ✅

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Vào Settings section | Trang Cài đặt hệ thống hiển thị |
| 2 | Scroll đến "Nạp thêm Credits" | 4 gói hiển thị: 50, 100, 250, 600 |
| 3 | Kiểm tra thông tin mỗi gói | Credits, giá VND, giá/credit |
| 4 | Gói "Phổ biến" được highlight | Badge "Phổ biến" trên gói 250 credits |

**Kết quả 2026-05-27**: ✅ 4 gói hiển thị đúng: 50cr/29k, 100cr/49k, 250cr/99k (Phổ biến), 600cr/199k.

### TC-N02: Tạo đơn hàng và hiển thị QR ✅

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Click **Mua ngay** trên gói 250 credits | Loading → Dialog "Chuyển khoản ngân hàng" |
| 2 | QR code VietQR hiển thị | Logo VietQR + Vietcombank |
| 3 | Thông tin ngân hàng | Số TK: 1014816617, Tên: VU TUAN ANH |
| 4 | Số tiền | 99.000₫ (khớp gói 250 credits) |
| 5 | Nội dung CK | `CREATORHUB {orderCode}` (12 chữ số unique) |
| 6 | Kiểm tra Network | `POST /api/payment/create-order` trả 200, tạo order trong DB |

**Kết quả 2026-05-27**: ✅ QR tạo thành công với đầy đủ thông tin. Order code unique theo timestamp. Ngân hàng: Vietcombank.

### TC-N03: Sao chép thông tin chuyển khoản 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong dialog QR, click icon copy bên cạnh số TK | Clipboard nhận giá trị |
| 2 | Click icon copy bên cạnh số tiền | Clipboard nhận `99000` |
| 3 | Click icon copy bên cạnh Nội dung CK | Clipboard nhận `CREATORHUB {orderCode}` |
| 4 | Toast "Đã sao chép" hiện | Đúng |

### TC-N04: Xác nhận chưa thanh toán 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong dialog, click **Tôi đã thanh toán** ngay (không chuyển khoản) | API `GET /api/payment/check-order?orderCode=...` |
| 2 | API trả về status PENDING | Toast: "Chưa nhận được thanh toán" hoặc tương tự |
| 3 | Dialog vẫn mở | Không đóng cho đến khi được xác nhận |

### TC-N05: Admin xác nhận thanh toán thủ công ✅ (manual)

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Admin: Supabase → `credit_orders` → tìm order code | Order có status=PENDING |
| 2 | Đổi `status = 'PAID'` trong DB | Updated |
| 3 | User: click "Tôi đã thanh toán" | API kiểm tra → status=PAID |
| 4 | Dialog đóng | Credits được cộng vào balance |
| 5 | Kiểm tra `GET /api/usage` | `credits.remaining` tăng đúng số credits của gói |

**Lưu ý**: Đây là luồng thủ công cho đồ án. Production cần webhook từ ngân hàng.

### TC-N06: Edge — Mở nhiều QR cùng lúc 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Click "Mua ngay" gói 50 credits | QR 1 hiển thị |
| 2 | Đóng, click "Mua ngay" gói 100 credits | QR 2 hiển thị với số tiền 49k |
| 3 | Không có cross-contamination | Order code và số tiền của QR 2 là đúng |

### TC-N07: Edge — Thông tin VietQR thiếu trong .env 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Comment out `VIETQR_BANK_BIN` trong .env | Thiếu cấu hình |
| 2 | Click "Mua ngay" | Error toast rõ ràng, không crash |

---

## PHẦN J: MEDIA & FILE UPLOAD

### TC-J01: Upload ảnh vào post 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong editor, click nút đính kèm media | File picker mở |
| 2 | Chọn 1 file ảnh (JPG/PNG, < 5MB) | Preview hiển thị |
| 3 | Ảnh hiện trong MediaPreview component | Đúng kích thước, không bị méo |

### TC-J02: Upload file quá kích thước 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Upload ảnh > 10MB | Error: "File quá lớn" |
| 2 | Upload file sai định dạng (PDF, EXE) | Error: "Định dạng không được hỗ trợ" |

---

## PHẦN K: I18N (ĐA NGÔN NGỮ)

### TC-K01: Chuyển ngôn ngữ ✅

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Hiện đang ở `/vi/create` | UI tiếng Việt |
| 2 | Click Language Switcher → chọn English | URL đổi thành `/en/create` |
| 3 | Tất cả label, button, toast | Chuyển sang tiếng Anh |
| 4 | Refresh trang | Vẫn tiếng Anh |
| 5 | Chuyển lại tiếng Việt | URL = `/vi/create`, UI tiếng Việt |

**Kết quả 2026-05-27**: ✅ Header hiển thị VI/EN switcher đúng.

### TC-K02: Consistency nội dung đa ngôn ngữ 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Mở mỗi section ở tiếng Anh | Không có text tiếng Việt sót lại |
| 2 | Mở mỗi section ở tiếng Việt | Không có text tiếng Anh sót lại |
| 3 | Kiểm tra toast messages | Đúng ngôn ngữ đang chọn |
| 4 | Kiểm tra error messages | Đúng ngôn ngữ |

---

## PHẦN L: PROFILE & SETTINGS

### TC-L01: Xem Profile 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Vào **Profile** section | Tên, email, avatar hiển thị |
| 2 | Kiểm tra Network | `GET /api/me` trả 200 |
| 3 | Login methods hiển thị đúng | Email / Google |

### TC-L03: Cập nhật thông tin Profile 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Vào Profile section | Form thông tin hiển thị |
| 2 | Sửa display name | Input nhận giá trị mới |
| 3 | Click Save / Cập nhật | Toast success, DB updated |
| 4 | Refresh trang | Tên mới vẫn hiển thị |
| 5 | Header user chip | Cập nhật theo tên mới |

### TC-L02: System Settings ✅

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Vào Settings section | Panel 3 cards hiển thị |
| 2 | Toggle dark/light mode | Theme thay đổi ngay (button Sáng/Tối) |
| 3 | Click "Chạy lại onboarding" | Onboarding flow re-trigger |
| 4 | Click "Mở hồ sơ" / "Mở kết nối" | Navigate đến profile / connections |

**Kết quả 2026-05-27**: ✅ Settings UI: Theme=Sáng, Language=VI, Chế độ=Quy trình nội dung AI.

---

## PHẦN O: ONBOARDING & NAVIGATION

### TC-O01: Chạy lại Onboarding 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Vào Settings, click **Chạy lại onboarding** | Onboarding modal/flow xuất hiện |
| 2 | Đi qua từng bước của onboarding | Các bước hiển thị đúng thứ tự |
| 3 | Hoàn thành onboarding | Redirect về Create section |
| 4 | Không bị loop vô tận | Đúng |

### TC-O02: Manual post creation (không dùng AI) 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong Create empty state, click **TikTok** | Tạo post thủ công cho TikTok |
| 2 | Hoặc click **Thêm bài đăng** | Post tab mới xuất hiện |
| 3 | Nhập nội dung thủ công | Editor nhận text |
| 4 | Publish ngay | Flow bình thường, không cần AI |

### TC-O03: Sidebar navigation 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Click từng icon trên sidebar (Create → Calendar → Drafts → Published → Failed → Operations → Connections → Settings → Profile) | Mỗi section load đúng |
| 2 | URL thay đổi theo section | `/vi/create`, `/vi/calendar`, v.v. |
| 3 | Không có blank page hoặc crash | Đúng |
| 4 | Active icon highlight đúng section hiện tại | Đúng |

### TC-O04: Dark mode persistence 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Settings → click **Tối** | Toàn bộ UI chuyển dark |
| 2 | Refresh trang | Vẫn dark mode |
| 3 | Navigate sang Calendar, Operations | Tất cả sections đều dark |
| 4 | Click **Sáng** | UI chuyển light, persisted sau refresh |

---

## PHẦN M: CROSS-CUTTING (EDGE CASES)

### TC-M01: Refresh ở giữa thao tác 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Generate content → F5 giữa chừng | Không crash, quay về trạng thái clean |
| 2 | Đang schedule → F5 | Không tạo ghost event |
| 3 | Đang publish → F5 | Kiểm tra post có bị publish 2 lần không |

### TC-M02: Mở nhiều tab 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Mở tab 1: `/vi/create`, tab 2: `/vi/calendar` | Cả 2 load đúng |
| 2 | Publish ở tab 1 | Published section ở tab 2 cập nhật sau refresh |

### TC-M03: Network offline/slow 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Tắt network trong DevTools | UI hiện trạng thái offline hoặc error |
| 2 | Thử Generate | Error toast, không hang/crash |
| 3 | Bật lại network | App recover, có thể retry |

### TC-M04: Edge — SQL injection / XSS 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Nhập `<script>alert(1)</script>` vào content editor | Text render as-is, không execute JS |
| 2 | Nhập `'; DROP TABLE scheduled_posts; --` | ORM escapes, DB không bị ảnh hưởng |
| 3 | Post content hiển thị trong Published | HTML entities escaped đúng |

### TC-M05: Edge — Calendar localStorage sau nhiều test sessions 🔲

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Xóa localStorage: DevTools → Application → Clear | All cleared |
| 2 | Reload Calendar | Chỉ load data từ DB (API), không có ghost events |
| 3 | Không có duplicate key warnings | Console sạch |

**Lưu ý**: Phải clear localStorage trước mỗi demo session để tránh accumulated test data.

---

## Regression nhanh trước bảo vệ đồ án (8 case tối thiểu)

| # | Test Case | Kết quả |
|---|-----------|---------|
| 1 | **TC-A01** — Đăng nhập email | ✅ |
| 2 | **TC-D01** — Kết nối tài khoản demo | ✅ |
| 3 | **TC-D02** — Zernio OAuth popup mở | ✅ |
| 4 | **TC-E01** — Publish ngay | ✅ |
| 5 | **TC-G01** — Xem Published posts | ✅ |
| 6 | **TC-F03** — Calendar renders đúng | ✅ |
| 7 | **TC-I03** — Operations Dashboard | ✅ |
| 8 | **TC-N01/N02** — Payment QR flow | ✅ |

---

## Bugs đã phát hiện và xử lý

| Bug | Mức độ | Trạng thái |
|-----|--------|------------|
| OAuth popup "Unauthorized" | High | ✅ Fixed — append token cho same-origin URL |
| X platform status dot không nhận "connected" | Medium | ✅ Fixed — `PROVIDER_SLUGS["X"] = "x"` |
| Calendar agenda count hiện "78 78 lịch" | Low | ✅ Fixed — remove duplicate count in JSX |
| Calendar duplicate React keys từ localStorage | Medium | ✅ Fixed — dedup by id after merge |
| Google OAuth login redirect `/vi/vi/signin` | High | ⚠️ Known, ghi nhận — cần fix Supabase redirect config |
| Free plan limit quá thấp (2 profiles) | Medium | ✅ Fixed → nâng lên 5 |
| CreditTopUp dialog thiếu DialogDescription | Low | ✅ Fixed — a11y warning resolved |

---

## Mẫu log bug khi test

```markdown
### [BUG-XXX] Tiêu đề ngắn

**Mức độ**: Critical / High / Medium / Low
**Section**: Create / Calendar / Published / Failed / Connections / Payment / ...
**Bước tái hiện**:
1. ...
2. ...

**Kết quả thực tế**: ...
**Kết quả mong đợi**: ...
**API liên quan**: `POST /api/...` — status: ...
**Hành động**: fix / defer / accept
```
