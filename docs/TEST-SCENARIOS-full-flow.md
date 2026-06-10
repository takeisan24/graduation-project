# Kịch bản test toàn luồng — CreatorHub

> Mục đích: kiểm thử thủ công toàn bộ luồng demo trước bảo vệ. Ký hiệu: ✅ kỳ vọng đạt · 🔧 = điểm verify fix của phiên gần đây · ⚠️ = edge case.
> Quy ước: mỗi bước ghi rõ **Thao tác → Kỳ vọng**. Đánh dấu Pass/Fail khi chạy.

## 0. Chuẩn bị

- [ ] Chạy `npm run build` → exit 0 (đã xác nhận).
- [ ] Đăng nhập tài khoản test. Ngôn ngữ để **Tiếng Việt** (mặc định).
- [ ] Có sẵn 1 tài khoản MXH thật để nối qua Zernio (Facebook Page khuyến nghị). Nhớ free tier = **tối đa 2 account**.
- [ ] Có credit > 0 (xem số dư ở thanh công cụ).

---

## Flow 1 — Tạo dự án (ProjectGate)

1. **Vào trang Tạo khi chưa có dự án active** → ✅ hiện màn hình ProjectGate full-area (icon + "Bắt đầu dự án nội dung"), KHÔNG hiện workspace.
2. 🔧 **Đổi ngôn ngữ sang EN ở góc trên** → ✅ toàn bộ chữ ProjectGate đổi sang tiếng Anh ("Start a content project"...). Đổi lại VI. *(verify i18n ProjectGate)*
3. **Để trống tên, bấm "Tạo dự án"** → ✅ tạo dự án tên mặc định theo ngày, vào thẳng workspace 3 cột.
4. ⚠️ **Tạo dự án có nhập tên dài/khoảng trắng thừa** → ✅ tên được trim, không lỗi.
5. **Quay lại ProjectGate, mở 1 dự án trong "Dự án gần đây"** → ✅ vào đúng workspace dự án đó.
6. ⚠️ **Mất mạng rồi bấm Tạo** → ✅ hiện lỗi "Không thể tạo dự án..." (không trắng màn hình).

## Flow 2 — Thêm nguồn & sinh nội dung (Gemini)

1. **Workspace 3 cột**: cột trái Nguồn | giữa Editor | phải AI Chat → ✅ layout không đè, không tràn.
2. **Thêm nguồn (prompt/URL/file)** → ✅ nguồn lưu vào danh sách bên trái.
3. **Chọn nguồn → cấu hình nền tảng (PostConfigurationForm) → chọn framework cụ thể → Sinh** → ✅ nội dung sinh ra **đúng framework đã chọn**. 🔧 *(verify fix SourceForm: trước đây luôn lấy framework[0] từ localStorage → sai)*
4. 🔧 **Mở PostConfigurationForm + AI Chat** → ✅ chỉ hiển thị **"Gemini"**, KHÔNG có menu chọn ChatGPT/Claude. *(verify Gemini-only)*
5. ⚠️ **Instagram**: ✅ đầu ra là **caption** (không phải kịch bản carousel rời rạc). **TikTok/YouTube**: ✅ nội dung **đăng được** (không phải script thô).
6. ⚠️ **Dán link YouTube ngắn làm nguồn** → ✅ AI đọc/hiểu được video (native video understanding).

## Flow 3 — Kết nối tài khoản (OAuth Zernio)

1. **Vào Cài đặt → Tích hợp nền tảng → nối 1 tài khoản** → ✅ popup/redirect OAuth, nối thành công, thẻ tài khoản hiện đúng username/avatar.
2. 🔧 **Khi nối xong (full-page redirect)** → ✅ toast "Kết nối ... thành công". Đổi EN → toast tiếng Anh. *(verify i18n SettingsSection OAuth)*
3. ⚠️ **Nối tài khoản thứ 3 (vượt free tier)** → ✅ báo lỗi thân thiện (402), KHÔNG hiện preview giả.
4. **Bấm vào thẻ đã kết nối** → ✅ cho phép thêm tài khoản khác (không phải dead-end).
5. **Ngắt kết nối 1 tài khoản** → ✅ có xác nhận; sau khi ngắt, slot Zernio được giải phóng (nối lại được account mới).

## Flow 4 — Đăng thật / Lên lịch

1. **Soạn bài cho Facebook (có text) → Đăng ngay** → ✅ poll xong trả ra **URL bài đăng THẬT**, mở link thấy bài trên Facebook. KHÔNG có URL giả.
2. 🔧 **Chọn Instagram/TikTok/YouTube/Pinterest nhưng KHÔNG đính kèm media → bấm Đăng** → ✅ chặn + cảnh báo rõ "cần đính kèm ảnh/video" (MEDIA_REQUIRED_PLATFORMS), không gửi request lỗi.
3. **Lên lịch 1 bài (chọn giờ tương lai)** → ✅ tạo lịch thành công, toast xác nhận, xuất hiện trên Calendar.
4. ⚠️ **Token hết hạn / Zernio trả lỗi khi đăng** → ✅ báo lỗi thân thiện, bài chuyển trạng thái failed (không vỡ UI).

