# Kịch Bản Kiểm Thử Thủ Công (Manual E2E Test Plan v2)

> **Mục đích**: Kiểm thử toàn bộ luồng thực tế của CreatorHub trên `npm run dev`.
> Mỗi test case có bước chi tiết, kết quả mong đợi, và hướng sửa nếu fail.
> **Ngày tạo**: 2026-05-25

---

## Chuẩn bị môi trường

1. `npm install && npm run dev`
2. Mở browser (Chrome/Edge), bật DevTools → **Console + Network + Application**
3. Đảm bảo `.env.local` có đủ:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY` (hoặc `OPENAI_API_KEY`)
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
4. Đảm bảo Supabase DB đã chạy `db/schema.sql` + `db/initDataForGenerateContent.sql`
5. Có sẵn 1 tài khoản test (email/password hoặc Google OAuth)

### Quy ước ký hiệu

- ✅ = Pass
- ❌ = Fail → ghi bug
- ⚠️ = Pass có điều kiện (ghi note)
- 🔧 = Cần fix trước khi demo

---

## PHẦN A: AUTHENTICATION & SESSION

### TC-A01: Đăng nhập bằng Email (pass)

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Mở `http://localhost:3000` | Landing page hiển thị đúng |
| 2 | Click "Đăng nhập" / "Sign in" | Redirect đến `/vi/signin` hoặc `/en/signin` |
| 3 | Nhập email + password hợp lệ | Loading spinner hiển thị |
| 4 | Chờ đăng nhập xong | Redirect đến `/vi/create` hoặc `/en/create` |
| 5 | Kiểm tra Console | Không có error đỏ liên quan auth |
| 6 | Kiểm tra Network | `POST /auth` trả về 200, có token |

**Nếu fail:**
- 401 → Kiểm tra tài khoản có tồn tại trong Supabase Auth
- Redirect loop → Kiểm tra middleware `i18n` và `NEXT_PUBLIC_APP_URL`
- Flash UI trắng → Kiểm tra `useRequireAuth` hook

### TC-A02: Đăng nhập bằng Google OAuth (fail vi redirect về /vi/vi/signin)

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Click "Đăng nhập bằng Google" | Mở Google OAuth consent screen |
| 2 | Chọn tài khoản Google | Redirect về callback URL |
| 3 | Chờ callback xử lý | Redirect đến `/create` với session |
| 4 | Kiểm tra Profile section | Hiển thị đúng tên + email Google |

**Nếu fail:**
- Redirect sai URL → Kiểm tra Supabase Auth > URL Configuration > Redirect URLs
- "Invalid origin" → Thêm `localhost:3000` vào Supabase allowed origins

### TC-A03: Session persistence

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Sau khi đã đăng nhập, **F5 refresh** | Vẫn ở trang hiện tại, không redirect |
| 2 | Mở tab mới, vào `/en/create` | Vào được, không redirect về signin |
| 3 | Để idle 5 phút, click vào section khác | Vẫn hoạt động bình thường |
| 4 | Đóng browser hoàn toàn, mở lại app | Session vẫn giữ (nếu remember me) |

### TC-A04: Đăng xuất

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Click Sign Out (trong Profile hoặc header) | Redirect về landing hoặc signin |
| 2 | Thử vào `/en/create` trực tiếp | Bị redirect về signin |
| 3 | Kiểm tra localStorage trong DevTools | Session data đã bị xóa |
| 4 | Kiểm tra Console | Không error spam |

---

## PHẦN B: CONTENT CREATION (AI)

### TC-B01: Tạo nội dung từ Text (Content Strategy)

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
- "Insufficient credits" → Kiểm tra `GET /api/usage`, tăng credits trong DB
- API timeout → Kiểm tra `GEMINI_API_KEY` hoặc `OPENAI_API_KEY`
- Generate trả về rỗng → Kiểm tra prompts trong `lib/prompts/index.ts`
- 🔧 **Fix nếu cần**: Thêm credits cho user test: `UPDATE users SET credits_balance = 100 WHERE id = '<user_id>'`

