import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { withPaywallCheck } from "@/lib/paywall";
import { getDraftById, updateDraft } from "@/lib/services/db/projects";
import { scheduleDraftPost } from "@/lib/services/late/scheduleService";
import { DEFAULT_TIMEZONE } from "@/lib/utils/date";

/**
 * POST /api/schedule/:draftId
 * body: { profile_ids: string[], scheduled_time: ISOString, idType?: 'late_profile'|'connected_account' }
 */
export async function POST(req: NextRequest, { params }: { params: { draftId: string } }) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    // Check paywall for post scheduling
    const paywallCheck = await withPaywallCheck(req, 'posts');
    if ('error' in paywallCheck) {
      return fail(paywallCheck.error.message, paywallCheck.error.status);
    }
    
    const { paywallResult } = paywallCheck;
    
    if (!paywallResult.allowed) {
      return fail(JSON.stringify({
        message: paywallResult.reason,
        upgradeRequired: paywallResult.upgradeRequired,
        currentLimit: paywallResult.currentLimit,
        limitReached: paywallResult.limitReached
      }), 403);
    }

    const draftId = params.draftId;
    const body = await req.json();
    const profileIds: string[] = Array.isArray(body?.profile_ids) ? body.profile_ids : [];
    const scheduledTime: string | undefined = body?.scheduled_time;
    const timezone: string | undefined = body?.timezone;
    const idType: "late_profile" | "connected_account" = body?.idType === "connected_account" ? "connected_account" : "late_profile";

    if (!scheduledTime) return fail("scheduled_time (ISO) is required", 400);
    if (!profileIds || profileIds.length === 0) return fail("profile_ids required", 400);

    // Validate draft ownership via service layer
    const draft = await getDraftById(draftId, user.id);
    if (!draft) return fail("Draft not found", 404);

    // If draft already scheduled/posted, block
    if (["scheduled", "posted"].includes(draft.status)) {
      return fail(`Draft status is '${draft.status}', cannot schedule`, 400);
    }

    // Schedule draft post via service layer
    const result = await scheduleDraftPost(user, draft, profileIds, scheduledTime, idType, timezone || DEFAULT_TIMEZONE);
    
    // Update draft status if at least one post was scheduled successfully
    if (result.success) {
      await updateDraft(draftId, user.id, { status: "scheduled", scheduled_at: scheduledTime });
    }

    return success({ ok: result.success, results: result.results }, 201);
  } catch (err: any) {
    console.error("POST /api/schedule/[draftId] error:", err);
    return fail(err.message || "Server error", 500);
  }
}
