# Bộ Test Case Manual Khi Chạy `npm run dev`

## Mục đích

Checklist này dùng để test tay trên app thật khi chạy local bằng `npm run dev`.
Mục tiêu là kéo ra các bug về state, refresh, session, upload, integration, và đồng bộ UI
mà automated test chưa chắc đã lộ ra.

## Cách chuẩn bị

1. Chạy `npm install` nếu máy chưa có đủ dependency.
2. Chạy `npm run dev`.
3. Mở app trong browser thường.
4. Mở DevTools:
   - `Network`
   - `Console`
   - `Application > Local Storage`
5. Mở thêm một tab nữa để test refresh và reopen.

## Khi gặp bug phải chụp lại gì

- bước tái hiện
- URL hiện tại
- request URL và method
- response status và response body
- ảnh chụp UI đang sai
- bug có còn sau hard refresh hay không

## Thứ tự ưu tiên khi test

1. `Create -> Lưu draft -> Mở lại draft`
2. `Create -> Schedule -> Calendar -> Reschedule`
3. `Create -> Publish -> Published`
4. `Failed -> Retry / Edit again`
5. `Connections -> Connect / Disconnect`
6. `Operations -> Metrics có khớp dữ liệu không`
7. `Profile / session / refresh consistency`

## Danh sách test case

### TC-01 Kiểm tra session đăng nhập

Điều kiện:
- đã có account test

Bước chạy:
1. Sign in.
2. Refresh trang hiện tại.
3. Mở tab thứ hai vào `/en/create`.
4. Để idle vài phút rồi chuyển section khác.
5. Sign out.

Kết quả mong đợi:
- không redirect sai locale
- session vẫn giữ sau refresh và sau khi mở tab mới
- route protected không bị flash UI sai trước khi redirect
- sign out xóa sạch UI protected

### TC-02 Tạo nội dung từ text

Bước chạy:
1. Mở `Create`.
2. Chọn source dạng text.
3. Nhập một chủ đề liên quan đến đồ án.
4. Generate cho ít nhất `Facebook` và `YouTube`.
5. Sửa một post trong editor.

Kết quả mong đợi:
- generate chạy xong, không treo loading
- có content cho từng platform
- editor vẫn thao tác bình thường sau khi generate
- không lộ pricing / billing / credits ở UI chính

### TC-03 Tạo nội dung từ URL và YouTube URL lỗi

Bước chạy:
1. Dùng một article URL hợp lệ để generate.
2. Lặp lại với một YouTube URL sai.

Kết quả mong đợi:
- URL hợp lệ generate được
- URL sai bị chặn trước khi submit
- lỗi hiển thị rõ và dễ hiểu

### TC-04 Lưu draft và mở lại draft

Bước chạy:
1. Generate hoặc tự gõ content trong `Create`.
2. Bấm `Save draft`.
3. Mở `Drafts`.
4. Mở lại draft vừa lưu.
5. Sửa nội dung rồi lưu lại.
6. Refresh và mở lại lần nữa.

Kết quả mong đợi:
- draft chỉ xuất hiện một lần
- mở lại giữ đúng text, platform, media
- lưu lại cập nhật đúng draft cũ, không tạo bản trùng
- refresh không làm mất continuity `projectId / draftId`

### TC-05 Publish ngay

Bước chạy:
1. Mở một post đã sẵn sàng trong `Create`.
2. Mở publish modal.
3. Publish bằng một connected account.
4. Mở `Published`.

Kết quả mong đợi:
- toast success chỉ hiện sau khi publish thành công
- item xuất hiện ở `Published`
- luôn thấy platform và timestamp
- nếu có URL thì mở post thật được

### TC-06 Validate khi chưa có connected account

Bước chạy:
1. Dùng trạng thái không có connected profile.
2. Thử `Publish now`.

Kết quả mong đợi:
- publish bị chặn đúng cách
- lỗi yêu cầu chọn / kết nối account
- không có fake success toast

### TC-07 Schedule và đồng bộ Calendar

Bước chạy:
1. Schedule một post tới thời điểm tương lai.
2. Mở `Calendar`.
3. Xác nhận event có trên planner.
4. Xác nhận agenda panel bên phải hiện đúng nội dung.
5. Refresh trang.

Kết quả mong đợi:
- scheduled item có mặt ở cả planner và agenda
- ngày được chọn và panel bên phải luôn đồng bộ
- refresh không tạo ghost event hoặc duplicate

### TC-08 Reschedule và delete scheduled item

Bước chạy:
1. Trong `Calendar`, reschedule một scheduled post.
2. Kiểm tra giờ mới đã hiện.
3. Xóa scheduled post đó.
4. Refresh sau khi xóa.

Kết quả mong đợi:
- giờ cũ biến mất
- giờ mới vẫn giữ sau refresh
- xóa xong mất khỏi planner và agenda
- không còn ghost event

### TC-09 Khôi phục bài Failed

Bước chạy:
1. Chuẩn bị ít nhất một failed item.
2. Mở `Failed`.
3. Xem lý do lỗi.
4. Thử `Retry`, `Reschedule`, hoặc `Edit again`.

Kết quả mong đợi:
- lý do lỗi đọc được và không quá mơ hồ
- action recovery dễ hiểu
- nếu xử lý thành công thì failed state được cập nhật hoặc biến mất đúng cách

### TC-10 Kiểm tra Connections

Bước chạy:
1. Mở `Platform Integrations`.
2. Connect một platform hoặc chạy flow demo hiện có.
3. Refresh page.
4. Disconnect platform đó.
5. Refresh lần nữa.

Kết quả mong đợi:
- connected state hiện ngay
- refresh vẫn khớp với state thật
- disconnect xóa account sạch
- popup blocked / OAuth fail có đường recovery

### TC-11 Kiểm tra Operations

Bước chạy:
1. Đảm bảo app đang có draft, scheduled, published, failed.
2. Mở `Operations`.
3. Kiểm tra các tab overview, analytics, activity.

Kết quả mong đợi:
- số liệu khớp dữ liệu thật hoặc dữ liệu demo đã seed
- activity feed dùng ngôn ngữ workflow, không bị SaaS/billing bias
- chart render được, không lỗi date

### TC-12 Kiểm tra Profile và login methods

Bước chạy:
1. Mở `Profile`.
2. Kiểm tra display name và email.
3. Kiểm tra block login methods.
4. Refresh rồi mở lại profile.

Kết quả mong đợi:
- profile data render đúng
- login methods không spam error toast
- route profile ổn định sau refresh

## Regression nhanh trước demo

Nếu không có nhiều thời gian, chạy tối thiểu 6 case này:

1. `TC-01`
2. `TC-04`
3. `TC-05`
4. `TC-07`
5. `TC-09`
6. `TC-11`

## Mẫu log bug

### Tên bug

- 

### Bước tái hiện

1. 
2. 
3. 

### Kết quả thực tế

- 

### Kết quả mong đợi

- 

### API liên quan

- 

### Mức độ

- Critical / High / Medium / Low
