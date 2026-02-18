-- ============================================
-- CreatorHub - Schema cho Supabase
-- Chạy trong Supabase SQL Editor
-- ============================================

-- Extensions cần thiết
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ============================================
-- 1. BẢNG NGƯỜI DÙNG
-- ============================================

create table if not exists users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  avatar_url text,
  role text default 'user',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint users_role_check check (role in ('user', 'admin'))
);

-- ============================================
-- 2. BẢNG DỰ ÁN NỘI DUNG
-- ============================================

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  name text not null,
  description text,
  source_type text default 'prompt',
  source_content text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 3. BẢNG BẢN NHÁP NỘI DUNG
-- ============================================

create table if not exists content_drafts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects (id) on delete cascade,
  user_id uuid references users (id) on delete cascade,
  platform text,
  text_content text,
  media_urls jsonb default '[]'::jsonb,
  media_type text,
  status text default 'draft',
  scheduled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint content_drafts_status_check check (status in ('draft', 'scheduled', 'posted', 'failed'))
);

-- ============================================
-- 4. BẢNG CHATBOT AI
-- ============================================

create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  context text default 'general',
  project_id uuid references projects (id) on delete cascade,
  draft_id uuid references content_drafts (id) on delete cascade,
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_sessions (id) on delete cascade,
  draft_id uuid references content_drafts (id) on delete cascade,
  user_id uuid references users (id),
  role text check (role in ('user', 'assistant')),
  content text,
  context text default 'general',
  content_type text default 'text',
  platform text default 'general',
  created_at timestamptz default now()
);

-- ============================================
-- 5. BẢNG KẾT NỐI TÀI KHOẢN MẠNG XÃ HỘI
-- ============================================

create table if not exists connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  platform text,
  profile_id text,
  profile_name text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  connection_provider text default 'native' check (connection_provider in ('late', 'native')),
  platform_metadata jsonb default '{}'::jsonb,
  profile_metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint connected_accounts_platform_check check (
    platform in ('instagram', 'tiktok', 'x', 'linkedin', 'facebook', 'threads', 'bluesky', 'youtube', 'pinterest')
  )
);

-- Mỗi user chỉ kết nối 1 profile_id trên 1 platform
create unique index if not exists idx_connected_accounts_user_platform_profile
on connected_accounts (user_id, platform, profile_id);

-- ============================================
-- 6. BẢNG LỊCH ĐĂNG BÀI
-- ============================================

create table if not exists scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  draft_id uuid references content_drafts (id),
  connected_account_id uuid references connected_accounts (id) on delete set null,
  platform text,
  scheduled_at timestamptz,
  status text default 'scheduled',
  post_url text,
  payload jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint scheduled_posts_status_check check (
    status in ('scheduled', 'publishing', 'posted', 'failed', 'cancelled')
  )
);

-- ============================================
-- 7. BẢNG TỆP TIN & HÌNH ẢNH
-- ============================================

create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  key text,
  bucket text,
  mime text,
  size bigint,
  metadata jsonb,
  created_at timestamptz default now()
);

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  asset_type text not null,
  source_type text not null default 'uploaded',
  origin text,
  storage_type text not null default 's3',
  storage_bucket text not null,
  storage_key text not null,
  public_url text not null,
  thumbnail_url text,
  thumbnail_key text,
  file_size bigint,
  mime_type text,
  duration integer,
  width integer,
  height integer,
  checksum text,
  metadata jsonb default '{}'::jsonb,
  parent_asset_id uuid references media_assets (id) on delete cascade,
  created_at timestamptz default now(),

  constraint media_assets_asset_type_check check (
    asset_type in ('image', 'video', 'audio', 'document')
  ),
  constraint media_assets_storage_type_check check (
    storage_type in ('supabase', 's3', 'url')
  ),
  constraint media_assets_source_type_check check (
    source_type in ('uploaded', 'ai_generated', 'processed')
  )
);

-- ============================================
-- 8. BẢNG CHIẾN LƯỢC NỘI DUNG (Niches, Goals, Frameworks)
-- ============================================

