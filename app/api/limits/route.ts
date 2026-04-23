import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { withAuthOnly } from "@/lib/middleware/api-protected";
import { getPlanPostLimit, getPlanProfileLimit } from "@/lib/usage";
import {
  getUserPlanAndCredits,
  ensureUserProfile,
  countConnectedAccounts,
  getMonthlyUsage
} from "@/lib/services/db/users";

// ✅ Force dynamic rendering for API route
export const dynamic = 'force-dynamic';
import { getMonthStartDate, DEFAULT_TIMEZONE } from "@/lib/utils/date";

/**
 * GET /api/limits
 * Returns compact workflow capacity data for the authenticated user.
 *
 * Legacy fields such as `plan` and `creditsRemaining` are preserved for
 * compatibility. Neutral aliases are included for thesis-facing review.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await withAuthOnly(req);
    if ('error' in auth) return auth.error;
    const { user } = auth;

    // Read the configured resource tier and real-time AI balance.
    let plan = 'free';
    let creditsRemaining = 0;
    const userRow = await getUserPlanAndCredits(user.id);

    if (userRow) {
      plan = userRow.plan || 'free';
      creditsRemaining = userRow.credits_balance ?? 0;
    } else {
      // No users row yet: bootstrap the profile and use the returned balance.
      const ensuredCredits = await ensureUserProfile(user.id);
      if (ensuredCredits !== null && ensuredCredits !== undefined) {
        creditsRemaining = ensuredCredits;
        plan = 'free';
      }
    }

    // Profiles current via service layer
    const profilesCurrent = await countConnectedAccounts(user.id);

    // Posts current = monthly_usage.scheduled_posts for current month via service layer
    const month = getMonthStartDate(DEFAULT_TIMEZONE);
    const mu = await getMonthlyUsage(user.id, month);

    const workflowCapacity = {
      profiles: { current: profilesCurrent ?? 0, limit: getPlanProfileLimit(plan) },
      posts: { current: mu?.scheduled_posts ?? 0, limit: getPlanPostLimit(plan) },
    };

    return success({
      creditsRemaining,
      plan,
      resourceTier: plan,
      profiles: workflowCapacity.profiles,
      posts: workflowCapacity.posts,
      resourceBudget: {
        remaining: creditsRemaining,
      },
      workflowCapacity,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("limits route error", message);
    return fail(message, 500);
  }
}


