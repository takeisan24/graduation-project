-- Run in Supabase SQL editor

-- Ensure required extensions for UUID generation
create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  avatar_url text,
  plan text default 'free',
  lemonsqueezy_customer_id text,
  lemonsqueezy_subscription_id text,
  subscription_status text default 'inactive',
  subscription_ends_at timestamptz,
  credits_balance integer default 0, -- Số credit hiện tại của user (để theo dõi real-time)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  name text not null,
  description text,
  source_type text default 'prompt',
  source_content text,
  created_at timestamptz default now()
);

create table if not exists content_drafts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects (id) on delete cascade,
  user_id uuid references users (id) on delete cascade,
  platform text,
  text_content text,
  media_urls jsonb default '[]'::jsonb,
  status text default 'draft',
  scheduled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references content_drafts (id) on delete cascade,
  user_id uuid references users (id),
  role text check (role in ('user','assistant')),
  content text,
  created_at timestamptz default now()
);

create table if not exists connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  platform text,
  profile_id text,
  profile_name text,
  access_token text,
  refresh_token text,
  expires_at bigint,
  late_profile_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

-- Bảng ghi lại toàn bộ thao tác sử dụng theo thời gian (activity log)
-- Cho phép query linh hoạt theo 1 ngày, 3 ngày, 7 ngày, 30 ngày, toàn bộ thời gian
-- Thay thế cho activity_log table
create table if not exists credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  action_type text not null, -- 'PROJECT_CREATED', 'POST_CREATED', 'IMAGE_GENERATED', 'VIDEO_GENERATED', 'CREDIT_DEDUCTED', 'CREDIT_PURCHASED', 'POST_SCHEDULED', 'POST_PUBLISHED', 'AI_REFINEMENT', 'VIDEO_PROCESSING', 'TEXT_ONLY', 'WITH_IMAGE', 'WITH_VIDEO'
  credits_used integer default 0, -- Credits đã dùng cho action này (nếu có)
  credits_remaining integer, -- Credits còn lại sau action (nếu có)
  total_credits integer, -- Tổng credits tại thời điểm action (nếu có)
  resource_id uuid, -- ID của resource liên quan (project_id, draft_id, etc.)
  resource_type text, -- Loại resource ('project', 'draft', 'image', 'video', etc.)
  platform text, -- Platform liên quan (nếu có)
  metadata jsonb, -- { model, platform, prompt, size, aspectRatio, count, etc. }
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
      'WITH_VIDEO'
    )
  )
);

-- Bảng mới để quản lý monthly usage theo yêu cầu
create table if not exists monthly_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  month date not null,
  projects_created integer default 0,
  posts_created integer default 0,
  images_generated integer default 0,
  videos_generated integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, month)
);


-- Bảng mới để quản lý subscriptions
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  lemonsqueezy_subscription_id text unique,
  lemonsqueezy_customer_id text,
  plan text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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
  platform text,
  scheduled_at timestamptz,
  late_job_id text,
  status text default 'scheduled',
  payload jsonb,
  created_at timestamptz default now()
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

-- Create chat_sessions table for managing chat conversations
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

-- Update chat_messages table to support sessions
alter table chat_messages 
add column if not exists session_id uuid references chat_sessions(id) on delete cascade,
add column if not exists context text default 'general',
add column if not exists content_type text default 'text',
add column if not exists platform text default 'general';

-- Function to increment usage counters
create or replace function increment_usage(
  p_user_id uuid,
  p_month date,
  p_field text,
  p_amount int
) returns void as $$
begin
  update monthly_usage 
  set 
    projects_created = case when p_field = 'projects_created' then projects_created + p_amount else projects_created end,
    posts_created = case when p_field = 'posts_created' then posts_created + p_amount else posts_created end,
    images_generated = case when p_field = 'images_generated' then images_generated + p_amount else images_generated end,
    videos_generated = case when p_field = 'videos_generated' then videos_generated + p_amount else videos_generated end,
    updated_at = now()
  where user_id = p_user_id and month = p_month;
  
  if not found then
    insert into monthly_usage (user_id, month, projects_created, posts_created, images_generated, videos_generated)
    values (
      p_user_id, 
      p_month,
      case when p_field = 'projects_created' then p_amount else 0 end,
      case when p_field = 'posts_created' then p_amount else 0 end,
      case when p_field = 'images_generated' then p_amount else 0 end,
      case when p_field = 'videos_generated' then p_amount else 0 end
    );
  end if;
