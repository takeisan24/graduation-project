-- =============================================================================
-- OMNIA DATABASE SCHEMA V2.0 (HYBRID NATIVE + LATE)
-- =============================================================================
-- Script này sẽ RESET toàn bộ database public. Hãy backup nếu cần thiết.
-- =============================================================================

-- 1. CLEANUP & INIT
-- =============================================================================
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Extension cho UUID và Mã hóa
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 2. TABLE DEFINITIONS
-- =============================================================================

-- 2.1 USERS & AUTH
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    avatar_url TEXT,
    email TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'creator', 'creator_pro', 'agency')),
    subscription_status TEXT DEFAULT 'inactive',
    lemonsqueezy_customer_id TEXT,
    lemonsqueezy_subscription_id TEXT,
    subscription_ends_at TIMESTAMPTZ,
    credits_balance INTEGER DEFAULT 0,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 SYSTEM ACCOUNTS (Late.dev Config) - Chứa API Key nhạy cảm
CREATE TABLE public.getlate_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_name TEXT,
    api_key TEXT NOT NULL UNIQUE,
    client_id TEXT,
    client_secret TEXT,
    webhook_secret TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 SYSTEM PROFILES (Late.dev Profiles)
CREATE TABLE public.getlate_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    getlate_account_id UUID REFERENCES public.getlate_accounts(id) ON DELETE CASCADE,
    late_profile_id TEXT NOT NULL UNIQUE,
    profile_name TEXT,
    description TEXT,
    social_media_ids JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.4 CONNECTED ACCOUNTS (HYBRID: Native + Late)
CREATE TABLE public.connected_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Phân loại: 'late' (qua bên thứ 3) hoặc 'native' (trực tiếp Google/Meta)
    connection_provider TEXT DEFAULT 'late' CHECK (connection_provider IN ('late', 'native')),
    
    -- Fields cho Late.dev (Nullable vì Native không có)
    getlate_profile_id UUID REFERENCES public.getlate_profiles(id) ON DELETE SET NULL,
    getlate_account_id UUID REFERENCES public.getlate_accounts(id) ON DELETE SET NULL,
    late_profile_id TEXT, -- Legacy ID
    social_media_account_id TEXT, -- ID account trên Late
    
    -- Fields chung & Native (Token được mã hóa)
    platform TEXT NOT NULL,
    profile_id TEXT, -- Social ID (VD: YouTube Channel ID)
    profile_name TEXT,
    access_token TEXT, 
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    
    profile_metadata JSONB DEFAULT '{}'::jsonb, -- Avatar, username...
    platform_metadata JSONB DEFAULT '{}'::jsonb, -- Native specific (Upload playlist ID...)
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ràng buộc: Mỗi user chỉ kết nối 1 social ID cụ thể 1 lần
    UNIQUE(user_id, platform, profile_id)
);

-- 2.5 CONTENT MANAGEMENT
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    source_type TEXT DEFAULT 'prompt',
    source_content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.content_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    platform TEXT,
    text_content TEXT,
    media_urls JSONB DEFAULT '[]'::jsonb,
    media_type TEXT,
    status TEXT DEFAULT 'draft',
    scheduled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.6 CHAT SYSTEM
CREATE TABLE public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    context TEXT DEFAULT 'general',
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    draft_id UUID REFERENCES public.content_drafts(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    draft_id UUID REFERENCES public.content_drafts(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('user', 'assistant')),
    content TEXT,
    context TEXT DEFAULT 'general',
    content_type TEXT DEFAULT 'text',
    platform TEXT DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.7 PUBLISHING QUEUE (Updated for Native)
CREATE TABLE public.scheduled_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    draft_id UUID REFERENCES public.content_drafts(id),
    
    -- Link trực tiếp tới connection (QUAN TRỌNG cho Native)
    connected_account_id UUID REFERENCES public.connected_accounts(id) ON DELETE SET NULL,
    
    -- Link tới Late (Nullable)
    getlate_profile_id UUID REFERENCES public.getlate_profiles(id) ON DELETE SET NULL,
    getlate_account_id UUID REFERENCES public.getlate_accounts(id) ON DELETE SET NULL,
    late_job_id TEXT, -- Null nếu là Native post
    
    platform TEXT,
    scheduled_at TIMESTAMPTZ,
    status TEXT DEFAULT 'scheduled',
    post_url TEXT,
    payload JSONB, -- Chứa metadata, response, error details
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.8 BILLING & USAGE
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    lemonsqueezy_subscription_id TEXT UNIQUE,
    lemonsqueezy_customer_id TEXT,
    plan TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    credits_used INTEGER DEFAULT 0,
    credits_purchased INTEGER DEFAULT 0,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, period_start)
);

