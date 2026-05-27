import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { findPackageById } from "@/lib/constants/credit-packages";
import { supabase } from "@/lib/supabase";
import { buildVietQRUrl, getVietQRConfig } from "@/lib/vietqr";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const body = await req.json();
    const { packageId } = body;

    const pkg = findPackageById(packageId);
    if (!pkg) {
      return fail("Gói credits không hợp lệ", 400);
    }

    const orderCode = Number(
      `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-12)
    );

    const { error: insertError } = await supabase
      .from("credit_orders")
      .insert({
        order_code: orderCode,
        user_id: user.id,
        package_id: pkg.id,
        credits: pkg.credits,
        amount: pkg.priceVND,
        status: "PENDING",
      });

    if (insertError) {
      console.error("[payment/create-order] DB insert error:", insertError);
      return fail("Không thể tạo đơn hàng", 500);
    }

    const qrUrl = buildVietQRUrl({ amount: pkg.priceVND, orderCode });
    const { accountNo, accountName, bankBin } = getVietQRConfig();

    return success({
      qrUrl,
      orderCode,
      bankInfo: {
        bankBin,
        accountNo,
        accountName,
        amount: pkg.priceVND,
        content: `CREATORHUB ${orderCode}`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/payment/create-order error:", message);
    return fail(message, 500);
  }
}
