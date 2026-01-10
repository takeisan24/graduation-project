-- Run in Supabase SQL editor

-- Ensure required extensions for UUID generation and Text Search
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ============================================
-- 1. CORE TABLES (Users, Projects, etc.)
-- ============================================

-- 0. PLANS (Dependency for Users)
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  credits_monthly integer not null,
  credits_yearly integer not null,
  price_monthly numeric not null,
  price_yearly numeric not null,
  features jsonb default '[]'::jsonb,
  max_profiles integer,
  max_posts_per_month integer,
  tier_level integer not null,
  is_active boolean default true,
  is_visible boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 1. USERS
create table if not exists users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  avatar_url text,
  -- Plan & Subscription Fields
  plan text default 'free', -- legacy field, kept for compatibility check constraint below
  current_plan_slug text default 'free',
  current_plan_id uuid references plans(id),
  subscription_status text default 'inactive', -- 'active','inactive','cancelled','past_due','expired'
  subscription_ends_at timestamptz,
  last_plan_purchase_at timestamptz,
  -- Credits
  credits_balance integer default 0,
  next_credit_grant_at timestamptz,
  -- Connection tracking
  last_login_at timestamptz,
  -- Role
  role text default 'user',
  -- Metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Constraints
  constraint users_plan_check check (plan in ('free','creator','creator_pro','agency')),
  constraint users_subscription_status_check check (subscription_status in ('active','inactive','cancelled','past_due','expired')),
  constraint users_role_check check (role in ('user','admin'))
);

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

create table if not exists content_drafts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects (id) on delete cascade,
  user_id uuid references users (id) on delete cascade,
  platform text,
  text_content text,
  media_urls jsonb default '[]'::jsonb,
  media_type text,
  status text default 'draft', -- 'draft','scheduled','posted','failed'
  scheduled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  constraint content_drafts_status_check check (status in ('draft','scheduled','posted','failed'))
);

create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  context text default 'general', -- 'general', 'project', 'draft', 'workspace'
  project_id uuid references projects(id) on delete cascade,
  draft_id uuid references content_drafts(id) on delete cascade,
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_sessions(id) on delete cascade,
  draft_id uuid references content_drafts (id) on delete cascade,
  user_id uuid references users (id),
  role text check (role in ('user','assistant')),
  content text,
  context text default 'general',
  content_type text default 'text',
  platform text default 'general',
  created_at timestamptz default now()
);

-- ============================================
-- 2. SOCIAL CONNECTIONS & LATE.DEV
-- ============================================

create table if not exists getlate_accounts (
  id uuid primary key default gen_random_uuid(),
  account_name text,
  api_key text not null unique,
  client_id text,
  client_secret text,
  webhook_secret text,
  is_active boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists getlate_profiles (
  id uuid primary key default gen_random_uuid(),
  getlate_account_id uuid references getlate_accounts (id) on delete cascade,
  late_profile_id text not null unique,
  profile_name text,
  description text,
  social_media_ids jsonb default '{}'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  -- Late.dev Integration
  getlate_profile_id uuid references getlate_profiles (id) on delete cascade,
  getlate_account_id uuid references getlate_accounts (id) on delete set null,
  late_profile_id text, -- legacy
  social_media_account_id text, -- from late.dev
  -- Common
  platform text,
  profile_id text, -- social platform ID
  profile_name text,
  -- Token Management
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  -- Type & Metadata
  connection_provider text default 'late' check (connection_provider in ('late', 'native')),
  platform_metadata jsonb default '{}'::jsonb, -- e.g. youtube uploadPlaylistId
  profile_metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  constraint connected_accounts_platform_check check (platform in ('instagram','tiktok','x','linkedin','facebook','threads','bluesky','youtube','pinterest','late'))
);
-- Unique index for Native connections (User + Platform + ProfileID)
create unique index if not exists idx_connected_accounts_user_platform_profile 
on connected_accounts (user_id, platform, profile_id);
-- Unique index for Late connections (User + LateProfile + Platform)
create unique index if not exists idx_connected_accounts_user_getlate_profile_platform 
on connected_accounts(user_id, getlate_profile_id, platform);


-- ============================================
-- 3. USAGE & SUBSCRIPTIONS
-- ============================================

create table if not exists usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  credits_used integer default 0,
  credits_purchased integer default 0,
  period_start timestamptz not null,
  period_end timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, period_start)
);

-- Bảng mới để quản lý monthly usage theo yêu cầu
create table if not exists monthly_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  month date not null,
  projects_created integer default 0,
  posts_created integer default 0,
  scheduled_posts integer default 0,
  images_generated integer default 0,
  videos_generated integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, month)
);

-- PAYMENT & ORDERS TABLES

create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percentage', 'fixed_amount')),
  discount_value numeric not null check (discount_value > 0),
  max_discount_amount numeric,
  min_order_amount numeric default 0,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_count integer default 0 check (usage_count >= 0),
  usage_per_user integer default 1 check (usage_per_user > 0),
  start_date timestamptz not null,
  end_date timestamptz not null,
  applies_to_billing text not null default 'yearly' check (applies_to_billing in ('monthly', 'yearly', 'both')),
  applies_to_plans uuid[],
  is_active boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references auth.users(id),
  -- Plan Info Snapshot
  plan_id uuid references plans(id),
  plan_name text not null,
  plan_slug text not null,
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
  credits_amount integer not null check (credits_amount > 0),
  -- Amounts
  subtotal numeric not null check (subtotal >= 0),
  discount_amount numeric default 0 check (discount_amount >= 0),
  total_amount numeric not null check (total_amount >= 0),
  currency text default 'VND',
  -- Coupon Info Snapshot
  coupon_id uuid references coupons(id),
  coupon_code text,
  coupon_discount_type text,
  coupon_discount_value numeric,
  -- Customer Info
  customer_name text,
  customer_email text not null,
  customer_phone text,
  -- VNPay
  vnpay_txn_ref text unique,
  vnpay_transaction_no text,
  vnpay_bank_code text,
  vnpay_bank_tran_no text,
  vnpay_card_type text,
  vnpay_pay_date text,
  vnpay_response_code text,
  vnpay_transaction_status text,
  vnpay_secure_hash text,
  vnpay_raw_response jsonb,
  -- OnePay
  onepay_txn_ref text unique,
  onepay_transaction_no text,
  onepay_response_code text,
  onepay_transaction_status text,
  onepay_raw_response jsonb,
  -- Status & Meta
  status text not null default 'pending' check (status in ('pending', 'paid', 'completed', 'failed', 'expired', 'refunded', 'partially_refunded')),
  payment_method text default 'vnpay',
  credits_added boolean default false,
  credits_added_at timestamptz,
  -- Refund
  refund_amount numeric default 0,
  refund_requested_at timestamptz,
  refund_completed_at timestamptz,
  refund_reason text,
  refund_credits_deducted integer default 0,
  -- Upgrades/Renewals
  previous_plan_slug text,
  previous_plan_remaining_value numeric,
  subscription_id uuid, -- Circular ref added later via ALTER if needed, or just allow null here
  created_at timestamptz default now(),
  paid_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz default now()
);

create table if not exists coupon_usage (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references coupons(id),
  user_id uuid not null references auth.users(id),
  order_id uuid not null references orders(id),
  discount_amount numeric not null,
  order_total numeric not null,
  created_at timestamptz default now()
);

create table if not exists payment_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  event_type text not null,
  payload jsonb,
  error_message text,
  created_at timestamptz default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  -- LemonSqueezy (Legacy/Alternative)
  lemonsqueezy_subscription_id text unique,
  lemonsqueezy_customer_id text,
  -- Core System
  plan_id uuid references plans(id),
  plan text not null, -- slug
  status text not null default 'active',
  billing_cycle text check (billing_cycle in ('monthly', 'yearly')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  credits_per_period integer default 0,
  next_credit_date date,
  is_auto_renew boolean default false,
  cancel_at_period_end boolean default false,
  original_order_id uuid references orders(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  constraint subscriptions_plan_check check (plan in ('creator','creator_pro','agency')),
  constraint subscriptions_status_check check (status in ('active','cancelled','past_due','expired'))
);

-- Circular FK for orders -> subscriptions
alter table orders 
add constraint orders_subscription_id_fkey 
foreign key (subscription_id) references subscriptions(id);

create table if not exists credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  action_type text not null,
  credits_used integer default 0,
  credits_remaining integer,
  resource_id uuid,
  resource_type text,
  platform text,
  metadata jsonb,
  response_data jsonb,
  -- Payment linkage
  order_id uuid references orders(id),
  subscription_id uuid references subscriptions(id),
  source text default 'purchase' check (source in ('purchase', 'subscription_renewal', 'bonus', 'refund', 'admin_adjustment')),
  created_at timestamptz default now(),
  
  constraint credit_transactions_action_type_check check (
    action_type in (
      'PROJECT_CREATED', 
      'POST_CREATED', 
      'IMAGE_GENERATED', 
      'VIDEO_GENERATED', 
      'CREDIT_DEDUCTED', 
      'CREDIT_PURCHASED',
      'POST_SCHEDULED',
      'POST_PUBLISHED',
      'AI_REFINEMENT',
      'VIDEO_PROCESSING',
      'TEXT_ONLY',
      'WITH_IMAGE',
      'WITH_VIDEO',
      'TEXT_TO_VIDEO',
      'CUT_CLIP',
      'VIDEO_FACTORY'
    )
  )
);

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

create table if not exists scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  draft_id uuid references content_drafts(id),
  -- Connection
  connected_account_id uuid references connected_accounts(id) on delete set null,
  getlate_profile_id uuid references getlate_profiles(id) on delete set null, -- Optional
  getlate_account_id uuid references getlate_accounts(id) on delete set null, -- Optional
  late_job_id text, -- Optional
  -- Meta
  platform text,
  scheduled_at timestamptz,
  status text default 'scheduled',
  post_url text,
  payload jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  constraint scheduled_posts_status_check check (status in ('scheduled','publishing','posted','failed','cancelled'))
);

-- ============================================
-- 4. VIDEO FACTORY & PROCESSING
-- ============================================

-- Video Factory Tables (Order matters for FKs)

-- A. Table: processing_jobs (Core)
create table if not exists processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  job_type text not null,
  status text not null default 'queued',
  priority integer default 0,
  input_data jsonb not null,
  output_data jsonb,
  error_message text,
  progress integer default 0 check (progress >= 0 and progress <= 100),
  progress_message text,
  aws_mediaconvert_job_id text,
  estimated_completion_time timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  -- Liveness & Metadata
  last_progress_at timestamptz,
  last_heartbeat_at timestamptz,
  abandon_reason text,
  timeout_at timestamptz, -- Absolute deadline
  max_duration_sec integer default 28800, -- 8 hours
  -- Links (FKs added after tables exist)
  project_id uuid, -- Link to video_factory_projects
  job_subtype text check (job_subtype is null or job_subtype in ('cut', 'postprocess')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  constraint processing_jobs_status_check check (
    status in ('queued', 'processing', 'completed', 'failed', 'cancelled', 'abandoned')
  ),
  constraint processing_jobs_job_type_check check (
    job_type in ('image_generation', 'video_generation', 'video_factory', 'video_cut', 'video_merge', 'video_subtitle', 'video_translate', 'video_download', 'video_transcode', 'video_add_brolls', 'video_add_music', 'video_add_logo', 'audio_extract', 'audio_merge', 'audio_transcribe', 'file_upload', 'file_optimize')
  )
);

-- B. Table: media_assets
create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  job_id uuid references processing_jobs(id) on delete set null,
  asset_type text not null check (asset_type in ('image', 'video', 'audio', 'document')),
  source_type text not null default 'uploaded' check (source_type in ('uploaded', 'ai_generated', 'processed')),
  origin text,
  storage_type text not null default 's3' check (storage_type in ('supabase', 's3', 'url')),
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
  project_id uuid, -- Link to video_factory_projects
  parent_asset_id uuid references media_assets(id) on delete cascade,
  created_at timestamptz default now()
);

-- C. Table: video_factory_audio_transcripts
create table if not exists video_factory_audio_transcripts (
  id uuid primary key default gen_random_uuid(),
  audio_media_asset_id uuid not null references media_assets(id) on delete cascade,
  source_media_asset_id uuid references media_assets(id) on delete cascade,
  audio_s3_uri text not null,
  transcript jsonb,
  transcript_source text,
  translations jsonb default '{}'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint video_factory_audio_transcripts_audio_asset_unique unique (audio_media_asset_id)
);

-- D. Table: video_factory_projects
create table if not exists video_factory_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  job_id uuid references processing_jobs(id) on delete set null unique, -- history/status link
  project_name text,
  source_type text not null check (source_type in ('youtube', 'upload')),
  source_url text not null,
  source_thumbnail_url text,
  source_duration_seconds integer,
  -- Asset Links
  source_media_asset_id uuid references media_assets(id) on delete cascade,
  audio_transcript_id uuid references video_factory_audio_transcripts(id) on delete set null,
  -- Legacy/Deprecated fields (kept for migration safety, nullable)
  audio_media_asset_id uuid references media_assets(id) on delete set null,
  transcript jsonb,
  transcript_source text,
  -- Configs
  cut_config jsonb,
  postprod_config jsonb,
  output_clips jsonb,
  final_video_url text,
  -- State
  status text not null default 'processing' check (status in ('draft', 'cutting', 'ready', 'processing_post', 'completed', 'processing', 'failed')),
  current_cut_job_id uuid references processing_jobs(id) on delete set null,
  current_processing_job_id uuid references processing_jobs(id) on delete set null,
  input_snapshot jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add Circular FKs for Video Factory
alter table processing_jobs 
add constraint processing_jobs_project_id_fkey 
foreign key (project_id) references video_factory_projects(id) on delete cascade;

alter table media_assets 
add constraint media_assets_project_id_fkey 
foreign key (project_id) references video_factory_projects(id) on delete set null;

-- E. Table: video_factory_outputs
create table if not exists video_factory_outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  cut_job_id uuid not null references processing_jobs(id) on delete cascade,
  postprocess_job_id uuid not null references processing_jobs(id) on delete set null unique,
  project_id uuid references video_factory_projects(id) on delete cascade,
  final_video_url text,
  final_video_key text,
  thumbnail_url text,
  thumbnail_key text,
  postprod_config jsonb,
  selected_clip_keys text[],
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  duration_seconds integer,
  file_size bigint,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists video_processing_configs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references processing_jobs(id) on delete cascade,
  operation_type text not null check (operation_type in ('cut', 'merge', 'subtitle', 'translate', 'transcode', 'add_brolls', 'add_music', 'add_logo')),
  config jsonb not null,
  created_at timestamptz default now()
);

-- F. Job Steps & External Tasks
create table if not exists job_steps (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references processing_jobs(id) on delete cascade,
  step_name varchar(64) not null,
  step_order int not null default 0,
  status varchar(32) not null check (status in ('pending', 'running', 'waiting', 'completed', 'failed', 'skipped')),
  waiting_reason varchar(64),
  retry_count int default 0,
  max_retries int default 5,
  started_at timestamptz,
  finished_at timestamptz,
  last_checked_at timestamptz,
  next_check_at timestamptz,
  timeout_at timestamptz,
  error_code varchar(64),
  error_message text,
  output jsonb default '{}'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(job_id, step_name)
);

create table if not exists external_tasks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references processing_jobs(id) on delete cascade,
  step_id uuid not null references job_steps(id) on delete cascade,
  provider varchar(32) not null check (provider in ('aws_mediaconvert', 'aws_transcribe', 'openai', 'gemini')),
  external_job_id varchar(128) not null,
  status varchar(32) not null check (status in ('submitted', 'running', 'completed', 'failed')),
  last_polled_at timestamptz,
  next_poll_at timestamptz,
  poll_count int default 0,
  max_polls int default 100,
  timeout_at timestamptz,
  hard_cap_at timestamptz,
  poll_locked_until timestamptz,
  poll_owner text,
  raw_response jsonb,
  output jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists global_stock_assets (
  id uuid primary key default gen_random_uuid(),
  keyword varchar(255) not null,
  s3_key text not null unique,
  provider varchar(50) not null check (provider in ('pexels', 'pixabay')),
  provider_id varchar(255) not null,
  orientation varchar(50) not null check (orientation in ('landscape', 'portrait', 'square')),
  duration integer,
  width integer,
  height integer,
  preview_url text,
  tags text[] default '{}',
  author varchar(255),
  license varchar(100),
  usage_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(provider, provider_id)
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text,
  payload jsonb,
  status text default 'queued',
  attempts int default 0,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 5. CONTENT FRAMEWORKS
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
  framework_id uuid references frameworks(id) on delete cascade,
  niche_id uuid references niches(id) on delete cascade,
  override_prompt_text text,
  primary key (framework_id, niche_id)
);

