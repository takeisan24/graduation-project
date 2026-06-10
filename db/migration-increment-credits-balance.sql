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
-- Validate p_amount > 0 để tránh balance bị trừ nhầm do bug ở tầng application.
-- BẢO MẬT: SET search_path = '' + fully-qualify public.users (chống search_path hijack);
-- và CHỈ service_role (server-side) được gọi — KHÔNG cho anon/authenticated tự gọi
-- /rest/v1/rpc/increment_credits_balance để tự cộng credit.
CREATE OR REPLACE FUNCTION increment_credits_balance(
  p_user_id uuid,
  p_amount   integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'increment_credits_balance: p_amount must be positive, got %', p_amount;
  END IF;
  UPDATE public.users
  SET credits_balance = credits_balance + p_amount,
      updated_at      = now()
  WHERE id = p_user_id;
END;
$$;

-- Thu hồi quyền gọi mặc định (PUBLIC) + anon/authenticated; chỉ service_role được phép.
REVOKE EXECUTE ON FUNCTION increment_credits_balance(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION increment_credits_balance(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION increment_credits_balance(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION increment_credits_balance(uuid, integer) TO service_role;
