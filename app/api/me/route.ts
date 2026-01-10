import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { getPlanCredits, getPlanProfileLimit, getPlanPostLimit } from "@/lib/usage";
import { withAuthOnly } from "@/lib/middleware/api-protected";
import {
  getUserProfileWithSubscription,
  getCurrentMonthUsage,
  countConnectedAccounts
} from "@/lib/services/db/users";

// ✅ Force dynamic rendering for API route
export const dynamic = 'force-dynamic';

/**
 * GET /api/me
 * Get current user's profile with subscription and usage information
 * 
 * Refactored: Uses service layer for all database operations
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await withAuthOnly(req);
    if ('error' in auth) return auth.error;
    const { user } = auth;

    // Fetch user profile with subscription details via service layer
    const profile = await getUserProfileWithSubscription(user.id);

    // Get current usage for the month via service layer
    const usage = await getCurrentMonthUsage(user.id);

    // Get connected accounts count via service layer
    const connectedAccountsCount = await countConnectedAccounts(user.id);

    // Calculate subscription info
    const plan = profile?.plan || 'free';
    const subscription = profile?.subscriptions?.[0] || null;
    const creditsUsed = usage?.credits_used || 0;
    const creditsPurchased = usage?.credits_purchased || 0;
    const totalCredits = getPlanCredits(plan) + creditsPurchased;
    const creditsRemaining = totalCredits - creditsUsed;
    
    // Use credits_balance from users table if available (real-time), otherwise calculate
    const creditsBalance = profile?.credits_balance !== undefined && profile?.credits_balance !== null
      ? profile.credits_balance
      : creditsRemaining;

    // Check if subscription is active
    const isSubscriptionActive = subscription?.status === 'active' || plan === 'free';

    return success({ 
      authUser: user, 
      profile: profile || null,
      subscription: {
        plan,
        status: subscription?.status || 'inactive',
        isActive: isSubscriptionActive,
        currentPeriodStart: subscription?.current_period_start,
        currentPeriodEnd: subscription?.current_period_end,
        cancelAtPeriodEnd: subscription?.cancel_at_period_end || false
      },
      usage: {
        creditsUsed,
        creditsPurchased,
        totalCredits,
        creditsRemaining,
        creditsBalance, // Real-time balance from users table
        periodStart: usage?.period_start,
        periodEnd: usage?.period_end
      },
      limits: {
        profiles: getPlanProfileLimit(plan),
        posts: getPlanPostLimit(plan),
        connectedAccounts: connectedAccountsCount || 0
      }
    });
  
  } catch (err: any) {
    console.error("me route error", err);
    return fail(err.message || "Server error", 500);
  }
}