-- ============================================
-- 6. FUNCTIONS & TRIGGERS
-- ============================================

-- Function to atomically rollback (refund) user credits
create or replace function rollback_user_credits(
  p_user_id uuid,
  p_credits_to_rollback integer,
  p_action_type text,
  p_metadata jsonb
) returns json as $$
declare
  v_credits_used integer;
  v_credits_left integer;
  v_month_start timestamptz;
  v_period_start timestamptz;
begin
  -- Get current month period (UTC baseline)
  v_month_start := date_trunc('month', now());
  v_period_start := v_month_start;
  
  -- Ensure usage row exists
  insert into usage (user_id, credits_used, credits_purchased, period_start, period_end)
  values (p_user_id, 0, 0, v_period_start, v_period_start + interval '1 month')
  on conflict (user_id, period_start) do nothing;
  
  -- Get current usage
  select credits_used 
  into v_credits_used
  from usage 
  where user_id = p_user_id and period_start = v_period_start;
  
  -- Atomic update of usage (reduce credits_used)
  update usage 
  set credits_used = greatest(0, credits_used - p_credits_to_rollback),
      updated_at = now()
  where user_id = p_user_id and period_start = v_period_start;
  
  -- Atomic update of users balance (increase credits_balance)
  update users
  set credits_balance = coalesce(credits_balance, 0) + p_credits_to_rollback,
      updated_at = now()
  where id = p_user_id
  returning credits_balance into v_credits_left;
  
  -- Insert transaction log
  insert into credit_transactions (
    user_id, 
    action_type, 
    credits_used, 
    credits_remaining, 
    metadata
  )
  values (
    p_user_id, 
    p_action_type, 
    -p_credits_to_rollback, 
    v_credits_left, 
    p_metadata || jsonb_build_object('rollback', true)
  );
  
  return json_build_object(
    'success', true,
    'credits_left', v_credits_left
  );
end;
$$ language plpgsql;

-- 1. Function trừ credits có kiểm tra số dư (Atomic Deduct)
CREATE OR REPLACE FUNCTION deduct_credits_atomic(
  p_user_id uuid, 
  p_amount numeric
)
RETURNS users AS $$
DECLARE
  result users;
BEGIN
  -- Thực hiện update trong một câu lệnh duy nhất để đảm bảo tính atomic
  UPDATE users 
  SET 
    credits_balance = credits_balance - p_amount, 
    updated_at = now()
  WHERE 
    id = p_user_id 
    AND credits_balance >= p_amount -- Guard: Chỉ trừ nếu đủ số dư
  RETURNING * INTO result;

  -- Nếu không tìm thấy row nào thỏa mãn (do id sai hoặc không đủ tiền)
  IF result IS NULL THEN
    RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 2. Function cộng lại credits (Atomic Add/Refund)
CREATE OR REPLACE FUNCTION add_credits_atomic(
  p_user_id uuid, 
  p_amount numeric
)
RETURNS users AS $$
DECLARE
  result users;
BEGIN
  UPDATE users 
  SET 
    credits_balance = credits_balance + p_amount, 
    updated_at = now()
  WHERE 
    id = p_user_id
  RETURNING * INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance optimization
create index if not exists idx_users_plan on users(plan);
create index if not exists idx_users_subscription_status on users(subscription_status);
create index if not exists idx_projects_user_id on projects(user_id);
create index if not exists idx_content_drafts_user_id on content_drafts(user_id);
create index if not exists idx_content_drafts_project_id on content_drafts(project_id);
create index if not exists idx_content_drafts_platform on content_drafts(platform);
create index if not exists idx_content_drafts_status on content_drafts(status);
create index if not exists idx_chat_messages_user_id on chat_messages(user_id);
create index if not exists idx_chat_messages_session_id on chat_messages(session_id);
create index if not exists idx_chat_messages_draft_id on chat_messages(draft_id);
-- Indexes for getlate_accounts
create index if not exists idx_getlate_accounts_is_active on getlate_accounts(is_active);
create index if not exists idx_getlate_accounts_api_key on getlate_accounts(api_key);

-- A. Timestamp Updater
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
create trigger update_getlate_accounts_updated_at before update on getlate_accounts for each row execute function update_updated_at_column();
create trigger update_getlate_profiles_updated_at before update on getlate_profiles for each row execute function update_updated_at_column();
create trigger update_connected_accounts_updated_at before update on connected_accounts for each row execute function update_updated_at_column();
create trigger update_usage_updated_at before update on usage for each row execute function update_updated_at_column();
create trigger update_monthly_usage_updated_at before update on monthly_usage for each row execute function update_updated_at_column();
create trigger update_subscriptions_updated_at before update on subscriptions for each row execute function update_updated_at_column();
create trigger update_scheduled_posts_updated_at before update on scheduled_posts for each row execute function update_updated_at_column();
create trigger update_jobs_updated_at before update on jobs for each row execute function update_updated_at_column();
create trigger update_plans_updated_at before update on plans for each row execute function update_updated_at_column();
create trigger update_coupons_updated_at before update on coupons for each row execute function update_updated_at_column();
create trigger update_orders_updated_at before update on orders for each row execute function update_updated_at_column();
create trigger update_processing_jobs_updated_at before update on processing_jobs for each row execute function update_updated_at_column();
create trigger update_video_factory_projects_updated_at before update on video_factory_projects for each row execute function update_updated_at_column();
create trigger update_video_factory_outputs_updated_at before update on video_factory_outputs for each row execute function update_updated_at_column();
create trigger update_video_factory_audio_transcripts_updated_at before update on video_factory_audio_transcripts for each row execute function update_updated_at_column();
create trigger update_job_steps_updated_at before update on job_steps for each row execute function update_updated_at_column();
create trigger update_external_tasks_updated_at before update on external_tasks for each row execute function update_updated_at_column();
create trigger update_global_stock_assets_updated_at before update on global_stock_assets for each row execute function update_updated_at_column();


-- B. User Profile Management (Auth Hook)
-- RPC function: ensure_user_profile
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
  v_month_start timestamptz;
  v_period_end timestamptz;
  v_plan text;
  v_plan_credits integer;
  v_credits_balance integer;
begin
  -- Create the user row if missing
  insert into users (id, name, avatar_url, plan, current_plan_slug, subscription_status, credits_balance)
  values (p_user_id, p_name, p_avatar_url, 'free', 'free', 'active', 10)
  on conflict (id) do nothing;

  -- Get user plan to set initial credits_balance
  select current_plan_slug into v_plan from users where id = p_user_id;
  
  -- Simple plan mapping (should align with plans table)
  if v_plan = 'creator' then v_plan_credits := 200;
  elsif v_plan = 'creator_pro' then v_plan_credits := 450;
  elsif v_plan = 'agency' then v_plan_credits := 1000;
  else v_plan_credits := 10; -- free
  end if;

  -- Initialize usage for current month
  v_month_start := date_trunc('month', now());
  v_period_end := v_month_start + interval '1 month';
  insert into usage (
    user_id, credits_used, credits_purchased, period_start, period_end
  )
  values (p_user_id, 0, 0, v_month_start, v_period_end)
  on conflict (user_id, period_start) do nothing;

  -- Sync credits_balance from usage table (fallback)
  update users
  set credits_balance = (
    select v_plan_credits + coalesce(credits_purchased, 0) - coalesce(credits_used, 0)
    from usage
    where user_id = p_user_id and period_start = v_month_start
    limit 1
  )
  where id = p_user_id and (credits_balance is null or credits_balance < 0);
  
  -- If credits_balance is still null, set to plan credits
  update users
  set credits_balance = v_plan_credits
  where id = p_user_id and credits_balance is null;
  
  -- Update last_login_at
  update users
  set last_login_at = now(),
      updated_at = now()
  where id = p_user_id;
  
  select credits_balance into v_credits_balance from users where id = p_user_id;
  return coalesce(v_credits_balance, 0);
end;
$$;
grant execute on function ensure_user_profile(uuid, text, text, text) to anon, authenticated, service_role;

-- C. Usage & Credit Management
create or replace function increment_usage(
  p_user_id uuid,
  p_month date,
  p_field text,
  p_amount int
) returns void as $$
begin
  insert into monthly_usage (user_id, month, projects_created, posts_created, scheduled_posts, images_generated, videos_generated)
  values (
    p_user_id, 
    p_month,
    case when p_field = 'projects_created' then p_amount else 0 end,
    case when p_field = 'posts_created' then p_amount else 0 end,
    case when p_field = 'scheduled_posts' then p_amount else 0 end,
    case when p_field = 'images_generated' then p_amount else 0 end,
    case when p_field = 'videos_generated' then p_amount else 0 end
  )
  on conflict (user_id, month) do update
  set 
    projects_created = case when p_field = 'projects_created' then monthly_usage.projects_created + p_amount else monthly_usage.projects_created end,
    posts_created = case when p_field = 'posts_created' then monthly_usage.posts_created + p_amount else monthly_usage.posts_created end,
    scheduled_posts = case when p_field = 'scheduled_posts' then monthly_usage.scheduled_posts + p_amount else monthly_usage.scheduled_posts end,
    images_generated = case when p_field = 'images_generated' then monthly_usage.images_generated + p_amount else monthly_usage.images_generated end,
    videos_generated = case when p_field = 'videos_generated' then monthly_usage.videos_generated + p_amount else monthly_usage.videos_generated end,
    updated_at = now();
end;
$$ language plpgsql;

create or replace function deduct_user_credits(
  p_user_id uuid,
  p_credits_to_deduct integer
) returns json as $$
declare
  v_credits_left integer;
begin
  -- Simple optimistic deduction from users table source of truth
  select credits_balance into v_credits_left from users where id = p_user_id;
  
  if v_credits_left is null then v_credits_left := 0; end if;
  
  if v_credits_left < p_credits_to_deduct then
    return json_build_object('success', false, 'reason', 'insufficient_credits', 'credits_left', v_credits_left);
  end if;
  
  update users
  set credits_balance = credits_balance - p_credits_to_deduct,
      updated_at = now()
  where id = p_user_id;
  
  -- Also update legacy usage table for basic tracking if needed (optional, can be deprecated)
  -- update usage set credits_used = credits_used + p_credits_to_deduct ...
  
  return json_build_object('success', true, 'credits_left', v_credits_left - p_credits_to_deduct);
end;
$$ language plpgsql;

create or replace function sync_user_credits_balance(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_credits_balance integer;
begin
  -- For now, just rely on ensure_user_profile logic or re-calculate. 
  -- Simplified placeholder to match existing interface
  perform ensure_user_profile(p_user_id);
end;
$$;


<<<<<<< HEAD
-- 4) Backfill: ensure existing auth users have public users row (safe, idempotent)
insert into users (id, plan, subscription_status)
select au.id, 'free', 'active'
from auth.users au
left join users u on u.id = au.id
where u.id is null;

-- ============================================
-- Content Niches, Goals, and Frameworks
-- ============================================

-- 1. Bảng Niches
create table if not exists niches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  description text
);

-- 2. Bảng Goals
create table if not exists content_goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  prompt_modifier_text text
);

-- 3. Bảng Frameworks (Quay về goal_ids UUID[])
create table if not exists frameworks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique,
  description text,
  icon_name text not null,
  goal_ids uuid[] default '{}'::uuid[],
  base_prompt_text text,
  placeholders text[] default '{}'::text[],
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 4. Bảng liên kết Framework - Niche
create table if not exists framework_niches (
  framework_id uuid references frameworks(id) on delete cascade,
  niche_id uuid references niches(id) on delete cascade,
  override_prompt_text text,
  primary key (framework_id, niche_id)
);


-- ============================================
-- Server B (JQM) - Processing Jobs Tables
-- ============================================
-- Tables for Server B job processing and media management
-- These tables are shared between Server A and Server B

-- ✅ CRITICAL: Create video_factory_projects FIRST (before processing_jobs and media_assets)
-- This is required because processing_jobs and media_assets have FK references to video_factory_projects
-- However, video_factory_projects also references processing_jobs and media_assets, so we need to:
-- 1. Create video_factory_projects without those FKs first
-- 2. Create processing_jobs and media_assets with project_id FK
-- 3. Add the remaining FKs to video_factory_projects using ALTER TABLE

-- Table: video_factory_audio_transcripts
-- ✅ NEW: Bảng chuyên lưu trữ audio + transcript + translate (trên cùng 1 bản ghi)
-- ✅ WRITE ONCE, READ MANY PRINCIPLE:
--    - Transcript và translations chỉ được ghi 1 lần (lần đầu thành công)
--    - Các lần sau CHỈ đọc để reuse, KHÔNG update/delete
--    - Điều này đảm bảo data consistency và tránh race conditions
-- 
-- ✅ REUSE OPTIMIZATION:
--    - Tránh duplicate data khi nhiều project dùng chung 1 source video
--    - Query theo source_media_asset_id để tìm existing transcript
--    - Tối ưu schema để normalize data storage
-- 
-- ✅ CASCADE DELETE BEHAVIOR:
--    - Source video deleted → audio deleted (parent_asset_id CASCADE) → transcript deleted (audio_media_asset_id CASCADE)
--    - Project deleted → audio_transcript_id set NULL (preserve shared resources)
--    - ⚠️ CRITICAL: Projects link to shared transcript via audio_transcript_id with ON DELETE SET NULL
--                   to prevent losing shared resources when one project is deleted
-- 
-- Design:
-- - Bảng này lưu audio + transcript + translate cho 1 source video
-- - Nhiều project có thể reference đến cùng 1 audio_transcript_id
-- - Cascade delete: source video → audio → audio_transcript
-- - Project delete: CHỈ xóa project record (audio_transcript_id ON DELETE SET NULL)
create table if not exists video_factory_audio_transcripts (
  id uuid primary key default gen_random_uuid(),
  -- ✅ CRITICAL: Link to audio asset in media_assets
  -- Audio asset chứa file audio đã extract từ source video
  -- Khi xóa audio asset → cascade xóa audio_transcript (on delete cascade)
  -- ⚠️ NOTE: media_assets table will be created later, so this FK will be added via ALTER TABLE
  audio_media_asset_id uuid not null,
  -- ✅ CRITICAL: Link to source video in media_assets (for efficient reuse queries)
  -- Khi xóa source video → cascade xóa audio (via parent_asset_id) → cascade xóa audio_transcript (via audio_media_asset_id)
  source_media_asset_id uuid,
  -- ✅ CRITICAL: audio_s3_uri lưu duy nhất ở đây (khi tách audio từ video gốc)
  -- Nhiều project có thể tái sử dụng → lấy audio_s3_uri từ audio_transcript_id
  -- Đảm bảo audio_s3_uri chỉ lưu 1 chỗ duy nhất (không duplicate)
  audio_s3_uri text not null,
  -- ✅ Transcript data (JSONB array of segments)
  -- Format: [{ startTime, endTime, text, speaker? }]
  transcript jsonb,
  -- ✅ Transcript source (where transcript came from)
  -- Values: 'aws_transcribe' | 'youtube' | 'gemini_asr'
  transcript_source text,
  -- ✅ NEW: Language of transcript (ISO 639-1 code)
  -- Purpose: Support multiple transcripts per source video (different languages)
  -- Default: 'vi' (Vietnamese) for backward compatibility
  language varchar(10) not null default 'vi',
  -- ✅ Translations (JSONB object: { language: [segments] })
  -- Format: { "en": [{ startTime, endTime, text }], "ja": [...], ... }
  translations jsonb default '{}'::jsonb,
  -- ✅ Metadata for tracking and debugging
  metadata jsonb default '{}'::jsonb,
  -- ✅ NEW: Soft delete support
  -- Purpose: Allow users to delete transcripts without losing data
  deleted_at timestamptz,
  -- ✅ NEW: Optimistic locking version field
  -- Purpose: Prevent lost updates in concurrent scenarios
  version integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- ✅ UNIQUE CONSTRAINT: One audio_transcript per audio_media_asset_id
  -- Đảm bảo không có duplicate audio_transcript cho cùng 1 audio asset
  constraint video_factory_audio_transcripts_audio_asset_unique unique (audio_media_asset_id)
);