### TC-B02: Tạo nội dung từ URL

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong Create, chọn source type **URL** | Input URL hiển thị |
| 2 | Paste một URL bài viết hợp lệ (ví dụ: bài blog tech) | URL được nhận |
| 3 | Click Generate | Content được trích xuất từ URL → AI generate posts |
| 4 | Kiểm tra nội dung generated | Liên quan đến nội dung URL gốc |

**Nếu fail:**
- URL extraction lỗi → Kiểm tra `/api/data/url` response
- CORS error → URL có thể bị block, thử URL khác

### TC-B03: Tạo nội dung từ YouTube URL

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Paste YouTube URL vào source | URL được nhận diện là YouTube |
| 2 | Generate | Extract metadata → generate content |
| 3 | Thử YouTube URL sai format | Error message rõ ràng |

### TC-B04: Tạo hình ảnh AI

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong editor, click nút tạo ảnh AI | Modal Image Gen mở |
| 2 | Nhập prompt: "A colorful infographic about AI in education" | Prompt được nhận |
| 3 | Click Generate | Loading → ảnh được tạo |
| 4 | Click chọn ảnh để gắn vào post | Ảnh hiển thị trong media preview |
| 5 | Kiểm tra Network | `POST /api/ai/generate-image` trả 200 |
| 6 | Kiểm tra credits | Trừ 5 credits (WITH_IMAGE) |

**Nếu fail:**
- Image API không hỗ trợ → Kiểm tra provider config
- Credits không đủ → Tăng credits

### TC-B05: AI Chatbot trợ lý

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Mở panel Chat (bên phải hoặc nút chat) | Chat panel hiển thị |
| 2 | Gõ: "Viết lại nội dung này ngắn gọn hơn" | Message hiển thị trong chat |
| 3 | Chờ AI trả lời | Response hiển thị, format markdown |
| 4 | Gõ tiếp: "Dịch sang tiếng Anh" | AI trả lời tiếp theo context |
| 5 | Kiểm tra Network | `POST /api/chat` trả 200 |

**Nếu fail:**
- Chat không response → Kiểm tra chat session API
- Credits → 1 credit per 3 requests (AI_REFINEMENT)

---

## PHẦN C: DRAFT MANAGEMENT

### TC-C01: Lưu draft

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Sau khi generate content (TC-B01), click **Save as Draft** | Toast "Đã lưu draft" hiển thị |
| 2 | Kiểm tra Network | `POST /api/projects` + `POST /api/projects/:id/drafts` trả 201 |
| 3 | Chuyển sang **Drafts** section | Draft vừa lưu xuất hiện trong danh sách |
| 4 | Kiểm tra: platform, content preview, thời gian | Tất cả đúng |

**Nếu fail:**
- Draft không xuất hiện → Kiểm tra `getDraftsByUserId` response
- Duplicate draft → Bug ở `createDraft`, kiểm tra project_id

### TC-C02: Mở lại draft để chỉnh sửa

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong Drafts, click **Edit** trên 1 draft | Navigate về `/create` với content loaded |
| 2 | Kiểm tra editor | Text content đúng, platform đúng |
| 3 | Kiểm tra media | Nếu có ảnh/video, hiển thị đúng |
| 4 | Sửa nội dung text | Editor cho phép sửa |
| 5 | Click Save lại | Toast "Đã cập nhật", không tạo draft mới |
| 6 | Quay lại Drafts | Draft cập nhật đúng thời gian mới |

**Nếu fail:**
- ❌ **KNOWN ISSUE**: Nút Edit có thể không navigate (xem `docs/known-issues.md` mục `[2026-05-21]`)
- 🔧 **Fix**: Kiểm tra button onClick handler trong DraftsSection component → đảm bảo `router.push('/create')` với đúng params

### TC-C03: Xóa draft

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong Drafts, click **Delete** trên 1 draft | Confirm modal hiển thị |
| 2 | Confirm xóa | Draft biến mất khỏi danh sách |
| 3 | Refresh trang | Draft vẫn không còn |
| 4 | Kiểm tra Network | `DELETE /api/projects/:id/drafts/:draftId` trả 200 |