end;
$$ language plpgsql;

-- Function to atomically deduct user credits
create or replace function deduct_user_credits(
  p_user_id uuid,
  p_credits_to_deduct integer
) returns json as $$
declare
  v_user_plan text;
  v_credits_used integer;
  v_credits_purchased integer;
  v_plan_credits integer;
  v_total_credits integer;
  v_credits_left integer;
  v_month_start timestamptz;
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  -- Get user's plan
  select plan into v_user_plan from users where id = p_user_id;
  if v_user_plan is null then
    return json_build_object('success', false, 'reason', 'user_not_found');
  end if;
  
  -- Calculate plan credits
  case v_user_plan
    when 'creator' then v_plan_credits := 200;
    when 'creator_pro' then v_plan_credits := 450;
    when 'agency' then v_plan_credits := 1000;
    else v_plan_credits := 10; -- free plan
  end case;
  
  -- Get current month period
  v_month_start := date_trunc('month', now());
  v_period_start := v_month_start;
  v_period_end := v_month_start + interval '1 month';
  
  -- Ensure usage row exists
  insert into usage (user_id, credits_used, credits_purchased, period_start, period_end)
  values (p_user_id, 0, 0, v_period_start, v_period_end)
  on conflict (user_id, period_start) do nothing;
  
  -- Get current usage
  select credits_used, credits_purchased 
  into v_credits_used, v_credits_purchased
  from usage 
  where user_id = p_user_id and period_start = v_period_start;
  
  v_total_credits := v_plan_credits + coalesce(v_credits_purchased, 0);
  
  -- Use credits_balance from users table as source of truth (real-time)
  -- If credits_balance is null or invalid, calculate from usage table
  select credits_balance into v_credits_left from users where id = p_user_id;
  
  if v_credits_left is null or v_credits_left < 0 then
    -- Fallback: calculate from usage table
    v_credits_left := v_total_credits - coalesce(v_credits_used, 0);
    -- Update credits_balance to match calculated value
    update users set credits_balance = v_credits_left where id = p_user_id;
  end if;
  
  -- Check if user has enough credits
  if v_credits_left < p_credits_to_deduct then
    return json_build_object(
      'success', false, 
      'reason', 'insufficient_credits',
      'credits_left', v_credits_left,
      'total_credits', v_total_credits
    );
  end if;
  
  -- Deduct credits atomically
  update usage 
  set credits_used = credits_used + p_credits_to_deduct,
      updated_at = now()
  where user_id = p_user_id and period_start = v_period_start;
  
  v_credits_left := v_credits_left - p_credits_to_deduct;
  
  -- Update credits_balance in users table for real-time tracking
  update users
  set credits_balance = v_credits_left,
      updated_at = now()
  where id = p_user_id;
  
  -- Insert into credit_transactions for detailed tracking (for dashboard)
  -- Note: action_type and metadata should be passed from application layer
  -- This will be handled in TypeScript layer for flexibility
  
  return json_build_object(
    'success', true,
    'credits_left', v_credits_left,
    'total_credits', v_total_credits
  );
end;
$$ language plpgsql;

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
create index if not exists idx_connected_accounts_user_id on connected_accounts(user_id);
create index if not exists idx_connected_accounts_platform on connected_accounts(platform);
create index if not exists idx_usage_user_id on usage(user_id);
create index if not exists idx_usage_period_start on usage(period_start);
create index if not exists idx_monthly_usage_user_id on monthly_usage(user_id);
create index if not exists idx_monthly_usage_month on monthly_usage(month);
-- Indexes for credit_transactions table (quan trọng cho performance khi query theo thời gian)
create index if not exists idx_credit_transactions_user_id on credit_transactions(user_id);
create index if not exists idx_credit_transactions_created_at on credit_transactions(created_at);
create index if not exists idx_credit_transactions_action_type on credit_transactions(action_type);
create index if not exists idx_credit_transactions_user_created on credit_transactions(user_id, created_at);
create index if not exists idx_credit_transactions_resource on credit_transactions(resource_id, resource_type);
create index if not exists idx_subscriptions_user_id on subscriptions(user_id);
create index if not exists idx_subscriptions_status on subscriptions(status);
create index if not exists idx_scheduled_posts_user_id on scheduled_posts(user_id);
create index if not exists idx_scheduled_posts_scheduled_at on scheduled_posts(scheduled_at);
create index if not exists idx_scheduled_posts_status on scheduled_posts(status);
create index if not exists idx_jobs_status on jobs(status);
create index if not exists idx_jobs_job_type on jobs(job_type);
create index if not exists idx_chat_sessions_user_id on chat_sessions(user_id);
create index if not exists idx_chat_sessions_context on chat_sessions(context);


