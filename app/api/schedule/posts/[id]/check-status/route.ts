import { NextRequest } from "next/server";
import { fail, success } from "@/lib/response";
import { withAuthOnly } from "@/lib/middleware/api-protected";
import {
  getResolvedInternalLatePost,
  serializeLatePost,
} from "@/lib/services/posts/lateCompat";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await withAuthOnly(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const resolved = await getResolvedInternalLatePost(id, auth.user.id);
    if (!resolved) {
      return fail("Post not found", 404);
    }

    return success({
      post: serializeLatePost(resolved.post),
      postStatus: resolved.postStatus,
      newStatus: resolved.newStatus,
      statusChanged: resolved.statusChanged,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return fail(message, 500);
  }
}
