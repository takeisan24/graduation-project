# CreatorHub

> Website ho tro lap ke hoach va sang tao noi dung da nen tang su dung cong cu Generative AI.

**Do an tot nghiep** — Vu Tuan Anh — CNTT4 — K63
Truong Dai hoc Giao thong Van tai — GVHD: ThS. Dao Vu Hoang Nam

---

## Gioi thieu

CreatorHub la ung dung Web giup cac nha sang tao noi dung trong viec len y tuong va lap ke hoach dang bai. He thong tich hop Tri tue nhan tao tao sinh (Generative AI) de giai quyet van de "bi y tuong" va quan ly noi dung roi rac tren nhieu nen tang mang xa hoi.

### Van de can giai quyet

- Nguoi sang tao noi dung thuong gap kho khan trong viec duy tri y tuong moi
- Noi dung can toi uu hoa cho tung nen tang (Instagram, TikTok, LinkedIn, Facebook...)
- Quan ly lich dang bai tren nhieu nen tang cung luc phuc tap va ton thoi gian
- Thieu cong cu tich hop AI ho tro toan bo quy trinh tu y tuong den dang bai

### Giai phap

CreatorHub cung cap mot nen tang duy nhat de:
1. **Tao noi dung tu dong** bang AI (van ban, hinh anh, video)
2. **Lap ke hoach** dang bai voi giao dien lich truc quan
3. **Tinh chinh** noi dung qua chatbot AI tro ly
4. **Quan ly** toan bo quy trinh tu y tuong den xuat ban

---

## Tinh nang chinh

| Tinh nang | Mo ta |
|-----------|-------|
| Sang tao noi dung AI | Tich hop Google Gemini va OpenAI de sinh noi dung van ban, kich ban video, goi y hinh anh |
| Lap ke hoach truc quan | Giao dien Lich voi thao tac keo tha (Drag & Drop), theo doi trang thai bai dang |
| Chatbot AI tro ly | Tinh chinh noi dung - viet lai, tom tat, thay doi giong van, dich ngon ngu |
| Da nen tang | Tao noi dung toi uu cho Instagram, TikTok, LinkedIn, Facebook, X, YouTube, Pinterest |
| Content Strategy | Chon niche, muc tieu, framework de AI tao noi dung phu hop chien luoc |
| Thu vien Media | Upload, quan ly va tai su dung hinh anh/video cho nhieu bai dang |
| He thong Credits | Quan ly han muc su dung AI, theo doi lich su tieu thu |
| Da ngon ngu | Ho tro day du Tieng Viet va Tieng Anh (next-intl) |

---

## Kien truc he thong

```
                    +------------------+
                    |   Client (Browser)|
                    +--------+---------+
                             |
                    +--------v---------+
                    |  Next.js App      |
                    |  (App Router)     |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
    +---------v----------+       +----------v---------+
    |   API Routes       |       |  Server Components  |
    |   (44 endpoints)   |       |  (SSR Pages)        |
    +---------+----------+       +---------------------+
              |
    +---------v----------+
    |   Service Layer     |
    |   (Business Logic)  |
    +----+----------+----+
         |          |
+--------v---+  +---v-----------+
| Supabase   |  | AI Providers  |
| - Auth     |  | - Gemini      |
| - PostgreSQL| | - OpenAI      |
| - Storage  |  +---------------+
+------------+
```

### Luong xu ly chinh

```
User Input → API Route (Auth + Credits) → Service Layer → AI/Database → Response
```

- **API Routes**: Xac thuc (JWT), kiem tra credits, uy quyen cho Service Layer
- **Service Layer**: Xu ly business logic, khong throw exception, tra ve gia tri mac dinh an toan
- **Supabase**: Authentication (OAuth + Email), PostgreSQL (RLS), Storage (file upload)
- **AI Providers**: Gemini (primary), OpenAI (fallback) voi co che chuyen doi tu dong

---

## Cong nghe su dung

| Thanh phan | Cong nghe | Phien ban |
|------------|-----------|-----------|
| Framework | Next.js (App Router) | 14.2 |
| Ngon ngu | TypeScript | 5.x |
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

## Cai dat va chay

### Yeu cau he thong

- Node.js >= 18.0
- npm >= 9.0
- Tai khoan Supabase (free tier)
- API Key: Google Gemini va/hoac OpenAI

### Huong dan cai dat

1. **Clone repository**:
```bash
git clone https://github.com/takeisan24/graduation-project.git
cd graduation-project
```

2. **Cai dat dependencies**:
```bash
npm install
```

3. **Cau hinh environment** — tao file `.env.local` tu `.env.example`:
```bash
cp .env.example .env.local
```

Dien cac gia tri:
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

4. **Khoi tao database** — chay trong Supabase SQL Editor:
```sql
-- Buoc 1: Tao bang va indexes
-- File: db/schema.sql

-- Buoc 2: Them du lieu khoi tao (niches, goals, frameworks)
-- File: db/initDataForGenerateContent.sql
```

5. **Cau hinh Supabase Storage**:
   - Tao bucket `uploads` (public)
   - Them Storage Policies cho authenticated users