-- -- Enable Row Level Security
-- alter table users enable row level security;
-- alter table projects enable row level security;
-- alter table content_drafts enable row level security;
-- alter table chat_sessions enable row level security;
-- alter table chat_messages enable row level security;
-- alter table connected_accounts enable row level security;
-- alter table usage enable row level security;
-- alter table monthly_usage enable row level security;
-- alter table subscriptions enable row level security;
-- alter table files enable row level security;
-- alter table scheduled_posts enable row level security;
-- alter table jobs enable row level security;

-- -- Users policies
-- create policy "Users can view their own profile"
--   on users for select using (auth.uid() = id);
-- create policy "Users can update their own profile"
--   on users for update using (auth.uid() = id);

-- -- Allow inserts into users (for auth trigger flow)
-- create policy "Allow inserts into users"
--   on users for insert with check (true);

-- -- Projects policies
-- create policy "Users can view their own projects"
--   on projects for select using (auth.uid() = user_id);
-- create policy "Users can create their own projects"
--   on projects for insert with check (auth.uid() = user_id);
-- create policy "Users can update their own projects"
--   on projects for update using (auth.uid() = user_id);
-- create policy "Users can delete their own projects"
--   on projects for delete using (auth.uid() = user_id);

-- -- Content drafts policies
-- create policy "Users can view their own drafts"
--   on content_drafts for select using (auth.uid() = user_id);
-- create policy "Users can create their own drafts"
--   on content_drafts for insert with check (auth.uid() = user_id);
-- create policy "Users can update their own drafts"
--   on content_drafts for update using (auth.uid() = user_id);
-- create policy "Users can delete their own drafts"
--   on content_drafts for delete using (auth.uid() = user_id);

-- -- Chat sessions policies
-- create policy "Users can view their own chat sessions"
--   on chat_sessions for select using (auth.uid() = user_id);
-- create policy "Users can create their own chat sessions"
--   on chat_sessions for insert with check (auth.uid() = user_id);
-- create policy "Users can update their own chat sessions"
--   on chat_sessions for update using (auth.uid() = user_id);
-- create policy "Users can delete their own chat sessions"
--   on chat_sessions for delete using (auth.uid() = user_id);

-- -- Chat messages policies
-- create policy "Users can view their own chat messages"
--   on chat_messages for select using (auth.uid() = user_id);
-- create policy "Users can create their own chat messages"
--   on chat_messages for insert with check (auth.uid() = user_id);

-- -- Connected accounts policies
-- create policy "Users can view their own connected accounts"
--   on connected_accounts for select using (auth.uid() = user_id);
-- create policy "Users can create their own connected accounts"
--   on connected_accounts for insert with check (auth.uid() = user_id);
-- create policy "Users can update their own connected accounts"
--   on connected_accounts for update using (auth.uid() = user_id);
-- create policy "Users can delete their own connected accounts"
--   on connected_accounts for delete using (auth.uid() = user_id);

-- -- Usage policies
-- create policy "Users can view their own usage"
--   on usage for select using (auth.uid() = user_id);

-- -- Allow inserts into usage (for auth trigger flow)
-- create policy "Allow inserts into usage"
--   on usage for insert with check (true);

-- -- Monthly usage policies
-- create policy "Users can view their own monthly usage"
--   on monthly_usage for select using (auth.uid() = user_id);

-- -- Subscriptions policies
-- create policy "Users can view their own subscriptions"
--   on subscriptions for select using (auth.uid() = user_id);

