import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getDraftById, updateDraft } from "@/lib/services/db/projects";
import { DEFAULT_TIMEZONE } from "@/lib/utils/date";
import { checkPostLimit, trackUsage } from "@/lib/usage";

/**
 * POST /api/schedule/:draftId
 * body: { profile_ids: string[], scheduled_time: ISOString }
 *
 * Schedules a draft by saving it to DB with scheduled status.
 */
export async function POST(req: NextRequest, { params }: { params: { draftId: string } }) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const draftId = params.draftId;
    const body = await req.json();
    const profileIds: string[] = Array.isArray(body?.profile_ids) ? body.profile_ids : [];
    const scheduledTime: string | undefined = body?.scheduled_time;
    const timezone: string | undefined = body?.timezone;

    if (!scheduledTime) return fail("scheduled_time (ISO) is required", 400);
    if (!profileIds || profileIds.length === 0) return fail("profile_ids required", 400);

    // Validate draft ownership via service layer
    const draft = await getDraftById(draftId, user.id);
    if (!draft) return fail("Draft not found", 404);

    // If draft already scheduled/posted, block
    if (["scheduled", "posted"].includes(draft.status)) {
      return fail(`Draft status is '${draft.status}', cannot schedule`, 400);
    }

    // Giới hạn số bài lên lịch theo gói (free: 10/tháng; trả phí: không giới hạn)
    const postLimit = await checkPostLimit(user.id);
    if (!postLimit.canSchedule) {
      return fail(JSON.stringify({
        message: `Đã đạt giới hạn ${postLimit.limit} bài lên lịch trong tháng của gói hiện tại.`,
        current: postLimit.current,
        limit: postLimit.limit,
        upgradeRequired: true,
      }), 403);
    }

    // Save scheduled posts to DB
    const { createScheduledPost } = await import("@/lib/services/db/posts");
    const results = [];

    for (const profileId of profileIds) {
      try {
        const savedPost = await createScheduledPost({
          user_id: user.id,
          draft_id: draftId,
          platform: draft.platform || '',
          scheduled_at: scheduledTime,
          status: "scheduled",
          payload: {
            text: draft.text_content ?? undefined,
            mediaUrls: draft.media_urls || [],
            profile_id: profileId,
            timezone: timezone || DEFAULT_TIMEZONE
          }
        });
        results.push({ profileId, success: true, post: savedPost });
      } catch (e: unknown) {
        const eMsg = e instanceof Error ? e.message : String(e);
        results.push({ profileId, success: false, error: eMsg });
      }
    }

    const anySuccess = results.some(r => r.success);

    // Update draft status if at least one post was scheduled successfully
    if (anySuccess) {
      await updateDraft(draftId, user.id, { status: "scheduled", scheduled_at: scheduledTime });
      const okCount = results.filter(r => r.success).length;
      await trackUsage(user.id, 'post_scheduled', okCount).catch(() => {});
    }

    return success({ ok: anySuccess, results }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/schedule/[draftId] error:", message);
    return fail(message, 500);
  }
}