---

## PHẦN D: CONNECTIONS (KẾT NỐI TÀI KHOẢN MXH)

### TC-D01: Kết nối tài khoản (Demo Mode)

> **Lưu ý**: Hiện tại hệ thống đang ở demo mode — tạo fake connection thay vì OAuth thật.
> Đây là hành vi có chủ đích cho đồ án.

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Vào **Connections** section | Grid 8 platforms hiển thị |
| 2 | Click **Connect** trên Facebook | Popup/dialog hiện (hoặc process ngay trong demo mode) |
| 3 | Chờ kết nối hoàn tất | Badge "Connected" + avatar hiển thị |
| 4 | Kiểm tra Network | `GET /api/connections/start/facebook?complete=1` trả 200 |
| 5 | Refresh trang | Vẫn hiển thị Connected |
| 6 | Kiểm tra DB: `connected_accounts` table | Record mới với `platform=facebook`, `profile_id=demo-facebook-<userId>` |

**Nếu fail:**
- Popup bị block → Cho phép popup trong browser settings
- Connection không lưu → Kiểm tra `createConnectionLegacy` service
- Refresh mất state → Kiểm tra `loadConnectedAccounts` API call

### TC-D02: Kết nối nhiều platform

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Kết nối thêm **Instagram**, **TikTok**, **YouTube** | Mỗi platform hiển thị Connected |
| 2 | Kiểm tra profile limit | Free plan = 2 profiles → Platform thứ 3 bị chặn |
| 3 | Kiểm tra toast/error khi vượt limit | Message rõ ràng: "Đã đạt giới hạn..." |

**Nếu fail:**
- Không check limit → Kiểm tra `checkProfileLimit` trong `/api/connections/start/[provider]`
- 🔧 **Fix**: Thêm check `checkProfileLimit` trước khi tạo connection

### TC-D03: Ngắt kết nối

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Click **Disconnect** trên platform đã kết nối | Confirm dialog hiển thị |
| 2 | Confirm | Badge chuyển về "Not connected" |
| 3 | Kiểm tra Network | `DELETE /api/connections/:id` trả 200 |
| 4 | Refresh trang | Vẫn Not connected |
| 5 | Kiểm tra DB | Record bị xóa khỏi `connected_accounts` |

---

## PHẦN E: PUBLISHING (ĐĂNG BÀI)

### TC-E01: Publish ngay (Publish Now)

> **Tiên quyết**: Đã kết nối ít nhất 1 platform (TC-D01)

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong Create, có 1 post Facebook với nội dung | Content hiển thị trong editor |
| 2 | Click **Publish** | Publish modal hiển thị |
| 3 | Chọn connected account (nếu có nhiều) | Account được chọn |
| 4 | Click **Publish Now** | Loading toast: "Đang đăng bài..." |
| 5 | Chờ xử lý xong | Toast success: "Bài viết đã được đăng thành công!" |
| 6 | Kiểm tra Network | `POST /api/late/posts` trả 201 |
| 7 | Response body kiểm tra | `latePost.url` có giá trị |
| 8 | Post tab biến mất khỏi editor | Đúng — post đã xử lý xong |
| 9 | Chuyển sang **Published** section | Bài vừa đăng xuất hiện |
| 10 | Click **View Post** (nếu có URL) | Mở URL (sẽ là synthetic URL ở demo mode) |

**Nếu fail:**
- "Account not connected" → Chưa kết nối hoặc platform không khớp
- 500 error → Kiểm tra `createInternalLatePost` service
- Post không hiện ở Published → Kiểm tra `loadPublishedPosts` / `needsRefreshPublishedPosts` flag
- 🔧 **Fix nếu cần**: Đảm bảo `useCreatePublishStore.handlePublish` set `needsRefreshPublishedPosts` đúng

