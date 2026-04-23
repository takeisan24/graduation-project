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
 * Returns the current AI resource budget, workflow capacity, and recent
 * activity counters for the authenticated user.
 *
 * Legacy fields such as `plan`, `credits`, and `limits` are preserved for
 * compatibility with existing frontend code. Neutral aliases are included so
 * thesis-facing code review can discuss "resources" rather than billing.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    // Read the user's configured resource tier and current AI budget.
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

    // Calculate AI resource budget from the configured tier and current usage.
    const creditsUsed = usage?.credits_used || 0;
    const creditsPurchased = usage?.credits_purchased || 0;
    const totalCredits = getPlanCredits(plan) + creditsPurchased;
    const creditsRemaining = totalCredits - creditsUsed;

    // Prefer the real-time balance from the users table when available.
    const creditsBalance = userData?.credits_balance !== undefined && userData?.credits_balance !== null
      ? userData.credits_balance
      : creditsRemaining;
    // Legacy subscription fields are still returned for compatibility.
    const subscription = await getUserSubscription(user.id);
    const billingCycle = subscription?.billing_cycle || 'monthly';
    const creditsPerPeriod = subscription?.credits_per_period || getPlanCredits(plan);
    const nextCreditGrantAt = userData?.next_credit_grant_at || subscription?.next_credit_date || null;
    const subscriptionEndsAt = userData?.subscription_ends_at || subscription?.current_period_end || null;

    const workflowCapacity = {
      profiles: getPlanProfileLimit(plan),
      posts: getPlanPostLimit(plan),
      connectedAccounts: connectedAccountsCount || 0,
    };

    const resourceBudget = {
      used: creditsUsed,
      purchased: creditsPurchased,
      total: totalCredits,
      remaining: creditsRemaining,
      balance: creditsBalance,
      periodStart: usage?.period_start,
      periodEnd: usage?.period_end,
      allocationCycle: billingCycle,
      allocationPerCycle: creditsPerPeriod,
      nextAllocationAt: nextCreditGrantAt,
      tierEndsAt: subscriptionEndsAt,
    };

    const activityCounters = {
      projectsCreated: monthlyUsage?.projects_created || 0,
      postsCreated: monthlyUsage?.posts_created || 0,
      imagesGenerated: monthlyUsage?.images_generated || 0,
      videosGenerated: monthlyUsage?.videos_generated || 0,
    };

    return success({
      plan,
      resourceTier: plan,
      isSubscriptionActive,
      credits: {
        ...resourceBudget,
        billingCycle,
        creditsPerPeriod,
        nextCreditGrantAt,
        subscriptionEndsAt,
      },
      resourceBudget,
      limits: workflowCapacity,
      workflowCapacity,
      usage: activityCounters,
      activityCounters,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/usage error:", message);
    return fail(message, 500);
  }
}
