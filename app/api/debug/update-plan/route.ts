import { NextRequest } from "next/server";
import { withAuthOnly } from "@/lib/middleware/api-protected";
import { success, fail } from "@/lib/response";
import { supabase } from "@/lib/supabase";
import { ensureUserProfile } from "@/lib/services/db/users";

const ALLOWED_PLANS = ["free", "creator", "creator_pro", "agency"];

/**
 * Temporary test-only endpoint to adjust plan and credits.
 * Do NOT ship to production builds.
 */
export async function POST(req: NextRequest) {
  // Disable debug endpoint for production
  return fail("Endpoint disabled", 404);

  /* ORIGINAL DEBUG LOGIC - UNCOMMENT TO ENABLE
  const auth = await withAuthOnly(req);
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const body = await req.json();
    const plan = typeof body.plan === "string" ? body.plan.toLowerCase() : "free";
    const updatedCredits = Number(body.credits ?? 0);

    if (!ALLOWED_PLANS.includes(plan)) {
      return fail("Invalid plan type", 400);
    }
    if (!Number.isFinite(updatedCredits) || updatedCredits < 0) {
      return fail("credits must be a non-negative number", 400);
    }

    const userId = auth.user.id;
    let { data: userRow, error } = await supabase
      .from("users")
      .select("plan, credits_balance")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("[debug/update-plan] Failed to fetch user:", error);
      return fail("Unable to load user record", 500);
    }

    if (!userRow) {
      const ensuredCredits = await ensureUserProfile(userId);
      userRow = {
        plan: "free",
        credits_balance: ensuredCredits ?? 0,
      };
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({
        plan,
        credits_balance: updatedCredits,
        subscription_status: 'active' // Simulate active subscription for testing
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[debug/update-plan] Failed to update user:", updateError);
      return fail("Unable to update plan/credits", 500);
    }

    return success({
      plan,
      creditsBalance: updatedCredits,
    });
  } catch (err: any) {
    console.error("[debug/update-plan] Unexpected error:", err);
    return fail(err?.message || "Server error", 500);
  }
  */
}