-- Table: video_factory_projects
-- Stores Video Factory project information including transcript, source, and configuration
-- This allows users to view their Video Factory projects list and reuse transcripts
-- 
-- ✅ DESIGN: 
-- - Video ở media_assets → link qua source_media_asset_id (ON DELETE SET NULL to preserve project history)
-- - Audio + Transcript + Translate ở video_factory_audio_transcripts → link qua audio_transcript_id (reuse được cho nhiều project cùng source video)
-- 
-- ✅ CASCADE DELETE BEHAVIOR:
-- - Khi xóa SOURCE VIDEO trong media library:
--   1. Audio assets deleted (parent_asset_id CASCADE)
--   2. Audio transcripts deleted (audio_media_asset_id CASCADE)
--   3. Projects have source_media_asset_id and audio_transcript_id set NULL (preserve project history)
-- 
-- - Khi xóa PROJECT:
--   1. CHỈ xóa bản ghi project
--   2. KHÔNG xóa audio, transcript, translate (shared resources preserved)
--   3. KHÔNG xóa source video, clips, outputs
-- 
-- ⚠️ CRITICAL RISK MITIGATION:
--    - Multiple projects can share same source video / audio / transcript
--    - Use ON DELETE SET NULL for shared resources to prevent cascade deletion
--    - Use ON DELETE CASCADE only when deleting original source should delete all derived data
create table if not exists video_factory_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  -- NOTE: job_id CHỈ dùng để link trạng thái job gần nhất (history), KHÔNG phải nguồn sự thật cho audio/transcript/clips
  -- ✅ RULE: Khi user xóa processing_jobs (job history), KHÔNG được xóa project + transcript + audio + clips
  -- Do đó: dùng ON DELETE SET NULL thay vì ON DELETE CASCADE
  -- ⚠️ NOTE: processing_jobs table will be created later, so this FK will be added via ALTER TABLE
  job_id uuid,
  project_name text,
  source_type text not null check (source_type in ('youtube', 'upload')),
  source_url text not null,
  source_thumbnail_url text,
  source_duration_seconds integer,
  -- ✅ IMPROVEMENT: Link với video trong media_assets để query reuse hiệu quả
  -- Khi user chọn video từ media library → set source_media_asset_id
  -- Khi xóa video → cascade xóa project (on delete cascade)
  -- ⚠️ NOTE: media_assets table will be created later, so this FK will be added via ALTER TABLE
  source_media_asset_id uuid,
  -- ✅ NEW: Link với video_factory_audio_transcripts (chứa audio + transcript + translate)
  -- Nhiều project có thể reference đến cùng 1 audio_transcript_id (tránh duplicate data)
  -- Khi xóa project → CHỈ xóa project record (audio_transcript_id ON DELETE SET NULL)
  -- Khi xóa source video → cascade xóa audio → cascade xóa audio_transcript → audio_transcript_id set null
  audio_transcript_id uuid references video_factory_audio_transcripts(id) on delete set null,
  -- ⚠️ DEPRECATED: Các columns sau sẽ được remove sau migration
  -- audio_media_asset_id, transcript, transcript_source → dùng audio_transcript_id thay thế
  -- audio_s3_uri → lấy từ video_factory_audio_transcripts.audio_s3_uri qua audio_transcript_id
  -- ⚠️ NOTE: media_assets table will be created later, so this FK will be added via ALTER TABLE
  audio_media_asset_id uuid,
  -- ⚠️ REMOVED: audio_s3_uri column (xóa khỏi video_factory_projects - lấy từ video_factory_audio_transcripts.audio_s3_uri qua audio_transcript_id)
  -- Note: Column đã được xóa khỏi schema - lấy audio_s3_uri từ video_factory_audio_transcripts.audio_s3_uri qua audio_transcript_id
  transcript jsonb, -- ⚠️ DEPRECATED: Use audio_transcript_id instead (duplicate từ audio_transcript.transcript)
  transcript_source text, -- ⚠️ DEPRECATED: Use audio_transcript_id instead (duplicate từ audio_transcript.transcript_source)
  cut_config jsonb, -- Cut configuration: { method: 'auto' | 'manual', auto?: {...}, manual?: [...] }
  postprod_config jsonb, -- Post-production config: { auto_captions, broll, background_music, transitions, ... }
  output_clips jsonb, -- Generated clips: [{ id, url, thumbnail, duration, startTime, endTime, ... }]
  -- ✅ HYBRID STRATEGY: Snapshot of the LATEST post-process output clips for quick access
  postprocess_output_clips jsonb default '[]'::jsonb,
  final_video_url text, -- Final merged video URL
  -- ✅ OPTIMIZATION: Thumbnail URL for the final concatenated video or representative clip
  final_thumbnail_url text,
  status text not null default 'processing' check (status in ('draft', 'cutting', 'ready', 'processing_post', 'completed', 'processing', 'failed')),
  -- ✅ PROJECT-CENTRIC: Link to current cut job (one project = one cut job)
  -- ⚠️ NOTE: processing_jobs table will be created later, so this FK will be added via ALTER TABLE
  current_cut_job_id uuid,
  -- ✅ PROJECT-CENTRIC: Link to current processing job (cut or postprocess job currently being processed)
  -- This allows FE to track active jobs and display progress correctly
  -- ⚠️ NOTE: processing_jobs table will be created later, so this FK will be added via ALTER TABLE
  current_processing_job_id uuid,
  -- ✅ BACKGROUND PROCESSING: Snapshot of input data when job starts (for worker recovery)
  input_snapshot jsonb,
  
  -- ✅ ATOMIC UPDATE TRACKING
  expected_output_clip_count INTEGER DEFAULT 0,
  completed_clips INTEGER DEFAULT 0,
  failed_clips INTEGER DEFAULT 0,
  job_history_version INTEGER DEFAULT 0,
  finalized_at TIMESTAMP WITH TIME ZONE,

  constraint check_completion_bounds CHECK (completed_clips + failed_clips <= expected_output_clip_count),

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Table: processing_jobs
-- Core table for all processing jobs (image generation, video generation, video processing, etc.)
create table if not exists processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  job_type text not null,
  status text not null default 'queued',
  priority integer default 0,
  input_data jsonb not null,
  output_data jsonb,
  error_message text,
  progress integer default 0 check (progress >= 0 and progress <= 100),
  progress_message text,
  aws_mediaconvert_job_id text,
  estimated_completion_time timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  -- Liveness fields for job lifecycle correctness
  -- These are used by Server B (JQM) to track zombie jobs and abandoned jobs
  last_progress_at timestamptz, -- Updated when a step makes progress
  last_heartbeat_at timestamptz, -- Updated by workers/pollers to signal liveness
  abandon_reason text, -- Reason if job was marked as abandoned
  -- ✅ IMPROVEMENT 1: Job-level timeout fields
  timeout_at timestamptz, -- Absolute deadline for job completion
  max_duration_sec integer default 28800, -- Maximum duration in seconds (default: 8 hours for video_factory)
  -- ✅ PROJECT-CENTRIC: Link to video_factory_projects (all jobs belong to a project)
  project_id uuid references video_factory_projects(id) on delete cascade,
  -- ✅ PROJECT-CENTRIC: Subtype for video_factory jobs ('cut' | 'postprocess')
  job_subtype text check (job_subtype is null or job_subtype in ('cut', 'postprocess')),
  -- ✅ NEW: Optimistic locking version field (Date: 2026-01-13)
  -- Purpose: Prevent lost updates in concurrent scenarios using Compare-And-Swap (CAS)
  version integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  constraint processing_jobs_status_check check (
    -- IMPORTANT: Include 'abandoned' for system-marked zombie jobs
    status in ('queued', 'processing', 'completed', 'failed', 'cancelled', 'abandoned')
  ),
  constraint processing_jobs_job_type_check check (
    job_type in (
      'image_generation', 
      'video_generation', 
      'video_factory',
      'video_cut', 
      'video_merge', 
      'video_subtitle', 
      'video_translate', 
      'video_download', 
      'video_transcode',
      'video_add_brolls',
      'video_add_music',
      'video_add_logo',
      'audio_extract', 
      'audio_merge',
      'audio_transcribe',
      'file_upload',
      'file_optimize'
    )
  )
);

-- Indexes for processing_jobs
create index if not exists idx_processing_jobs_user_id on processing_jobs(user_id);
create index if not exists idx_processing_jobs_status on processing_jobs(status);
create index if not exists idx_processing_jobs_job_type on processing_jobs(job_type);
create index if not exists idx_processing_jobs_created_at on processing_jobs(created_at);
create index if not exists idx_processing_jobs_priority_status on processing_jobs(priority desc, status, created_at);
create index if not exists idx_processing_jobs_user_status on processing_jobs(user_id, status, created_at desc);
create index if not exists idx_processing_jobs_aws_job_id on processing_jobs(aws_mediaconvert_job_id) where aws_mediaconvert_job_id is not null;
-- Index to support zombie job detection by liveness fields
create index if not exists idx_processing_jobs_liveness 
  on processing_jobs(status, last_progress_at, last_heartbeat_at, updated_at)
  where status in ('queued', 'processing');

-- ✅ IMPROVEMENT 1: Index for timeout detection
create index if not exists idx_processing_jobs_timeout 
  on processing_jobs(status, timeout_at) 
  where status in ('queued', 'processing') and timeout_at is not null;

-- ✅ OPTIMIZATION: Indexes for video factory postprocess mode queries
-- These indexes improve query performance when filtering jobs by mode or cut_job_id
-- Note: These are optional performance optimizations. The system works without them,
-- but queries may be slower when filtering by JSONB fields.
create index if not exists idx_processing_jobs_mode 
on processing_jobs((input_data->>'mode'))
where job_type = 'video_factory' and input_data->>'mode' is not null;

create index if not exists idx_processing_jobs_cut_job_id 
on processing_jobs((input_data->>'cut_job_id'))
where job_type = 'video_factory' and input_data->>'cut_job_id' is not null;

create index if not exists idx_processing_jobs_postprocess_cut_status 
on processing_jobs((input_data->>'cut_job_id'), status, created_at desc)
where job_type = 'video_factory' 
  and input_data->>'mode' = 'postprocess' 
  and input_data->>'cut_job_id' is not null;

-- ✅ PROJECT-CENTRIC: Indexes for project_id and job_subtype
create index if not exists idx_processing_jobs_project_id 
on processing_jobs(project_id) 
where project_id is not null;

create index if not exists idx_processing_jobs_project_subtype 
on processing_jobs(project_id, job_subtype, status, created_at desc) 
where job_type = 'video_factory' and project_id is not null and job_subtype is not null;

create index if not exists idx_processing_jobs_subtype 
on processing_jobs(job_subtype, status, created_at desc) 
where job_type = 'video_factory' and job_subtype is not null;

-- ✅ Index for optimistic locking version checks (Date: 2026-01-13)
create index if not exists idx_processing_jobs_version 
on processing_jobs(id, version);

-- Table: media_assets
-- Media files storage metadata (images, videos, audio, documents)
-- Used for media library and asset management
-- ============================================
-- AI Video Production Pipeline
-- ============================================


create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  job_id uuid references processing_jobs(id) on delete set null,
  asset_type text not null,
  source_type text not null default 'uploaded',
  origin text,
  storage_type text not null default 's3',
  storage_bucket text not null,
  storage_key text not null,
  public_url text not null,
  thumbnail_url text,
  thumbnail_key text, -- ✅ NEW: S3 key for thumbnail (for Asset Gateway) - allows direct S3 key lookup without parsing URLs
  file_size bigint,
  mime_type text,
  duration integer,
  width integer,
  height integer,
  checksum text,
  metadata jsonb default '{}'::jsonb,
  -- ✅ PROJECT-CENTRIC: Link to video_factory_projects (all assets belong to a project)
  project_id uuid references video_factory_projects(id) on delete set null,
  ai_video_project_id uuid references ai_video_projects(id) on delete set null,
  -- ✅ CRITICAL: Link to parent asset (source video) for processed assets (audio, transcript, etc.)
  -- Example: Audio asset extracted from video → parent_asset_id = source video asset ID
  -- This enables efficient reuse queries and proper linking to original source
  -- ✅ CASCADE DELETE: When source video is deleted, delete all derived assets (audio, translate, etc.)
  -- Audio assets are always derived from a specific source video, so safe to cascade delete
  parent_asset_id uuid references media_assets(id) on delete cascade,
  -- ✅ NEW: Optimistic locking version field (Date: 2026-01-13)
  -- Purpose: Prevent lost updates in concurrent scenarios using Compare-And-Swap (CAS)
  version integer not null default 0,
  created_at timestamptz default now(),
  
  constraint media_assets_asset_type_check check (
    asset_type in ('image', 'video', 'audio', 'document')
  ),
  constraint media_assets_storage_type_check check (
    -- Note: 'supabase' is reserved for future use, currently code only uses 's3' | 'url'
    storage_type in ('supabase', 's3', 'url')
  ),
  constraint media_assets_source_type_check check (
    source_type in ('uploaded', 'ai_generated', 'processed')
  )
);

-- Indexes for media_assets
create index if not exists idx_media_assets_user_id on media_assets(user_id);
create index if not exists idx_media_assets_job_id on media_assets(job_id);
create index if not exists idx_media_assets_asset_type on media_assets(asset_type);
create index if not exists idx_media_assets_created_at on media_assets(created_at);
create index if not exists idx_media_assets_user_type on media_assets(user_id, asset_type, created_at desc);
create index if not exists idx_media_assets_storage_key on media_assets(storage_bucket, storage_key);
create index if not exists idx_media_assets_source_type on media_assets(source_type);
-- ✅ PROJECT-CENTRIC: Indexes for project_id
create index if not exists idx_media_assets_project_id on media_assets(project_id) where project_id is not null;
create index if not exists idx_media_assets_ai_video_project_id on media_assets(ai_video_project_id) where ai_video_project_id is not null;
create index if not exists idx_media_assets_project_type on media_assets(project_id, asset_type, created_at desc) where project_id is not null;
-- ✅ CRITICAL: Index for parent_asset_id (for efficient reuse queries)
-- Enables fast lookup of audio assets linked to source video
create index if not exists idx_media_assets_parent_asset_id on media_assets(parent_asset_id) where parent_asset_id is not null;
create index if not exists idx_media_assets_parent_asset_type on media_assets(parent_asset_id, asset_type, created_at desc) where parent_asset_id is not null;
-- ✅ OPTIMIZATION: GIN index for metadata JSONB field (ETag deduplication)
-- Enables fast lookup by ETag for file deduplication and reuse
-- Use: WHERE metadata->>'etag' = 'some-etag' (10-50x faster with index)
create index if not exists idx_media_assets_metadata_gin 
on media_assets using gin(metadata);

-- ✅ Index for optimistic locking version checks (Date: 2026-01-13)
create index if not exists idx_media_assets_version 
on media_assets(id, version);

-- ✅ CRITICAL: Unique constraint to prevent race condition (Date: 2026-01-14)
-- Prevents duplicate assets when multiple jobs process same source video
-- Enables UPSERT pattern: INSERT ... ON CONFLICT DO UPDATE
do $$ begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'media_assets_user_storage_key_unique'
      and conrelid = 'media_assets'::regclass
  ) then
    alter table media_assets 
    add constraint media_assets_user_storage_key_unique 
    unique (user_id, storage_key);
    
    comment on constraint media_assets_user_storage_key_unique on media_assets is 
      'Ensures one asset per storage_key per user. Enables UPSERT pattern to prevent race conditions.';
  end if;
end $$;

-- ============================================
-- ✅ CRITICAL: video_factory_audio_transcripts FK constraints (CASCADE DELETE)
-- ============================================
-- All FKs from video_factory_audio_transcripts use ON DELETE CASCADE
-- to delete transcripts when audio or source video is deleted
-- This ensures data integrity: no orphaned transcripts
do $$ begin
  -- ✅ FK 1: audio_media_asset_id → media_assets(id) ON DELETE CASCADE
  -- REASON: When audio asset is deleted, transcript should also be deleted
  -- Transcripts are meaningless without their audio
  if not exists (
    select 1 from pg_constraint 
    where conname = 'video_factory_audio_transcripts_audio_media_asset_id_fkey'
  ) then
    alter table video_factory_audio_transcripts
      add constraint video_factory_audio_transcripts_audio_media_asset_id_fkey
      foreign key (audio_media_asset_id) references media_assets(id) on delete cascade;
  end if;
  
  -- ✅ FK 2: source_media_asset_id → media_assets(id) ON DELETE CASCADE
  -- REASON: When source video is deleted, transcript should also be deleted
  -- This provides additional cleanup path: video → transcript (direct)
  -- Combined with: video → audio → transcript (via audio_media_asset_id)
  if not exists (
    select 1 from pg_constraint 
    where conname = 'video_factory_audio_transcripts_source_media_asset_id_fkey'
  ) then
    alter table video_factory_audio_transcripts
      add constraint video_factory_audio_transcripts_source_media_asset_id_fkey
      foreign key (source_media_asset_id) references media_assets(id) on delete cascade;
  end if;
