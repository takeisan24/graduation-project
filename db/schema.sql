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
  email text,
  name text,
  avatar_url text,
  role text default 'user',
  plan text default 'free',
  subscription_status text,
  credits_balance integer not null default 10,
  subscription_ends_at timestamptz,
  next_credit_grant_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint users_role_check check (role in ('user', 'admin'))
);

alter table users add column if not exists email text;
alter table users add column if not exists plan text default 'free';
alter table users add column if not exists subscription_status text;
alter table users add column if not exists credits_balance integer not null default 10;
alter table users add column if not exists subscription_ends_at timestamptz;
alter table users add column if not exists next_credit_grant_at timestamptz;

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
  -- Định danh tài khoản/hồ sơ phía dịch vụ đăng bài Zernio (getlate.dev)
  getlate_account_id text,
  getlate_profile_id text,
  late_profile_id text,
  social_media_account_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint connected_accounts_platform_check check (
    platform in ('tiktok', 'instagram', 'youtube', 'facebook', 'x', 'threads', 'linkedin', 'pinterest')
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
  updated_at timestamptz default now(),

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

alter table media_assets add column if not exists updated_at timestamptz default now();

-- ============================================
-- 8. BẢNG GÓI DỊCH VỤ, CREDITS & THỐNG KÊ SỬ DỤNG
-- ============================================

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'active',
  billing_cycle text,
  credits_per_period integer,
  next_credit_date timestamptz,
  current_period_start timestamptz default now(),
  current_period_end timestamptz default (now() + interval '1 month'),
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  credits_used integer not null default 0,
  credits_purchased integer not null default 0,
  period_start timestamptz not null,
  period_end timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, period_start)
);

create table if not exists monthly_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  month date not null,
  projects_created integer not null default 0,
  posts_created integer not null default 0,
  images_generated integer not null default 0,
  videos_generated integer not null default 0,
  scheduled_posts integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, month)
);

create table if not exists credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  action_type text not null,
  credits_used integer not null default 0,
  credits_remaining integer,
  resource_id text,
  resource_type text,
  platform text,
  metadata jsonb default '{}'::jsonb,
  response_data jsonb,
  created_at timestamptz default now()
);

-- Đơn nạp credits qua VietQR
create table if not exists credit_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  order_code bigint unique not null,
  package_id text not null,
  credits integer not null,
  amount integer not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID', 'CANCELLED', 'FAILED')),
  paid_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_credit_orders_user_id on credit_orders (user_id);
create index if not exists idx_credit_orders_order_code on credit_orders (order_code);

-- ============================================
-- 9. BẢNG CHIẾN LƯỢC NỘI DUNG (Niches, Goals, Frameworks)
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
-- 10. CHỈ MỤC (INDEXES)
-- ============================================

-- Users
create index if not exists idx_users_role on users (role);
create index if not exists idx_users_plan on users (plan);

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

-- Usage, credits, subscriptions
create index if not exists idx_subscriptions_user_id on subscriptions (user_id);
create index if not exists idx_subscriptions_status on subscriptions (status);
create index if not exists idx_usage_user_period on usage (user_id, period_start, period_end);
create index if not exists idx_monthly_usage_user_month on monthly_usage (user_id, month);
create index if not exists idx_credit_transactions_user_created on credit_transactions (user_id, created_at desc);
create index if not exists idx_credit_transactions_action_type on credit_transactions (action_type);

-- ============================================
-- 11. HÀM VÀ TRIGGER
-- ============================================

-- A. Tự động cập nhật updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_users_updated_at on users;
drop trigger if exists update_projects_updated_at on projects;
drop trigger if exists update_content_drafts_updated_at on content_drafts;
drop trigger if exists update_chat_sessions_updated_at on chat_sessions;
drop trigger if exists update_connected_accounts_updated_at on connected_accounts;
drop trigger if exists update_scheduled_posts_updated_at on scheduled_posts;
drop trigger if exists update_media_assets_updated_at on media_assets;
drop trigger if exists update_subscriptions_updated_at on subscriptions;
drop trigger if exists update_usage_updated_at on usage;
drop trigger if exists update_monthly_usage_updated_at on monthly_usage;

create trigger update_users_updated_at before update on users for each row execute function update_updated_at_column();
create trigger update_projects_updated_at before update on projects for each row execute function update_updated_at_column();
create trigger update_content_drafts_updated_at before update on content_drafts for each row execute function update_updated_at_column();
create trigger update_chat_sessions_updated_at before update on chat_sessions for each row execute function update_updated_at_column();
create trigger update_connected_accounts_updated_at before update on connected_accounts for each row execute function update_updated_at_column();
create trigger update_scheduled_posts_updated_at before update on scheduled_posts for each row execute function update_updated_at_column();
create trigger update_media_assets_updated_at before update on media_assets for each row execute function update_updated_at_column();
create trigger update_subscriptions_updated_at before update on subscriptions for each row execute function update_updated_at_column();
create trigger update_usage_updated_at before update on usage for each row execute function update_updated_at_column();
create trigger update_monthly_usage_updated_at before update on monthly_usage for each row execute function update_updated_at_column();

