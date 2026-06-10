import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { findPackageById, computeCreditAmount, MIN_CREDITS, MAX_CREDITS } from "@/lib/constants/credit-packages";
import { supabase } from "@/lib/supabase";
import { buildVietQRUrl, getVietQRConfig } from "@/lib/vietqr";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const body = await req.json();

    // Ưu tiên mô hình "trả theo dùng": { credits } số tự do. Giữ tương thích cũ: { packageId }.
    let credits: number;
    let amount: number;
    let packageId: string;
    if (typeof body.credits === "number" && Number.isFinite(body.credits)) {
      credits = Math.floor(body.credits);
      if (credits < MIN_CREDITS || credits > MAX_CREDITS) {
        return fail("INVALID_CREDITS", 400);
      }
      amount = computeCreditAmount(credits);
      packageId = "custom";
    } else {
      const pkg = findPackageById(body.packageId);
      if (!pkg) {
        return fail("INVALID_PACKAGE", 400);
      }
      credits = pkg.credits;
      amount = pkg.priceVND;
      packageId = pkg.id;
    }

    const orderCode = Number(
      `${Date.now()}${Math.floor(Math.random() * 10000)}`.slice(-12)
    );

    const { error: insertError } = await supabase
      .from("credit_orders")
      .insert({
        order_code: orderCode,
        user_id: user.id,
        package_id: packageId,
        credits,
        amount,
        status: "PENDING",
      });

    if (insertError) {
      console.error("[payment/create-order] DB insert error:", insertError);
      return fail("ORDER_CREATE_FAILED", 500);
    }

    const qrUrl = buildVietQRUrl({ amount, orderCode });
    const { accountNo, accountName, bankBin } = getVietQRConfig();

    return success({
      qrUrl,
      orderCode,
      credits,
      bankInfo: {
        bankBin,
        accountNo,
        accountName,
        amount,
        content: `CREATORHUB ${orderCode}`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/payment/create-order error:", message);
    return fail(message, 500);
  }
}
