# CreatorHub

Website hỗ trợ lập kế hoạch và sáng tạo nội dung đa nền tảng sử dụng công cụ Generative AI.

## Giới thiệu

CreatorHub là ứng dụng Web giúp các nhà sáng tạo nội dung trong việc lên ý tưởng và lập kế hoạch đăng bài. Hệ thống tích hợp Trí tuệ nhân tạo tạo sinh (Generative AI) để giải quyết vấn đề "bí ý tưởng" và quản lý nội dung rời rạc.

## Tính năng chính

- **Sáng tạo nội dung tự động**: Tích hợp Google Gemini và OpenAI để tự động sinh nội dung văn bản, kịch bản video ngắn, và gợi ý hình ảnh
- **Lập kế hoạch trực quan**: Giao diện Lịch với thao tác kéo thả (Drag & Drop), sắp xếp bài đăng và theo dõi trạng thái
- **Chatbot AI trợ lý**: Tinh chỉnh nội dung - viết lại, tóm tắt, thay đổi giọng văn
- **Đa nền tảng**: Tạo nội dung tối ưu cho nhiều mạng xã hội từ một nguồn dữ liệu duy nhất
- **Đa ngôn ngữ**: Hỗ trợ Tiếng Việt và Tiếng Anh

## Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Frontend | Next.js 14+ (App Router), React 18, TypeScript |
| Styling | TailwindCSS, Shadcn/ui, Radix UI |
| State Management | Zustand |
| Backend & CSDL | Supabase (PostgreSQL, Authentication, Storage) |
| AI | Google Gemini API, OpenAI API |
| Deployment | Vercel |
| i18n | next-intl |

## Cài đặt

### Yêu cầu

- Node.js 18+
- npm hoặc pnpm
- Tài khoản Supabase
- API Key: Google Gemini và/hoặc OpenAI

### Hướng dẫn

1. Clone repository:
```bash
git clone https://github.com/takeisan24/graduation-project.git
cd graduation-project
```

2. Cài đặt dependencies:
```bash
npm install
```

3. Tạo file `.env.local` từ template:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI APIs
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Khởi tạo database:
- Chạy file `db/schema.sql` trong Supabase SQL Editor
- Chạy file `db/initDataForGenerateContent.sql` để thêm dữ liệu mẫu

5. Chạy ứng dụng:
```bash
npm run dev
```

Ứng dụng sẽ chạy tại `http://localhost:3000`

## Cấu trúc dự án

```
├── app/                    # Next.js App Router
│   ├── [locale]/          # Trang theo ngôn ngữ (vi/en)
│   │   ├── (pages)/       # Trang public (home, auth)
│   │   └── profile/       # Trang cá nhân
│   └── api/               # API Routes
│       ├── ai/            # AI generation endpoints
│       ├── auth/          # Authentication
│       ├── chat/          # Chatbot AI
│       ├── data/          # Content extraction (URL, PDF, text)
│       ├── posts/         # Quản lý bài đăng
│       └── schedule/      # Lập lịch đăng bài
├── components/            # React Components
│   ├── features/          # Component theo tính năng
│   ├── shared/            # Component dùng chung
│   └── ui/                # UI primitives (Shadcn)
├── db/                    # Database schema & migrations
├── hooks/                 # Custom React hooks
├── i18n/                  # Cấu hình đa ngôn ngữ
├── lib/                   # Business logic
│   ├── ai/                # AI providers & services
│   ├── services/          # Service layer
│   └── utils/             # Utilities
├── messages/              # File ngôn ngữ (vi.json, en.json)
└── store/                 # Zustand state management
```

## Tác giả

- **Sinh viên**: Vũ Tuấn Anh - CNTT4 - K63
- **GVHD**: ThS. Đào Vũ Hoàng Nam
- **Trường**: Đại học Giao thông Vận tải
