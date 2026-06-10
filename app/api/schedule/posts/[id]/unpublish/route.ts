import { NextRequest } from "next/server";
import { fail, success } from "@/lib/response";
import { withAuthOnly } from "@/lib/middleware/api-protected";
import { getPostById, updatePost } from "@/lib/services/db/posts";
import { syncDraftStatusFromScheduledPosts } from "@/lib/services/db/projects";
import { serializeLatePost } from "@/lib/services/posts/lateCompat";
import { isZernioConfigured, unpublishZernioPost, canUnpublishPlatform } from "@/lib/zernio";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/schedule/posts/{id}/unpublish
 * Gỡ 1 bài ĐÃ ĐĂNG khỏi nền tảng thật qua Zernio (POST /posts/{id}/unpublish).
 * Không hỗ trợ Instagram/TikTok. Sau khi gỡ: đánh dấu bài 'cancelled' + xoá URL.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await withAuthOnly(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const post = await getPostById(id);
    if (!post || post.user_id !== auth.user.id) {
      return fail("Post not found", 404);
    }

    if (!(post.late_job_id && post.getlate_account_id && isZernioConfigured())) {
      return fail("Bài này không hỗ trợ gỡ qua Zernio.", 400);
    }

    if (!canUnpublishPlatform(post.platform)) {
      return fail(`Nền tảng ${post.platform} không hỗ trợ gỡ bài đã đăng qua API.`, 400);
    }

    try {
      await unpublishZernioPost(post.late_job_id, post.platform);
    } catch (zErr) {
      const m = zErr instanceof Error ? zErr.message : String(zErr);
      return fail(`Gỡ bài trên nền tảng thất bại: ${m}`, 502);
    }

    const updatedPost = await updatePost(id, auth.user.id, {
      status: "cancelled",
      post_url: null,
    });

    const resolved = updatedPost || { ...post, status: "cancelled" as const, post_url: null };
    if (resolved.draft_id) {
      await syncDraftStatusFromScheduledPosts(resolved.draft_id, auth.user.id);
    }

    return success({ post: serializeLatePost(resolved), status: "cancelled" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return fail(message, 500);
  }
}
