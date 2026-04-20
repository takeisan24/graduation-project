import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getPlanCredits, getPlanProfileLimit, getPlanPostLimit } from "@/lib/usage";
import {
  getUserProfile,
  getCurrentMonthUsage,
  getMonthlyUsage,
  countConnectedAccounts,
  getUserSubscription
} from "@/lib/services/db/users";
import { getMonthStartDate, DEFAULT_TIMEZONE } from "@/lib/utils/date";

// ✅ Force dynamic rendering for API route
export const dynamic = 'force-dynamic';

/**
 * GET /api/usage
 * Get user's current usage and limits
 * 
 * Refactored: Uses service layer for all database operations
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    // Get user's plan and credits_balance via service layer
    const userData = await getUserProfile(user.id);
    const plan = userData?.plan || 'free';
    const isSubscriptionActive = userData?.subscription_status === 'active' || plan === 'free';

    // Get current month usage via service layer
    const usage = await getCurrentMonthUsage(user.id);

    // Get monthly usage via service layer
    const month = getMonthStartDate(DEFAULT_TIMEZONE);
    const monthlyUsage = await getMonthlyUsage(user.id, month);

    // Get connected accounts count via service layer
    const connectedAccountsCount = await countConnectedAccounts(user.id);

    // Calculate credits
    const creditsUsed = usage?.credits_used || 0;
    const creditsPurchased = usage?.credits_purchased || 0;
    const totalCredits = getPlanCredits(plan) + creditsPurchased;
    const creditsRemaining = totalCredits - creditsUsed;

    // Use credits_balance from users table if available (real-time), otherwise calculate
    const creditsBalance = userData?.credits_balance !== undefined && userData?.credits_balance !== null
      ? userData.credits_balance
      : creditsRemaining;
    // Fetch subscription details to get billing_cycle and credits_per_period
    const subscription = await getUserSubscription(user.id);
    const billingCycle = subscription?.billing_cycle || 'monthly';
    const creditsPerPeriod = subscription?.credits_per_period || getPlanCredits(plan);
    const nextCreditGrantAt = userData?.next_credit_grant_at || subscription?.next_credit_date || null;
    const subscriptionEndsAt = userData?.subscription_ends_at || subscription?.current_period_end || null;

    return success({
      plan,
      isSubscriptionActive,
      credits: {
        used: creditsUsed,
        purchased: creditsPurchased,
        total: totalCredits,
        remaining: creditsRemaining,
        balance: creditsBalance, // Real-time balance from users table
        periodStart: usage?.period_start,
        periodEnd: usage?.period_end,
        billingCycle: billingCycle,
        creditsPerPeriod: creditsPerPeriod,
        nextCreditGrantAt: nextCreditGrantAt,
        subscriptionEndsAt: subscriptionEndsAt
      },
      limits: {
        profiles: getPlanProfileLimit(plan),
        posts: getPlanPostLimit(plan),
        connectedAccounts: connectedAccountsCount || 0
      },
      usage: {
        projectsCreated: monthlyUsage?.projects_created || 0,
        postsCreated: monthlyUsage?.posts_created || 0,
        imagesGenerated: monthlyUsage?.images_generated || 0,
        videosGenerated: monthlyUsage?.videos_generated || 0
      }
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/usage error:", message);
    return fail(message, 500);
  }
}
