-- ============================================
-- Migration: Bảng credit_orders cho PayOS
-- Chạy trong Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS credit_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_code BIGINT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL,
  credits INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT credit_orders_status_check CHECK (
    status IN ('PENDING', 'PAID', 'CANCELLED', 'FAILED')
  )
);

CREATE INDEX IF NOT EXISTS idx_credit_orders_user_id ON credit_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_orders_order_code ON credit_orders(order_code);
CREATE INDEX IF NOT EXISTS idx_credit_orders_status ON credit_orders(status);

-- Grant access
GRANT ALL ON credit_orders TO service_role;