## Flow 5 — Bài đã đăng & Gỡ bài

1. **Vào mục "Bài đã đăng"** → ✅ 3 thẻ thống kê hiển thị **tiếng Việt** ("Đã xuất bản"/"Bài có liên kết"/"Nền tảng hoạt động"). 🔧 Đổi EN → đổi sang English. *(verify fix thẻ thống kê hardcode)*
2. **Mở 1 bài → PublishedDetailModal** → ✅ layout NẰM NGANG (meta trái, nội dung phải, cuộn được, vừa khung). Ngày/giờ đúng định dạng theo locale. 🔧
3. **Bấm "Mở bài đăng"** → ✅ mở đúng URL thật.
4. **Gỡ bài (Facebook/LinkedIn...)** → ✅ có ConfirmModal; xác nhận → bài bị xóa khỏi nền tảng thật + khỏi danh sách. 🔧 Đổi EN → nút "Unpublish post", nút Hủy → "Cancel". *(verify i18n unpublish + ConfirmModal default)*
5. ⚠️ **Bài Instagram/TikTok** → ✅ KHÔNG hiện nút Gỡ bài (Zernio không hỗ trợ unpublish 2 nền tảng này).

## Flow 6 — Lịch (Calendar)

1. **Xem Calendar** → ✅ bài lên lịch + bài đã đăng hiển thị đúng màu theo trạng thái.
2. 🔧 **Bài đã đăng và bài lên lịch CÙNG GIỜ** → ✅ KHÔNG bị trùng/nhân đôi event. *(verify fix dedup scheduled_post_id)*
3. **Đổi lịch 1 bài (reschedule)** → ✅ cập nhật cả trên hệ thống + Zernio, toast xác nhận.

## Flow 7 — Quản lý dự án (ProjectMenu)

1. **Mở menu dự án trên thanh công cụ** → ✅ liệt kê **tất cả** dự án, đánh dấu dự án hiện hành (chấm + nền). *(verify fix: dự án mới phải xuất hiện trong danh sách)*
2. **Đổi tên dự án (inline)** → ✅ lưu, cập nhật label.
3. **Xóa 1 dự án** → ✅ ConfirmModal "Xóa dự án" + mô tả có tên dự án; xác nhận → xóa cascade. 🔧 Đổi EN → "Delete project" + "Cancel". *(verify i18n ProjectMenu + deleteConfirmDescription)*
4. ⚠️ **Mở lại 1 dự án đã có draft** → ✅ khôi phục đúng nội dung tab bài viết đã lưu.

## Flow 8 — AI Chat (Gemini-only)

1. **Mở rộng cột AI Chat** → ✅ header chỉ ghi "Gemini", nút "+" tooltip "Tạo cuộc trò chuyện mới". 🔧 Đổi EN → "Start a new conversation". *(verify i18n AIChatbox)*
2. **Gửi yêu cầu chỉnh sửa bài** → ✅ AI phản hồi, áp vào bài đang chọn (label "Bài viết: ..." / "Tất cả"). 🔧 Đổi EN → "Post:" / "All".
3. ⚠️ **Gửi khi mất mạng** → ✅ báo lỗi offline, có nút Thử lại.
4. **Xóa cuộc trò chuyện** → ✅ ConfirmModal cảnh báo, xác nhận → xóa lịch sử.

## Flow 9 — Nạp credit

1. **Mở Nạp credit → chọn gói → tạo đơn → xác nhận thanh toán (PAID)** → ✅ toast thành công. 🔧 **Số dư credit ở thanh công cụ cập nhật NGAY** không cần reload trang. *(verify fix mutate /api/usage)*

---

## Cross-cutting — Test song ngữ nhanh

- [ ] 🔧 Bật EN, lướt nhanh: ProjectGate, ProjectMenu (xóa), Published (thẻ + modal + gỡ bài), AIChatbox, SettingsSection (toast OAuth), mọi ConfirmModal → ✅ đổi sang tiếng Anh đúng.
- [ ] ⚠️ **Giới hạn đã biết (chấp nhận):** một số **toast trong store** (đăng/lưu nháp/dịch...) vẫn **tiếng Việt** kể cả ở EN. Đây là quyết định có chủ đích — **demo bằng tiếng Việt** sẽ không thấy. (Nếu muốn loại bỏ hẳn: ẩn LanguageSwitcher trong workspace.)

## Smoke test kỹ thuật (chạy trước khi lên sân khấu)

```
npx tsc --noEmit      # sạch
npx next lint         # 0 error
npm run build         # exit 0
```
