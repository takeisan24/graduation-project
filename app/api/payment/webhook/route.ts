import { NextResponse } from "next/server";

// AUDIT-002 / B17a: This webhook is intentionally a stub for the thesis demo.
// In production, this endpoint must:
//   1. Verify the payment provider's HMAC/signature before processing
//   2. Match the transaction amount and orderCode against credit_orders
//   3. Call addPurchasedCredits() only after successful verification
//   4. Return 401 on signature mismatch, 409 on duplicate, 200 on success
//
// For the thesis demo, credits are granted via the manual confirm-order route
// (gated by ENABLE_MANUAL_CONFIRM=true). This stub exists so the endpoint is
// registered and does not 404 if the payment provider sends a callback.
export async function POST() {
  return NextResponse.json({ success: true });
}
