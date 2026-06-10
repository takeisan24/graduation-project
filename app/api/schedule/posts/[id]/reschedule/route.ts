import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { fail, success } from "@/lib/response";
import { withAuthOnly } from "@/lib/middleware/api-protected";
import { getPostById, updatePost, type PostPayload } from "@/lib/services/db/posts";
import { syncDraftStatusFromScheduledPosts } from "@/lib/services/db/projects";
import { serializeLatePost } from "@/lib/services/posts/lateCompat";
import { isZernioConfigured, updateZernioPost } from "@/lib/zernio";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await withAuthOnly(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const body = await req.json();
    const { newScheduleAt, timezone } = body || {};

    if (!newScheduleAt || typeof newScheduleAt !== "string") {
      return fail("Missing required field: newScheduleAt", 400);
    }

    // Validate phía server: thời gian lên lịch phải hợp lệ và ở tương lai (đối xứng với client).
    const newTime = new Date(newScheduleAt);
    if (Number.isNaN(newTime.getTime())) {
      return fail("Invalid newScheduleAt", 400);
    }
    if (newTime.getTime() <= Date.now()) {
      return fail("Thời gian lên lịch phải ở tương lai", 400);
    }

    const post = await getPostById(id);
    if (!post || post.user_id !== auth.user.id) {
      return fail("Post not found", 404);
    }

    const updatedPayload: PostPayload = {
      ...(post.payload || {}),
      timezone: typeof timezone === "string" ? timezone : post.payload?.timezone,
      error: undefined,
      error_message: undefined,
      error_details: undefined,
      status_check_response: undefined,
    };

    // Bài Zernio thật: PHẢI cập nhật scheduledFor trên Zernio (Zernio mới là bộ lập lịch),
    // và GIỮ NGUYÊN late_job_id (= id post Zernio) để không mất liên kết.
    const isZernioPost = !!(post.late_job_id && post.getlate_account_id && isZernioConfigured());
    if (isZernioPost) {
      try {
        await updateZernioPost(post.late_job_id!, {
          scheduledFor: newScheduleAt,
          timezone: typeof timezone === "string" ? timezone : undefined,
        });
      } catch (zErr) {
        const m = zErr instanceof Error ? zErr.message : String(zErr);
        return fail(`Không cập nhật được lịch đăng trên Zernio: ${m}`, 502);
      }
    }

    const updatedPost = await updatePost(id, auth.user.id, {
      scheduled_at: newScheduleAt,
      status: "scheduled",
      post_url: null,
      late_job_id: isZernioPost ? post.late_job_id : randomUUID(),
      payload: updatedPayload,
    });

    if (!updatedPost) {
      return fail("Unable to reschedule post", 500);
    }

    if (updatedPost.draft_id) {
      await syncDraftStatusFromScheduledPosts(updatedPost.draft_id, auth.user.id);
    }

    return success({ post: serializeLatePost(updatedPost) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return fail(message, 500);
  }
}