### TC-E02: Publish khi chưa kết nối account

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Tạo post cho platform chưa kết nối (ví dụ: LinkedIn) | Post hiển thị |
| 2 | Click Publish | Error toast: "Chưa kết nối tài khoản LinkedIn" |
| 3 | Không có request tới `/api/late/posts` | Đúng — chặn trước khi gọi API |

### TC-E03: Publish post trống

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Xóa hết content trong editor | Editor trống |
| 2 | Click Publish | Warning toast: "Nội dung bài đăng trống" |
| 3 | Không gọi API | Đúng |

### TC-E04: Publish với Media (Ảnh/Video)

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Tạo post với content + đính kèm ảnh | Ảnh hiện trong MediaPreview |
| 2 | Click Publish | Loading: "Đang đăng bài..." |
| 3 | Kiểm tra Network | Presigned upload → PUT S3 → POST /api/late/posts |
| 4 | Chờ xong | Toast success, post có media URL trong Published |

**Nếu fail:**
- Upload ảnh fail → Kiểm tra presigned URL flow (`/api/files/presign-upload`)
- S3 PUT fail → Kiểm tra CORS policy trên S3/Supabase Storage

---

## PHẦN F: SCHEDULING (LÊN LỊCH)

### TC-F01: Schedule post cho tương lai

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong Create, có post sẵn sàng | Content hiển thị |
| 2 | Click **Schedule** | Schedule modal hiển thị |
| 3 | Chọn ngày: **ngày mai** | Date picker cập nhật |
| 4 | Chọn giờ: **10:00 AM** | Time picker cập nhật |
| 5 | Click **Schedule** | Loading toast |
| 6 | Chờ xong | Toast: "Đã lên lịch 1 bài đăng cho Facebook vào 10:00 AM ngày..." |
| 7 | Kiểm tra Network | `POST /api/schedule` trả 201 |
| 8 | Response body | `scheduledPosts` array có 1 item |
| 9 | Post biến mất khỏi editor | Đúng |
| 10 | Chuyển sang **Calendar** | Event hiển thị ở đúng ngày |

**Nếu fail:**
- Schedule trả 500 → Kiểm tra connections match
- Calendar không hiển thị → Kiểm tra `hydrateScheduledPosts`
- 🔧 **Fix**: Đảm bảo `calendarStore.hydrateScheduledPosts()` được gọi sau schedule thành công

### TC-F02: Xem scheduled post trên Calendar

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Vào Calendar section | Calendar grid hiển thị |
| 2 | Navigate đến ngày đã schedule | Ngày có event dot/badge |
| 3 | Click vào ngày đó | Agenda panel bên phải hiển thị chi tiết |
| 4 | Kiểm tra: platform icon, time, content preview | Tất cả đúng |
| 5 | Thử toggle Weekly/Monthly view | Event hiển thị nhất quán ở cả 2 view |

### TC-F03: Reschedule post

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong Calendar agenda, click **Reschedule** | Reschedule modal hiển thị |
| 2 | Chọn ngày/giờ mới | Date/time picker cập nhật |
| 3 | Confirm | Toast: "Đã lên lịch lại thành công" |
| 4 | Kiểm tra Network | `PATCH /api/schedule/posts/:id/reschedule` trả 200 |
| 5 | Calendar cập nhật | Event di chuyển sang ngày/giờ mới |
| 6 | Event ở ngày cũ biến mất | Đúng |
| 7 | Refresh trang | Vẫn đúng ngày/giờ mới |

**Nếu fail:**
- 404 → Post ID không tồn tại
- 500 → Kiểm tra `updatePost` service
- Calendar không update → Kiểm tra `hydrateScheduledPosts` được gọi lại

### TC-F04: Cancel/Delete scheduled post

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong Calendar, chọn scheduled post | Agenda hiển thị |
| 2 | Click **Delete** / **Cancel** | Confirm dialog |
| 3 | Confirm | Toast success |
| 4 | Kiểm tra Network | `DELETE /api/schedule/posts/:id` trả 200 |
| 5 | Event biến mất khỏi Calendar | Đúng |
| 6 | Refresh | Không còn ghost event |

