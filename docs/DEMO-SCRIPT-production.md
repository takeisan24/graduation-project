# Kịch bản DEMO production — CreatorHub (chạy 1 mạch từ đầu đến cuối)

> **Mục đích:** demo LIVE trước hội đồng + tự test pass/fail. Đi TUẦN TỰ theo Màn (Act). Mỗi bước: **Thao tác (kèm ví dụ) → Kỳ vọng (tiêu chí PASS)**. Cột cuối tự ghi `PASS/FAIL/ghi chú`.
> **URL production:** mở Vercel dashboard → project `graduation-project` → domain Production (`https://graduation-project-...vercel.app`).
> **Ngôn ngữ:** để **Tiếng Việt** khi demo.

## ⚙️ Chuẩn bị trước (làm TRƯỚC khi lên demo)
- [ ] Mở site production, **đăng nhập** tài khoản demo. Để ngôn ngữ **🇻🇳 Tiếng Việt**.
- [ ] Có **≥ 1 tài khoản MXH thật** đã nối qua Zernio (khuyến nghị **Facebook Page** — trả link ổn định nhất để demo). Free tier Zernio = tối đa 2 account.
- [ ] **Reconnect Instagram 1 lần** nếu định demo IG (để bài IG hiện đúng tài khoản).
- [ ] Số dư **credit > 0** (góc trên phải).
- [ ] Chuẩn bị sẵn **1 ảnh** trong máy (để demo đăng Instagram có ảnh).

**Dữ liệu ví dụ dùng xuyên suốt:**
| Biến | Giá trị ví dụ |
|---|---|
| Tên dự án | `Demo UTC Open Day 2026` |
| Prompt nguồn | `Giới thiệu ngày hội Open Day của trường Đại học Giao thông Vận tải cho học sinh cấp 3` |
| Yêu cầu chat | `Rút gọn bài này còn 3 câu và thêm 2 emoji` |
| Nội dung Facebook | `🎓 UTC Open Day 2026 — ngày hội mở cửa cho các bạn 2k8! Đến để khám phá ngành học, gặp gỡ sinh viên và trải nghiệm môi trường GTVT.` |
| Số credit mua | `200` |

---

## 🎬 MÀN 1 — Đăng nhập & Tổng quan
| # | Thao tác (ví dụ) | Kỳ vọng (PASS nếu) | KQ |
|---|---|---|---|
| 1.1 | Mở URL production → trang Landing | Trang chủ hiển thị đầy đủ, không vỡ layout, ảnh/nút tải xong | |
| 1.2 | Bấm **Đăng nhập** → nhập email + mật khẩu demo → Đăng nhập | Vào được app, điều hướng tới workspace; góc trên hiện avatar + số credit | |
| 1.3 | Quan sát thanh công cụ trên | Hiện chip `🪙 <số> credits` (KHÔNG kèm nhãn gói); chip tên dự án; nút đổi ngôn ngữ | |

## 🎬 MÀN 2 — Tạo dự án (ProjectGate)
| # | Thao tác (ví dụ) | Kỳ vọng | KQ |
|---|---|---|---|
| 2.1 | Menu trái → **Tạo bài viết**. Nếu đang mở dự án cũ → mở dropdown tên dự án → **Chọn dự án khác** | Hiện màn **ProjectGate** (icon thư mục + "Bắt đầu dự án nội dung"), có ô tên + danh sách dự án | |
| 2.2 | Ô **Tên dự án**: gõ `Demo UTC Open Day 2026` → bấm **Tạo dự án** | Vào ngay **workspace 3 cột** (Nguồn \| Editor \| AI Chat); chip trên hiện tên dự án | |

## 🎬 MÀN 3 — Thêm nguồn (chiến lược) & Sinh nội dung bằng AI (Gemini)
> Luồng ĐÚNG: "Thêm nguồn" = **Bước 1 (Chiến lược): Mục tiêu → Ngách → Framework** → **Bước 2 (Nội dung): nhập Ý tưởng → Lưu**. Sau đó mới bấm thẻ nguồn → **chọn nền tảng → Sinh nội dung** (FR04: mục tiêu + ngách + framework).

