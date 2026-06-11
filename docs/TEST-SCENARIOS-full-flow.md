# Kịch bản test chi tiết — CreatorHub

> **Cách dùng:** làm theo TỪNG bước nhỏ, dùng đúng dữ liệu ví dụ cho sẵn để kết quả dễ đối chiếu.
> Mỗi test case (TC) gồm: **Tiền đề → Các bước (thao tác cụ thể) → Kỳ vọng (kết quả chính xác)**. Tick `[x]` khi đạt.
> Ký hiệu: 🔧 = điểm kiểm tra fix mới · ⚠️ = edge case · 🌐 = test song ngữ.

## 0. Chuẩn bị môi trường

- [ ] Mở terminal, chạy `npm run dev`, đợi log `Ready` → mở `http://localhost:3000`.
- [ ] Đăng nhập tài khoản test. Góc trên phải để **Tiếng Việt** (🇻🇳).
- [ ] Có ≥ 1 tài khoản MXH thật đã sẵn sàng nối qua Zernio (khuyến nghị **Facebook Page** + **Instagram**). Nhớ free tier Zernio = **tối đa 2 tài khoản**.
- [ ] Số dư credit > 0 (xem góc trên phải, ví dụ `38 credits`).

**Dữ liệu ví dụ dùng xuyên suốt:**

| Biến | Giá trị ví dụ |
|---|---|
| Tên dự án | `Chiến dịch UTC Open Day` |
| Prompt nguồn | `5 mẹo ôn thi cuối kỳ hiệu quả cho sinh viên` |
| URL nguồn | `https://www.youtube.com/watch?v=<video ngắn>` |
| Nội dung bài Facebook | `Chào các bạn 👋 Hôm nay mình chia sẻ 5 mẹo ôn thi...` |
| Số credit mua | `200` |

---

## Flow 1 — Tạo & quản lý dự án

### TC-1.1 — Tạo dự án từ màn ProjectGate

**Tiền đề:** Chưa có dự án nào đang mở (vừa đăng nhập, hoặc đã bấm "Chọn dự án khác").
**Các bước:**

1. Vào menu trái → bấm **Tạo bài viết**.
2. Quan sát màn hình.
3. Ở ô **Tên dự án**, gõ `Chiến dịch UTC Open Day`.
4. Bấm nút **Tạo dự án**.

**Kỳ vọng:**

- Bước 2: hiện màn **ProjectGate** chiếm toàn khung (icon thư mục + tiêu đề "Bắt đầu dự án nội dung"), **KHÔNG** thấy editor 3 cột.
- Bước 4: chuyển ngay sang **workspace 3 cột** (Nguồn | Editor | AI Chat); tên dự án `Chiến dịch UTC Open Day` hiện ở thanh công cụ trên.

### TC-1.2 — Để trống tên → tự đặt theo ngày

**Các bước:** Ở ProjectGate, **KHÔNG** gõ gì vào ô tên → bấm **Tạo dự án**.
**Kỳ vọng:** Tạo dự án tên kiểu `Dự án 11/06/2026` (theo ngày hôm nay), vào workspace.

### TC-1.3 🔧 — Chuyển sang dự án khác qua dropdown

**Tiền đề:** Đã có ≥ 2 dự án (chạy TC-1.1 hai lần với tên khác nhau, ví dụ thêm `Dự án Tết 2027`).
**Các bước:**

1. Trên thanh công cụ, bấm chip tên dự án (ví dụ `Dự án: Chiến dịch UTC Open Day`) để mở dropdown.
2. Ở mục **Tất cả dự án**, bấm vào tên dự án khác — ví dụ `Dự án Tết 2027`.

**Kỳ vọng:**

- Bước 2: **chuyển ngay** sang dự án vừa bấm; chip thanh công cụ đổi thành `Dự án: Dự án Tết 2027`; dropdown đóng lại.
- *(Trước fix: bấm vào không có gì xảy ra.)*

### TC-1.4 🔧 — Quay lại ProjectGate ("Chọn dự án khác")

**Các bước:** Mở dropdown dự án → bấm **Chọn dự án khác**.
**Kỳ vọng:** Quay về màn **ProjectGate** (chọn/tạo dự án) mà **KHÔNG** mất nội dung đang soạn dở.

### TC-1.5 — Xóa dự án

**Các bước:**

1. Mở dropdown dự án → ở danh sách, bấm icon 🗑 cạnh `Dự án Tết 2027`.
2. Đọc hộp xác nhận → bấm nút đỏ **Xác nhận xóa**.