create table if not exists niches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  description text
);

create table if not exists content_goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  prompt_modifier_text text
);

create table if not exists frameworks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique,
  description text,
  icon_name text not null,
  goal_ids uuid[] default '{}'::uuid[],
  base_prompt_text text,
  placeholders text[] default '{}'::text[],
  created_at timestamptz default now()
);

create table if not exists framework_niches (
  framework_id uuid references frameworks (id) on delete cascade,
  niche_id uuid references niches (id) on delete cascade,
  override_prompt_text text,
  primary key (framework_id, niche_id)
);

-- ============================================
-- 9. CHỈ MỤC (INDEXES)
-- ============================================

-- Users
create index if not exists idx_users_role on users (role);

-- Projects
create index if not exists idx_projects_user_id on projects (user_id);

-- Content Drafts
create index if not exists idx_content_drafts_user_id on content_drafts (user_id);
create index if not exists idx_content_drafts_project_id on content_drafts (project_id);
create index if not exists idx_content_drafts_platform on content_drafts (platform);
create index if not exists idx_content_drafts_status on content_drafts (status);

-- Chat
create index if not exists idx_chat_messages_user_id on chat_messages (user_id);
create index if not exists idx_chat_messages_session_id on chat_messages (session_id);
create index if not exists idx_chat_messages_draft_id on chat_messages (draft_id);

-- Connected Accounts
create index if not exists idx_connected_accounts_provider on connected_accounts (connection_provider);

-- Scheduled Posts
create index if not exists idx_scheduled_posts_user_id on scheduled_posts (user_id);
create index if not exists idx_scheduled_posts_status on scheduled_posts (status);
create index if not exists idx_scheduled_posts_scheduled_at on scheduled_posts (scheduled_at);
create index if not exists idx_scheduled_posts_connected_account_id on scheduled_posts (connected_account_id);

-- Media Assets
create index if not exists idx_media_assets_user_id on media_assets (user_id);
create index if not exists idx_media_assets_asset_type on media_assets (asset_type);
create index if not exists idx_media_assets_created_at on media_assets (created_at);
create index if not exists idx_media_assets_user_type on media_assets (user_id, asset_type, created_at desc);
create index if not exists idx_media_assets_storage_key on media_assets (storage_bucket, storage_key);
create index if not exists idx_media_assets_source_type on media_assets (source_type);
create index if not exists idx_media_assets_parent_asset_id on media_assets (parent_asset_id) where parent_asset_id is not null;

-- ============================================
-- 10. HÀM VÀ TRIGGER
-- ============================================

-- A. Tự động cập nhật updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_users_updated_at before update on users for each row execute function update_updated_at_column();
create trigger update_projects_updated_at before update on projects for each row execute function update_updated_at_column();
create trigger update_content_drafts_updated_at before update on content_drafts for each row execute function update_updated_at_column();
create trigger update_chat_sessions_updated_at before update on chat_sessions for each row execute function update_updated_at_column();
create trigger update_connected_accounts_updated_at before update on connected_accounts for each row execute function update_updated_at_column();
create trigger update_scheduled_posts_updated_at before update on scheduled_posts for each row execute function update_updated_at_column();
create trigger update_media_assets_updated_at before update on media_assets for each row execute function update_updated_at_column();

-- B. Tạo hồ sơ người dùng khi đăng nhập (Auth Hook)
create or replace function ensure_user_profile(
  p_user_id uuid,
  p_name text default null,
  p_avatar_url text default null,
  p_email text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Tạo user nếu chưa tồn tại
  insert into users (id, name, avatar_url)
  values (p_user_id, p_name, p_avatar_url)
  on conflict (id) do nothing;

  -- Cập nhật thời gian đăng nhập
  update users
  set updated_at = now()
  where id = p_user_id;
end;
$$;

grant execute on function ensure_user_profile(uuid, text, text, text) to anon, authenticated, service_role;

-- ============================================
-- 11. QUYỀN TRUY CẬP
-- ============================================

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