---

## PHẦN G: PUBLISHED POSTS

### TC-G01: Xem danh sách bài đã đăng

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Vào **Published** section | Danh sách bài đã đăng hiển thị |
| 2 | Kiểm tra Network | `GET /api/posts/published` trả 200 |
| 3 | Mỗi item có: platform, content, time, URL | Đúng |
| 4 | Click **View Post** | Mở URL trong tab mới |
| 5 | Filter theo platform | Chỉ hiện posts của platform được chọn |
| 6 | Scroll xuống (nếu nhiều posts) | Pagination/load more hoạt động |

### TC-G02: Xem chi tiết bài đã đăng

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Click vào 1 published post | Detail modal hiển thị |
| 2 | Kiểm tra: platform, full content, time, URL, engagement | Tất cả hiển thị đúng |
| 3 | Engagement (likes, comments, shares) | Hiển thị (mặc định 0 ở demo mode) |

---

## PHẦN H: FAILED POSTS

### TC-H01: Xem danh sách bài thất bại

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Vào **Failed** section | Danh sách hiển thị (có thể trống) |
| 2 | Kiểm tra Network | `GET /api/posts/failed` trả 200 |
| 3 | Mỗi item có: platform, error reason, time | Đúng |
| 4 | Error message đọc được, không phải raw JSON | Đúng |

### TC-H02: Retry/Reschedule bài thất bại

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Click **Reschedule** trên 1 failed post | Reschedule modal hiển thị |
| 2 | Chọn ngày/giờ mới | Picker cập nhật |
| 3 | Confirm | Toast: "Đã lên lịch lại thành công" |
| 4 | Post biến mất khỏi Failed | Đúng |
| 5 | Calendar có event mới | Đúng |
| 6 | Kiểm tra Network | `PATCH /api/schedule/posts/:id/reschedule` trả 200 |

### TC-H03: Xóa bài thất bại

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Click **Delete** trên 1 failed post | Confirm dialog |
| 2 | Confirm | Post biến mất |
| 3 | Refresh | Vẫn không còn |

### TC-H04: Mở lại bài thất bại trong editor

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Click **Edit Again** trên 1 failed post | Navigate về Create |
| 2 | Editor load đúng content + media gốc | Đúng |
| 3 | Có thể sửa và publish/schedule lại | Đúng |

---

## PHẦN I: CREDITS & USAGE

### TC-I01: Kiểm tra credit balance

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Kiểm tra Network: `GET /api/usage` | Response có `credits.remaining` |
| 2 | Vào Operations section | Credit info hiển thị |
| 3 | Generate 1 text content | Credits giảm 1 (TEXT_ONLY) |
| 4 | Generate 1 image | Credits giảm 5 (WITH_IMAGE) |
| 5 | Kiểm tra lại `/api/usage` | Số credits đã cập nhật |

### TC-I02: Hết credits

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Đặt credits = 0 trong DB: `UPDATE users SET credits_balance = 0` | Done |
| 2 | Thử Generate content | Error: "Insufficient credits" |
| 3 | Error hiển thị modal/toast rõ ràng | Có hướng dẫn nạp thêm |
| 4 | Thử Publish (không cần credits) | Publish vẫn hoạt động bình thường |

### TC-I03: Kiểm tra Operations Dashboard

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Vào **Operations** section | Dashboard hiển thị |
| 2 | Kiểm tra các tab: Overview, Analytics, Activity | Render không lỗi |
| 3 | Số liệu có logic (credits used, projects created...) | Đúng |
| 4 | Chart render đúng | Không lỗi date/number |
| 5 | Activity log có đúng actions gần đây | Đúng |

---

## PHẦN J: MEDIA & FILE UPLOAD

### TC-J01: Upload ảnh vào post

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Trong editor, click nút đính kèm media | File picker mở |
| 2 | Chọn 1 file ảnh (JPG/PNG, < 5MB) | Preview hiển thị |
| 3 | Ảnh hiện trong MediaPreview component | Đúng kích thước, không bị méo |