**Kỳ vọng:** Hộp thoại tiêu đề "Xóa dự án" + mô tả có tên `Dự án Tết 2027`; sau khi xác nhận, dự án biến mất khỏi danh sách.
🌐 Đổi sang EN trước khi mở hộp thoại → tiêu đề "Delete project", nút "Cancel".

---

## Flow 2 — Thêm nguồn & sinh nội dung (Gemini)

### TC-2.1 — Thêm nguồn dạng prompt

**Các bước:**

1. Cột **Nguồn** (trái) → bấm **+ Thêm nguồn**.
2. Chọn loại **Văn bản / Ý tưởng** (prompt).
3. Dán: `5 mẹo ôn thi cuối kỳ hiệu quả cho sinh viên`.
4. Bấm **Lưu**.

**Kỳ vọng:** Một thẻ nguồn mới xuất hiện trong danh sách cột trái với nhãn gần với nội dung vừa nhập.

### TC-2.2 🔧 — Sinh nội dung đúng framework đã chọn

**Các bước:**

1. Bấm vào thẻ nguồn vừa tạo → mở form cấu hình (PostConfigurationForm).
2. Chọn nền tảng: tick **Facebook** + **Instagram**.
3. Ở phần **Khung nội dung (framework)**, chọn framework **thứ 2 hoặc thứ 3** trong danh sách (KHÔNG để mặc định cái đầu).
4. Bấm **Sinh nội dung**.

**Kỳ vọng:**

- Đầu ra bám đúng **framework vừa chọn** (giọng văn/cấu trúc khớp mô tả framework đó), không phải framework đầu danh sách.
- *(Trước fix SourceForm: luôn lấy framework[0] → sai.)*

### TC-2.3 🔧 — Chỉ có Gemini, không có menu chọn model

**Các bước:** Mở form cấu hình nền tảng và mở rộng cột **AI Chat** (phải).
**Kỳ vọng:** Cả 2 nơi chỉ hiển thị nhãn **"Gemini"**, **KHÔNG** có dropdown chọn ChatGPT/Claude.

### TC-2.4 ⚠️ — Đầu ra theo nền tảng

**Kỳ vọng:** Instagram → đầu ra là **caption** hoàn chỉnh (không phải kịch bản carousel rời rạc). TikTok/YouTube → nội dung **đăng được** (không phải script thô).

---

## Flow 3 — Kết nối tài khoản (OAuth Zernio)

### TC-3.1 — Nối 1 tài khoản

**Các bước:**

1. Menu trái → **Cài đặt** → mục **Tích hợp nền tảng**.
2. Bấm thẻ **Instagram** (hoặc Facebook) → cho phép OAuth trong popup/redirect.
3. Hoàn tất đăng nhập MXH.

**Kỳ vọng:** Quay lại app, thẻ tài khoản hiện đúng **username + avatar** thật; toast "Kết nối ... thành công".
🌐 Đổi EN → toast "Connected ... successfully".

### TC-3.2 ⚠️ — Vượt giới hạn 2 tài khoản

**Các bước:** Sau khi đã nối 2 tài khoản, thử nối tài khoản **thứ 3**.
**Kỳ vọng:** Báo lỗi thân thiện (free tier tối đa 2), **KHÔNG** hiện preview/tài khoản giả.

### TC-3.3 — Ngắt kết nối

**Các bước:** Bấm ngắt kết nối 1 tài khoản → xác nhận.
**Kỳ vọng:** Có hộp xác nhận; sau khi ngắt, slot Zernio được giải phóng (nối lại tài khoản mới được).

---

## Flow 4 — Đăng thật & Lên lịch

### TC-4.1 — Đăng Facebook ngay (có text)

**Các bước:**

1. Trong editor, chọn tab bài **Facebook**, gõ nội dung ví dụ: `Chào các bạn 👋 Hôm nay mình chia sẻ 5 mẹo ôn thi...`.
2. Bấm **Đăng** (góc dưới editor) → trong modal đăng, chọn tài khoản Facebook đã nối → **Đăng ngay**.
3. Đợi poll chạy xong (vài giây).

**Kỳ vọng:** Toast thành công; bài chuyển sang mục **Bài đã đăng**; mở link → thấy bài thật trên Facebook.

### TC-4.2 🔧 — Chặn đăng khi thiếu media