-- B. Tạo hồ sơ người dùng khi đăng nhập (Auth Hook)
drop function if exists ensure_user_profile(uuid, text, text, text);
create or replace function ensure_user_profile(
  p_user_id uuid,
  p_name text default null,
  p_avatar_url text default null,
  p_email text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits_balance integer;
begin
  -- Tạo user nếu chưa tồn tại
  insert into users (id, email, name, avatar_url, plan, credits_balance)
  values (p_user_id, p_email, p_name, p_avatar_url, 'free', 10)
  on conflict (id) do update
  set
    email = coalesce(excluded.email, users.email),
    name = coalesce(excluded.name, users.name),
    avatar_url = coalesce(excluded.avatar_url, users.avatar_url),
    updated_at = now();

  select credits_balance into v_credits_balance
  from users
  where id = p_user_id;

  return coalesce(v_credits_balance, 0);
end;
$$;

grant execute on function ensure_user_profile(uuid, text, text, text) to anon, authenticated, service_role;

-- C. Cập nhật thống kê tháng theo trường được phép
create or replace function increment_usage(
  p_user_id uuid,
  p_month date,
  p_field text,
  p_amount integer default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into monthly_usage (user_id, month)
  values (p_user_id, p_month)
  on conflict (user_id, month) do nothing;

  if p_field not in ('projects_created', 'posts_created', 'images_generated', 'videos_generated', 'scheduled_posts') then
    raise exception 'Invalid usage field: %', p_field;
  end if;

  execute format(
    'update monthly_usage set %I = greatest(0, coalesce(%I, 0) + $1), updated_at = now() where user_id = $2 and month = $3',
    p_field,
    p_field
  )
  using p_amount, p_user_id, p_month;
end;
$$;

grant execute on function increment_usage(uuid, date, text, integer) to service_role;

-- D. Trừ credits an toàn ở database để tránh race condition
create or replace function deduct_user_credits(
  p_user_id uuid,
  p_credits_to_deduct integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_credits_to_deduct <= 0 then
    select credits_balance into v_balance from users where id = p_user_id;
    return jsonb_build_object('success', true, 'credits_left', coalesce(v_balance, 0));
  end if;

  update users
  set credits_balance = credits_balance - p_credits_to_deduct,
      updated_at = now()
  where id = p_user_id
    and credits_balance >= p_credits_to_deduct
  returning credits_balance into v_balance;

  if v_balance is null then
    select credits_balance into v_balance from users where id = p_user_id;
    return jsonb_build_object(
      'success', false,
      'reason', 'insufficient_credits',
      'credits_left', coalesce(v_balance, 0)
    );
  end if;

  update usage
  set credits_used = credits_used + p_credits_to_deduct,
      updated_at = now()
  where user_id = p_user_id
    and now() >= period_start
    and now() < period_end;

  return jsonb_build_object('success', true, 'credits_left', v_balance);
end;
$$;

grant execute on function deduct_user_credits(uuid, integer) to service_role;

-- E. Hoàn credits khi tác vụ AI fail sau bước trừ
create or replace function rollback_user_credits(
  p_user_id uuid,
  p_credits_to_rollback integer,
  p_action_type text default 'ROLLBACK',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  update users
  set credits_balance = credits_balance + greatest(0, p_credits_to_rollback),
      updated_at = now()
  where id = p_user_id
  returning credits_balance into v_balance;

  update usage
  set credits_used = greatest(0, credits_used - greatest(0, p_credits_to_rollback)),
      updated_at = now()
  where user_id = p_user_id
    and now() >= period_start
    and now() < period_end;

  insert into credit_transactions (
    user_id,
    action_type,
    credits_used,
    credits_remaining,
    metadata
  )
  values (
    p_user_id,
    p_action_type || '_REFUND',
    -greatest(0, p_credits_to_rollback),
    coalesce(v_balance, 0),
    coalesce(p_metadata, '{}'::jsonb)
  );

  return jsonb_build_object('success', true, 'credits_left', coalesce(v_balance, 0));
end;
$$;

grant execute on function rollback_user_credits(uuid, integer, text, jsonb) to service_role;

-- F. Cộng credits an toàn khi user mua top-up (atomic increment, tránh race condition)
-- Validate p_amount > 0 để tránh balance bị trừ nhầm do bug ở tầng application.
drop function if exists increment_credits_balance(uuid, integer);
create or replace function increment_credits_balance(
  p_user_id uuid,
  p_amount   integer
)
returns void
language plpgsql
security definer
as $$
begin
  if p_amount <= 0 then
    raise exception 'increment_credits_balance: p_amount must be positive, got %', p_amount;
  end if;
  update users
  set credits_balance = credits_balance + p_amount,
      updated_at      = now()
  where id = p_user_id;
end;
$$;

grant execute on function increment_credits_balance(uuid, integer) to service_role;

-- ============================================
-- 12. QUYỀN TRUY CẬP
-- ============================================

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