-- -- Files policies
-- create policy "Users can view their own files"
--   on files for select using (auth.uid() = user_id);
-- create policy "Users can create their own files"
--   on files for insert with check (auth.uid() = user_id);
-- create policy "Users can delete their own files"
--   on files for delete using (auth.uid() = user_id);

-- -- Scheduled posts policies
-- create policy "Users can view their own scheduled posts"
--   on scheduled_posts for select using (auth.uid() = user_id);
-- create policy "Users can create their own scheduled posts"
--   on scheduled_posts for insert with check (auth.uid() = user_id);
-- create policy "Users can update their own scheduled posts"
--   on scheduled_posts for update using (auth.uid() = user_id);
-- create policy "Users can delete their own scheduled posts"
--   on scheduled_posts for delete using (auth.uid() = user_id);

-- -- Jobs policies
-- create policy "Users cannot view jobs"
--   on jobs for select using (false);

-- ==========================
-- Alignment with schema_updated.sql (constraints, triggers, indexes)
-- ==========================

-- Add CHECK constraints for users
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_plan_check') then
    alter table users add constraint users_plan_check check (plan in ('free','creator','creator_pro','agency'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'users_subscription_status_check') then
    alter table users add constraint users_subscription_status_check check (subscription_status in ('active','inactive','cancelled','past_due','expired'));
  end if;
  -- Ensure users.role exists for legacy triggers/workflows that set a role
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'role'
  ) then
    alter table users add column role text default 'user';
  end if;
  -- Optional: constrain role values if not already present
  if not exists (select 1 from pg_constraint where conname = 'users_role_check') then
    alter table users add constraint users_role_check check (role is null or role in ('user','admin'));
  end if;
end $$;

-- Ensure projects has updated_at
alter table projects
  add column if not exists updated_at timestamptz default now();

-- Content drafts: add media_type and checks
alter table content_drafts
  add column if not exists media_type text,
  add column if not exists updated_at timestamptz default now();
-- Add CHECKS (will enforce going forward)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'content_drafts_status_check') then
    alter table content_drafts add constraint content_drafts_status_check check (status in ('draft','scheduled','posted','failed'));
  end if;
end $$;

-- Connected accounts: platform constraint and unique(user_id, profile_id)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'connected_accounts_platform_check') then
    alter table connected_accounts add constraint connected_accounts_platform_check check (platform in ('instagram','tiktok','x','linkedin','facebook','threads','bluesky','youtube','pinterest','late'));
  end if;
end $$;
create unique index if not exists idx_connected_accounts_user_profile on connected_accounts(user_id, profile_id);

-- Subscriptions: add checks
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_plan_check') then
    alter table subscriptions add constraint subscriptions_plan_check check (plan in ('creator','creator_pro','agency'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_status_check') then
    alter table subscriptions add constraint subscriptions_status_check check (status in ('active','cancelled','past_due','expired'));
  end if;
end $$;

-- Scheduled posts: add updated_at and status check
alter table scheduled_posts
  add column if not exists updated_at timestamptz default now();
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'scheduled_posts_status_check') then
    alter table scheduled_posts add constraint scheduled_posts_status_check check (status in ('scheduled','publishing','posted','failed','cancelled'));
  end if;
end $$;

-- update_updated_at trigger function
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'update_users_updated_at') then
    create trigger update_users_updated_at before update on users
      for each row execute function update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'update_projects_updated_at') then
    create trigger update_projects_updated_at before update on projects
      for each row execute function update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'update_content_drafts_updated_at') then
    create trigger update_content_drafts_updated_at before update on content_drafts
      for each row execute function update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'update_chat_sessions_updated_at') then
    create trigger update_chat_sessions_updated_at before update on chat_sessions
      for each row execute function update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'update_connected_accounts_updated_at') then
    create trigger update_connected_accounts_updated_at before update on connected_accounts
      for each row execute function update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'update_usage_updated_at') then
    create trigger update_usage_updated_at before update on usage
      for each row execute function update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'update_monthly_usage_updated_at') then
    create trigger update_monthly_usage_updated_at before update on monthly_usage
      for each row execute function update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'update_subscriptions_updated_at') then
    create trigger update_subscriptions_updated_at before update on subscriptions
      for each row execute function update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'update_scheduled_posts_updated_at') then
    create trigger update_scheduled_posts_updated_at before update on scheduled_posts
      for each row execute function update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'update_jobs_updated_at') then
    create trigger update_jobs_updated_at before update on jobs
      for each row execute function update_updated_at_column();
  end if;