**Các bước:**

1. Tạo/chọn 1 bài **Instagram** chỉ có text, **KHÔNG** đính kèm ảnh.
2. Bấm **Đăng ngay**.

**Kỳ vọng:** Bị **chặn** + toast cảnh báo rõ kiểu `Instagram cần đính kèm ảnh/video mới đăng được.` Không gửi request lỗi.

### TC-4.3 — Lên lịch 1 bài

**Các bước:**

1. Soạn 1 bài Facebook có nội dung.
2. Bấm **Đăng** → chọn **Lên lịch** → chọn ngày giờ **tương lai gần** (ví dụ 10 phút sau).
3. Xác nhận.

**Kỳ vọng:** Toast "đã lên lịch"; sang mục **Lịch** thấy event đúng ngày/giờ, màu trạng thái "đã lên lịch".

### TC-4.4 🔧 — Bài lên lịch tự cập nhật "đã đăng"

**Tiền đề:** Vừa làm TC-4.3, đang ở mục **Lịch**, **để nguyên trang mở**.
**Các bước:** Đợi qua giờ đã lên lịch (Zernio đăng thật) → quan sát event đó trong ~15–30 giây.
**Kỳ vọng:** Event tự đổi trạng thái từ "đã lên lịch" → **"đã đăng"** mà không cần reload trang.
*(Fix: vòng lặp polling đã được sửa + giữ poll tới khi scheduled→posted.)*

---

## Flow 5 — Bài đã đăng & Modal chi tiết

### TC-5.1 🔧 — Mở modal bài đã đăng (layout NGANG)

**Các bước:**

1. Vào mục **Bài đã đăng** → bấm 1 thẻ bài có ảnh (ví dụ bài Instagram vừa đăng).

**Kỳ vọng (modal mới):**

- **Hàng meta NẰM NGANG** ở trên: Nền tảng · Tài khoản · Thời điểm · Liên kết.
- Khu nội dung **toàn chiều rộng**: **ảnh bên trái**, **caption bên phải** đọc theo **dòng dài (ngang)**, dễ đọc.
- Hiển thị đúng **tên tài khoản** (ví dụ `@t_ahnofficial204`) và **ảnh đã đăng**.

### TC-5.2 🔧 — Liên kết bài đăng (test với bài MỚI)

**Tiền đề quan trọng:** dùng **bài mới đăng SAU khi deploy fix** (bài cũ sẽ không có link, đó là dữ liệu cũ).
**Các bước:**

1. Đăng 1 bài Facebook mới (TC-4.1) → mở modal bài đó.
2. Xem mục **Liên kết bài đăng**.
3. Bấm nút **Mở bài đăng**.

**Kỳ vọng:** Mục Liên kết hiện URL thật; nút **Mở bài đăng** mở đúng bài trên nền tảng.
⚠️ **Lưu ý Instagram:** Zernio có thể trả URL chậm/không trả cho IG → nếu IG vẫn trống link dù là bài mới, đó là **giới hạn nền tảng** (Facebook thường có link ổn định hơn để demo).

### TC-5.3 — Gỡ bài

**Các bước:** Mở modal 1 bài **Facebook** → bấm **Gỡ bài đăng** → xác nhận.
**Kỳ vọng:** Bài bị gỡ khỏi nền tảng thật + khỏi danh sách.
⚠️ Bài **Instagram/TikTok**: **KHÔNG** có nút Gỡ bài (Zernio không hỗ trợ).
🌐 EN → nút "Unpublish post", "Cancel".

---

## Flow 6 — Lịch (Calendar)

### TC-6.1 🔧 — Không trùng event + không spam API

**Các bước:**

1. Vào mục **Lịch**, mở DevTools (F12) → tab **Network**.
2. Để yên trang ~1 phút, quan sát.

**Kỳ vọng:**

- Bài đã đăng & lên lịch cùng giờ **KHÔNG** bị nhân đôi event.
- Khi **không có bài nào đang chờ đăng**, **KHÔNG** thấy request `/api/schedule` lặp liên tục mỗi vài giây. *(Fix: phá vòng lặp + chỉ poll khi còn bài scheduled.)*

### TC-6.2 🔧 — Xóa sự kiện: 2 lựa chọn

**Tiền đề:** Có 1 event đã lên lịch trên Lịch.
**Các bước:**

