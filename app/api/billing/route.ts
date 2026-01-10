import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { lemonClient, PLAN_CONFIG, CREDIT_PACKAGES } from "@/lib/payments/lemonsqueezy";
import { getPlanCredits, getPlanProfileLimit, getPlanPostLimit } from "@/lib/usage";
import { getUserSubscription, getCurrentMonthUsageRecord, getUserProfile } from "@/lib/services/db/users";

/**
 * GET /api/billing
 * Get user's current subscription and billing information
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req); 
    if (!user) return fail("Unauthorized", 401);
    
    // Get user's subscription details via service layer
    const subscription = await getUserSubscription(user.id);
    
    // Get user's current usage via service layer
    const usage = await getCurrentMonthUsageRecord(user.id);
    
    // Get user's plan details
    const plan = subscription?.plan || 'free';
    const planConfig = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG] || {
      name: 'Free',
      price: 0,
      credits: 10,
      profiles: 2,
      posts: 10,
      features: ['ai_content']
    };
    
    // Calculate credits remaining
    const creditsUsed = usage?.credits_used || 0;
    const creditsPurchased = usage?.credits_purchased || 0;
    const totalCredits = planConfig.credits + creditsPurchased;
    const creditsRemaining = totalCredits - creditsUsed;
    
    return success({
      subscription: subscription || null,
      plan: planConfig,
      usage: {
        creditsUsed,
        creditsPurchased,
        totalCredits,
        creditsRemaining,
        periodStart: usage?.period_start,
        periodEnd: usage?.period_end
      },
      limits: {
        profiles: getPlanProfileLimit(plan),
        posts: getPlanPostLimit(plan)
      }
    });
    
  } catch (err: any) {
    console.error("GET /api/billing error:", err);
    return fail(err.message || "Server error", 500);
  }
}

/**
 * POST /api/billing
 * Create checkout session for subscription or credit top-up
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req); 
    if (!user) return fail("Unauthorized", 401);
    
    const body = await req.json();
    const { type, planId, creditPackage } = body;
    
    if (!type) return fail("Type is required", 400);
    
    // Get user's email via service layer
    const userData = await getUserProfile(user.id);
    if (!userData) return fail("User not found", 404);
    
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
        type: 'subscription'
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
        type: 'topup'
      });
      
    } else {
      return fail("Invalid type. Must be 'subscription' or 'topup'", 400);
    }
    
  } catch (err: any) {
    console.error("POST /api/billing error:", err);
    return fail(err.message || "Server error", 500);
  }
}