6. **Chay ung dung**:
```bash
npm run dev
```

Truy cap tai `http://localhost:3000`

---

## Cau truc du an

```
do_an_tot_nghiep/
├── app/
│   ├── [locale]/              # Trang theo ngon ngu (vi/en)
│   │   ├── (pages)/           # Trang public (landing, auth)
│   │   └── profile/           # Trang ca nhan
│   └── api/                   # 44 API Route handlers
│       ├── ai/                # AI generation (text, image, suggestions)
│       ├── auth/              # Authentication (email, OAuth)
│       ├── chat/              # Chatbot AI (sessions, messages)
│       ├── connections/       # Ket noi mang xa hoi
│       ├── data/              # Content extraction (URL, PDF, text)
│       ├── files/             # File upload & management
│       ├── media-assets/      # Thu vien media
│       ├── posts/             # Quan ly bai dang (published, failed)
│       ├── projects/          # Du an noi dung + drafts
│       ├── schedule/          # Lap lich dang bai
│       ├── usage/             # Credit system
│       └── v1/                # Content strategy API
├── components/
│   ├── features/              # Components theo tinh nang
│   │   ├── create/            # Trang sang tao (editor, calendar, chat...)
│   │   └── user/              # Profile management
│   ├── shared/                # Components dung chung
│   ├── providers/             # Context providers (Theme)
│   └── ui/                    # shadcn/ui primitives
├── lib/
│   ├── ai/                    # AI provider configs
│   ├── services/
│   │   ├── ai/                # AI business logic
│   │   ├── db/                # Database CRUD services
│   │   ├── posts/             # Post management services
│   │   ├── source/            # Content strategy services
│   │   └── storage/           # File storage services
│   ├── middleware/             # API protection (auth + credits)
│   ├── usage/                 # Credit system logic
│   ├── prompts/               # AI prompt templates
│   ├── types/                 # TypeScript type definitions
│   └── utils/                 # Utility functions
├── store/                     # Zustand stores (per feature domain)
├── db/                        # Database schema & seed data
├── messages/                  # i18n translations (vi.json, en.json)
├── e2e/                       # Playwright E2E tests
└── scripts/                   # Automation scripts
```

---

## Database Schema

He thong su dung **10 bang chinh** tren Supabase PostgreSQL:

| Bang | Muc dich |
|------|----------|
| `users` | Thong tin nguoi dung (lien ket voi Supabase Auth) |
| `projects` | Du an noi dung |
| `content_drafts` | Ban nhap noi dung (draft, scheduled, posted, failed) |
| `chat_sessions` | Phien hoi thoai AI |
| `chat_messages` | Tin nhan trong phien chat |
| `connected_accounts` | Tai khoan mang xa hoi da ket noi |
| `scheduled_posts` | Lich dang bai |
| `files` | Metadata file upload |
| `media_assets` | Thu vien tai nguyen media |
| `niches` / `content_goals` / `frameworks` | Du lieu chien luoc noi dung |

Chi tiet schema: [`db/schema.sql`](db/schema.sql)

---

## API Endpoints

He thong co **44 API endpoints**, chia theo chuc nang:

| Nhom | Endpoints | Chuc nang |
|------|-----------|-----------|
| `/api/auth` | 3 | Dang ky, dang nhap, OAuth (Google) |
| `/api/ai` | 5 | Tao noi dung, tao hinh anh, goi y, models |
| `/api/chat` | 4 | Quan ly phien chat va tin nhan AI |
| `/api/projects` | 8 | CRUD du an, drafts, workspace, generate |
| `/api/schedule` | 3 | Lap lich, huy lich, cap nhat |
| `/api/posts` | 2 | Bai da dang, bai loi |
| `/api/connections` | 2 | Ket noi/ngat ket noi mang xa hoi |
| `/api/files` | 3 | Upload, signed URL, presigned upload |
| `/api/media-assets` | 2 | Thu vien media |
| `/api/usage` | 3 | Credits, lich su, dung luong |
| `/api/v1` | 5 | Content strategy (niches, goals, frameworks) |
| `/api/data` | 3 | Extract content tu URL, PDF, text |
| `/api/me`, `/api/limits` | 2 | Thong tin user, gioi han |

Tat ca endpoints duoc bao ve boi middleware xac thuc (`withApiProtection` hoac `withAuthOnly`).

---

## Bao mat

- **Authentication**: Supabase Auth (JWT) + OAuth 2.0 (Google)
- **Authorization**: Row Level Security (RLS) tren PostgreSQL
- **API Protection**: Middleware kiem tra token o moi endpoint
- **Credit System**: Xu ly server-side, chong gian lan
- **Input Validation**: Zod schema validation
- **Storage**: Bucket policies gioi han truy cap theo user ID

---

## Tac gia

| | Thong tin |
|---|---|
| **Sinh vien** | Vu Tuan Anh — CNTT4 — K63 |
| **GVHD** | ThS. Dao Vu Hoang Nam |
| **Truong** | Dai hoc Giao thong Van tai |
| **Nam** | 2025 - 2026 |