end $$;

-- Table: video_processing_configs
-- Configuration for video processing operations
create table if not exists video_processing_configs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references processing_jobs(id) on delete cascade,
  operation_type text not null,
  config jsonb not null,
  created_at timestamptz default now(),
  
  constraint video_processing_configs_operation_type_check check (
    operation_type in ('cut', 'merge', 'subtitle', 'translate', 'transcode', 'add_brolls', 'add_music', 'add_logo')
  )
);

-- Indexes for video_processing_configs
create index if not exists idx_video_processing_configs_job_id on video_processing_configs(job_id);
create index if not exists idx_video_processing_configs_operation_type on video_processing_configs(operation_type);


-- ============================================
-- ✅ CRITICAL: Indexes for video_factory_audio_transcripts (TRANSCRIPT REUSE OPTIMIZATION)
-- Date: 2026-01-11
-- Purpose: Performance indexes for efficient transcript reuse queries
-- Impact: 100-1000x faster reuse queries
-- ============================================

-- ✅ PRIMARY REUSE INDEX: source_media_asset_id (CRITICAL for reuse queries)
-- Enables fast lookup: "Find existing transcript for this source video"
-- Used by: TranscriptReuseService.findReusableTranscript()
-- Query: WHERE source_media_asset_id = 'uuid'
create index if not exists idx_video_factory_audio_transcripts_source_media_asset_id 
on video_factory_audio_transcripts(source_media_asset_id) 
where source_media_asset_id is not null;

-- ✅ UNIQUE INDEX: audio_media_asset_id (CRITICAL for data integrity)
-- Ensures one transcript per audio asset (enforces Write Once, Read Many)
-- Used by: Foreign key constraint + idempotency checks
-- Query: WHERE audio_media_asset_id = 'uuid'
create unique index if not exists idx_video_factory_audio_transcripts_audio_media_asset_id 
on video_factory_audio_transcripts(audio_media_asset_id);

-- ✅ LEGACY INDEX: source_asset (deprecated, kept for backwards compatibility)
-- Use idx_video_factory_audio_transcripts_source_media_asset_id instead
create index if not exists idx_video_factory_audio_transcripts_source_asset 
on video_factory_audio_transcripts(source_media_asset_id) 
where source_media_asset_id is not null;

-- ✅ LEGACY INDEX: audio_asset (deprecated, use unique index above instead)
create index if not exists idx_video_factory_audio_transcripts_audio_asset 
on video_factory_audio_transcripts(audio_media_asset_id);

-- ✅ OPTIMIZATION: audio_s3_uri (for quick lookup without join)
-- Enables fast lookup by S3 URI without joining media_assets table
create index if not exists idx_video_factory_audio_transcripts_audio_s3_uri 
on video_factory_audio_transcripts(audio_s3_uri) 
where audio_s3_uri is not null;

-- ✅ COMPOSITE INDEX: source + transcript existence (for reuse eligibility check)
-- Enables fast query: "Find transcripts ready for reuse (has data)"
-- Used by: Reuse eligibility checks
create index if not exists idx_video_factory_audio_transcripts_source_transcript 
on video_factory_audio_transcripts(source_media_asset_id) 
where source_media_asset_id is not null and transcript is not null;

-- ✅ PERFORMANCE INDEX: created_at (for cleanup and analytics)
-- Enables fast query: "Find old transcripts for cleanup"
create index if not exists idx_video_factory_audio_transcripts_created_at 
on video_factory_audio_transcripts(created_at desc);

-- ✅ COMPOSITE INDEX: source + created_at (for finding latest transcript)
-- Enables fast query: "Find most recent transcript for this source video"
-- Used by: Reuse service to find latest successful transcription
create index if not exists idx_video_factory_audio_transcripts_source_created 
on video_factory_audio_transcripts(source_media_asset_id, created_at desc) 
where source_media_asset_id is not null;

-- ✅ CRITICAL: Partial unique index for soft delete support
-- Prevents duplicate transcripts for same source video + language (only for active records)
-- Date: 2026-01-13
create unique index if not exists uq_source_lang_active 
on video_factory_audio_transcripts(source_media_asset_id, language) 
where deleted_at is null;

-- ✅ Index for optimistic locking version checks
create index if not exists idx_video_factory_audio_transcripts_version 
on video_factory_audio_transcripts(id, version);

-- Trigger for video_factory_audio_transcripts updated_at
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'update_video_factory_audio_transcripts_updated_at') then
    create trigger update_video_factory_audio_transcripts_updated_at before update on video_factory_audio_transcripts
      for each row execute function update_updated_at_column();
  end if;
end $$;

-- ============================================
-- ✅ CRITICAL: Comments for video_factory_audio_transcripts (TRANSCRIPT REUSE OPTIMIZATION)
-- Date: 2026-01-11
-- ============================================

comment on table video_factory_audio_transcripts is 
  '✅ WRITE ONCE, READ MANY PRINCIPLE: Stores audio + transcript + translate data for video factory projects. One record per audio asset (extracted from source video). Multiple projects can reference the same audio_transcript_id to avoid duplicate data and AWS Transcribe costs. 
  
  ✅ REUSE FLOW: 
  1. Worker checks if source_media_asset_id already has transcript (query uses indexed source_media_asset_id)
  2. If found → reuse existing transcript (80-90% cost savings on AWS Transcribe)
  3. If not found → create new transcript → save with source_media_asset_id for future reuse
  
  ✅ CASCADE DELETE BEHAVIOR: 
  - When source video deleted → audio deleted (parent_asset_id CASCADE) → transcript deleted (audio_media_asset_id CASCADE)
  - When project deleted → only project record deleted (audio_transcript_id ON DELETE SET NULL to preserve shared resources)
  
  ✅ IDEMPOTENCY: 
  - One transcript per audio_media_asset_id (unique constraint)
  - Worker checks existing transcript before creating duplicate
  - Retry-safe: failed transcription can be retried without creating duplicates
  
  ✅ INDEXES: 
  - idx_video_factory_audio_transcripts_source_media_asset_id (CRITICAL for reuse queries, 100-1000x faster)
  - idx_video_factory_audio_transcripts_audio_media_asset_id (UNIQUE, prevents duplicates)';

comment on column video_factory_audio_transcripts.audio_media_asset_id is 
  '✅ FOREIGN KEY: Link to audio asset in media_assets table. Audio asset contains the extracted audio file. 
  ✅ UNIQUE CONSTRAINT: Ensures one transcript per audio asset (idempotency).
  ✅ CASCADE DELETE: When audio asset is deleted → audio_transcript is deleted (on delete cascade).';

comment on column video_factory_audio_transcripts.source_media_asset_id is 
  '✅ CRITICAL FOR REUSE: Link to source video in media_assets table. This is the PRIMARY KEY for transcript reuse queries.
  ✅ REUSE QUERY: Worker queries "WHERE source_media_asset_id = ?" to find existing transcripts (uses indexed column for 100-1000x performance).
  ✅ CASCADE DELETE: When source video is deleted → audio is deleted (via parent_asset_id CASCADE) → audio_transcript is deleted (via audio_media_asset_id CASCADE).
  ✅ NULL HANDLING: If NULL, transcript cannot be reused (orphaned data). Migration script backfills NULLs from audio.parent_asset_id.
  ✅ INDEX: idx_video_factory_audio_transcripts_source_media_asset_id (CRITICAL for reuse performance).';

comment on column video_factory_audio_transcripts.audio_s3_uri is 
  '✅ SINGLE SOURCE OF TRUTH: S3 URI của audio đã extract từ video gốc. Lưu duy nhất ở đây (không duplicate). Nhiều project có thể tái sử dụng → lấy audio_s3_uri từ audio_transcript_id.';

comment on column video_factory_audio_transcripts.transcript is 
  '✅ WRITE ONCE, READ MANY: Transcript segments (JSONB array). Format: [{ startTime, endTime, text, speaker? }]. 
  ✅ REUSE: Stored here (not in audio.metadata) to enable sharing across multiple projects using same source video.
  ✅ IDEMPOTENCY: Once written (first successful transcription), should only be read for reuse, never updated/deleted.
  ✅ RETRY SAFE: Worker checks if transcript.length > 0 before overwriting (allows retry on initial failure).';

comment on column video_factory_audio_transcripts.transcript_source is 
  '✅ TRANSCRIPT SOURCE: Where transcript came from. Values: aws_transcribe | youtube | gemini_asr. Used for analytics and debugging.';

comment on column video_factory_audio_transcripts.translations is 
  '✅ WRITE ONCE, READ MANY: Translations of transcript (JSONB object). Format: { "en": [{ startTime, endTime, text }], "ja": [...], ... }. 
  ✅ REUSE: Stored here (not in audio.metadata) to enable sharing across multiple projects using same source video.
  ✅ IDEMPOTENCY: Each language translation should only be written once (first successful translation), then only read for reuse.
  ✅ ATOMIC UPDATE: Use upsert_translation() RPC function to prevent race conditions when multiple workers translate to different languages.
  ✅ RETRY SAFE: Worker checks if translations[language].length > 0 before overwriting (allows retry on initial failure).';

-- Disable RLS for video_factory_audio_transcripts
alter table video_factory_audio_transcripts disable row level security;


-- Indexes for video_factory_projects
create index if not exists idx_video_factory_projects_user_id on video_factory_projects(user_id);
create index if not exists idx_video_factory_projects_job_id on video_factory_projects(job_id);
create index if not exists idx_video_factory_projects_status on video_factory_projects(status);
create index if not exists idx_video_factory_projects_created_at on video_factory_projects(created_at desc);
create index if not exists idx_video_factory_projects_user_status on video_factory_projects(user_id, status, created_at desc);
-- ✅ PROJECT-CENTRIC: Index for current_cut_job_id
create index if not exists idx_video_factory_projects_cut_job on video_factory_projects(current_cut_job_id) where current_cut_job_id is not null;
-- ✅ PROJECT-CENTRIC: Index for current_processing_job_id (for active job tracking)
create index if not exists idx_video_factory_projects_processing_job on video_factory_projects(current_processing_job_id) where current_processing_job_id is not null;
-- ✅ IMPROVEMENT: Indexes for efficient reuse queries
-- Index để query project có audio/transcript theo source video trong media library
create index if not exists idx_video_factory_projects_source_asset 
on video_factory_projects(source_media_asset_id) 
where source_media_asset_id is not null;
-- Index để query project có audio asset (reuse audio_media_asset_id)
create index if not exists idx_video_factory_projects_audio_asset 
on video_factory_projects(source_media_asset_id, audio_media_asset_id) 
where audio_media_asset_id is not null;
-- ✅ FIX: Index chỉ trên source_media_asset_id (không index transcript vì quá lớn)
-- Index để query project có transcript (reuse transcript)
-- NOTE: Không index transcript column vì JSONB lớn (>8KB) vượt quá index size limit (8191 bytes)
-- Query có thể dùng WHERE transcript IS NOT NULL mà không cần index trên transcript
create index if not exists idx_video_factory_projects_transcript 
on video_factory_projects(source_media_asset_id) 
where transcript is not null;
-- ✅ OPTIMIZATION: Index for hash-based unique constraint (prevent duplicate projects)
create index if not exists idx_video_factory_projects_hashes
on video_factory_projects(user_id, source_url_hash, cut_config_hash);
-- ✅ OPTIMIZATION: Unique constraint to prevent duplicate projects
-- Prevents race condition when creating projects with same source + cut config
create unique index if not exists unique_user_source_cut_config
on video_factory_projects(user_id, source_url_hash, cut_config_hash);

-- ✅ Index for optimistic locking version checks (Date: 2026-01-13)
create index if not exists idx_video_factory_projects_version 
on video_factory_projects(id, version);

-- ✅ CRITICAL: Unique index on current_processing_job_id (Date: 2026-01-18)
-- Purpose: Prevent duplicate job assignments (ghost project prevention)
-- Ensures only ONE project can have a specific postprocess job ID
-- Prevents race conditions where multiple projects claim same job
create unique index if not exists idx_video_factory_projects_current_processing_job_id 
on video_factory_projects(current_processing_job_id) 
where current_processing_job_id is not null;

-- Table: video_factory_outputs
-- ✅ NEW: Stores multiple final video outputs from postprocess jobs linked to a cut job
-- Purpose: Allow users to create multiple postprocess jobs from the same cut job
--          and view all outputs associated with the original cut job
-- 
-- Design:
-- - cut_job_id: Links to the original cut job (processing_jobs.id)
-- - postprocess_job_id: Links to the postprocess job that created this output (processing_jobs.id)
-- - final_video_url: Final merged video URL from postprocess job
-- - postprod_config: Post-production config used (captions, b-roll, etc.)
-- - selected_clip_keys: Clips that were selected for this postprocess run
-- - status: Status of the output (processing, completed, failed)
-- ✅ CRITICAL: Remove legacy unique constraint to enable multiple clips per job
DROP INDEX IF EXISTS video_factory_outputs_postprocess_job_unique;

create table if not exists video_factory_outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  -- ✅ CRITICAL: Link to original cut job (the source of clips)
  cut_job_id uuid not null references processing_jobs(id) on delete cascade,
  -- ✅ CRITICAL: Link to postprocess job that created this output
  postprocess_job_id uuid not null references processing_jobs(id) on delete set null,
  -- ✅ PROJECT-CENTRIC: Link to video_factory_projects (all outputs belong to a project)
  project_id uuid references video_factory_projects(id) on delete cascade,
  -- Final video output
  final_video_url text,
  final_video_key text, -- S3 key for final video (for Asset Gateway)
  thumbnail_url text,
  thumbnail_key text, -- S3 key for thumbnail (for Asset Gateway)
  -- Post-production configuration used
  postprod_config jsonb, -- { auto_captions, broll, caption_style, etc. }
  -- Clips that were selected for this postprocess run
  selected_clip_keys text[], -- Array of clip keys/IDs that were processed
  -- ✅ NEW: Store physical UUIDs for robust retry
  selected_cut_clip_ids text[],
  -- Status tracking
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  -- Metadata
  duration_seconds integer, -- Final video duration
  file_size bigint, -- Final video file size in bytes
  -- ✅ DATA SEPARATION: Link back to original cut clip
  parent_cut_clip_id uuid,
  -- ✅ NEW: Explicit thumbnail for postprocessed result (distinct from cut clip)
  final_thumbnail_url text,
  -- ✅ OPTIMIZATION: Index of the clip within the post-process job (0 for first clip, -1 for final concat)
  clip_index integer,
  metadata jsonb default '{}'::jsonb, -- Additional metadata (render_mode, etc.)
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- ✅ DATA INTEGRITY: Ensure unique clip index per postprocess job
  constraint uq_vfo_job_clip_index unique (postprocess_job_id, clip_index)
);

-- Table: video_factory_job_history
-- ✅ JOB HISTORY ARCHITECTURE: Persistent storage for completed/failed jobs
-- Decouples history from transient processing_jobs table
create table if not exists video_factory_job_history (
    id uuid primary key, -- Maps to original processing_jobs.id
    project_id uuid not null references video_factory_projects(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    job_type varchar(50) not null, -- e.g. 'video_factory'
    job_subtype varchar(50), -- e.g. 'cut', 'postprocess'
    status varchar(50) not null, -- 'completed', 'failed', 'cancelled'
    config jsonb default '{}'::jsonb, -- Snapshot of input_data
    result jsonb default '{}'::jsonb, -- Snapshot of output_data / clips
    error_message text,
    created_at timestamptz not null,
    finished_at timestamptz default now()
);

-- Index for fast history listing by project
create index if not exists idx_vfjh_project_subtype_created 
on video_factory_job_history(project_id, job_subtype, created_at desc);

-- Indexes for video_factory_outputs
create index if not exists idx_video_factory_outputs_user_id on video_factory_outputs(user_id);
create index if not exists idx_video_factory_outputs_cut_job_id on video_factory_outputs(cut_job_id);
create index if not exists idx_video_factory_outputs_postprocess_job_id on video_factory_outputs(postprocess_job_id);
create index if not exists idx_video_factory_outputs_status on video_factory_outputs(status);
create index if not exists idx_video_factory_outputs_created_at on video_factory_outputs(created_at desc);
-- ✅ OPTIMIZATION: Index for faster sorting in Gallery
create index if not exists idx_vfo_gallery_sort on video_factory_outputs(postprocess_job_id, clip_index);
-- ✅ CRITICAL: Index for querying all outputs from a cut job (main use case)
create index if not exists idx_video_factory_outputs_cut_status 
on video_factory_outputs(cut_job_id, status, created_at desc);
-- ✅ PROJECT-CENTRIC: Indexes for project_id
create index if not exists idx_video_factory_outputs_project_id 
on video_factory_outputs(project_id, created_at desc) 
where project_id is not null;
create index if not exists idx_video_factory_outputs_project_status 
on video_factory_outputs(project_id, status, created_at desc) 
where project_id is not null;

-- ✅ INDEX for parent_cut_clip_id (for efficient lookups)
create index if not exists idx_video_factory_outputs_parent_cut_clip_id 
on video_factory_outputs(parent_cut_clip_id);

-- Trigger for video_factory_outputs updated_at
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'update_video_factory_outputs_updated_at') then
    create trigger update_video_factory_outputs_updated_at before update on video_factory_outputs
      for each row execute function update_updated_at_column();
  end if;
