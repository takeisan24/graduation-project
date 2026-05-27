import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { supabase } from "@/lib/supabase";
import { addPurchasedCredits } from "@/lib/usage";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const body = await req.json();
    const { orderCode } = body;

    if (!orderCode) {
      return fail("INVALID_ORDER_CODE", 400);
    }

    const { data: order } = await supabase
      .from("credit_orders")
      .select("*")
      .eq("order_code", orderCode)
      .eq("user_id", user.id)
      .single();

    if (!order) {
      return fail("ORDER_NOT_FOUND", 404);
    }

    if (order.status === "PAID") {
      return success({ status: "PAID", credits: order.credits });
    }

    if (order.status !== "PENDING") {
      return fail("ORDER_NOT_CONFIRMABLE", 400);
    }

    const { error: updateError } = await supabase
      .from("credit_orders")
      .update({ status: "PAID", paid_at: new Date().toISOString() })
      .eq("order_code", orderCode)
      .eq("status", "PENDING");

    if (updateError) {
      console.error("[payment/confirm-order] Update error:", updateError);
      return fail("ORDER_CONFIRM_FAILED", 500);
    }

    const creditResult = await addPurchasedCredits(order.user_id, order.credits);

    if (!creditResult.success) {
      console.error("[payment/confirm-order] Add credits failed:", creditResult.reason);
      return fail("CREDITS_ADD_FAILED", 500);
    }

    return success({ status: "PAID", credits: order.credits });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/payment/confirm-order error:", message);
    return fail(message, 500);
  }
}
