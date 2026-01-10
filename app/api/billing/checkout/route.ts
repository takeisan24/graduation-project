import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { lemonClient, PLAN_CONFIG, CREDIT_PACKAGES } from "@/lib/payments/lemonsqueezy";

/**
 * POST /api/billing/checkout
 * Create checkout session for subscription or credit top-up
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req); 
    if (!user) return fail("Unauthorized", 401);
    
    const body = await req.json();
    const { type, planId, creditPackage } = body;
    
    if (!type) return fail("Type is required", 400);
    
    const email = user.email || '';
    
    if (type === 'subscription') {
      if (!planId) return fail("Plan ID is required for subscription", 400);
      
      // Validate plan
      if (!PLAN_CONFIG[planId as keyof typeof PLAN_CONFIG]) {
        return fail("Invalid plan", 400);
      }
      
      const checkout = await lemonClient.createCheckout({
        planId,
        email,
        userId: user.id
      });
      
      return success({
        checkoutUrl: checkout.url,
        checkoutId: checkout.checkoutId,
        type: 'subscription',
        plan: PLAN_CONFIG[planId as keyof typeof PLAN_CONFIG]
      });
      
    } else if (type === 'topup') {
      if (!creditPackage) return fail("Credit package is required for top-up", 400);
      
      // Validate credit package
      if (!CREDIT_PACKAGES[creditPackage as keyof typeof CREDIT_PACKAGES]) {
        return fail("Invalid credit package", 400);
      }
      
      const checkout = await lemonClient.createTopUpCheckout({
        creditPackage,
        email,
        userId: user.id
      });
      
      return success({
        checkoutUrl: checkout.url,
        checkoutId: checkout.checkoutId,
        type: 'topup',
        package: CREDIT_PACKAGES[creditPackage as keyof typeof CREDIT_PACKAGES]
      });
      
    } else {
      return fail("Invalid type. Must be 'subscription' or 'topup'", 400);
    }
    
  } catch (err: any) {
    console.error("POST /api/billing/checkout error:", err);
    return fail(err.message || "Server error", 500);
  }
}