# Known Issues — Report Freeze 2026-05-21

Ghi lại mọi lỗi/quirk phát hiện sau mốc freeze để **không sửa code core** trong giai đoạn viết báo cáo.
Mục đích: chuyển thành phần "Hạn chế & Hướng phát triển" trong báo cáo đồ án.

## Cách dùng

- Phát hiện lỗi → ghi vào đây trước, **không** sửa code ngay.
- Chỉ sửa code khi lỗi **chặn demo** hoặc **chặn bảo vệ**.
- Mỗi mục: mô tả ngắn + bước tái hiện + mức độ (blocker / minor / cosmetic) + quyết định (fix / defer / accept).

## Template

```
### [YYYY-MM-DD] Tiêu đề ngắn
- Mức độ: blocker | minor | cosmetic
- Tái hiện:
  1.
  2.
- Quan sát:
- Quyết định: fix | defer | accept-as-limitation
- Ghi chú cho báo cáo:
```

## Danh sách

### [2026-05-21] E2E flaky: redirect test trùng route ở `connections.spec.ts:13`
- Mức độ: cosmetic (test-only, không ảnh hưởng app)
- Tái hiện:
  1. `npm run test:e2e` chạy full suite.
  2. `connections.spec.ts:13` (`/en/connections` redirect to signin) thỉnh thoảng timeout 15s.
- Quan sát:
  - Cùng route đã được cover bởi `navigation.spec.ts:96` và `dashboard.spec.ts:18` — **cả hai đều pass**.
  - Khi chạy đơn lẻ, test này thường pass; chỉ fail khi chạy song song với load cao.
- Quyết định: **accept-as-flaky** (duplicate coverage, không sửa code app).
- Ghi chú cho báo cáo: trong phần "Kiểm thử" có thể đề cập rằng redirect logic đã được verify bởi 2 suite khác.

### [2026-05-21] E2E flaky: redirect test trùng route ở `content-creation.spec.ts:4`
- Mức độ: cosmetic (test-only)
- Tái hiện:
  1. `npm run test:e2e` chạy full suite.
  2. `content-creation.spec.ts:4` (`/en/create` redirect to signin) thỉnh thoảng timeout 15s.
- Quan sát:
  - Y hệt case trên — `navigation.spec.ts:96` (`/create redirect`) và `dashboard.spec.ts:18` (`/en/create redirect`) **đều pass**.
- Quyết định: **accept-as-flaky** (duplicate coverage).
- Ghi chú cho báo cáo: như trên.

### [2026-05-21] E2E fail: drafts → Edit không điều hướng về `/en/create`
- Mức độ: **cần điều tra — có thể blocker hoặc test issue**
- Tái hiện (theo `e2e/create-sections-manual-qa.spec.ts:111`):
  1. Vào `/en/drafts` với mock data có draft "Da Nang itinerary".
  2. Click button có text "Edit" đầu tiên.
  3. Expect URL chuyển sang `/en/create` trong 5s.
- Quan sát:
  - URL không đổi, vẫn ở `/en/drafts` (9 lần retry).
  - Có thể là: (a) bug thật ở handler nút Edit, (b) button có cùng text khác bị match trước, (c) navigation chậm > 5s.
- Quyết định: **chờ test thủ công** — chưa sửa code.
- Hành động đề xuất khi test tay (sau khi viết báo cáo xong tuần này):
  1. Mở `/en/drafts` thật, kiểm Edit có navigate không.
  2. Nếu navigate được → đây là test issue, accept-as-flaky.
  3. Nếu KHÔNG navigate → bug thật, fix nhỏ ở component card draft, commit riêng kèm tag `v1.1-fix-draft-edit`.
- Ghi chú cho báo cáo: nếu kết luận là bug, đưa vào "Hạn chế" và demo thay bằng luồng tạo draft mới (vẫn cover được phần draft editor).