1. Bấm vào event → chọn **Xóa**.
2. Đọc hộp thoại — có **2 nút**: **Chỉ gỡ khỏi lịch** và **Xóa hoàn toàn**.
3. Thử nhánh "Xóa hoàn toàn".

**Kỳ vọng:** "Chỉ gỡ khỏi lịch" = gỡ khỏi lịch, giữ trên Zernio. "Xóa hoàn toàn" = xóa cả trên Zernio. Cả 2 đều dọn event khỏi lịch.

### TC-6.3 🔧 — Xóa event "mồ côi" (không còn bài thật)

**Tiền đề:** Một event lên lịch mà bản ghi đã bị xóa ở nơi khác (event ma).
**Các bước:** Bấm xóa event đó.
**Kỳ vọng:** Event được **dọn khỏi lịch bình thường**, **KHÔNG** còn báo lỗi "không tìm thấy bài viết để xóa". *(Fix 404.)*

---

## Flow 7 — Nạp credit (trả theo dùng)

### TC-7.1 🔧 — Card nạp credit kiểu nhập số tự do

**Các bước:**

1. Cài đặt → **Nạp thêm credit**.
2. Quan sát giao diện.
3. Bấm preset **250**, rồi sửa ô số thành `200`.
4. Xem dòng giá.

**Kỳ vọng:**

- **KHÔNG** còn banner "chế độ demo" (đã bỏ).
- **KHÔNG** còn 4 gói tên starter/popular/pro; thay bằng **ô nhập số credit + nút preset 50/100/250/500**.
- Giá tổng hiện realtime theo số nhập (ví dụ `200` → `98.000₫`), đơn giá `490₫/credit`.
- Nút mua ghi `Mua 200 credit`.

### TC-7.2 🔧 — Mua credit → số dư cập nhật ngay

**Các bước:**

1. Bấm **Mua 200 credit** → hiện QR + thông tin chuyển khoản.
2. Bấm **Tôi đã thanh toán** (demo: xác nhận thủ công).

**Kỳ vọng:** Toast cộng credit thành công; **số dư ở góc trên phải tăng ngay** (ví dụ `38 → 238`) mà **không cần reload**.
⚠️ Nếu trên **site Vercel** mà báo 403: kiểm tra env `ENABLE_MANUAL_CONFIRM=true` (local `npm run dev` thì tự bật).

### TC-7.3 — Nhãn plan

**Kỳ vọng:** Khu thông tin tài khoản hiện plan là **"Trả theo dùng"** (không phải "Free"). 🌐 EN → "Pay-as-you-go".

---

## Flow 8 — AI Chat (Gemini-only)

### TC-8.1 — Chỉnh sửa bài qua chat

**Các bước:**

1. Có ≥ 1 bài đang mở → mở cột **AI Chat**.
2. Gõ: `Rút gọn bài này còn 3 câu và thêm 2 emoji` → Enter.

**Kỳ vọng:** Header chat ghi **"Gemini"**; AI phản hồi và áp thay đổi vào bài đang chọn (chip ngữ cảnh "Bài viết: ...").
🌐 EN → tooltip nút "+" = "Start a new conversation"; chip "Post:"/"All".

---

## 🌐 Cross-cutting — Test song ngữ nhanh

- [ ] Bật **EN** ở góc trên, lướt nhanh: ProjectGate, dropdown dự án (xóa), Bài đã đăng (thẻ + modal + gỡ bài), AI Chat, Cài đặt (toast OAuth), mọi hộp xác nhận → tất cả đổi sang tiếng Anh đúng.
- [ ] ⚠️ **Giới hạn đã biết (chấp nhận):** vài **toast trong store** (đăng/lưu nháp...) vẫn tiếng Việt kể cả ở EN — cố ý, demo bằng tiếng Việt sẽ không thấy.

## ✅ Smoke test kỹ thuật (chạy trước khi lên sân khấu)

```
npx tsc --noEmit      # không lỗi
npx next lint         # 0 error
npm run build         # exit 0
```

## 🩺 Checklist hạ tầng (nếu demo trên site Vercel)

- [ ] Supabase đã chạy migration `increment_credits_balance` (đã làm) → credit cộng atomic.
- [ ] Vercel env `ENABLE_MANUAL_CONFIRM=true` (đã set production) → nút "Tôi đã thanh toán" hoạt động.
- [ ] Đã push commit mới nhất → Vercel deploy **Ready**.
- [ ] Reconnect Instagram 1 lần để bài IG cũ hiện đúng tài khoản (bài mới tự đúng).
