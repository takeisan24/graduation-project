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
