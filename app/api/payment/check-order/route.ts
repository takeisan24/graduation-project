import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const url = new URL(req.url);
    const orderCode = Number(url.searchParams.get("orderCode"));

    if (!orderCode || isNaN(orderCode)) {
      return fail("Mã đơn hàng không hợp lệ", 400);
    }

    const { data: order } = await supabase
      .from("credit_orders")
      .select("*")
      .eq("order_code", orderCode)
      .eq("user_id", user.id)
      .single();

    if (!order) {
      return fail("Đơn hàng không tồn tại", 404);
    }

    return success({ status: order.status, credits: order.credits });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/payment/check-order error:", message);
    return fail(message, 500);
  }
}
