-- ============================================
-- Migration: RPC increment_credits_balance
-- Atomic credit top-up increment để tránh race condition
-- Chạy trong Supabase SQL Editor
-- ============================================

-- Xóa version cũ nếu tồn tại (idempotent)
DROP FUNCTION IF EXISTS increment_credits_balance(uuid, integer);

-- Tạo hàm atomic increment credits_balance trong bảng users.
-- Dùng SQL expression `credits_balance + p_amount` thay vì
-- read-modify-write để tránh race condition khi nhiều top-up xảy ra đồng thời.
CREATE OR REPLACE FUNCTION increment_credits_balance(
  p_user_id uuid,
  p_amount   integer
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE users
  SET credits_balance = credits_balance + p_amount,
      updated_at      = now()
  WHERE id = p_user_id;
$$;

-- Chỉ service_role được gọi RPC này (gọi từ API route server-side)
GRANT EXECUTE ON FUNCTION increment_credits_balance(uuid, integer) TO service_role;
