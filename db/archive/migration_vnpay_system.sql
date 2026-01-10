-- ============================================
-- VNPay Payment System - Database Migration
-- Created: 2026-01-05
-- Purpose: Complete payment system with VNPay integration
-- ============================================

-- ============================================
-- PART 1: PLANS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Plan identification
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Credits allocation
  credits_monthly INTEGER NOT NULL,
  credits_yearly INTEGER NOT NULL,
  
  -- Pricing (VNĐ)
  price_monthly DECIMAL(12,2) NOT NULL,
  price_yearly DECIMAL(12,2) NOT NULL,
  
  -- Features & limits 
  features JSONB DEFAULT '[]'::jsonb,
  max_profiles INTEGER,
  max_posts_per_month INTEGER,
  
  -- Plan hierarchy (for upgrade/downgrade logic)
  tier_level INTEGER NOT NULL,
  -- 0 = free, 1 = creator, 2 = creator_pro, 3 = agency
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_visible BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_plans_slug ON plans(slug);
CREATE INDEX IF NOT EXISTS idx_plans_tier_level ON plans(tier_level);

-- RLS Policies
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans are viewable by everyone"
  ON plans FOR SELECT
  USING (is_visible = true);

-- Seed data (Pricing based on actual USD rates converted to VND at ~25,000 rate)
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

COMMENT ON TABLE plans IS 'Subscription plans with pricing and features';
COMMENT ON COLUMN plans.tier_level IS 'Hierarchy for upgrade/downgrade logic: 0=free, 1=creator, 2=creator_pro, 3=agency';