| # | Thao tác (ví dụ) | Kỳ vọng | KQ |
|---|---|---|---|
| 3.1 | Cột Nguồn → **+ Thêm nguồn**. Bước 1: chọn **Mục tiêu** (1) | Chọn được Mục tiêu | |
| 3.2 | Chọn **Ngách** (2) | Sau khi đủ **Mục tiêu + Ngách** → **danh sách Framework (Mẫu) hiện ra** (3) | |
| 3.3 | Chọn **1 Framework** cụ thể → bấm **Tiếp theo** | Nút "Tiếp theo" chỉ bật khi đã chọn framework; chuyển sang Bước 2 | |
| 3.4 | Bước 2: nhập **💭 Ý tưởng** = `Giới thiệu ngày hội Open Day của trường ĐH GTVT cho học sinh cấp 3` → (tùy chọn đính kèm **nguồn tham khảo** URL/file) → **Lưu** | Thẻ nguồn mới hiện ở cột trái | |
| 3.5 | Bấm thẻ nguồn → form cấu hình: tick **Facebook** + **Instagram** (+ số lượng) → **Sinh nội dung** | Loading; ra **2 tab bài** (FB, IG) bám đúng **framework đã chọn**; chỉ **"Gemini"** (không menu model khác) | |
| 3.6 🔧 | Lặp lại sinh **2-3 lần** với nguồn khác nhau | **KHÔNG** lần nào báo "AI_RESPONSE_NO_JSON"/không ra bài (regex đã linh hoạt hơn) | |
| 3.7 | Xem tab Instagram | Đầu ra là **caption hoàn chỉnh** (không phải JSON/script thô) | |

## 🎬 MÀN 4 — Tinh chỉnh bằng AI Chat
| # | Thao tác (ví dụ) | Kỳ vọng | KQ |
|---|---|---|---|
| 4.1 | Mở cột **AI Chat** → chọn tab bài Facebook → gõ `Rút gọn bài này còn 3 câu và thêm 2 emoji` → Enter | AI phản hồi (hiện tóm tắt, không JSON thô); **nội dung tab Facebook được cập nhật** theo yêu cầu | |
| 4.2 | Bấm nút **+** (cuộc trò chuyện mới) | Chat reset; tooltip nút ghi "Tạo cuộc trò chuyện mới" | |

## 🎬 MÀN 5 — Kết nối tài khoản (nếu chưa nối)
| # | Thao tác (ví dụ) | Kỳ vọng | KQ |
|---|---|---|---|
| 5.1 | Menu → **Cài đặt** → **Tích hợp nền tảng** → bấm thẻ **Facebook** → hoàn tất OAuth | Quay lại app, thẻ tài khoản hiện đúng **tên + avatar** thật; toast "Kết nối ... thành công" | |
| 5.2 | (Tùy chọn) Thử nối **tài khoản thứ 3** | Báo lỗi thân thiện (free tier 2 account), KHÔNG hiện tài khoản giả | |

## 🎬 MÀN 6 — Đăng bài THẬT
| # | Thao tác (ví dụ) | Kỳ vọng | KQ |
|---|---|---|---|
| 6.1 | Về editor, tab **Facebook**, đảm bảo có nội dung (ví dụ nội dung FB ở bảng trên) → bấm **Đăng** → chọn tài khoản FB → **Đăng ngay** | Hiện loading/poll; toast thành công; bài chuyển sang mục **Bài đã đăng** | |
| 6.2 | ⚠️ Thử đăng tab **Instagram KHÔNG đính kèm ảnh** → **Đăng ngay** | Bị **chặn** + cảnh báo "Instagram cần đính kèm ảnh/video..." | |
| 6.3 | Tab Instagram → đính kèm **1 ảnh** → **Đăng ngay** | Đăng được; vào Bài đã đăng thấy bài IG (kèm ảnh) | |

## 🎬 MÀN 7 — Bài đã đăng & Modal chi tiết
| # | Thao tác (ví dụ) | Kỳ vọng | KQ |
|---|---|---|---|
| 7.1 | Mục **Bài đã đăng** → bấm bài Facebook vừa đăng | Modal mở: **meta nằm ngang** (Nền tảng·Tài khoản·Thời điểm·Liên kết); nội dung trải ngang; có **link thật** | |
| 7.2 | Bấm **Mở bài đăng** | Mở đúng bài trên Facebook (tab mới) | |
| 7.3 | Mở modal bài có ảnh | Hiển thị **ảnh đã đăng** + caption cạnh nhau | |
| 7.4 | Bài Facebook → bấm **Gỡ bài đăng** → xác nhận | Bài bị gỡ khỏi nền tảng thật + khỏi danh sách. (Bài IG/TikTok KHÔNG có nút gỡ — đúng) | |

