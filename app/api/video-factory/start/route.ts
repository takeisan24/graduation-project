import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { requireAuth } from "@/lib/auth";
import { withApiProtection } from "@/lib/middleware/api-protected";

const SERVER_B_URL = process.env.SERVER_B_URL;
const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) {
      return fail("Unauthorized", 401);
    }

    if (!SERVER_B_URL || !SERVER_B_API_KEY) {
      return fail("Server B is not configured", 500);
    }

    const body = await req.json();

    // ✅ NEW: Use estimatedCredits from FE (exact value shown to user) instead of recalculating
    // This prevents FE/BE mismatch and ensures user sees accurate credit deduction
    const amount = body.estimatedCredits || (() => {
      // ✅ FALLBACK: If FE doesn't send estimatedCredits, calculate from cut config (backward compatibility)
      const clipCount = body.cut?.auto?.clip_count || body.cut?.manual?.length || 1;
      const clipDuration = body.cut?.auto?.clip_duration_preference || '60-90s';
      const durationMultiplier = clipDuration === '<60s' ? 1.0 : clipDuration === '60-90s' ? 1.5 : 2.0;
      return Math.ceil(clipCount * 5 * durationMultiplier);
    })();

    // Paywall/auth check + UPFRONT DEDUCTION
    const protection = await withApiProtection(req, 'CUT_CLIP', {
      returnError: true,
      skipDeduct: false, // ✅ Upfront deduction enabled
      amount: amount
    });

    if ('error' in protection) {
      const status = protection.error.status ?? 401;
      const body = await protection.error.json().catch(() => undefined);
      return fail(body?.error || body?.message || 'Unauthorized or insufficient credits', status);
    }

    // Forward to Server B
    const res = await fetch(`${SERVER_B_URL}/api/v1/video-factory/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SERVER_B_API_KEY,
        'x-user-id': user.id,
      },
      body: JSON.stringify({
        ...body,
        // ✅ DYNAMIC CALLBACK: Use VIDEO_FACTORY_APP_URL for reliable server-to-server webhooks
        callback_url: `${process.env.VIDEO_FACTORY_APP_URL || 'http://localhost:3000'}/api/webhooks/video`,
        metadata: {
          ...(body.metadata || {}),
          credit_held: true,
          deducted_amount: amount,
          action_type: 'CUT_CLIP'
        }
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      // ✅ ROLLBACK IF SERVER B FAILS
      console.error(`[Video Factory Start] Server B error - refunding ${amount} credits`);
      const { rollbackCredits } = await import("@/lib/usage");
      await rollbackCredits(user.id, 'CUT_CLIP', {
        reason: 'video_factory_start_server_b_fail',
        error: json?.error || 'Unknown error'
      }, amount);

      return fail(json?.error || 'Server B error', res.status);
    }

    // Success - stats only
    const { trackUsage } = await import("@/lib/usage");
    await trackUsage(user.id, 'project_created');

    // ✅ NEW: Get updated credits for instant FE UI update (matching Text-to-Video pattern)
    const { getUserPlanAndCredits } = await import("@/lib/services/db/users");
    const userCredits = await getUserPlanAndCredits(user.id);
    const creditsRemaining = userCredits?.credits_balance ?? 0;

    return success({
      ...(json?.data ?? json),
      creditsRemaining
    }, res.status);
  } catch (err: any) {
    console.error("POST /api/video-factory/start error:", err);
    return fail("Server error", 500);
  }
}