### TC-J02: Upload video vào post

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Chọn 1 file video (MP4, < 50MB) | Preview hiển thị (có thể thumbnail) |
| 2 | Video icon hiển thị đúng loại | Đúng |

### TC-J03: Media Library

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Mở Media Library selector | Modal hiển thị |
| 2 | Xem danh sách media đã upload | Grid/list hiển thị |
| 3 | Chọn 1 media từ library | Media gắn vào post hiện tại |
| 4 | Kiểm tra Network | `GET /api/media-assets` trả 200 |

---

## PHẦN K: I18N (ĐA NGÔN NGỮ)

### TC-K01: Chuyển ngôn ngữ

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Hiện đang ở `/vi/create` | UI tiếng Việt |
| 2 | Click **Language Switcher** → chọn English | URL đổi thành `/en/create` |
| 3 | Tất cả label, button, toast | Chuyển sang tiếng Anh |
| 4 | Refresh trang | Vẫn tiếng Anh |
| 5 | Chuyển lại tiếng Việt | URL = `/vi/create`, UI tiếng Việt |

### TC-K02: Consistency nội dung đa ngôn ngữ

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Mở mỗi section 1 lần ở tiếng Anh | Không có text tiếng Việt sót |
| 2 | Mở mỗi section 1 lần ở tiếng Việt | Không có text tiếng Anh sót |
| 3 | Kiểm tra toast messages | Đúng ngôn ngữ đang chọn |
| 4 | Kiểm tra error messages | Đúng ngôn ngữ |

---

## PHẦN L: PROFILE & SETTINGS

### TC-L01: Xem và cập nhật Profile

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Vào **Profile** section | Tên, email, avatar hiển thị |
| 2 | Kiểm tra Network | `GET /api/me` trả 200 |
| 3 | Login methods hiển thị đúng | Email / Google |

### TC-L02: System Settings

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Vào **Settings** section | Settings panel hiển thị |
| 2 | Toggle dark/light mode | Theme thay đổi ngay |
| 3 | Refresh | Theme được lưu |

---

## PHẦN M: CROSS-CUTTING (EDGE CASES)

### TC-M01: Refresh ở giữa thao tác

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Generate content → F5 giữa chừng | Không crash, quay về trạng thái clean |
| 2 | Đang schedule → F5 | Không tạo ghost event |
| 3 | Đang publish → F5 | Kiểm tra post có bị publish 2 lần không |

### TC-M02: Mở nhiều tab

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Mở tab 1: `/en/create` | OK |
| 2 | Mở tab 2: `/en/calendar` | OK, data đồng bộ |
| 3 | Publish ở tab 1 | Published section ở tab 2 cập nhật sau refresh |

### TC-M03: Network offline/slow

| Bước | Thao tác | Kết quả mong đợi |
|------|---------|------------------|
| 1 | Tắt network trong DevTools | UI hiện trạng thái offline hoặc error |
| 2 | Thử Generate | Error toast, không hang/crash |
| 3 | Bật lại network | App recover, có thể retry |

---

## Regression nhanh trước bảo vệ đồ án (6 case tối thiểu)

1. **TC-A01** — Đăng nhập
2. **TC-B01** — Tạo nội dung AI
3. **TC-E01** — Publish ngay
4. **TC-F01** — Schedule post
5. **TC-D01** — Kết nối tài khoản
6. **TC-I03** — Operations Dashboard

---

## Mẫu log bug khi test

```markdown
### [BUG-XXX] Tiêu đề ngắn

**Mức độ**: Critical / High / Medium / Low
**Section**: Create / Calendar / Published / Failed / Connections / ...
**Bước tái hiện**:
1. ...
2. ...
3. ...

**Kết quả thực tế**: ...
**Kết quả mong đợi**: ...
**API liên quan**: `POST /api/...` — status: ...
**Screenshot**: (đính kèm)
**Hành động**: fix / defer / accept
```
