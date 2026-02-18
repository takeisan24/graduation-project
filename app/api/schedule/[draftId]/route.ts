import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getDraftById, updateDraft } from "@/lib/services/db/projects";
import { DEFAULT_TIMEZONE } from "@/lib/utils/date";

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

    // Save scheduled posts to DB
    const { createPost } = await import("@/lib/services/db/posts");
    const results = [];

    for (const profileId of profileIds) {
      try {
        const savedPost = await createPost({
          user_id: user.id,
          draft_id: draftId,
          platform: draft.platform,
          profile_id: profileId,
          text_content: draft.text_content,
          media_urls: draft.media_urls || [],
          scheduled_at: scheduledTime,
          timezone: timezone || DEFAULT_TIMEZONE,
          status: "scheduled"
        });
        results.push({ profileId, success: true, post: savedPost });
      } catch (e: any) {
        results.push({ profileId, success: false, error: e.message });
      }
    }

    const anySuccess = results.some(r => r.success);

    // Update draft status if at least one post was scheduled successfully
    if (anySuccess) {
      await updateDraft(draftId, user.id, { status: "scheduled", scheduled_at: scheduledTime });
    }

    return success({ ok: anySuccess, results }, 201);
  } catch (err: any) {
    console.error("POST /api/schedule/[draftId] error:", err);
    return fail(err.message || "Server error", 500);
  }
}