CREATE TABLE public.monthly_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    month DATE NOT NULL,
    projects_created INTEGER DEFAULT 0,
    posts_created INTEGER DEFAULT 0,
    scheduled_posts INTEGER DEFAULT 0,
    images_generated INTEGER DEFAULT 0,
    videos_generated INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month)
);

CREATE TABLE public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    credits_used INTEGER DEFAULT 0,
    credits_remaining INTEGER,
    resource_id UUID,
    resource_type TEXT,
    platform TEXT,
    metadata JSONB,
    response_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.9 FILES & JOBS
CREATE TABLE public.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    bucket TEXT NOT NULL,
    mime TEXT,
    size BIGINT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT,
    payload JSONB,
    status TEXT DEFAULT 'queued',
    attempts INT DEFAULT 0,
    last_error TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.10 STATIC DATA (Strategy)
CREATE TABLE public.content_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    prompt_modifier_text TEXT
);

CREATE TABLE public.niches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    description TEXT
);

CREATE TABLE public.frameworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE,
    description TEXT,
    icon_name TEXT NOT NULL,
    goal_ids UUID[] DEFAULT '{}',
    niches UUID[] DEFAULT '{}',
    base_prompt_text TEXT,
    placeholders TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.framework_niches (
    framework_id UUID REFERENCES public.frameworks(id) ON DELETE CASCADE,
    niche_id UUID REFERENCES public.niches(id) ON DELETE CASCADE,
    override_prompt_text TEXT,
    PRIMARY KEY (framework_id, niche_id)
);

-- =============================================================================
-- 3. INDEXES
-- =============================================================================
CREATE INDEX idx_users_plan ON public.users(plan);
CREATE INDEX idx_connected_accounts_user_provider ON public.connected_accounts(user_id, connection_provider);
CREATE INDEX idx_connected_accounts_platform ON public.connected_accounts(platform);
CREATE INDEX idx_scheduled_posts_user_status ON public.scheduled_posts(user_id, status);
CREATE INDEX idx_scheduled_posts_scheduled_at ON public.scheduled_posts(scheduled_at);
CREATE INDEX idx_credit_transactions_user_created ON public.credit_transactions(user_id, created_at);

-- =============================================================================
-- 4. SECURITY (RLS POLICIES)
-- =============================================================================
-- Enable RLS for ALL tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.getlate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.getlate_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.niches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.framework_niches ENABLE ROW LEVEL SECURITY;

-- 4.1 USER DATA (Chỉ chủ sở hữu được phép)
CREATE POLICY "Users view/edit own profile" ON public.users FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users manage own projects" ON public.projects FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own drafts" ON public.content_drafts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own chats" ON public.chat_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own messages" ON public.chat_messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own connections" ON public.connected_accounts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own posts" ON public.scheduled_posts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own files" ON public.files FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users view own usage" ON public.usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users view own monthly usage" ON public.monthly_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users view own transactions" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users view own subs" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- 4.2 SHARED DATA (Late Profiles - Chỉ xem nếu có kết nối)
CREATE POLICY "Users view linked profiles" ON public.getlate_profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.connected_accounts ca WHERE ca.getlate_profile_id = getlate_profiles.id AND ca.user_id = auth.uid())
);