end $$;

-- ============================================
-- AI Video Production Pipeline
-- ============================================


/**
 * AI Video Projects Table
 */
create table if not exists ai_video_projects (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    project_name text,
    project_type text not null, -- 'text-to-video', 'image-to-video', 'video-to-video'
    
    -- Production Status & Progress
    status text default 'INIT', -- INIT, ANALYZING, PLANNING, GENERATING_CHARACTER, GENERATING_SCENES, STITCHING, DONE, FAILED
    progress integer default 0, -- 0-100%
    
    -- Inherent inputs (Extensible)
    source_type text, -- 'prompt', 'image', 'video'
    source_url text, -- Original input URL if applicable
    source_media_asset_id uuid references media_assets(id) on delete set null,
    
    -- Master Configuration (JSONB)
    -- Contains: orchestration, characterProfile, scenes[], userInput
    config_data jsonb default '{}'::jsonb,
    
    -- Production Results
    final_video_url text,
    final_video_s3_key text,
    final_thumbnail_url text,
    final_thumbnail_s3_key text,
    
    -- Error Handling & Metadata
    error_details jsonb,
    metadata jsonb default '{}'::jsonb,
    
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Comments for documentation
comment on column ai_video_projects.config_data is 'Massive JSONB containing the production pipeline state: orchestration (script), characterProfile, scenes (segments), and original userInput parameters.';
comment on column ai_video_projects.status is 'Current production stage: INIT, ANALYZING, PLANNING, GENERATING_CHARACTER, GENERATING_SCENES, STITCHING, DONE, FAILED.';
comment on column ai_video_projects.final_thumbnail_url is 'URL to the thumbnail image of the final stitched video';
comment on column ai_video_projects.final_thumbnail_s3_key is 'S3 storage key for the final video thumbnail (allows secure proxying)';

-- Indexes for performance
create index if not exists idx_ai_video_projects_user_id on ai_video_projects(user_id);
create index if not exists idx_ai_video_projects_status on ai_video_projects(status);
create index if not exists idx_ai_video_projects_type on ai_video_projects(project_type);

alter table ai_video_projects enable row level security;

-- Policies for ai_video_projects
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ai_video_projects' AND policyname = 'Users can view their own AI projects'
    ) THEN
        CREATE POLICY "Users can view their own AI projects" 
        ON ai_video_projects FOR SELECT 
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ai_video_projects' AND policyname = 'Users can create their own AI projects'
    ) THEN
        CREATE POLICY "Users can create their own AI projects" 
        ON ai_video_projects FOR INSERT 
        WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ai_video_projects' AND policyname = 'Users can update their own AI projects'
    ) THEN
        CREATE POLICY "Users can update their own AI projects" 
        ON ai_video_projects FOR UPDATE 
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ai_video_projects' AND policyname = 'Users can delete their own AI projects'
    ) THEN
        CREATE POLICY "Users can delete their own AI projects" 
        ON ai_video_projects FOR DELETE 
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- Trigger for updated_at
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'update_ai_video_projects_updated_at') then
    create trigger update_ai_video_projects_updated_at before update on ai_video_projects
      for each row execute function update_updated_at_column();
  end if;
end $$;


-- ✅ ARCHITECTURAL FIX: Explicitly disable RLS for video_factory_outputs
-- Workers use SERVICE ROLE KEY which bypasses RLS, but we disable RLS explicitly
-- to prevent any policy conflicts or accidental RLS enablement
alter table video_factory_outputs disable row level security;

-- Add comments for video_factory_outputs documentation
comment on table video_factory_outputs is 
  'Stores multiple final video outputs from postprocess jobs linked to a cut job. Allows users to create multiple postprocess jobs from the same cut job and view all outputs.';

comment on column video_factory_outputs.cut_job_id is 
  'Link to original cut job (the source of clips). All outputs from postprocess jobs created from this cut job will have the same cut_job_id.';

comment on column video_factory_outputs.postprocess_job_id is 
  'Link to postprocess job that created this output. Supports multiple outputs per postprocess job (One-to-Many).';

comment on column video_factory_outputs.final_video_url is 
  'Final merged video URL from postprocess job. Available when status = completed.';

comment on column video_factory_outputs.final_video_key is 
  'S3 key for final video (for Asset Gateway). Allows direct S3 key lookup without parsing URLs.';

comment on column video_factory_outputs.thumbnail_key is 
  'S3 key for thumbnail (for Asset Gateway). Allows direct S3 key lookup without parsing URLs.';

comment on column video_factory_outputs.postprod_config is 
  'Post-production configuration used (captions, b-roll, etc.). Stored as JSONB for flexibility.';

comment on column video_factory_outputs.selected_clip_keys is 
  'Array of clip keys/IDs that were selected for this postprocess run. Allows tracking which clips were used.';

comment on column video_factory_outputs.status is 
  'Status of the output: processing (job in progress), completed (output ready), failed (job failed).';

-- ============================================
-- ✅ NEW: Stock Footage Integration
-- Date: 2024-12-19
-- Purpose: Global cache for stock media assets (Pexels, Pixabay) to reduce API calls and download costs
-- ============================================

-- Table: global_stock_assets
-- Global cache for stock media assets (Pexels, Pixabay) to reduce API calls and download costs
-- This enables sharing stock media across all users, reducing API calls and download bandwidth
create table if not exists global_stock_assets (
  id uuid primary key default gen_random_uuid(),
  keyword varchar(255) not null,
  s3_key text not null unique,
  provider varchar(50) not null check (provider in ('pexels', 'pixabay')),
  provider_id varchar(255) not null,
  orientation varchar(50) not null check (orientation in ('landscape', 'portrait', 'square')),
  duration integer, -- Duration in seconds (NULL for images)
  width integer,
  height integer,
  preview_url text,
  tags text[] default '{}',
  author varchar(255),
  license varchar(100),
  usage_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Unique constraint: same provider + provider_id should only exist once
  unique(provider, provider_id)
);

-- ✅ CRITICAL: Enable pg_trgm extension BEFORE creating GIN index with gin_trgm_ops
-- This extension is required for fuzzy text search using gin_trgm_ops operator class
create extension if not exists pg_trgm;

-- Indexes for global_stock_assets
-- GIN index for fuzzy text search on keyword
create index if not exists idx_global_stock_assets_keyword 
  on global_stock_assets using gin (keyword gin_trgm_ops);

-- Index for provider ID lookup (race condition protection)
create index if not exists idx_global_stock_assets_provider_id 
  on global_stock_assets(provider, provider_id);

-- Index for orientation filtering
create index if not exists idx_global_stock_assets_orientation 
  on global_stock_assets(orientation);

-- Index for usage count (popular assets)
create index if not exists idx_global_stock_assets_usage_count 
  on global_stock_assets(usage_count desc);

-- Index for S3 key lookup
create index if not exists idx_global_stock_assets_s3_key 
  on global_stock_assets(s3_key);

-- Comments for documentation
comment on table global_stock_assets is 'Global cache for stock media assets (Pexels, Pixabay) to reduce API calls and download costs';
comment on column global_stock_assets.keyword is 'Search keyword used to find this asset';
comment on column global_stock_assets.s3_key is 'S3 key where the asset is stored';
comment on column global_stock_assets.provider is 'Stock provider: pexels or pixabay';
comment on column global_stock_assets.provider_id is 'Original provider asset ID';
comment on column global_stock_assets.usage_count is 'Number of times this asset has been used (for analytics)';

-- Trigger for global_stock_assets updated_at
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'update_global_stock_assets_updated_at') then
    create trigger update_global_stock_assets_updated_at before update on global_stock_assets
      for each row execute function update_updated_at_column();
  end if;
end $$;

-- ✅ ARCHITECTURAL FIX: Explicitly disable RLS for global_stock_assets
-- Workers use SERVICE ROLE KEY which bypasses RLS, but we disable RLS explicitly
-- to prevent any policy conflicts or accidental RLS enablement
alter table global_stock_assets disable row level security;

-- ✅ SAFETY MIGRATION: Đảm bảo constraint job_id dùng ON DELETE SET NULL (không cascade xoá project khi xoá job)
do $$ begin
  -- Drop old FK nếu còn dùng ON DELETE CASCADE
  if exists (
    select 1
    from pg_constraint
    where conname = 'video_factory_projects_job_id_fkey'
      and confrelid = 'processing_jobs'::regclass
  ) then
    alter table video_factory_projects
      drop constraint video_factory_projects_job_id_fkey;
  end if;

  -- Tạo lại FK với ON DELETE SET NULL (idempotent: nếu đã tồn tại đúng kiểu, sẽ lỗi unique → catch bằng exception nếu cần)
  begin
    alter table video_factory_projects
      add constraint video_factory_projects_job_id_fkey
      foreign key (job_id) references processing_jobs(id) on delete set null;
  exception
    when duplicate_object then
      -- Constraint đã tồn tại với cấu hình đúng → bỏ qua
      null;
  end;
  
  -- ============================================
  -- ✅ CRITICAL: video_factory_projects FK constraints (REUSE OPTIMIZATION)
  -- ============================================
  -- All FKs from video_factory_projects to shared resources use ON DELETE SET NULL
  -- to preserve project history when shared resources are deleted
  -- This enables multiple projects to share same video/audio/transcript
  
  -- ✅ FK 1: source_media_asset_id → media_assets(id) ON DELETE SET NULL
  -- REASON: Multiple projects can share the same source video (reuse scenario)
  -- When source video is deleted → set source_media_asset_id to NULL (keep project history)
  -- Audio/Transcript are deleted via separate cascade: video → audio (parent_asset_id) → transcript (audio_media_asset_id)
  -- ⚠️ CRITICAL: MUST be SET NULL (not CASCADE) to preserve project history when video deleted
  --             If this is CASCADE in your database, run: migrations/fix_source_media_asset_id_constraint.sql
  if not exists (
    select 1 from pg_constraint 
    where conname = 'video_factory_projects_source_media_asset_id_fkey'
  ) then
    alter table video_factory_projects
      add constraint video_factory_projects_source_media_asset_id_fkey
      foreign key (source_media_asset_id) references media_assets(id) on delete set null;
  end if;
  
  -- ✅ FK 2: audio_media_asset_id → media_assets(id) ON DELETE SET NULL
  -- REASON: Multiple projects can share the same audio asset (reuse scenario)
  -- When audio is deleted → set audio_media_asset_id to NULL (keep project history)
  if not exists (
    select 1 from pg_constraint 
    where conname = 'video_factory_projects_audio_media_asset_id_fkey'
  ) then
    alter table video_factory_projects
      add constraint video_factory_projects_audio_media_asset_id_fkey
      foreign key (audio_media_asset_id) references media_assets(id) on delete set null;
  end if;
  
  -- Add FK for current_cut_job_id if not exists
  if not exists (
    select 1 from pg_constraint 
    where conname = 'video_factory_projects_current_cut_job_id_fkey'
  ) then
    alter table video_factory_projects
      add constraint video_factory_projects_current_cut_job_id_fkey
      foreign key (current_cut_job_id) references processing_jobs(id) on delete set null;
  end if;
  
  -- Add FK for current_processing_job_id if not exists
  if not exists (
    select 1 from pg_constraint 
    where conname = 'video_factory_projects_current_processing_job_id_fkey'
  ) then
    alter table video_factory_projects
      add constraint video_factory_projects_current_processing_job_id_fkey
      foreign key (current_processing_job_id) references processing_jobs(id) on delete set null;
  end if;
end $$;

-- ✅ ARCHITECTURAL FIX: Explicitly disable RLS for video_factory_projects
-- Workers use SERVICE ROLE KEY which bypasses RLS, but we disable RLS explicitly
-- to prevent any policy conflicts or accidental RLS enablement
-- This ensures workers can always insert/update projects regardless of auth context
alter table video_factory_projects disable row level security;

-- Trigger for video_factory_projects updated_at
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'update_video_factory_projects_updated_at') then
    create trigger update_video_factory_projects_updated_at before update on video_factory_projects
      for each row execute function update_updated_at_column();
  end if;
end $$;

-- Trigger for processing_jobs updated_at
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'update_processing_jobs_updated_at') then
    create trigger update_processing_jobs_updated_at before update on processing_jobs
      for each row execute function update_updated_at_column();
  end if;
end $$;

-- ============================================
-- REFACTOR: Job Steps & External Tasks Tables
-- Date: 2025-12-20
-- 
-- These tables enable:
-- - Worker polling from DB instead of Redis
-- - Better query performance with indexes
-- - Easier auditing and debugging
-- 
-- IMPORTANT: This is ADDITIVE ONLY - no breaking changes
-- Old system (output_data.steps) continues to work during migration
-- ============================================

-- Table: job_steps
-- Separate table for step lifecycle management
-- Enables efficient polling queries and better indexing
create table if not exists job_steps (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references processing_jobs(id) on delete cascade,
  
  step_name varchar(64) not null, -- 'ingest' | 'audio_extract' | 'transcribe' | 'cut' | 'postprocess'
  step_order int not null default 0,
  
  status varchar(32) not null check (status in (
    'pending', 'running', 'waiting', 'completed', 'failed', 'skipped'
  )),
  
  waiting_reason varchar(64), -- 'AWS_MEDIACONVERT' | 'AWS_TRANSCRIBE' | 'OPENAI' | 'GEMINI' | 'S3' | 'MANUAL'
  
  retry_count int default 0,
  max_retries int default 5,
  
  started_at timestamptz,
  finished_at timestamptz,
  
  -- ✅ CRITICAL: Polling fields for worker to know when to check
  last_checked_at timestamptz,
  next_check_at timestamptz,
  timeout_at timestamptz,
  
  error_code varchar(64),
  error_message text,
  
  output jsonb default '{}'::jsonb,
  metadata jsonb default '{}'::jsonb,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for efficient polling
create index if not exists idx_job_steps_polling 
on job_steps(status, next_check_at) 
where status = 'waiting' and next_check_at is not null;

create index if not exists idx_job_steps_job_status 
on job_steps(job_id, status);

create unique index if not exists idx_job_steps_job_name 
on job_steps(job_id, step_name);

-- Index for timeout detection
create index if not exists idx_job_steps_timeout 
on job_steps(status, timeout_at) 
where status in ('waiting', 'running') and timeout_at is not null;

-- Trigger for job_steps updated_at
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'update_job_steps_updated_at') then
    create trigger update_job_steps_updated_at before update on job_steps
      for each row execute function update_updated_at_column();
  end if;
end $$;

-- ============================================
-- ✅ ETag-based Caching RPC Function
-- Date: 2024-12-19
-- Purpose: Allow workers to quickly lookup completed ingest steps with the same sourceFileETag
--          Enables smart caching/reuse of ingest outputs to skip redundant processing
-- ✅ CRITICAL: This function must be created AFTER job_steps table is created
-- ============================================