## 🎬 MÀN 8 — Lên lịch & Lịch
| # | Thao tác (ví dụ) | Kỳ vọng | KQ |
|---|---|---|---|
| 8.1 | Soạn 1 bài Facebook → **Đăng** → **Lên lịch** → chọn giờ **~3-5 phút sau** → xác nhận | Toast "đã lên lịch"; sang mục **Lịch** thấy event đúng giờ | |
| 8.2 | Ở mục **Lịch**, để nguyên trang, đợi qua giờ đã lên lịch | Event tự đổi **"đã lên lịch" → "đã đăng"** trong ~15-30s (không cần reload) | |
| 8.3 | Bấm 1 event → **Xóa** | Dialog có **2 lựa chọn**: "Chỉ gỡ khỏi lịch" / "Xóa hoàn toàn" | |

## 🎬 MÀN 9 — Mô hình "1 dự án = 1 workspace" (điểm nhấn mới)
| # | Thao tác (ví dụ) | Kỳ vọng | KQ |
|---|---|---|---|
| 9.1 | Mở dropdown tên dự án → **Dự án mới** (hoặc tạo dự án B) → thêm nguồn/sinh bài khác | Workspace B **trống/khác A** (nguồn + tab + chat riêng) | |
| 9.2 | Mở dropdown → mục **Tất cả dự án** → bấm lại **Demo UTC Open Day 2026** (dự án A) | **Nạp lại** đúng tab bài + nguồn + **lịch sử chat** của A | |
| 9.3 | Gõ dở 1 bài (KHÔNG Ctrl+S) → chuyển sang dự án B → quay lại A | Phần gõ dở **đã được auto-save** (không mất) | |
| 9.4 | **Reload trang (F5)** khi đang ở 1 dự án | Editor + chat **tự nạp lại** dữ liệu dự án đó | |

## 🎬 MÀN 10 — Nạp credit
| # | Thao tác (ví dụ) | Kỳ vọng | KQ |
|---|---|---|---|
| 10.1 | Cài đặt → **Nạp thêm credit** | Thấy ô **nhập số tự do** + preset 50/100/250/500 (KHÔNG còn gói tên starter/pro; KHÔNG banner demo) | |
| 10.2 | Bấm preset **250** → sửa ô thành `200` | Giá hiện realtime (ví dụ `98.000₫`, `490₫/credit`); nút "Mua 200 credit" | |
| 10.3 | **Mua 200 credit** → hiện QR + chuyển khoản → **Tôi đã thanh toán** | Toast cộng credit; **số dư góc trên tăng ngay** (không reload) | |

## 🎬 MÀN 11 — Cài đặt & Song ngữ
| # | Thao tác (ví dụ) | Kỳ vọng | KQ |
|---|---|---|---|
| 11.1 | Mục **Cài đặt hệ thống** | Card **"Trạng thái hệ thống"** nằm **trên cùng** (theme/ngôn ngữ/chế độ) | |
| 11.2 | Đổi **giao diện** sáng/tối | Toàn app đổi theme ngay | |
| 11.3 | Góc trên đổi **EN** → lướt vài màn (Bài đã đăng, dialog xóa, ProjectGate) | Giao diện đổi sang tiếng Anh đúng. Đổi lại **VI** | |
| 11.4 | (Tùy chọn) Reset hướng dẫn (onboarding) | Tour hướng dẫn chạy lại | |

---

## 🗣️ Câu nói gợi ý khi phản biện (điểm mạnh để nêu)
- "Hệ thống đăng bài **THẬT** lên mạng xã hội qua Zernio API, trả về **link bài đăng thật** — không mô phỏng."
- "Sinh nội dung đa nền tảng từ **một nguồn** bằng **Google Gemini**, tối ưu theo từng nền tảng (caption cho IG, kịch bản cho TikTok/YouTube)."
- "Mô hình **1 dự án = 1 workspace**: nháp + lịch sử chat thuộc về dự án, lưu trên Supabase (`content_drafts`, `chat_sessions` khóa ngoại tới `projects`), mở lại tự nạp."
- "Thanh toán/credit ở chế độ **demo có chủ đích** (mô phỏng), nêu rõ trong báo cáo AUDIT-002; cộng credit **atomic** qua RPC chống race condition."
- "Song ngữ Việt/Anh (next-intl), bảo mật xác thực Supabase, RLS, hàm RPC `SECURITY DEFINER` đã siết quyền."

## ⚠️ Phòng hờ khi demo (nếu có sự cố)
- Mạng/Zernio lỗi khi đăng → bài chuyển **failed**, có nút **Đăng lại** → vẫn demo được phần recovery.
- IG không trả link ngay → đó là **giới hạn nền tảng**; ưu tiên demo **Facebook** cho phần "mở link thật".
- Credit không cộng trên production → kiểm tra env `ENABLE_MANUAL_CONFIRM=true` (đã set).