-- 4.3 SYSTEM DATA (Cấm user truy cập, chỉ Service Role)
-- getlate_accounts, jobs: KHÔNG CÓ POLICY (Deny All)

-- 4.4 STATIC DATA (Ai cũng xem được)
CREATE POLICY "Public read goals" ON public.content_goals FOR SELECT USING (true);
CREATE POLICY "Public read niches" ON public.niches FOR SELECT USING (true);
CREATE POLICY "Public read frameworks" ON public.frameworks FOR SELECT USING (true);
CREATE POLICY "Public read framework_niches" ON public.framework_niches FOR SELECT USING (true);

-- =============================================================================
-- 5. FUNCTIONS & TRIGGERS
-- =============================================================================

-- Auto updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER update_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t);
  END LOOP;
END $$;

-- Handle New User (Auth Hook)
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url, credits_balance)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url', 10);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Atomic Credit Deduction
CREATE OR REPLACE FUNCTION public.deduct_user_credits(p_user_id UUID, p_credits_to_deduct INTEGER) RETURNS JSON AS $$
DECLARE v_credits_left INTEGER;
BEGIN
  SELECT credits_balance INTO v_credits_left FROM public.users WHERE id = p_user_id;
  IF v_credits_left < p_credits_to_deduct THEN
    RETURN json_build_object('success', false, 'reason', 'insufficient_credits', 'credits_left', v_credits_left);
  END IF;
  UPDATE public.users SET credits_balance = credits_balance - p_credits_to_deduct, updated_at = NOW() WHERE id = p_user_id RETURNING credits_balance INTO v_credits_left;
  RETURN json_build_object('success', true, 'credits_left', v_credits_left);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic Usage Increment
CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id UUID, p_month DATE, p_field TEXT, p_amount INT) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.monthly_usage (user_id, month, projects_created, posts_created, scheduled_posts, images_generated, videos_generated)
  VALUES (p_user_id, p_month, 
    CASE WHEN p_field = 'projects_created' THEN p_amount ELSE 0 END,
    CASE WHEN p_field = 'posts_created' THEN p_amount ELSE 0 END,
    CASE WHEN p_field = 'scheduled_posts' THEN p_amount ELSE 0 END,
    CASE WHEN p_field = 'images_generated' THEN p_amount ELSE 0 END,
    CASE WHEN p_field = 'videos_generated' THEN p_amount ELSE 0 END
  )
  ON CONFLICT (user_id, month) DO UPDATE SET 
    projects_created = monthly_usage.projects_created + (CASE WHEN p_field = 'projects_created' THEN p_amount ELSE 0 END),
    posts_created = monthly_usage.posts_created + (CASE WHEN p_field = 'posts_created' THEN p_amount ELSE 0 END),
    scheduled_posts = monthly_usage.scheduled_posts + (CASE WHEN p_field = 'scheduled_posts' THEN p_amount ELSE 0 END),
    images_generated = monthly_usage.images_generated + (CASE WHEN p_field = 'images_generated' THEN p_amount ELSE 0 END),
    videos_generated = monthly_usage.videos_generated + (CASE WHEN p_field = 'videos_generated' THEN p_amount ELSE 0 END),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure User Profile (Idempotent)
CREATE OR REPLACE FUNCTION public.ensure_user_profile(p_user_id UUID, p_email TEXT DEFAULT NULL, p_name TEXT DEFAULT NULL, p_avatar_url TEXT DEFAULT NULL) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_balance INTEGER;
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url, credits_balance)
  VALUES (p_user_id, p_email, p_name, p_avatar_url, 10)
  ON CONFLICT (id) DO UPDATE SET last_login_at = NOW(), email = COALESCE(p_email, users.email), name = COALESCE(p_name, users.name), avatar_url = COALESCE(p_avatar_url, users.avatar_url)
  RETURNING credits_balance INTO v_balance;
  RETURN COALESCE(v_balance, 0);
END;
$$;

-- =============================================================================
-- 6. PERMISSIONS & SEED DATA
-- =============================================================================

-- Cấp quyền tối thượng cho Service Role (Backend)
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;