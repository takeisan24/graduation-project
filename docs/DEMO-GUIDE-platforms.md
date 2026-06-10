# Hướng dẫn DEMO — Kết nối & đăng bài từng nền tảng

> Tài liệu chuẩn bị cho buổi bảo vệ. Mô tả: cần gì để **kết nối** mỗi nền tảng, và cần **nội dung/media gì** để **đăng được bài thật** qua Zernio.
> Cập nhật: 2026-06-09. Nguồn điều kiện: tài liệu Zernio (docs.zernio.com/platforms/*) + kiểm thử API thật.

---

## 0. Điều kiện nền tảng chung (phải có trước khi demo)

| Hạng mục | Yêu cầu |
|---|---|
| Biến môi trường | `ZERNIO_API_KEY` (sk_…), `ZERNIO_PROFILE_ID`, `NEXT_PUBLIC_APP_URL`, `GEMINI_API_KEY`, Supabase keys |
| Tài khoản test | Đã đăng nhập bằng email/password (OAuth Google đang ẩn theo cờ — dùng email/password) |
| Còn credit | Sinh nội dung AI tốn credit; đảm bảo `credits_balance > 0` |
| Kết nối Zernio | Mỗi nền tảng phải kết nối qua nút **Kết nối** (OAuth Zernio) → tài khoản có `getlate_account_id` thật (KHÔNG phải `preview-…`) |

**Luồng đăng bài thật (đã triển khai):** Tạo bài → Đăng → Zernio `POST /posts` → hệ thống **poll `GET /posts/{id}`** đến khi `published`/`failed` → lưu **URL thật** (`platformPostUrl`). Lỗi → bài vào mục **Thất bại** kèm lý do (KHÔNG báo thành công giả, KHÔNG link giả).

---

## 1. Bảng điều kiện đăng bài theo nền tảng

| Nền tảng | Tài khoản cần | Đăng chỉ text? | Media bắt buộc? | Giới hạn nội dung | Mức độ demo |
|---|---|---|---|---|---|
| **LinkedIn** | Personal **hoặc** Company page | ✅ | ❌ | ≤ 3.000 ký tự; link nên để ở comment | 🟢 Dễ nhất |
| **X (Twitter)** | Account + scope `tweet.write` | ✅ | ❌ | 280 ký tự (free); **tốn phí/tweet**; cách 4 phút/bài; chặn trùng | 🟡 Được (tốn phí) |
| **Threads** | **IG Business/Creator** + bật Threads | ✅ | ❌ | **≤ 500 ký tự**; 250 bài/24h | 🟡 Được |
| **Facebook** | **Page** (KHÔNG dùng profile cá nhân) + Admin/Editor | ✅ | ❌ | ≤ 63k ký tự; **không trộn ảnh + video**; ảnh ≤ 4MB | 🟡 Cần có Page |
| **Instagram** | **Business/Creator** (+ thường liên kết FB) | ❌ | ✅ ảnh/video | Feed 1 ảnh/video; ≤100 bài/24h; caption ≤2.200, không link bấm | 🟠 Cần đính ảnh |
| **Pinterest** | Có **Board** | ❌ | ✅ ảnh/video | 1 media/pin; cần `boardId` + link đích | 🟠 Cần ảnh + board |
| **TikTok** | Cá nhân/business | ❌ | ✅ video/ảnh | Cần 2 cờ consent; giới hạn ngày; kiểm duyệt gắt | 🔴 Khó |
| **YouTube** | Channel (verify SĐT cho video > 15') | ❌ | ✅ **video** | Channel khóa → 403; quota ngày; xử lý lâu | 🔴 Khó |

**Phân nhóm để hiểu nhanh:**

- Đăng **chỉ text** (không cần ảnh): **LinkedIn, X, Threads, Facebook**.
- **Bắt buộc kèm media**: **Instagram, TikTok, YouTube, Pinterest**.
- **Yêu cầu tài khoản doanh nghiệp/Page**: Instagram, Threads (qua IG Business), Facebook (Page).

---

## 2. Cần NỘI DUNG gì để đăng — theo loại nền tảng

Hệ thống sinh nội dung qua Gemini đã được chỉnh để **khớp điều kiện đăng**:

| Loại | Output AI sinh ra | Cần thêm gì để đăng |
|---|---|---|
| LinkedIn / Facebook | Bài viết/caption hoàn chỉnh + 3-5 hashtag | Không cần thêm — đăng ngay |
| X | Caption < 280 ký tự + 2-3 hashtag | Không cần thêm |
| Threads | Caption < 500 ký tự + 1-3 hashtag | Không cần thêm |
| **Instagram** | **Caption hoàn chỉnh** (đã bỏ "kịch bản carousel") + hashtag | **Phải đính 1 ảnh/video** (tải lên hoặc dùng AI sinh ảnh) |
| **Pinterest** | Mô tả giàu từ khóa | **Phải có ảnh + board + link đích** |
| **TikTok** | **Caption đăng được** (ngắn, bắt trend) + 2-4 hashtag | **Phải có video** đính kèm mới đăng |
| **YouTube** | **Mô tả (description) đăng được** + 3-5 từ khóa | **Phải có video** đính kèm mới đăng |

> Lưu ý quan trọng: với **Instagram/TikTok/YouTube/Pinterest**, text mà AI tạo ra là **caption/kịch bản đi kèm media** — bắt buộc phải có ảnh/video đính kèm thì Zernio mới đăng được. Nếu đăng các nền tảng này mà thiếu media → Zernio trả lỗi và bài rơi vào mục **Thất bại** (đúng thiết kế, không giả lập thành công).

---

## 3. Cách KẾT NỐI từng nền tảng (trong app)

1. Vào **Cài đặt → Kết nối** (hoặc panel Kết nối).
2. Bấm nút nền tảng → mở **popup OAuth Zernio** → đăng nhập + uỷ quyền tài khoản.
3. Quay lại app → tài khoản hiện trong bảng "Tài khoản đã kết nối" với username thật.

**Lưu ý đặc thù:**

- **Instagram / Threads**: dùng tài khoản **Business/Creator**; cấp đủ quyền `content_publish` khi OAuth. (Tài khoản demo `t_ahnofficial204` đã là Creator, có quyền đăng.)
- **Facebook**: phải chọn **Page** (không phải profile cá nhân); bạn cần là Admin/Editor của Page.
- **Pinterest**: cần có ít nhất 1 **Board** trên tài khoản.
- **YouTube**: kênh phải còn hoạt động (không bị khóa); verify SĐT nếu muốn video > 15 phút.

---

## 4. Kịch bản DEMO khuyến nghị (an toàn nhất → thứ 6)

### Phương án A — đăng thật, ít rủi ro: **LinkedIn**

1. Kết nối LinkedIn (personal được).
2. Thêm nguồn → chọn nền tảng **LinkedIn**, count = 1 → Tạo bài.
3. Sửa lại nếu muốn → **Đăng ngay**.
4. Chờ "Đang đăng…" → "Đã đăng" → bấm **Mở bài viết** → mở đúng bài thật trên LinkedIn.
5. Mở **Zernio dashboard** đối chiếu có post.

### Phương án B — đăng thật có media: **Instagram** (tài khoản đã có)

1. Tạo bài Instagram (giờ ra **caption** chuẩn, không còn kịch bản slide).
2. **Đính 1 ảnh** (tải lên hoặc dùng AI sinh ảnh).
3. Đăng → mở link thật.

> Tránh demo TikTok/YouTube (cần video thật + duyệt + xử lý lâu).

---

## 5. Xử lý sự cố thường gặp khi demo

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Bài Instagram vào "Thất bại" | Đăng IG mà thiếu ảnh/video | Đính media rồi đăng lại |
| "Đăng qua Zernio thất bại: …" | Account chưa đủ quyền / token hết hạn / nội dung vi phạm | Kết nối lại tài khoản; đổi nội dung |
| Nút "Mở bài viết" bị mờ | Chưa có URL thật (bài đang đăng hoặc thất bại) | Chờ poll xong / kiểm tra mục Thất bại |
| Threads báo lỗi | Caption > 500 ký tự | Rút ngắn nội dung |
| Facebook lỗi media | Trộn ảnh + video trong 1 bài | Chỉ để ảnh HOẶC video |
| X tốn phí / chặn | X tính phí mỗi tweet + chặn trùng | Dùng nội dung mới, không lặp |

---

## 6. Khớp với báo cáo (không cần sửa báo cáo)

- Báo cáo ghi "đăng bài thật qua Zernio + server chốt trạng thái" → khớp luồng poll hiện tại.
- Báo cáo ghi thanh toán credit là "mô phỏng/làm tay" → **giữ nguyên**, không làm webhook thật.
- Báo cáo mô tả "sinh nội dung đa nền tảng" chung chung (không nêu carousel) → việc đổi Instagram sang caption **không lệch báo cáo**.
