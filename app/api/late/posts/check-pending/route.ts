import { NextRequest } from "next/server";
import { fail, success } from "@/lib/response";
import { withAuthOnly } from "@/lib/middleware/api-protected";
import {
  getResolvedInternalLatePosts,
  serializeLatePost,
} from "@/lib/services/posts/lateCompat";

export async function POST(req: NextRequest) {
  const auth = await withAuthOnly(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const postIds = Array.isArray(body?.postIds) ? body.postIds.map(String) : [];

    if (postIds.length === 0) {
      return fail("Missing required field: postIds", 400);
    }

    const results = await getResolvedInternalLatePosts(postIds, auth.user.id);

    return success({
      results: results.map((item) => ({
        postId: item.postId,
        post: serializeLatePost(item.post),
        postStatus: item.postStatus,
        newStatus: item.newStatus,
        statusChanged: item.statusChanged,
      })),
      errors: [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return fail(message, 500);
  }
}