### [2026-05-27] Google OAuth login redirect về `/vi/vi/signin`
- Mức độ: minor / demo-risk
- Tái hiện:
  1. Từ trang đăng nhập, chọn "Đăng nhập bằng Google".
  2. Sau OAuth callback, URL có thể bị nhân đôi locale thành `/vi/vi/signin`.
- Quan sát:
  - Luồng email/password vẫn đăng nhập được và là luồng demo chính.
  - Lỗi phụ thuộc cấu hình redirect URL của Supabase/OAuth và cách ghép locale ở client.
- Quyết định: defer cho sau mốc nộp báo cáo; demo bằng email/password.
- Ghi chú cho báo cáo: đưa vào phần hạn chế tích hợp OAuth bên thứ ba và yêu cầu cấu hình redirect URL chính xác khi triển khai.

### [2026-05-27] Logout có thể chờ lâu do Supabase Auth latency
- Mức độ: minor / demo-risk
- Tái hiện:
  1. Đăng nhập bằng tài khoản test.
  2. Click "Đăng xuất".
  3. Spinner "Redirecting..." có thể hiển thị lâu.
- Quan sát:
  - Local session/localStorage được xóa trước, nhưng Promise `supabaseClient.auth.signOut()` có thể chờ Supabase Auth API.
- Quyết định: defer; không dùng logout làm bước chính trong demo.
- Ghi chú cho báo cáo: mô tả là rủi ro phụ thuộc dịch vụ ngoài và đã có xử lý xóa session cục bộ.

### [2026-05-28] Manual QA stale: Operations test kỳ vọng `Current priorities`
- Mức độ: cosmetic (test-only)
- Tái hiện:
  1. Chạy `npx playwright test e2e/create-sections-manual-qa.spec.ts --workers=1`.
  2. Test Operations Hub fail ở text `Current priorities`.
- Quan sát:
  - Component Operations hiện hiển thị "Operational snapshot", "Pipeline health", "Recent activity feed" thay vì card "Current priorities".
  - Các luồng create authenticated khác vẫn pass.
- Quyết định: accept-as-test-stale; cập nhật test sau khi khóa nội dung báo cáo.
- Ghi chú cho báo cáo: không ảnh hưởng chức năng demo Operations Hub.

### [2026-05-28] Security audit phụ thuộc framework/dependency
- Mức độ: minor cho báo cáo nội bộ, high nếu public production
- Tái hiện:
  1. Chạy `npm audit --audit-level=high`.
  2. Audit báo nhiều advisory ở Next.js 14.2.x và dependency gián tiếp.
- Quan sát:
  - `npm run build` và lint vẫn pass.
  - Nâng Next.js major ngay trước ngày nộp có rủi ro regression lớn.
- Quyết định: defer; ghi vào "Hạn chế và hướng phát triển" là nâng cấp framework/dependency và kiểm thử regression trước production.
- Ghi chú cho báo cáo: hệ thống phục vụ đồ án/demo, chưa tuyên bố production hardening hoàn chỉnh.

### [2026-06-06] UI chưa hiển thị rõ số credits và gói hiện tại
- Mức độ: minor / demo-risk
- Tái hiện:
  1. Đăng nhập và dùng các tính năng AI có trừ credits.
  2. Quan sát workspace: người dùng chưa có điểm nhìn rõ ràng về `credits_balance` và `plan` hiện tại trước khi tạo nội dung.
- Quan sát:
  - Backend đã có `/api/usage`, `/api/me`, `useDashboardUsage`, và `CreditTopUp`.
  - Đã bổ sung badge credits/plan tối thiểu trên workspace TopBar, đọc dữ liệu từ `useDashboardUsage` và dẫn người dùng về Settings để xem/nạp thêm.
- Quyết định: fixed-minimal trước phản biện; phần mở rộng sau là dashboard chi tiết hơn cho lịch sử tiêu dùng credits.
- Ghi chú cho báo cáo: trình bày đây là cải thiện minh bạch tài nguyên ở lớp UI/UX, không thay đổi logic giao dịch credits.
