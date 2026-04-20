import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { fail, success } from "@/lib/response";
import { withAuthOnly } from "@/lib/middleware/api-protected";
import { getPostById, updatePost, type PostPayload } from "@/lib/services/db/posts";
import { serializeLatePost } from "@/lib/services/posts/lateCompat";

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

    const updatedPost = await updatePost(id, auth.user.id, {
      scheduled_at: newScheduleAt,
      status: "scheduled",
      post_url: null,
      late_job_id: randomUUID(),
      payload: updatedPayload,
    });

    if (!updatedPost) {
      return fail("Unable to reschedule post", 500);
    }

    return success({ post: serializeLatePost(updatedPost) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return fail(message, 500);
  }
}
