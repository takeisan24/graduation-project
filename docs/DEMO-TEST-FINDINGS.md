# Findings khi test demo (Phần D) — sửa SAU khi test xong

> Ghi lại lỗi/observation phát hiện trong lúc chạy `DEMO-SCRIPT-production.md`. **Chưa sửa** — gom lại fix một lượt sau khi test hết.
> Mức: 🔴 cao (lộ/vỡ khi demo) · 🟡 trung · 🔵 thấp/polish.

> **TRẠNG THÁI (2026-06-11): ĐÃ FIX TOÀN BỘ F1–F9 + build pass.** Chi tiết ở cột "Đã sửa".

| ID | Mức | Phát hiện ở | Mô tả | Root cause | Đã sửa |
|---|---|---|---|---|---|
| **F1** | 🟡 | 1.3 | Dropdown tài khoản có **Hồ sơ / Tích hợp nền tảng / Cài đặt hệ thống** trùng với sidebar trái → trùng nút điều hướng | `TopBar.tsx:151-157` (DropdownMenuItem /profile, /connections...) cùng các mục sidebar | ✅ Bỏ 3 mục điều hướng khỏi dropdown (chỉ còn thông tin user + Đăng xuất); gỡ import thừa `Link2/Settings/UserCircle2` |
| **F2** | 🟡 | Onboarding | Tour bước 1 hiện **box ở giữa-dưới**, rời rạc, không trỏ đúng nút "Thêm nguồn" | `OnboardingTour.tsx:45`: mảng targets để `empty-state-add-source-button` (nút GIỮA màn) **đứng đầu** | ✅ Đảo thứ tự ưu tiên: `[data-tour="add-source"]` (panel góc trái) lên đầu |
| **F3** | 🟡 | 2.3 | Tạo nhiều dự án tên trống cùng ngày → **trùng tên** "Dự án 11/6/2026" | `ProjectGate.handleCreate`: tên mặc định chỉ theo **ngày** | ✅ Thêm **giờ:phút** vào tên tự động → duy nhất. (A4 vẫn cho user tự đặt trùng) |
| **F4** | 🔴 | Sau 2.5 (AI Chat) | Mở AI Chat ở **dự án mới** lại thấy **nội dung chat cũ** của dự án khác | `getChatMessagesByContext` **bỏ qua `projectId`** → `GET /api/chat?projectId` trả **TẤT CẢ** chat của user | ✅ Sửa service: `projectId` → query `chat_sessions` lấy `session_id(s)` của dự án → `.in('session_id', ...)`. Dự án chưa có phiên → trả rỗng (không leak) |
| **F5** | 🟡 | 1.1 | Cần **review kĩ nội dung Landing page** | — | ✅ Review (Explore agent): **DEFENSE-READY**, không metric giả/claim sai/lộ Zernio. Chỉ 2 mục cố ý không dịch (tên nền tảng, tên tech stack) → giữ nguyên |
| **F6** | 🟡 | 5.2 | Lỗi kết nối **lộ "Zernio" / "gói miễn phí"** | `connections/start/[provider]/route.ts:63-65,89` | ✅ Viết lại hướng user, bỏ tên Zernio: *"Bạn đã đạt giới hạn số tài khoản mạng xã hội có thể kết nối (tối đa 2)..."* / *"Không thể bắt đầu kết nối {provider} lúc này..."* / *"Kết nối {provider} thất bại..."* |
| **F7** | 🔴 | 6.3 / Màn 7 | Modal bài đã đăng **ngay sau khi đăng** thiếu **tên tài khoản + ảnh** (IG cả link) | `publish.ts:240-248`: bài **optimistic** thiếu `profileName`/`profilePic`/`media` (DB lưu ĐÚNG) | ✅ Điền đủ profileName/profilePic/media vào bản optimistic từ `account.profile_metadata` + `mediaUrls`; **và** gọi `loadPublishedPosts()` (set `needsRefresh`) để thay bằng dữ liệu API đầy đủ |
| **F8** | 🔴 | 10.4 | Nạp credit xong **số dư không cộng ngay** (kể cả reload theo cảm nhận) | **Backend ĐÚNG** (DB xác minh: `credits_balance` 252→502 đúng lúc confirm). Là vấn đề **refresh phía client** | ✅ `CreditTopUp`: cập nhật **optimistic** số dư vào cache SWR `/api/usage` ngay khi confirm thành công, rồi `revalidate` từ server → TopBar đổi tức thì |
| **F9** | 🔴 | Lịch (ảnh user) | Bài **lên lịch không đổi trạng thái** — quá giờ vẫn "Lên lịch" mãi (DB xác minh 2 bài FB kẹt `scheduled`, `post_url=null`) | **Không có cron server**. Transition `scheduled→posted` chỉ chạy khi client poll (`check-pending`/`check-status` → `resolveInternalLatePost`), phụ thuộc trình duyệt mở + `pendingScheduledPosts` localStorage | ✅ **Self-heal phía server**: `GET /api/schedule` nay tự `resolveInternalLatePost` cho mọi bài **quá giờ mà còn 'scheduled'** (bài Zernio thật → poll URL thật; bài mô phỏng → 'posted'). Mở lịch là tự sửa, không phụ thuộc localStorage |

## Ghi chú
- Tất cả F1–F9 đã fix; `npx tsc --noEmit` sạch, `npm run build` pass.
- F8/F9 phát hiện thêm ở Màn 10 + ảnh lịch; đều là 🔴 và đã xử lý.
- Lint còn 6 lỗi **CÓ SẴN từ trước** trong `publish.ts` (import/biến thừa, `prefer-const`) — không do đợt sửa này, build vẫn pass.
