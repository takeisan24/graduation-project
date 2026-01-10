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
 * Combined limits and counters for FE (credits, profiles, posts)
 * 
 * Refactored: Uses service layer for all database operations
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await withAuthOnly(req);
    if ('error' in auth) return auth.error;
    const { user } = auth;

    // Users: plan + credits via service layer
    let plan = 'free';
    let creditsRemaining = 0;
    const userRow = await getUserPlanAndCredits(user.id);

    if (userRow) {
      plan = userRow.plan || 'free';
      creditsRemaining = userRow.credits_balance ?? 0;
      console.log(`[api/limits] Loaded plan=${plan}, credits=${creditsRemaining} for user=${user.id}`);
    } else {
      // No users row yet -> ensure profile via RPC and use returned credits
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

    return success({
      creditsRemaining,
      plan,
      profiles: { current: profilesCurrent ?? 0, limit: getPlanProfileLimit(plan) },
      posts: { current: mu?.scheduled_posts ?? 0, limit: getPlanPostLimit(plan) }
    });

  } catch (err: any) {
    console.error("limits route error", err);
    return fail(err.message || "Server error", 500);
  }
}