end $$;

-- Additional helpful indexes
create index if not exists idx_projects_created_at on projects(created_at);
create index if not exists idx_content_drafts_scheduled_at on content_drafts(scheduled_at);
create index if not exists idx_chat_messages_created_at on chat_messages(created_at);
create index if not exists idx_connected_accounts_profile_id on connected_accounts(profile_id);

-- Supabase Cloud-safe alternative to auth.users trigger
-- 1) Drop legacy trigger if it exists (some environments disallow creating triggers on auth schema)
do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    drop trigger on_auth_user_created on auth.users;
  end if;
end $$;

-- 2) RPC function: ensure_user_profile
--    Can be called from the app (anon/authenticated) after sign-in/up.
--    SECURITY DEFINER lets it insert into public.users without the caller needing write perms.
create or replace function ensure_user_profile(
  p_user_id uuid,
  p_email text default null,
  p_name text default null,
  p_avatar_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start timestamptz;
  v_period_end timestamptz;
  v_plan text;
  v_plan_credits integer;
begin
  -- Create the user row if missing
  insert into users (id, name, avatar_url, plan, subscription_status, credits_balance)
  values (p_user_id, p_name, p_avatar_url, 'free', 'active', 10)
  on conflict (id) do nothing;

  -- Get user plan to set initial credits_balance
  select plan into v_plan from users where id = p_user_id;
  
  case v_plan
    when 'creator' then v_plan_credits := 200;
    when 'creator_pro' then v_plan_credits := 450;
    when 'agency' then v_plan_credits := 1000;
    else v_plan_credits := 10; -- free plan
  end case;

  -- Initialize usage for current month
  v_month_start := date_trunc('month', now());
  v_period_end := v_month_start + interval '1 month';
  insert into usage (
    user_id, credits_used, credits_purchased, period_start, period_end
  )
  values (p_user_id, 0, 0, v_month_start, v_period_end)
  on conflict (user_id, period_start) do nothing;
  
  -- Sync credits_balance from usage table (for existing users)
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
end;
$$;

-- 3) Allow calling the RPC from the app
grant execute on function ensure_user_profile(uuid, text, text, text) to anon, authenticated, service_role;

-- Function to sync credits_balance from usage table (for existing users or when plan changes)
create or replace function sync_user_credits_balance(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_plan_credits integer;
  v_credits_used integer;
  v_credits_purchased integer;
  v_total_credits integer;
  v_credits_balance integer;
  v_month_start timestamptz;
  v_period_start timestamptz;
begin
  -- Get user plan
  select plan into v_plan from users where id = p_user_id;
  if v_plan is null then
    return;
  end if;
  
  -- Calculate plan credits
  case v_plan
    when 'creator' then v_plan_credits := 200;
    when 'creator_pro' then v_plan_credits := 450;
    when 'agency' then v_plan_credits := 1000;
    else v_plan_credits := 10; -- free plan
  end case;
  
  -- Get current month period
  v_month_start := date_trunc('month', now());
  v_period_start := v_month_start;
  
  -- Get current usage
  select credits_used, credits_purchased
  into v_credits_used, v_credits_purchased
  from usage
  where user_id = p_user_id and period_start = v_period_start
  limit 1;
  
  -- Calculate balance
  v_total_credits := v_plan_credits + coalesce(v_credits_purchased, 0);
  v_credits_balance := v_total_credits - coalesce(v_credits_used, 0);
  
  -- Update credits_balance in users table
  update users
  set credits_balance = v_credits_balance,
      updated_at = now()
  where id = p_user_id;
end;
$$;

grant execute on function sync_user_credits_balance(uuid) to authenticated, service_role;

-- 4) Backfill: ensure existing auth users have public users row (safe, idempotent)
insert into users (id, plan, subscription_status)
select au.id, 'free', 'active'
from auth.users au
left join users u on u.id = au.id
where u.id is null;