-- Function: find_ingest_steps_by_etag
-- 
-- Mục tiêu:
-- - Cho phép worker lookup nhanh các ingest steps đã completed có cùng sourceFileETag
-- - Giới hạn trong phạm vi user_id hiện tại để tránh leak dữ liệu giữa users
-- - Thay thế 2-query pattern (PROCESSING_JOBS + JOB_STEPS) bằng 1 RPC tối ưu + có index
--
-- Parameters:
--   p_user_id: User ID to filter results (security: prevents data leak between users)
--   p_etag: Source file ETag to match
--   p_exclude_job_id: Optional. Job ID to exclude from results (e.g., current job)
--   p_limit: Maximum number of results to return (default: 10)
--
-- Returns: Table of job_id and step_output for matching ingest steps
--
-- Usage: Called by workers during ingest step to check if same file was already processed
create or replace function find_ingest_steps_by_etag(
  p_user_id uuid,
  p_etag text,
  p_exclude_job_id uuid default null,
  p_limit integer default 10
)
returns table (
  job_id uuid,
  step_output jsonb
) as $$
  select
    js.job_id,
    js.output as step_output
  from job_steps js
  join processing_jobs pj
    on pj.id = js.job_id
  where
    pj.user_id = p_user_id
    and js.step_name = 'ingest'
    and js.status = 'completed'
    and (p_exclude_job_id is null or js.job_id <> p_exclude_job_id)
    and js.output->>'sourceFileETag' = p_etag
  order by js.created_at desc
  limit p_limit;
$$ language sql stable;

-- Grant execute permission
-- Workers use service_role to call this function
grant execute on function find_ingest_steps_by_etag(uuid, text, uuid, integer)
  to authenticated, service_role;

-- Table: external_tasks
-- DB-based external task tracking (replaces Redis storage)
-- Maps internal steps to external service jobs (AWS, OpenAI, Gemini)
create table if not exists external_tasks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references processing_jobs(id) on delete cascade,
  step_id uuid not null references job_steps(id) on delete cascade,
  
  provider varchar(32) not null check (provider in (
    'aws_mediaconvert', 'aws_transcribe', 'openai', 'gemini'
  )),
  
  external_job_id varchar(128) not null, -- AWS jobId, OpenAI requestId, Gemini operationId, etc.
  
  status varchar(32) not null check (status in (
    'submitted', 'running', 'completed', 'failed'
  )),
  
  -- Polling fields
  last_polled_at timestamptz,
  next_poll_at timestamptz,
  
  poll_count int default 0,
  max_polls int default 100,
  
  -- Timeouts
  timeout_at timestamptz, -- Soft timeout (can extend)
  hard_cap_at timestamptz, -- Absolute deadline (cannot extend)
  
  -- ✅ PRODUCTION-GRADE: DB-based leasing fields for preventing duplicate enqueueing
  poll_locked_until timestamptz, -- Timestamp when poll lease expires. NULL = not locked
  poll_owner text, -- Worker ID that owns the poll lease (format: worker-{pid} or custom WORKER_ID env var)
  
  raw_response jsonb,
  output jsonb,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for efficient polling
create index if not exists idx_external_tasks_polling 
on external_tasks(status, next_poll_at) 
where status in ('submitted', 'running') and next_poll_at is not null;

create index if not exists idx_external_tasks_job 
on external_tasks(job_id);

create index if not exists idx_external_tasks_step 
on external_tasks(step_id);

-- Index for hard cap detection
create index if not exists idx_external_tasks_hard_cap 
on external_tasks(status, hard_cap_at) 
where status in ('submitted', 'running') and hard_cap_at is not null;

-- ✅ PRODUCTION-GRADE: Indexes for DB-based leasing (prevent duplicate enqueueing)
-- Index for finding tasks ready for polling (status + next_poll_at + lease check)
create index if not exists idx_external_tasks_poll_claim
on external_tasks(status, next_poll_at, poll_locked_until)
where status in ('submitted', 'running') and next_poll_at is not null;

-- Index for finding tasks by owner (for cleanup/debugging)
create index if not exists idx_external_tasks_poll_owner
on external_tasks(poll_owner)
where poll_owner is not null;

-- Trigger for external_tasks updated_at
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'update_external_tasks_updated_at') then
    create trigger update_external_tasks_updated_at before update on external_tasks
      for each row execute function update_updated_at_column();
  end if;
end $$;

-- ============================================
-- ✅ PRODUCTION-GRADE: RPC Functions for DB-based Leasing
-- ============================================

-- ✅ PRODUCTION-GRADE: Atomic task claiming function
-- 
-- Purpose: Atomically claim external tasks for polling using DB-based leasing
-- Uses FOR UPDATE SKIP LOCKED to ensure only one worker claims each task
-- This eliminates race conditions and duplicate enqueueing in multi-worker environments
-- 
-- Parameters:
--   p_now: Current timestamp (used to filter tasks ready for polling)
--   p_lease_until: Timestamp when lease expires (typically now + 2 minutes)
--   p_owner: Worker ID that owns the lease (format: worker-{pid} or custom WORKER_ID)
--   p_limit: Maximum number of tasks to claim (default: 50)
-- 
-- Returns: Table of claimed external tasks ready for polling
-- 
-- Usage: Called by ExternalTaskPoller scheduler every 30 seconds
-- 
=======
-- D. Payments & Orders
create or replace function generate_order_number()
returns varchar as $$
declare
  new_order_number varchar;
  counter integer;
begin
  -- Format: ORD-YYYYMMDD-XXX
  select count(*) into counter
  from orders
  where date(created_at) = current_date;
  
  new_order_number := 'ORD-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad((counter + 1)::text, 3, '0');
  return new_order_number;
end;
$$ language plpgsql;

create or replace function set_order_defaults()
returns trigger as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := generate_order_number();
  end if;
  if new.expires_at is null and new.status = 'pending' then
    new.expires_at := now() + interval '15 minutes';
  end if;
  if new.vnpay_txn_ref is null and new.payment_method = 'vnpay' then
    new.vnpay_txn_ref := new.id::text;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trigger_set_order_defaults before insert on orders for each row execute function set_order_defaults();

create or replace function increment_coupon_usage()
returns trigger as $$
begin
  update coupons 
  set usage_count = usage_count + 1
  where id = new.coupon_id;
  return new;
end;
$$ language plpgsql;

create trigger trigger_increment_coupon_usage after insert on coupon_usage for each row execute function increment_coupon_usage();

create or replace function process_monthly_credit_grants()
returns void as $$
declare
  v_user record;
  v_plan record;
begin
  for v_user in 
    select * from users 
    where subscription_status = 'active' 
    and (next_credit_grant_at is null or next_credit_grant_at <= now())
    and current_plan_slug != 'free'
  loop
    select * into v_plan from plans where slug = v_user.current_plan_slug;
    
    if found then
        update users 
        set 
            credits_balance = credits_balance + v_plan.credits_monthly,
            next_credit_grant_at = now() + interval '1 month'
        where id = v_user.id;
        
        insert into credit_transactions (user_id, action_type, credits_used, credits_remaining, metadata, created_at)
        values (
            v_user.id, 
            'CREDIT_PURCHASED', 
            0,
            v_user.credits_balance + v_plan.credits_monthly,
            jsonb_build_object('credits_added', v_plan.credits_monthly, 'description', 'Monthly plan credit grant', 'type', 'deposit'),
            now()
        );
    end if;
  end loop;
end;
$$ language plpgsql;


-- E. Video Factory RPCs
>>>>>>> main
create or replace function claim_external_tasks_for_polling(
  p_now timestamptz,
  p_lease_until timestamptz,
  p_owner text,
  p_limit integer default 50
)
returns table (
  task_id uuid,
  job_id uuid,
  step_id uuid,
  provider text,
  external_job_id text,
  status text,
  last_polled_at timestamptz,
  next_poll_at timestamptz,
  poll_count integer,
  max_polls integer,
  timeout_at timestamptz,
  hard_cap_at timestamptz,
  poll_locked_until timestamptz,
  poll_owner text,
  raw_response jsonb,
  output jsonb,
  created_at timestamptz,
  updated_at timestamptz
) as $$
declare
  claimed_ids uuid[];
begin
<<<<<<< HEAD
  -- Step 1: Find and lock tasks ready for claiming, then update with lease
  -- ✅ FIX: Use alias to avoid ambiguity with RETURNS TABLE field names
=======
>>>>>>> main
  with locked_tasks as (
    select et.id as task_id
    from external_tasks et
    where et.status in ('submitted', 'running')
      and et.next_poll_at is not null
      and et.next_poll_at <= p_now
      and (et.poll_locked_until is null or et.poll_locked_until < p_now)
    order by et.next_poll_at asc
    limit p_limit
    for update skip locked
  ),
  updated_tasks as (
    update external_tasks et
    set 
      poll_locked_until = p_lease_until,
      poll_owner = p_owner,
      updated_at = now()
    from locked_tasks lt
    where et.id = lt.task_id
    returning et.id as task_id
  )
<<<<<<< HEAD
  -- ✅ FIX: Qualify column reference to avoid ambiguity
  select array_agg(ut.task_id) into claimed_ids from updated_tasks ut;

  -- Step 2: Return claimed tasks (if any)
  if claimed_ids is not null and array_length(claimed_ids, 1) > 0 then
    return query
    select 
      et.id as task_id,
      et.job_id,
      et.step_id,
      et.provider::text, -- ✅ FIX: Cast varchar(32) to text to match RETURNS TABLE
      et.external_job_id::text, -- ✅ FIX: Cast varchar(128) to text to match RETURNS TABLE
      et.status::text, -- ✅ FIX: Cast varchar(32) to text to match RETURNS TABLE
      et.last_polled_at,
      et.next_poll_at,
      et.poll_count,
      et.max_polls,
      et.timeout_at,
      et.hard_cap_at,
      et.poll_locked_until,
      et.poll_owner,
      et.raw_response,
      et.output,
      et.created_at,
      et.updated_at
=======
  select array_agg(ut.task_id) into claimed_ids from updated_tasks ut;

  if claimed_ids is not null and array_length(claimed_ids, 1) > 0 then
    return query
    select 
      et.id, et.job_id, et.step_id, et.provider::text, et.external_job_id::text, et.status::text,
      et.last_polled_at, et.next_poll_at, et.poll_count, et.max_polls, et.timeout_at, et.hard_cap_at,
      et.poll_locked_until, et.poll_owner, et.raw_response, et.output, et.created_at, et.updated_at
>>>>>>> main
    from external_tasks et
    where et.id = any(claimed_ids);
  end if;
end;
$$ language plpgsql;
<<<<<<< HEAD

-- Grant execute permission
-- Note: Workers use service_role to call this function
-- authenticated role is included for flexibility
grant execute on function claim_external_tasks_for_polling(timestamptz, timestamptz, text, integer) to authenticated, service_role;

-- ✅ VERIFICATION: Verify function exists (for debugging)
-- Uncomment to verify function was created successfully:
-- SELECT 
--   proname AS function_name,
--   pg_get_function_arguments(oid) AS arguments,
--   pg_get_function_result(oid) AS return_type
-- FROM pg_proc
-- WHERE proname = 'claim_external_tasks_for_polling'
--   AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
--
-- ✅ NOTE: To verify function was created, run this query in Supabase SQL Editor:
-- SELECT 
--   proname AS function_name,
--   pg_get_function_arguments(oid) AS arguments,
--   pg_get_function_result(oid) AS return_type
-- FROM pg_proc
-- WHERE proname = 'claim_external_tasks_for_polling'
--   AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ✅ IMPORTANT: PostgREST Schema Cache Refresh
-- After creating/updating this function, PostgREST (Supabase API) may need to refresh its schema cache.
-- If you see "function not found" errors (PGRST202), try:
-- 1. Wait 1-2 minutes for PostgREST schema cache to auto-refresh
-- 2. Or restart your Supabase project to force schema cache refresh
-- 3. The fallback method in code will work in the meantime

-- ============================================
-- ✅ OPTIONAL: Atomic CAS RPC Function for Step State Updates
-- ============================================
-- NOTE: This function is OPTIONAL and not currently used in production code
-- It can be enabled later if needed for better atomicity at DB level
-- Currently, application-level CAS checks are sufficient

-- Function để atomic update step state với CAS check
-- 
-- PARAMETERS:
--   p_job_id: Processing job ID
--   p_step: Step name (e.g., 'ingest', 'audio_extract', etc.)
--   p_patch: JSONB patch to apply to step state
--   p_expected_status: Optional. Only update if current status matches (CAS check)
--   p_increment_attempt: Optional. If true, increment attempt atomically
-- 
-- RETURNS:
--   BOOLEAN: true if update succeeded, false if CAS check failed
create or replace function patch_step_state(
  p_job_id uuid,
  p_step text,
  p_patch jsonb,
  p_expected_status text default null,
  p_increment_attempt boolean default false
)
returns boolean
language plpgsql
as $$
declare
  v_current_status text;
  v_current_attempt integer;
  v_output_data jsonb;
  v_step_data jsonb;
  v_updated_step jsonb;
begin
  -- Read current output_data với row-level lock (FOR UPDATE)
  select output_data into v_output_data
  from processing_jobs
  where id = p_job_id
  for update;

  -- Initialize output_data nếu null
  if v_output_data is null then
    v_output_data := '{}'::jsonb;
  end if;

  -- Initialize steps object nếu không tồn tại
  if v_output_data->'steps' is null then
    v_output_data := jsonb_set(v_output_data, '{steps}', '{}'::jsonb);
  end if;

  -- Get current step data
  v_step_data := v_output_data->'steps'->p_step;

  -- Get current step status
  if v_step_data is null then
    v_current_status := null;
    v_current_attempt := 0;
  else
    v_current_status := coalesce(v_step_data->>'status', null);
    v_current_attempt := coalesce((v_step_data->>'attempt')::integer, 0);
  end if;

  -- CAS check: verify expectedStatus if provided
  if p_expected_status is not null then
    if v_current_status is null then
      if p_expected_status != 'pending' then
        return false;
      end if;
    elsif v_current_status != p_expected_status then
      return false;
    end if;
  end if;

  -- Handle attempt increment atomically
  if p_increment_attempt then
    v_current_attempt := v_current_attempt + 1;
    p_patch := p_patch || jsonb_build_object('attempt', v_current_attempt);
  end if;

  -- Merge patch into current step (hoặc tạo mới nếu chưa tồn tại)
  if v_step_data is null then
    v_updated_step := jsonb_build_object(
      'id', p_step,
      'name', p_step,
      'status', 'pending',
      'attempt', coalesce((p_patch->>'attempt')::integer, 0)
    ) || p_patch;
  else
    v_updated_step := v_step_data || p_patch;
    v_updated_step := v_updated_step || jsonb_build_object('id', p_step, 'name', p_step);
  end if;

  -- Update output_data với merged step
  v_output_data := jsonb_set(
    v_output_data,
    array['steps', p_step],
    v_updated_step
  );

  -- Update với WHERE condition để đảm bảo atomicity
  update processing_jobs
  set
    output_data = v_output_data,
    updated_at = now()
  where id = p_job_id;

  return true;
end;
$$;




-- Grant execute permission (optional - only if using this function)
-- Currently commented out as this function is not used in production code
-- Uncomment if you want to use it:
-- grant execute on function patch_step_state(uuid, text, jsonb, text, boolean) to authenticated, service_role;

-- ============================================
-- ✅ Comments for new columns (Production-grade improvements)
-- ============================================

