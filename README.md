# CreatorHub

> Website hỗ trợ lập kế hoạch và sáng tạo nội dung đa nền tảng sử dụng công cụ Generative AI.

**Đồ án tốt nghiệp** — Vũ Tuấn Anh — CNTT4 — K63
Trường Đại học Giao thông Vận tải — GVHD: ThS. Đào Vũ Hoàng Nam

---

## Giới thiệu

CreatorHub là ứng dụng Web giúp các nhà sáng tạo nội dung trong việc lên ý tưởng và lập kế hoạch đăng bài. Hệ thống tích hợp Trí tuệ nhân tạo tạo sinh (Generative AI) để giải quyết vấn đề "bí ý tưởng" và quản lý nội dung rời rạc trên nhiều nền tảng mạng xã hội.

### Vấn đề cần giải quyết

- Người sáng tạo nội dung thường gặp khó khăn trong việc duy trì ý tưởng mới
- Nội dung cần tối ưu hóa cho từng nền tảng (Instagram, TikTok, LinkedIn, Facebook...)
- Quản lý lịch đăng bài trên nhiều nền tảng cùng lúc phức tạp và tốn thời gian
- Thiếu công cụ tích hợp AI hỗ trợ toàn bộ quy trình từ ý tưởng đến đăng bài

### Giải pháp

CreatorHub cung cấp một nền tảng duy nhất để:
1. **Tạo nội dung tự động** bằng AI (văn bản, hình ảnh, video)
2. **Lập kế hoạch** đăng bài với giao diện lịch trực quan
3. **Tinh chỉnh** nội dung qua chatbot AI trợ lý
4. **Quản lý** toàn bộ quy trình từ ý tưởng đến xuất bản

---

## Tính năng chính

| Tính năng | Mô tả |
|-----------|-------|
| Sáng tạo nội dung AI | Tích hợp Google Gemini và OpenAI để sinh nội dung văn bản, kịch bản video, gợi ý hình ảnh |
| Lập kế hoạch trực quan | Giao diện Lịch với thao tác kéo thả (Drag & Drop), theo dõi trạng thái bài đăng |
| Chatbot AI trợ lý | Tinh chỉnh nội dung - viết lại, tóm tắt, thay đổi giọng văn, dịch ngôn ngữ |
| Đa nền tảng | Tạo nội dung tối ưu cho Instagram, TikTok, LinkedIn, Facebook, X, YouTube, Pinterest |
| Content Strategy | Chọn niche, mục tiêu, framework để AI tạo nội dung phù hợp chiến lược |
| Thư viện Media | Upload, quản lý và tái sử dụng hình ảnh/video cho nhiều bài đăng |
| Hệ thống Credits | Quản lý hạn mức sử dụng AI, theo dõi lịch sử tiêu thụ |
| Đa ngôn ngữ | Hỗ trợ đầy đủ Tiếng Việt và Tiếng Anh (next-intl) |

---

## Kiến trúc hệ thống

```
                    +------------------+
                    |  Client (Browser) |
                    +--------+---------+
                             |
                    +--------v---------+
                    |   Next.js App     |
                    |   (App Router)    |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
    +---------v----------+       +----------v---------+
    |    API Routes       |       | Server Components  |
    |   (44 endpoints)    |       |   (SSR Pages)      |
    +---------+----------+       +---------------------+
              |
    +---------v----------+
    |   Service Layer     |
    |  (Business Logic)   |
    +----+----------+----+
         |          |
+--------v---+  +---v-----------+
| Supabase   |  | AI Providers  |
| - Auth     |  | - Gemini      |
| - PostgreSQL| | - OpenAI      |
| - Storage  |  +---------------+
+------------+
```

### Luồng xử lý chính

```
User Input → API Route (Auth + Credits) → Service Layer → AI/Database → Response
```

- **API Routes**: Xác thực (JWT), kiểm tra credits, ủy quyền cho Service Layer
- **Service Layer**: Xử lý business logic, không throw exception, trả về giá trị mặc định an toàn
- **Supabase**: Authentication (OAuth + Email), PostgreSQL (RLS), Storage (file upload)
- **AI Providers**: Gemini (primary), OpenAI (fallback) với cơ chế chuyển đổi tự động

---

## Công nghệ sử dụng

| Thành phần | Công nghệ | Phiên bản |
|------------|-----------|-----------|
| Framework | Next.js (App Router) | 14.2 |
| Ngôn ngữ | TypeScript | 5.x |
| Styling | Tailwind CSS + shadcn/ui | v4 |
| State Management | Zustand | 5.x |
| Data Fetching | SWR | 2.x |
| Forms | React Hook Form + Zod | |
| Auth & Database | Supabase (PostgreSQL, Auth, Storage) | |
| AI - Primary | Google Gemini (`@google/genai`) | |
| AI - Secondary | OpenAI API | |
| i18n | next-intl | |
| Charts | Recharts | |
| Animation | Framer Motion | |
| Testing | Playwright (E2E) | |
| Deployment | Vercel | |

---

## Cài đặt và chạy

### Yêu cầu hệ thống

- Node.js >= 18.0
- npm >= 9.0
- Tài khoản Supabase (free tier)
- API Key: Google Gemini và/hoặc OpenAI

### Hướng dẫn cài đặt

1. **Clone repository**:
```bash
git clone https://github.com/takeisan24/graduation-project.git
cd graduation-project
```

2. **Cài đặt dependencies**:
```bash
npm install
```

3. **Cấu hình environment** — tạo file `.env.local` từ `.env.example`:
```bash
cp .env.example .env.local
```