-- ============================================
-- PART 2: COUPONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Coupon code
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  
  -- Discount configuration
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
  max_discount_amount DECIMAL(12,2),
  min_order_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Usage limits
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0 CHECK (usage_count >= 0),
  usage_per_user INTEGER DEFAULT 1 CHECK (usage_per_user > 0),
  
  -- Validity period
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  
  -- Applicability
  applies_to_billing VARCHAR(20) NOT NULL DEFAULT 'yearly' 
    CHECK (applies_to_billing IN ('monthly', 'yearly', 'both')),
  applies_to_plans UUID[],
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Tracking
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CHECK (start_date < end_date),
  CHECK (usage_limit IS NULL OR usage_limit > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(UPPER(code));
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_dates ON coupons(start_date, end_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_coupons_created_by ON coupons(created_by);

-- RLS Policies
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can validate active coupons"
  ON coupons FOR SELECT
  USING (
    is_active = true AND
    NOW() BETWEEN start_date AND end_date AND
    (usage_limit IS NULL OR usage_count < usage_limit)
  );

COMMENT ON TABLE coupons IS 'Discount coupons for plans';
COMMENT ON COLUMN coupons.discount_type IS 'percentage (%) or fixed_amount (VNĐ)';
COMMENT ON COLUMN coupons.applies_to_billing IS 'Coupon valid for monthly, yearly, or both';

-- ============================================
-- PART 3: COUPON USAGE TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS coupon_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL, -- Will reference orders table (created below)
  
  -- Snapshot at usage time
  discount_amount DECIMAL(12,2) NOT NULL,
  order_total DECIMAL(12,2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(coupon_id, user_id, order_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_id ON coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_id ON coupon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_order_id ON coupon_usage(order_id);

-- Add FK constraint for order_id (must be added AFTER orders table is created below)
-- This will be added after orders table creation

-- Trigger to increment coupon usage count
CREATE OR REPLACE FUNCTION increment_coupon_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE coupons 
  SET usage_count = usage_count + 1
  WHERE id = NEW.coupon_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_coupon_usage
  AFTER INSERT ON coupon_usage
  FOR EACH ROW
  EXECUTE FUNCTION increment_coupon_usage();

COMMENT ON TABLE coupon_usage IS 'Tracks coupon usage by users and orders';

-- ============================================
-- PART 4: ORDERS TABLE (with refund tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- User & Plan
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  
  -- Plan snapshot (at purchase time)
  plan_name VARCHAR(100) NOT NULL,
  plan_slug VARCHAR(50) NOT NULL,
  billing_cycle VARCHAR(10) NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  credits_amount INTEGER NOT NULL CHECK (credits_amount > 0),
  
  -- Pricing
  subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
  discount_amount DECIMAL(12,2) DEFAULT 0 CHECK (discount_amount >= 0),
  total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
  currency VARCHAR(3) DEFAULT 'VND',
  
  -- Coupon (if applied)
  coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
  coupon_code VARCHAR(50),
  coupon_discount_type VARCHAR(20),
  coupon_discount_value DECIMAL(10,2),
  
  -- Customer info
  customer_name VARCHAR(255),
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20),
  
  -- VNPay transaction data
  vnpay_txn_ref VARCHAR(100) UNIQUE,
  vnpay_transaction_no VARCHAR(100),
  vnpay_bank_code VARCHAR(50),
  vnpay_bank_tran_no VARCHAR(100),
  vnpay_card_type VARCHAR(50),
  vnpay_pay_date VARCHAR(14),
  vnpay_response_code VARCHAR(10),
  vnpay_transaction_status VARCHAR(10),
  vnpay_secure_hash VARCHAR(255),
  vnpay_raw_response JSONB,
  
  -- Order status
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'completed', 'failed', 'expired', 'refunded', 'partially_refunded')),
  payment_method VARCHAR(50) DEFAULT 'vnpay',
  
  -- Credits tracking
  credits_added BOOLEAN DEFAULT false,
  credits_added_at TIMESTAMPTZ,
  
  -- Refund tracking (IMPORTANT for plan changes)
  refund_amount DECIMAL(12,2) DEFAULT 0,
  refund_requested_at TIMESTAMPTZ,
  refund_completed_at TIMESTAMPTZ,
  refund_reason TEXT,
  refund_credits_deducted INTEGER DEFAULT 0,
  
  -- Previous plan (for refund calculation)
  previous_plan_slug VARCHAR(50),
  previous_plan_remaining_value DECIMAL(12,2),
  
  -- Subscription link
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_vnpay_txn_ref ON orders(vnpay_txn_ref);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_coupon_id ON orders(coupon_id) WHERE coupon_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_plan_id ON orders(plan_id);
CREATE INDEX IF NOT EXISTS idx_orders_refund ON orders(status) WHERE status IN ('refunded', 'partially_refunded');

-- RLS Policies
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage orders"
  ON orders FOR ALL
  USING (true);

-- Function to generate order number
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

-- Trigger to auto-generate order number and set expiry
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

CREATE TRIGGER trigger_set_order_defaults
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_defaults();

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE orders IS 'Payment orders with VNPay integration and refund tracking';
COMMENT ON COLUMN orders.refund_amount IS 'Total amount refunded (partial or full)';
COMMENT ON COLUMN orders.previous_plan_slug IS 'User previous plan before upgrade (for refund calculation)';
COMMENT ON COLUMN orders.previous_plan_remaining_value IS 'Prorated value of previous plan when upgraded';

-- ============================================
-- ADD FOREIGN KEY: coupon_usage.order_id → orders.id
-- ============================================
-- Now that orders table exists, add the FK constraint

ALTER TABLE coupon_usage
  ADD CONSTRAINT coupon_usage_order_id_fkey 
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

COMMENT ON CONSTRAINT coupon_usage_order_id_fkey ON coupon_usage IS 'Links coupon usage to the order where it was applied';

-- ============================================
-- PART 5: UPDATE SUBSCRIPTIONS TABLE
-- ============================================

-- Add new columns to existing subscriptions table
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(10) CHECK (billing_cycle IN ('monthly', 'yearly')),
ADD COLUMN IF NOT EXISTS credits_per_period INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_credit_date DATE,
ADD COLUMN IF NOT EXISTS is_auto_renew BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS original_order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

-- Index for credit renewal cron job
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_credit_date 
  ON subscriptions(next_credit_date) 
  WHERE status = 'active' AND billing_cycle = 'yearly';

COMMENT ON COLUMN subscriptions.next_credit_date IS 'Next date to add credits for yearly plans';
COMMENT ON COLUMN subscriptions.original_order_id IS 'Original order that created this subscription';

-- ============================================
-- PART 6: UPDATE PUBLIC.USERS TABLE
-- ============================================

-- Add missing columns to existing public.users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS current_plan_slug VARCHAR(50),
ADD COLUMN IF NOT EXISTS current_plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS free_credits_reset_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_plan_purchase_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Update current_plan_slug based on existing plan column
UPDATE public.users
SET current_plan_slug = LOWER(REPLACE(plan, ' ', '_'))
WHERE current_plan_slug IS NULL AND plan IS NOT NULL;

-- Set default for users without plan
UPDATE public.users
SET current_plan_slug = 'free'
WHERE current_plan_slug IS NULL;

-- Set free_credits_reset_at for free users
UPDATE public.users
SET free_credits_reset_at = NOW() + INTERVAL '7 days'
WHERE current_plan_slug = 'free' AND free_credits_reset_at IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_current_plan_slug ON public.users(current_plan_slug);
CREATE INDEX IF NOT EXISTS idx_users_free_reset 
  ON public.users(free_credits_reset_at) 
  WHERE current_plan_slug = 'free' AND free_credits_reset_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON public.users(is_admin) WHERE is_admin = true;

COMMENT ON COLUMN public.users.current_plan_slug IS 'Current subscription plan slug';
COMMENT ON COLUMN public.users.free_credits_reset_at IS 'When free tier credits will reset (weekly)';
COMMENT ON COLUMN public.users.is_admin IS 'Admin flag for admin panel access';

-- Function to reset free tier credits weekly
CREATE OR REPLACE FUNCTION reset_free_tier_credits()
RETURNS void AS $$
DECLARE
  reset_count INTEGER;
BEGIN
  UPDATE public.users
  SET 
    credits_balance = 10,
    free_credits_reset_at = NOW() + INTERVAL '7 days'
  WHERE 
    current_plan_slug = 'free' AND
    credits_balance <= 0 AND
    (free_credits_reset_at IS NULL OR free_credits_reset_at <= NOW());
    
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RAISE NOTICE 'Reset free tier credits for % users', reset_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_free_tier_credits() IS 'Resets free tier users to 10 credits weekly when depleted';

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- No migration needed - we're updating existing public.users table

-- ============================================
-- PART 7: UPDATE CREDIT_TRANSACTIONS TABLE
-- ============================================

-- Update credit transactions to link to new system
ALTER TABLE credit_transactions
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'purchase'
  CHECK (source IN ('purchase', 'subscription_renewal', 'bonus', 'refund', 'admin_adjustment'));

-- Index
CREATE INDEX IF NOT EXISTS idx_credit_transactions_order_id 
  ON credit_transactions(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_transactions_source 
  ON credit_transactions(source);

COMMENT ON COLUMN credit_transactions.source IS 'Source of credit transaction';

-- ============================================
-- PART 8: PAYMENT LOGS TABLE (for debugging)
-- ============================================

CREATE TABLE IF NOT EXISTS payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  -- 'order_created', 'payment_initiated', 'ipn_received', 'payment_confirmed', 'credits_added', 'refund_processed'
  
  payload JSONB,
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_logs_order_id ON payment_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_created_at ON payment_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_logs_event_type ON payment_logs(event_type);

COMMENT ON TABLE payment_logs IS 'Audit log for all payment-related events';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check all tables created
DO $$
BEGIN
  RAISE NOTICE '=== VNPay Migration Verification ===';
  RAISE NOTICE 'Plans table exists: %', (SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'plans'));
  RAISE NOTICE 'Coupons table exists: %', (SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'coupons'));
  RAISE NOTICE 'Orders table exists: %', (SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'orders'));
  RAISE NOTICE 'Coupon usage table exists: %', (SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'coupon_usage'));
  RAISE NOTICE 'Payment logs table exists: %', (SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'payment_logs'));
  RAISE NOTICE 'Plans seeded: %', (SELECT COUNT(*) FROM plans);
  RAISE NOTICE 'Users table updated: %', (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'current_plan_slug'
  ));
  RAISE NOTICE 'Total users: %', (SELECT COUNT(*) FROM public.users);
END $$;