comment on column processing_jobs.timeout_at is 'Absolute deadline for job completion';
comment on column processing_jobs.max_duration_sec is 'Maximum duration in seconds (default: 8 hours for video_factory)';
comment on column external_tasks.poll_locked_until is 'Timestamp when poll lease expires. NULL = not locked. Used for DB-based task claiming to prevent duplicate enqueueing.';
comment on column external_tasks.poll_owner is 'Worker ID that owns the poll lease. Used for debugging and cleanup. Format: worker-{pid} or custom WORKER_ID env var.';
comment on column video_factory_projects.source_media_asset_id is 'Reference to source video in media_assets table. Enables efficient reuse queries. Khi xóa video → cascade xóa project (on delete cascade).';
comment on column video_factory_projects.audio_media_asset_id is 'Reference to extracted audio asset in media_assets table. Audio chứa transcript (audio.metadata.transcript) và translate (audio.metadata.translations). Khi xóa audio asset → set null (on delete set null) để không mất project. Khi xóa source video → cascade xóa audio → transcript và translate trong audio.metadata bị xóa.';
-- ⚠️ REMOVED: audio_s3_uri column comment (column đã được xóa khỏi video_factory_projects)
-- Lấy audio_s3_uri từ video_factory_audio_transcripts.audio_s3_uri qua audio_transcript_id
comment on column video_factory_projects.transcript is '⚠️ DEPRECATED: Transcript giờ lưu trong video_factory_audio_transcripts.transcript (via audio_transcript_id). Column này sẽ được remove sau migration.';
comment on column video_factory_projects.transcript_source is '⚠️ DEPRECATED: Transcript source giờ lưu trong video_factory_audio_transcripts.transcript_source (via audio_transcript_id). Column này sẽ được remove sau migration.';
comment on column media_assets.thumbnail_key is 'S3 key for thumbnail (for Asset Gateway). Allows direct S3 key lookup without parsing URLs. Populated by workers when saving media assets.';
comment on column media_assets.parent_asset_id is '✅ CASCADE DELETE CHAIN: Link to parent asset (source video) for processed assets (audio, transcript, etc.). Example: Audio asset extracted from video → parent_asset_id = source video asset ID. When source video is deleted: (1) All derived audio assets are deleted via parent_asset_id CASCADE, (2) All audio_transcripts linked to those audio assets are deleted via audio_media_asset_id CASCADE, (3) Projects linking to those transcripts have audio_transcript_id set to NULL (preserving project history). This ensures: Shared resources (audio/transcript) are only deleted when original source video is removed, not when individual projects are deleted.';
comment on column video_factory_projects.current_cut_job_id is 'Link to the current cut job for this project. One project has one cut job that generates clips.';
comment on column video_factory_projects.current_processing_job_id is 'Link to the current processing job (cut or postprocess) for this project. Allows FE to track active jobs and display progress. Updated when job starts, cleared when job completes/fails.';
comment on column processing_jobs.project_id is 'Link to video_factory_projects. All jobs (cut and postprocess) belong to a project.';
comment on column processing_jobs.job_subtype is 'Subtype for video_factory jobs: cut (generates clips) or postprocess (creates final videos).';
comment on column media_assets.project_id is 'Link to video_factory_projects. All assets (source, clips, outputs) belong to a project.';
comment on column video_factory_outputs.project_id is 'Link to video_factory_projects. All outputs belong to a project for easy querying.';
comment on column video_factory_projects.source_url_hash is '✅ OPTIMIZATION: MD5 hash of source_url for efficient duplicate detection. Used in unique constraint with user_id and cut_config_hash to prevent creating duplicate projects.';
comment on column video_factory_projects.cut_config_hash is '✅ OPTIMIZATION: MD5 hash of cut_config JSONB for efficient duplicate detection. Used in unique constraint with user_id and source_url_hash to prevent creating duplicate projects.';
comment on column processing_jobs.version is 'Optimistic locking version field (incremented on each update). Prevents lost updates in concurrent scenarios using Compare-And-Swap (CAS).';
comment on column video_factory_projects.version is 'Optimistic locking version field (incremented on each update). Prevents lost updates in concurrent scenarios using Compare-And-Swap (CAS).';
comment on column video_factory_audio_transcripts.version is 'Optimistic locking version field (incremented on each update). Prevents lost updates in concurrent scenarios using Compare-And-Swap (CAS).';
comment on column media_assets.version is 'Optimistic locking version field (incremented on each update). Prevents lost updates in concurrent scenarios using Compare-And-Swap (CAS).';
comment on column video_factory_audio_transcripts.language is 'Language of transcript (ISO 639-1 code). Default: vi (Vietnamese). Enables multiple transcripts per source video in different languages.';
comment on column video_factory_audio_transcripts.deleted_at is 'Soft delete timestamp. When set, transcript is considered deleted but preserved in database for audit/recovery. Used with partial unique index to allow re-creation after deletion.';




-- =============================================================================
-- MIGRATION SCRIPT: NATIVE YOUTUBE SUPPORT
-- Tác giả: [Tên Bạn]
-- Mục đích: Cập nhật schema hiện tại để hỗ trợ kết nối YouTube trực tiếp (Native)
--           mà không làm ảnh hưởng đến dữ liệu Late.dev hiện có.
-- An toàn để chạy trên Database đang hoạt động (Non-destructive).
-- =============================================================================

BEGIN;

-- 1. CẬP NHẬT BẢNG connected_accounts
-- =============================================================================

-- 1.1 Thêm cột connection_provider (để phân biệt Late vs Native)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'connected_accounts' AND column_name = 'connection_provider') THEN
        ALTER TABLE public.connected_accounts 
        ADD COLUMN connection_provider TEXT DEFAULT 'late';
        
        ALTER TABLE public.connected_accounts 
        ADD CONSTRAINT connected_accounts_provider_check CHECK (connection_provider IN ('late', 'native'));
    END IF;
END $$;

-- 1.2 Thêm cột platform_metadata (để lưu thông tin riêng của YouTube Native như uploadPlaylistId)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'connected_accounts' AND column_name = 'platform_metadata') THEN
        ALTER TABLE public.connected_accounts 
        ADD COLUMN platform_metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 1.3 Nới lỏng ràng buộc (Make Nullable) cho các cột của Late.dev
-- Vì YouTube Native sẽ không có getlate_profile_id
ALTER TABLE public.connected_accounts ALTER COLUMN getlate_profile_id DROP NOT NULL;
ALTER TABLE public.connected_accounts ALTER COLUMN getlate_account_id DROP NOT NULL;
ALTER TABLE public.connected_accounts ALTER COLUMN late_profile_id DROP NOT NULL;

-- 1.4 Tạo Unique Index để hỗ trợ lệnh UPSERT khi kết nối Native
-- Logic: Một user chỉ được kết nối một social profile ID (VD: Channel ID) một lần duy nhất trên một platform
DROP INDEX IF EXISTS idx_connected_accounts_user_platform_profile;
CREATE UNIQUE INDEX IF NOT EXISTS idx_connected_accounts_user_platform_profile 
ON public.connected_accounts (user_id, platform, profile_id);


-- 2. CẬP NHẬT BẢNG scheduled_posts
-- =============================================================================

-- 2.1 Thêm cột connected_account_id (Link trực tiếp tới connection thay vì qua profile)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_posts' AND column_name = 'connected_account_id') THEN
        ALTER TABLE public.scheduled_posts 
        ADD COLUMN connected_account_id UUID REFERENCES public.connected_accounts(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2.2 Nới lỏng ràng buộc (Make Nullable)
-- Bài đăng Native lúc mới tạo có thể chưa có late_job_id (hoặc không bao giờ có)
ALTER TABLE public.scheduled_posts ALTER COLUMN getlate_profile_id DROP NOT NULL;
ALTER TABLE public.scheduled_posts ALTER COLUMN getlate_account_id DROP NOT NULL;
ALTER TABLE public.scheduled_posts ALTER COLUMN late_job_id DROP NOT NULL;


-- 3. TỐI ƯU INDEX (PERFORMANCE)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_connected_accounts_provider ON public.connected_accounts(connection_provider);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_connected_account_id ON public.scheduled_posts(connected_account_id);


-- 4. CẤP QUYỀN (PERMISSIONS FIX)
-- Đảm bảo Backend (Service Role) có quyền truy cập các cột mới
-- =============================================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

COMMIT;

-- Kết quả
SELECT 'Migration for Native YouTube Integration completed successfully.' as status;

-- =============================================================================
-- MIGRATION SCRIPT: ADD thumbnail_key TO media_assets
-- Date: 2025-12-25
-- Purpose: Add thumbnail_key column to media_assets table for Asset Gateway
--          This allows direct S3 key lookup without parsing thumbnail_url
-- Safe to run on existing databases (non-destructive, nullable column)
-- =============================================================================

BEGIN;

-- Add thumbnail_key column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'media_assets' 
          AND column_name = 'thumbnail_key'
    ) THEN
        ALTER TABLE public.media_assets 
        ADD COLUMN thumbnail_key TEXT;
        
        -- Add comment for documentation
        COMMENT ON COLUMN public.media_assets.thumbnail_key IS 
            'S3 key for thumbnail (for Asset Gateway). Allows direct S3 key lookup without parsing URLs. Populated by workers when saving media assets.';
    END IF;
END $$;

COMMIT;

-- Kết quả
SELECT 'Migration for thumbnail_key column completed successfully.' as status;

-- =============================================================================
-- MIGRATION SCRIPT: ADD current_processing_job_id TO video_factory_projects
-- Date: 2025-12-31
-- Purpose: Add current_processing_job_id column to video_factory_projects table
--          This allows FE to track active jobs (cut or postprocess) and display progress correctly
--          Fixes PGRST204 error: "Could not find the 'current_processing_job_id' column"
-- Safe to run on existing databases (non-destructive, nullable column)
-- =============================================================================

BEGIN;

-- Add current_processing_job_id column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'video_factory_projects' 
          AND column_name = 'current_processing_job_id'
    ) THEN
        ALTER TABLE public.video_factory_projects 
        ADD COLUMN current_processing_job_id UUID REFERENCES public.processing_jobs(id) ON DELETE SET NULL;
        
        -- Create index for efficient queries
        CREATE INDEX IF NOT EXISTS idx_video_factory_projects_processing_job 
        ON public.video_factory_projects(current_processing_job_id) 
        WHERE current_processing_job_id IS NOT NULL;
        
        -- Add comment for documentation
        COMMENT ON COLUMN public.video_factory_projects.current_processing_job_id IS 
            'Link to the current processing job (cut or postprocess) for this project. Allows FE to track active jobs and display progress. Updated when job starts, cleared when job completes/fails.';
    END IF;
END $$;

COMMIT;

-- Kết quả
SELECT 'Migration for current_processing_job_id column completed successfully.' as status;

-- =============================================================================
-- MIGRATION SCRIPT: ADD UNIQUE CONSTRAINT ON job_id FOR video_factory_projects
-- Date: 2025-01-01
-- Purpose: Create unique constraint on job_id to enable UPSERT pattern
--          This allows upsertByJobId to use PostgreSQL UPSERT (ON CONFLICT) instead of Find -> Update
--          Impact: Reduces queries from 2 (Find + Update) to 1 (Upsert)
-- Safe to run on existing databases (will fail gracefully if duplicates exist)
-- =============================================================================

BEGIN;

-- Step 1: Check for duplicate job_id entries (should be none, but check first)
-- This is a verification query - run manually if needed
-- SELECT job_id, COUNT(*) as count
-- FROM video_factory_projects
-- GROUP BY job_id
-- HAVING COUNT(*) > 1;

-- Step 2: If duplicates exist, remove them (keep the most recent one)
-- ⚠️ WARNING: Only run this if Step 1 shows duplicates
-- Uncomment and run if needed:
-- DELETE FROM video_factory_projects a USING (
--     SELECT MIN(ctid) as ctid, job_id
--     FROM video_factory_projects
--     GROUP BY job_id HAVING COUNT(*) > 1
-- ) b
-- WHERE a.job_id = b.job_id AND a.ctid <> b.ctid;

-- Step 3: Create unique constraint on job_id
-- This enables PostgreSQL UPSERT (ON CONFLICT) pattern
-- If constraint already exists, this will fail with "already exists" -> Safe to ignore
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'video_factory_projects_job_id_key'
    ) THEN
        ALTER TABLE public.video_factory_projects
        ADD CONSTRAINT video_factory_projects_job_id_key UNIQUE (job_id);
        
        -- Add comment for documentation
        COMMENT ON CONSTRAINT video_factory_projects_job_id_key ON public.video_factory_projects IS 
            'Unique constraint on job_id to enable UPSERT pattern. Allows upsertByJobId to use PostgreSQL UPSERT (ON CONFLICT) instead of Find -> Update, reducing queries from 2 to 1.';
    END IF;
END $$;

-- Step 4: Verify constraint was created
-- This is a verification query - run manually if needed
-- SELECT 
--     conname as constraint_name,
--     contype as constraint_type,
--     pg_get_constraintdef(oid) as constraint_definition
-- FROM pg_constraint
-- WHERE conrelid = 'video_factory_projects'::regclass
--   AND conname = 'video_factory_projects_job_id_key';

COMMIT;

-- Kết quả
SELECT 'Migration for unique constraint on job_id completed successfully.' as status;

-- =============================================================================
-- ✅ CRITICAL: AUDIO/TRANSCRIPT REUSE VERIFICATION
-- Date: 2026-01-10
-- Purpose: Ensure database foreign key constraints support audio/transcript reuse
--          and follow "Write Once, Read Many" principle
-- =============================================================================

-- ============================================
-- ✅ VERIFICATION: Foreign Key Constraints
-- ============================================

-- Expected FK Constraints for video_factory_audio_transcripts:
-- 1. audio_media_asset_id → media_assets(id) ON DELETE CASCADE
--    Reason: When audio asset is deleted, transcript should be deleted
-- 2. source_media_asset_id → media_assets(id) ON DELETE CASCADE
--    Reason: When source video is deleted, all derived data (audio → transcript) should be deleted

-- Expected FK Constraints for video_factory_projects:
-- 1. audio_transcript_id → video_factory_audio_transcripts(id) ON DELETE SET NULL
--    Reason: Multiple projects can share same transcript. Deleting one project should NOT delete shared transcript.
-- 2. source_media_asset_id → media_assets(id) ON DELETE SET NULL
--    Reason: Multiple projects can share same source video. Deleting source video should preserve project history.
-- 3. audio_media_asset_id → media_assets(id) ON DELETE SET NULL
--    Reason: Multiple projects can share same audio. Deleting audio should preserve project history.

-- ============================================
-- ✅ VERIFICATION: FK CONSTRAINTS SUMMARY
-- ============================================
-- Run this query to verify all critical FK constraints are correct:
/*
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule,
  CASE 
    -- video_factory_projects (preserve project history)
    WHEN tc.table_name = 'video_factory_projects' AND kcu.column_name = 'audio_transcript_id' AND rc.delete_rule = 'SET NULL' THEN '✅ CORRECT'
    WHEN tc.table_name = 'video_factory_projects' AND kcu.column_name = 'audio_media_asset_id' AND rc.delete_rule = 'SET NULL' THEN '✅ CORRECT'
    WHEN tc.table_name = 'video_factory_projects' AND kcu.column_name = 'source_media_asset_id' AND rc.delete_rule = 'SET NULL' THEN '✅ CORRECT'
    -- video_factory_audio_transcripts (cascade delete)
    WHEN tc.table_name = 'video_factory_audio_transcripts' AND kcu.column_name = 'audio_media_asset_id' AND rc.delete_rule = 'CASCADE' THEN '✅ CORRECT'
    WHEN tc.table_name = 'video_factory_audio_transcripts' AND kcu.column_name = 'source_media_asset_id' AND rc.delete_rule = 'CASCADE' THEN '✅ CORRECT'
    -- media_assets (cascade delete derived assets)
    WHEN tc.table_name = 'media_assets' AND kcu.column_name = 'parent_asset_id' AND rc.delete_rule = 'CASCADE' THEN '✅ CORRECT'
    ELSE '❌ CHECK'
  END AS status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
LEFT JOIN information_schema.referential_constraints AS rc ON rc.constraint_name = tc.constraint_name
WHERE tc.table_name IN ('video_factory_projects', 'video_factory_audio_transcripts', 'media_assets')
AND tc.constraint_type = 'FOREIGN KEY'
AND kcu.column_name IN ('audio_transcript_id', 'audio_media_asset_id', 'source_media_asset_id', 'parent_asset_id')
ORDER BY tc.table_name, kcu.column_name;

-- Expected: All 6 rows show ✅ CORRECT
-- If any show ❌ CHECK or ❌ WRONG, see fixes below:
--
-- ⚠️ COMMON ISSUE: video_factory_projects.source_media_asset_id shows "❌ WRONG"
-- Symptom: Verification shows CASCADE instead of SET NULL for source_media_asset_id
-- Impact: Deleting source video also deletes all projects (loses history, breaks reuse)
-- Fix: Run migrations/fix_source_media_asset_id_constraint.sql
-- Quick Fix SQL:
--   ALTER TABLE video_factory_projects DROP CONSTRAINT IF EXISTS video_factory_projects_source_media_asset_id_fkey;
--   ALTER TABLE video_factory_projects ADD CONSTRAINT video_factory_projects_source_media_asset_id_fkey 
--   FOREIGN KEY (source_media_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;
*/

-- ============================================
-- ⚠️ CRITICAL RISKS DOCUMENTED
-- ============================================

-- RISK #1: Database Cascade Delete
-- Problem: If video_factory_projects has ON DELETE CASCADE to shared resources (audio/transcript),
--          deleting one project will delete resources used by other projects.
-- Solution: Use ON DELETE SET NULL for shared resources (audio_transcript_id, source_media_asset_id).
--           Use ON DELETE CASCADE only from source video → audio → transcript chain.
-- Status: ✅ FIXED - All constraints correctly configured in schema above (verify with query above)

-- RISK #2: Duplicate File Upload (File Hash Check)
-- Problem: User uploads same video multiple times → creates duplicate audio/transcript → wastes AWS credits.
-- Solution: [OPTIMIZATION] Implement ETag/MD5 hash check at ingest step to detect duplicates and reuse existing assets.
--           Current implementation: find_ingest_steps_by_etag() RPC function supports this.

