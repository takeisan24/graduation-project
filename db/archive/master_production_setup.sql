-- PAYMENT MODULE SETUP SCRIPT (IDEMPOTENT & PERMISSIVE)
-- ==============================================================================
-- DESCRIPTION:
-- Installs/Updates Payment System components.
-- SAFE TO RUN MULTIPLE TIMES (Checks if tables/columns/constraints exist).
-- 1. Creates NEW Tables (Plans, Coupons, Orders, Logs).
-- 2. Modifies EXISTING Tables (Users, Subscriptions, Credit Transactions).
-- 3. Sets up Logic (Triggers) & Seed Data.
-- 4. SECURITY: RLS DISABLED / PERMISSIONS OPEN (Dev Mode).
--
-- EXECUTION:
-- Run this in the Supabase SQL Editor.
-- ==============================================================================

BEGIN;

-- 1. CREATE NEW TABLES (IF NOT EXISTS)
-- ==============================================================================

-- A. PLANS
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  description text,
  credits_monthly integer NOT NULL,
  credits_yearly integer NOT NULL,
  price_monthly numeric NOT NULL,
  price_yearly numeric NOT NULL,
  features jsonb DEFAULT '[]'::jsonb,
  max_profiles integer,
  max_posts_per_month integer,
  tier_level integer NOT NULL,
  is_active boolean DEFAULT true,
  is_visible boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT plans_pkey PRIMARY KEY (id)
);

-- B. COUPONS
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code character varying NOT NULL UNIQUE,
  description text,
  discount_type character varying NOT NULL CHECK (discount_type::text = ANY (ARRAY['percentage'::character varying, 'fixed_amount'::character varying]::text[])),
  discount_value numeric NOT NULL CHECK (discount_value > 0::numeric),
  max_discount_amount numeric,
  min_order_amount numeric DEFAULT 0,
  usage_limit integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  usage_count integer DEFAULT 0 CHECK (usage_count >= 0),
  usage_per_user integer DEFAULT 1 CHECK (usage_per_user > 0),
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  applies_to_billing character varying NOT NULL DEFAULT 'yearly'::character varying CHECK (applies_to_billing::text = ANY (ARRAY['monthly'::character varying, 'yearly'::character varying, 'both'::character varying]::text[])),
  applies_to_plans UUID[],
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coupons_pkey PRIMARY KEY (id)
);

-- C. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_number character varying NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id), -- Nullable for Guest Checkout
  plan_id uuid REFERENCES public.plans(id),
  plan_name character varying NOT NULL,
  plan_slug character varying NOT NULL,
  billing_cycle character varying NOT NULL CHECK (billing_cycle::text = ANY (ARRAY['monthly'::character varying, 'yearly'::character varying]::text[])),
  credits_amount integer NOT NULL CHECK (credits_amount > 0),
  subtotal numeric NOT NULL CHECK (subtotal >= 0::numeric),
  discount_amount numeric DEFAULT 0 CHECK (discount_amount >= 0::numeric),
  total_amount numeric NOT NULL CHECK (total_amount >= 0::numeric),
  currency character varying DEFAULT 'VND'::character varying,
  coupon_id uuid REFERENCES public.coupons(id),
  coupon_code character varying,
  coupon_discount_type character varying,
  coupon_discount_value numeric,
  customer_name character varying,
  customer_email character varying NOT NULL,
  customer_phone character varying,
  vnpay_txn_ref character varying UNIQUE,
  vnpay_transaction_no character varying,
  vnpay_bank_code character varying,
  vnpay_bank_tran_no character varying,
  vnpay_card_type character varying,
  vnpay_pay_date character varying,
  vnpay_response_code character varying,
  vnpay_transaction_status character varying,
  vnpay_secure_hash character varying,
  vnpay_raw_response jsonb,
  status character varying NOT NULL DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'paid'::character varying, 'completed'::character varying, 'failed'::character varying, 'expired'::character varying, 'refunded'::character varying, 'partially_refunded'::character varying]::text[])),
  payment_method character varying DEFAULT 'vnpay'::character varying,
  credits_added boolean DEFAULT false,
  credits_added_at timestamp with time zone,
  refund_amount numeric DEFAULT 0,
  refund_requested_at timestamp with time zone,
  refund_completed_at timestamp with time zone,
  refund_reason text,
  refund_credits_deducted integer DEFAULT 0,
  previous_plan_slug character varying,
  previous_plan_remaining_value numeric,
  subscription_id uuid, -- Recursive ref added later optionally or ignore if circular
  created_at timestamp with time zone DEFAULT now(),
  paid_at timestamp with time zone,
  completed_at timestamp with time zone,
  expires_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id)
);

-- D. COUPON USAGE
CREATE TABLE IF NOT EXISTS public.coupon_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  discount_amount numeric NOT NULL,
  order_total numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coupon_usage_pkey PRIMARY KEY (id)
);

-- E. PAYMENT LOGS
CREATE TABLE IF NOT EXISTS public.payment_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id),
  event_type character varying NOT NULL,
  payload jsonb,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payment_logs_pkey PRIMARY KEY (id)
);


-- 2. MODIFY EXISTING TABLES (SAFE UPDATE)
-- ==============================================================================