Điền các giá trị:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Providers
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. **Khởi tạo database** — chạy trong Supabase SQL Editor:
```sql
-- Bước 1: Tạo bảng và indexes
-- File: db/schema.sql

-- Bước 2: Thêm dữ liệu khởi tạo (niches, goals, frameworks)
-- File: db/initDataForGenerateContent.sql
```

5. **Cấu hình Supabase Storage**:
   - Tạo bucket `uploads` (public)
   - Thêm Storage Policies cho authenticated users

6. **Chạy ứng dụng**:
```bash
npm run dev
```

Truy cập tại `http://localhost:3000`

---

## Cấu trúc dự án

```
do_an_tot_nghiep/
├── app/
│   ├── [locale]/              # Trang theo ngôn ngữ (vi/en)
│   │   ├── (pages)/           # Trang public (landing, auth)
│   │   └── profile/           # Trang cá nhân
│   └── api/                   # 44 API Route handlers
│       ├── ai/                # Tạo nội dung AI (text, image, suggestions)
│       ├── auth/              # Xác thực (email, OAuth)
│       ├── chat/              # Chatbot AI (sessions, messages)
│       ├── connections/       # Kết nối mạng xã hội
│       ├── data/              # Trích xuất nội dung (URL, PDF, text)
│       ├── files/             # Upload & quản lý file
│       ├── media-assets/      # Thư viện media
│       ├── posts/             # Quản lý bài đăng (published, failed)
│       ├── projects/          # Dự án nội dung + drafts
│       ├── schedule/          # Lập lịch đăng bài
│       ├── usage/             # Hệ thống credit
│       └── v1/                # Content strategy API
├── components/
│   ├── features/              # Components theo tính năng
│   │   ├── create/            # Trang sáng tạo (editor, calendar, chat...)
│   │   └── user/              # Quản lý hồ sơ
│   ├── shared/                # Components dùng chung
│   ├── providers/             # Context providers (Theme)
│   └── ui/                    # shadcn/ui primitives
├── lib/
│   ├── ai/                    # Cấu hình AI providers
│   ├── services/
│   │   ├── ai/                # Business logic AI
│   │   ├── db/                # Database CRUD services
│   │   ├── posts/             # Dịch vụ quản lý bài đăng
│   │   ├── source/            # Dịch vụ chiến lược nội dung
│   │   └── storage/           # Dịch vụ lưu trữ file
│   ├── middleware/            # API protection (auth + credits)
│   ├── usage/                 # Logic hệ thống credit
│   ├── prompts/               # AI prompt templates
│   ├── types/                 # TypeScript type definitions
│   └── utils/                 # Tiện ích
├── store/                     # Zustand stores (theo từng tính năng)
├── db/                        # Database schema & dữ liệu khởi tạo
├── messages/                  # Bản dịch i18n (vi.json, en.json)
├── e2e/                       # Playwright E2E tests
└── scripts/                   # Scripts tự động hóa
```

---

## Database Schema

Hệ thống sử dụng **10 bảng chính** trên Supabase PostgreSQL:

| Bảng | Mục đích |
|------|----------|
| `users` | Thông tin người dùng (liên kết với Supabase Auth) |
| `projects` | Dự án nội dung |
| `content_drafts` | Bản nháp nội dung (draft, scheduled, posted, failed) |
| `chat_sessions` | Phiên hội thoại AI |
| `chat_messages` | Tin nhắn trong phiên chat |
| `connected_accounts` | Tài khoản mạng xã hội đã kết nối |
| `scheduled_posts` | Lịch đăng bài |
| `files` | Metadata file upload |
| `media_assets` | Thư viện tài nguyên media |
| `niches` / `content_goals` / `frameworks` | Dữ liệu chiến lược nội dung |

Chi tiết schema: [`db/schema.sql`](db/schema.sql)

---

## API Endpoints

Hệ thống có **44 API endpoints**, chia theo chức năng:

| Nhóm | Endpoints | Chức năng |
|------|-----------|-----------|
| `/api/auth` | 3 | Đăng ký, đăng nhập, OAuth (Google) |
| `/api/ai` | 5 | Tạo nội dung, tạo hình ảnh, gợi ý, models |
| `/api/chat` | 4 | Quản lý phiên chat và tin nhắn AI |
| `/api/projects` | 8 | CRUD dự án, drafts, workspace, generate |
| `/api/schedule` | 3 | Lập lịch, hủy lịch, cập nhật |
| `/api/posts` | 2 | Bài đã đăng, bài lỗi |
| `/api/connections` | 2 | Kết nối/ngắt kết nối mạng xã hội |
| `/api/files` | 3 | Upload, signed URL, presigned upload |
| `/api/media-assets` | 2 | Thư viện media |
| `/api/usage` | 3 | Credits, lịch sử, dung lượng |
| `/api/v1` | 5 | Content strategy (niches, goals, frameworks) |
| `/api/data` | 3 | Trích xuất nội dung từ URL, PDF, text |
| `/api/me`, `/api/limits` | 2 | Thông tin user, giới hạn |

Tất cả endpoints được bảo vệ bởi middleware xác thực (`withApiProtection` hoặc `withAuthOnly`).

---

## Bảo mật

- **Authentication**: Supabase Auth (JWT) + OAuth 2.0 (Google)
- **Authorization**: Row Level Security (RLS) trên PostgreSQL
- **API Protection**: Middleware kiểm tra token ở mọi endpoint
- **Credit System**: Xử lý server-side, chống gian lận
- **Input Validation**: Zod schema validation
- **Storage**: Bucket policies giới hạn truy cập theo user ID

---

## Tác giả

| | Thông tin |
|---|---|
| **Sinh viên** | Vũ Tuấn Anh — CNTT4 — K63 |
| **GVHD** | ThS. Đào Vũ Hoàng Nam |
| **Trường** | Đại học Giao thông Vận tải |
| **Năm** | 2025 - 2026 |
