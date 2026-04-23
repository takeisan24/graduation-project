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
 * Returns the authenticated user profile plus workflow-related resource data.
 *
 * Legacy keys such as `subscription`, `usage`, and `limits` remain intact for
 * compatibility. Neutral aliases are added for thesis-facing review.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await withAuthOnly(req);
    if ('error' in auth) return auth.error;
    const { user } = auth;

    // Fetch user profile plus stored tier metadata.
    const profile = await getUserProfileWithSubscription(user.id);

    // Get current usage for the month via service layer
    const usage = await getCurrentMonthUsage(user.id);

    // Get connected accounts count via service layer
    const connectedAccountsCount = await countConnectedAccounts(user.id);

    // Calculate current AI resource state from the configured tier and usage.
    const plan = profile?.plan || 'free';
    const subscription = profile?.subscriptions?.[0] || null;
    const creditsUsed = usage?.credits_used || 0;
    const creditsPurchased = usage?.credits_purchased || 0;
    const totalCredits = getPlanCredits(plan) + creditsPurchased;
    const creditsRemaining = totalCredits - creditsUsed;
    
    // Prefer the real-time balance when it is already stored on the user row.
    const creditsBalance = profile?.credits_balance !== undefined && profile?.credits_balance !== null
      ? profile.credits_balance
      : creditsRemaining;

    // Legacy subscription activity field kept for compatibility.
    const isSubscriptionActive = subscription?.status === 'active' || plan === 'free';

    const resourceProfile = {
      tier: plan,
      budget: {
        used: creditsUsed,
        purchased: creditsPurchased,
        total: totalCredits,
        remaining: creditsRemaining,
        balance: creditsBalance,
        periodStart: usage?.period_start,
        periodEnd: usage?.period_end,
      },
      workflowCapacity: {
        profiles: getPlanProfileLimit(plan),
        posts: getPlanPostLimit(plan),
        connectedAccounts: connectedAccountsCount || 0,
      },
    };

    return success({ 
      authUser: user, 
      profile: profile || null,
      resourceProfile,
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
      limits: resourceProfile.workflowCapacity
    });
  
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("me route error", message);
    return fail(message, 500);
  }
}