-- A. USERS (Add Plan Tracking)
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS current_plan_slug character varying DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS current_plan_id uuid REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS free_credits_reset_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_plan_purchase_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- B. SUBSCRIPTIONS (Add Payment & Plan Links)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS billing_cycle character varying CHECK (billing_cycle::text = ANY (ARRAY['monthly'::character varying, 'yearly'::character varying]::text[])),
  ADD COLUMN IF NOT EXISTS credits_per_period integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_credit_date date,
  ADD COLUMN IF NOT EXISTS is_auto_renew boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_order_id uuid REFERENCES public.orders(id);

-- C. CREDIT TRANSACTIONS (Add Order/Sub Links)
ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id),
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.subscriptions(id),
  ADD COLUMN IF NOT EXISTS source character varying DEFAULT 'purchase'::character varying CHECK (source::text = ANY (ARRAY['purchase'::character varying, 'subscription_renewal'::character varying, 'bonus'::character varying, 'refund'::character varying, 'admin_adjustment'::character varying]::text[]));

-- D. SAFE CONSTRAINT ADDITION (Orders -> Subscriptions)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_subscription_id_fkey') THEN
        ALTER TABLE public.orders 
        ADD CONSTRAINT orders_subscription_id_fkey 
        FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id);
    END IF;
END $$;


-- 3. LOGIC: FUNCTIONS & TRIGGERS (REPLACE EXISTING)
-- ==============================================================================

-- Auto-generate Order Number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR AS $$
DECLARE
  new_order_number VARCHAR;
  counter INTEGER;
BEGIN
  -- Format: ORD-YYYYMMDD-XXX
  SELECT COUNT(*) INTO counter
  FROM orders
  WHERE DATE(created_at) = CURRENT_DATE;
  
  new_order_number := 'ORD-' || 
                      TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                      LPAD((counter + 1)::TEXT, 3, '0');
  
  RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;

-- Set Default Order Values
CREATE OR REPLACE FUNCTION set_order_defaults()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate order number if not provided
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  
  -- Set expires_at to 15 minutes from now for pending orders
  IF NEW.expires_at IS NULL AND NEW.status = 'pending' THEN
    NEW.expires_at := NOW() + INTERVAL '15 minutes';
  END IF;
  
  -- Auto-set vnpay_txn_ref to order ID if not provided
  IF NEW.vnpay_txn_ref IS NULL THEN
    NEW.vnpay_txn_ref := NEW.id::TEXT;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_order_defaults ON orders;
CREATE TRIGGER trigger_set_order_defaults
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_defaults();

-- Update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON orders;
CREATE TRIGGER trigger_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Increment Coupon Usage
CREATE OR REPLACE FUNCTION increment_coupon_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE coupons 
  SET usage_count = usage_count + 1
  WHERE id = NEW.coupon_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_coupon_usage ON coupon_usage;
CREATE TRIGGER trigger_increment_coupon_usage
  AFTER INSERT ON coupon_usage
  FOR EACH ROW
  EXECUTE FUNCTION increment_coupon_usage();


-- 4. SEED DATA (SAFE INSERT)
-- ==============================================================================
INSERT INTO plans (slug, name, description, credits_monthly, credits_yearly, price_monthly, price_yearly, tier_level, features, max_profiles, max_posts_per_month) 
VALUES
  ('free', 'Free', 'Gói miễn phí cho người dùng mới', 10, 10, 0, 0, 0, 
   '["10 credits", "Tính năng cơ bản", "2 Profiles", "10 posts/month"]'::jsonb, 2, 10),
  
  ('creator', 'Creator', 'Dành cho nhà sáng tạo nội dung cá nhân', 200, 200, 725000, 5970000, 1,
   '["200 credits/month", "10 Profiles", "Unlimited scheduling", "AI Content Generation", "AI Refine Assistant", "Logo Upload"]'::jsonb, 10, NULL),
  
  ('creator_pro', 'Creator Pro', 'Dành cho chuyên gia và team nhỏ', 450, 450, 1225000, 10470000, 2,
   '["450 credits/month", "20 Profiles", "Unlimited scheduling", "AI Content Generation", "AI Refine Assistant", "Logo Upload", "3 users"]'::jsonb, 20, NULL),
  
  ('agency', 'Agency', 'Dành cho agency và doanh nghiệp', 1000, 1000, 2475000, 20970000, 3,
   '["1000 credits/month", "50 Profiles", "Unlimited scheduling", "AI Content Generation", "AI Refine Assistant", "Logo Upload", "10 users"]'::jsonb, 50, NULL)
ON CONFLICT (slug) DO UPDATE SET
  credits_monthly = EXCLUDED.credits_monthly,
  credits_yearly = EXCLUDED.credits_yearly,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  features = EXCLUDED.features,
  max_profiles = EXCLUDED.max_profiles;


-- 5. DISABLE RLS & GRANT PERMISSIONS (PERMISSIVE MODE)
-- ==============================================================================

-- Disable RLS on Payment Tables
ALTER TABLE plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE coupons DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usage DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs DISABLE ROW LEVEL SECURITY;

-- Disable RLS on Modified Tables 
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions DISABLE ROW LEVEL SECURITY;

-- Grant Access
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant ALL to authenticated (Simulate Team Member access)
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant Basic to anon
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT INSERT ON TABLE orders TO anon;
GRANT INSERT ON TABLE payment_logs TO anon;

COMMIT;