-- RISK #3: Race Condition at Translation Step
-- Problem: Multiple workers translate same transcript to same language concurrently → may overwrite each other.
-- Solution: Application-level "Write Once, Read Many" check in updateTranslation() repository method.
--           Check if translation[language] already has data before writing.
--           For true atomic updates, use JSONB path update with WHERE condition checking translation[language] is NULL.

-- ============================================
-- ✅ WRITE ONCE, READ MANY PRINCIPLE
-- ============================================

-- Transcript Data:
-- - First successful transcription → CREATE transcript
-- - Retry (initial failed) → UPDATE transcript IF transcript.length === 0
-- - Reuse (from another project) → READ ONLY, never update

-- Translation Data:
-- - First successful translation for language X → CREATE translations[X]
-- - Retry (initial failed) → UPDATE translations[X] IF translations[X].length === 0
-- - Reuse (from another project) → READ ONLY, never update

-- Audio Data:
-- - First audio extraction → CREATE audio asset
-- - Reuse (from another project) → READ ONLY, never create duplicate

-- ============================================
-- 🚀 OPTIMIZATION SUGGESTIONS
-- ============================================

-- OPT #1: B-roll Caching (Global Cache)
-- Problem: Multiple projects download same B-roll from Pexels/Pixabay → wastes bandwidth and storage.
-- Solution: Create global_stock_assets table (already implemented) to cache B-roll.
--           Before downloading, check if asset exists in cache → reuse S3 key.

-- OPT #2: Cleanup Cronjob (Orphaned Resources)
-- Problem: User uploads video, starts processing, deletes project immediately → orphaned audio/transcript.
-- Solution: Periodic cleanup job to detect and delete orphaned resources:
--           - Audio assets with parent_asset_id pointing to deleted video
--           - Transcripts with source_media_asset_id pointing to deleted video
--           - Projects with source_media_asset_id = NULL and age > 30 days

-- ============================================
-- ✅ ATOMIC TRANSLATION UPDATE FUNCTION
-- ============================================
-- Purpose: Prevent race condition when multiple workers update different languages simultaneously
-- Implements "Write Once, Read Many" principle for translations
-- Created: 2026-01-10

-- Drop function if exists (for idempotent schema)
DROP FUNCTION IF EXISTS upsert_translation(UUID, TEXT, JSONB);

-- Create atomic translation upsert function
CREATE OR REPLACE FUNCTION upsert_translation(
  p_transcript_id UUID,
  p_language TEXT,
  p_segments JSONB
) RETURNS JSONB AS $$
DECLARE
  v_current_translations JSONB;
  v_existing_translation JSONB;
  v_has_data BOOLEAN;
BEGIN
  -- Get current translations
  SELECT translations INTO v_current_translations
  FROM video_factory_audio_transcripts
  WHERE id = p_transcript_id;
  
  -- Initialize if NULL
  IF v_current_translations IS NULL THEN
    v_current_translations := '{}'::jsonb;
  END IF;
  
  -- Check if translation for this language already has data
  v_existing_translation := v_current_translations -> p_language;
  v_has_data := (
    v_existing_translation IS NOT NULL AND
    jsonb_typeof(v_existing_translation) = 'array' AND
    jsonb_array_length(v_existing_translation) > 0
  );
  
  -- ✅ WRITE ONCE, READ MANY: Only update if translation doesn't have data
  IF v_has_data THEN
    -- Translation already exists with data → Skip update
    RAISE NOTICE 'Translation already exists for language % - skipping update (WRITE ONCE, READ MANY)', p_language;
    RETURN jsonb_build_object(
      'updated', false,
      'reason', 'already_exists',
      'existing_segments', jsonb_array_length(v_existing_translation)
    );
  ELSE
    -- Translation doesn't exist or is empty → OK to update
    -- ✅ ATOMIC: Use jsonb_set to update only one key
    -- This prevents race condition where concurrent updates overwrite each other
    UPDATE video_factory_audio_transcripts
    SET 
      translations = jsonb_set(
        v_current_translations,
        ARRAY[p_language],
        p_segments,
        true  -- create if not exists
      ),
      updated_at = NOW()
    WHERE id = p_transcript_id;
    
    RAISE NOTICE 'Translation updated for language %', p_language;
    RETURN jsonb_build_object(
      'updated', true,
      'reason', CASE WHEN v_existing_translation IS NULL THEN 'created' ELSE 'retry_completed' END,
      'new_segments', jsonb_array_length(p_segments)
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION upsert_translation(UUID, TEXT, JSONB) IS 
'Atomically update translation for specific language. Prevents race condition and enforces Write Once, Read Many principle.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION upsert_translation(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_translation(UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION upsert_translation(UUID, TEXT, JSONB) TO anon;

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
-- Migration: v18_atomic_clip_updates_and_invariants
-- Description: Adds atomic clip updating via RPC and enforcing completion invariants

-- 1. Add new columns for progress tracking and versioning
ALTER TABLE video_factory_projects 
ADD COLUMN IF NOT EXISTS expected_output_clip_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed_clips INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_clips INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS job_history_version INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP WITH TIME ZONE;

-- 2. Add DB-level invariant check
-- Ensure progress counters don't exceed expected count
-- 2. Add DB-level invariant check
-- Ensure progress counters don't exceed expected count
-- ✅ IDEMPOTENCY FIX: Drop constraint if exists before adding
ALTER TABLE video_factory_projects DROP CONSTRAINT IF EXISTS check_completion_bounds;

ALTER TABLE video_factory_projects
ADD CONSTRAINT check_completion_bounds 
CHECK (completed_clips + failed_clips <= expected_output_clip_count);

-- 3. Stored Procedure for Atomic, Idempotent Clip Updates
-- This handles row locking, array initialization, and state transition guards.
-- ✅ FIX AMBIGUITY: Drop legacy TEXT signature to prevent overloading/PGRST203 error
DROP FUNCTION IF EXISTS update_project_output_clip_atomic(TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION update_project_output_clip_atomic(
    p_job_id UUID,
    p_clip_id TEXT,
    p_clip_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_project_id UUID;
    v_output_clips JSONB;
    v_target_index INTEGER;
    v_existing_status TEXT;
    v_new_status TEXT;
    v_completed_delta INTEGER := 0;
    v_failed_delta INTEGER := 0;
    v_updated_record RECORD;
BEGIN
    -- 1. Lock the row for update (Atomicity & Isolation)
    -- ✅ CRITICAL FIX: Support both 'cut' job_id AND 'postprocess' current_processing_job_id
    SELECT id, output_clips INTO v_project_id, v_output_clips
    FROM video_factory_projects
    WHERE job_id = p_job_id OR current_processing_job_id = p_job_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- ✅ ENHANCED ERROR: Log which ID was searched for better debugging
        RAISE EXCEPTION 'Project with job_id/current_processing_job_id % not found', p_job_id;
    END IF;

    -- 2. Initialize or search for the clip by ID
    -- If output_clips is null, initialize as empty array
    v_output_clips := COALESCE(v_output_clips, '[]'::jsonb);
    
    -- Find index of the clip with matching id
    SELECT i - 1 INTO v_target_index
    FROM jsonb_array_elements(v_output_clips) WITH ORDINALITY AS t(elem, i)
    WHERE elem->>'id' = p_clip_id;

    -- 3. Idempotency Guard & State Logic
    v_new_status := p_clip_data->>'clipStatus';
    
    IF v_target_index IS NOT NULL THEN
        v_existing_status := v_output_clips->v_target_index->>'clipStatus';
        
        -- Guard: Never downgrade READY or FAILED (Terminal States)
        IF v_existing_status IN ('READY', 'FAILED') THEN
            RETURN jsonb_build_object(
                'status', 'skipped',
                'reason', 'Clip already in terminal state: ' || v_existing_status,
                'current_clips', v_output_clips
            );
        END IF;

        -- Update counters based on new status
        IF v_new_status = 'READY' THEN
            v_completed_delta := 1;
        ELSIF v_new_status = 'FAILED' THEN
            v_failed_delta := 1;
        END IF;

        -- Apply update at target index
        v_output_clips := jsonb_set(v_output_clips, array[v_target_index::text], p_clip_data);
    ELSE
        -- Fallback: If not found by ID (should rarely happen in postprocess if initialized by cut)
        -- We append it if it's a new clip (or handle as error based on requirements)
        -- For now, we append it to maintain robustness
        v_output_clips := v_output_clips || jsonb_build_array(p_clip_data);
        
        IF v_new_status = 'READY' THEN
            v_completed_delta := 1;
        ELSIF v_new_status = 'FAILED' THEN
            v_failed_delta := 1;
        END IF;
    END IF;

    -- 4. Persist changes with incremented version
    UPDATE video_factory_projects
    SET 
        output_clips = v_output_clips,
        completed_clips = completed_clips + v_completed_delta,
        failed_clips = failed_clips + v_failed_delta,
        job_history_version = job_history_version + 1,
        updated_at = NOW(),
        -- Auto-finalize if all clips are done
        finalized_at = CASE 
            WHEN (completed_clips + v_completed_delta + failed_clips + v_failed_delta) >= expected_output_clip_count 
            THEN NOW() 
            ELSE finalized_at 
        END
    WHERE id = v_project_id
    RETURNING output_clips, job_history_version, completed_clips, failed_clips, expected_output_clip_count INTO v_updated_record;

    -- 5. Return snapshot for worker sync
    RETURN jsonb_build_object(
        'status', 'updated',
        'output_clips', v_updated_record.output_clips,
        'version', v_updated_record.job_history_version,
        'completed_count', v_updated_record.completed_clips,
        'failed_count', v_updated_record.failed_clips,
        'expected_count', v_updated_record.expected_output_clip_count
    );
END;
$$;

-- ✅ ATOMIC POSTPROCESS CLIP UPDATE (v20: prefer current_processing_job_id to avoid ghost row)
-- Updates postprocess_output_clips only. Prefer current_processing_job_id first so we never update the wrong row.
DROP FUNCTION IF EXISTS update_project_postprocess_clip_atomic(UUID, TEXT, JSONB);

CREATE OR REPLACE FUNCTION update_project_postprocess_clip_atomic(
    p_job_id UUID,
    p_clip_id TEXT,
    p_clip_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_project_id UUID;
    v_pp_clips JSONB;
    v_target_index INTEGER;
    v_existing_status TEXT;
    v_new_status TEXT;
    v_updated_record RECORD;
BEGIN
    -- 1) Lock the project row for atomic update.
    --    PRIORITY 1: current_processing_job_id (postprocess job = row we must update).
    --    PRIORITY 2: job_id (cut job). Avoids updating a "ghost" row when both match.
    SELECT id, postprocess_output_clips
      INTO v_project_id, v_pp_clips
    FROM video_factory_projects
    WHERE current_processing_job_id = p_job_id
    FOR UPDATE;

    IF NOT FOUND THEN
        SELECT id, postprocess_output_clips
          INTO v_project_id, v_pp_clips
        FROM video_factory_projects
        WHERE job_id = p_job_id
        FOR UPDATE;
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Project with job_id/current_processing_job_id % not found', p_job_id;
    END IF;

    -- 2) Initialize array if null
    v_pp_clips := COALESCE(v_pp_clips, '[]'::jsonb);

    -- 3) Locate clip by id
    SELECT i - 1 INTO v_target_index
    FROM jsonb_array_elements(v_pp_clips) WITH ORDINALITY AS t(elem, i)
    WHERE elem->>'id' = p_clip_id;

    -- 4) Idempotency guard: never downgrade terminal states
    v_new_status := p_clip_data->>'clipStatus';

    IF v_target_index IS NOT NULL THEN
        v_existing_status := v_pp_clips->v_target_index->>'clipStatus';

        IF v_existing_status IN ('READY', 'FAILED') THEN
            RETURN jsonb_build_object(
                'status', 'skipped',
                'reason', 'Postprocess clip already in terminal state: ' || v_existing_status,
                'postprocess_output_clips', v_pp_clips
            );
        END IF;

        v_pp_clips := jsonb_set(v_pp_clips, array[v_target_index::text], p_clip_data);
    ELSE
        -- Append if not found (robustness for missing initialization)
        v_pp_clips := v_pp_clips || jsonb_build_array(p_clip_data);
    END IF;

    -- 5) Persist + bump version (use the existing project version counter for FE de-racing)
    UPDATE video_factory_projects
    SET
        postprocess_output_clips = v_pp_clips,
        job_history_version = job_history_version + 1,
        updated_at = NOW()
    WHERE id = v_project_id
    RETURNING postprocess_output_clips, job_history_version INTO v_updated_record;

    RETURN jsonb_build_object(
        'status', 'updated',
        'postprocess_output_clips', v_updated_record.postprocess_output_clips,
        'version', v_updated_record.job_history_version
    );
END;
$$;

=======
grant execute on function claim_external_tasks_for_polling(timestamptz, timestamptz, text, integer) to authenticated, service_role;

create or replace function find_ingest_steps_by_etag(
  p_user_id uuid,
  p_etag text,
  p_exclude_job_id uuid default null,
  p_limit integer default 10
)
returns table (
  job_id uuid,
  step_output jsonb
) as $$
  select
    js.job_id,
    js.output as step_output
  from job_steps js
  join processing_jobs pj on pj.id = js.job_id
  where
    pj.user_id = p_user_id
    and js.step_name = 'ingest'
    and js.status = 'completed'
    and (p_exclude_job_id is null or js.job_id <> p_exclude_job_id)
    and js.output->>'sourceFileETag' = p_etag
  order by js.created_at desc
  limit p_limit;
$$ language sql stable;
grant execute on function find_ingest_steps_by_etag(uuid, text, uuid, integer) to authenticated, service_role;


-- ============================================
-- 7. INDEXES (Consolidated)
-- ============================================

-- Users
create index if not exists idx_users_plan on users(current_plan_slug);
create index if not exists idx_users_subscription_status on users(subscription_status);
create index if not exists idx_users_email on auth.users(email); -- Hint (often used)

-- Content
create index if not exists idx_projects_user_id on projects(user_id);
create index if not exists idx_content_drafts_user_id on content_drafts(user_id);
create index if not exists idx_content_drafts_project_id on content_drafts(project_id);
create index if not exists idx_content_drafts_status on content_drafts(status);

-- Chat
create index if not exists idx_chat_messages_user_id on chat_messages(user_id);
create index if not exists idx_chat_messages_session_id on chat_messages(session_id);

-- Payment
create index if not exists idx_orders_user_id on orders(user_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_subscriptions_user_id on subscriptions(user_id);
create index if not exists idx_credit_transactions_user_id on credit_transactions(user_id);

-- Social
create index if not exists idx_connected_accounts_user_id on connected_accounts(user_id);
create index if not exists idx_connected_accounts_provider on connected_accounts(connection_provider);

-- Video Factory / Jobs
create index if not exists idx_processing_jobs_user_id on processing_jobs(user_id);
create index if not exists idx_processing_jobs_status on processing_jobs(status);
create index if not exists idx_media_assets_user_id on media_assets(user_id);
create index if not exists idx_video_factory_projects_user_id on video_factory_projects(user_id);
create index if not exists idx_video_factory_outputs_cut_job_id on video_factory_outputs(cut_job_id);

-- ============================================
-- 8. SECURITY & RLS (Optional/Disabled for simple access)
-- ============================================
-- Disable RLS on all tables for simplicity as requested, or keep it manageable.
-- Example: 'alter table users disable row level security;'
-- I will disable RLS on key tables to avoid permission errors if policies aren't perfect

alter table users disable row level security;
alter table projects disable row level security;
alter table content_drafts disable row level security;
alter table chat_sessions disable row level security;
alter table chat_messages disable row level security;
alter table connected_accounts disable row level security;
alter table getlate_accounts disable row level security;
alter table getlate_profiles disable row level security;
alter table usage disable row level security;
alter table monthly_usage disable row level security;
alter table subscriptions disable row level security;
alter table plans disable row level security;
alter table coupons disable row level security;
alter table orders disable row level security;
alter table coupon_usage disable row level security;
alter table payment_logs disable row level security;
alter table credit_transactions disable row level security;
alter table files disable row level security;
alter table scheduled_posts disable row level security;
alter table processing_jobs disable row level security;
alter table media_assets disable row level security;
alter table video_factory_projects disable row level security;
alter table video_factory_outputs disable row level security;
alter table video_factory_audio_transcripts disable row level security;
alter table job_steps disable row level security;
alter table external_tasks disable row level security;
alter table global_stock_assets disable row level security;
>>>>>>> main