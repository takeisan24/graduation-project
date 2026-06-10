import { NextRequest } from "next/server";
import { fail, success } from "@/lib/response";
import { withAuthOnly } from "@/lib/middleware/api-protected";
import { getPostById, updatePost } from "@/lib/services/db/posts";
import { syncDraftStatusFromScheduledPosts } from "@/lib/services/db/projects";
import { serializeLatePost } from "@/lib/services/posts/lateCompat";
import {
  isZernioConfigured,
  retryZernioPost,
  extractZernioResult,
  pollZernioUntilTerminal,
} from "@/lib/zernio";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/schedule/posts/{id}/retry
 * Thử đăng lại 1 bài đã FAILED qua Zernio (POST /posts/{id}/retry), rồi cập nhật trạng thái + URL thật.
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
      return fail("Bài này không hỗ trợ thử lại qua Zernio.", 400);
    }

    // Gọi Zernio retry; nếu chưa terminal thì poll thêm để lấy kết quả + URL thật.
    let result;
    try {
      const zPost = await retryZernioPost(post.late_job_id);
      result = extractZernioResult(zPost);
      if (result.status === "pending") {
        result = await pollZernioUntilTerminal(post.late_job_id);
      }
    } catch (zErr) {
      const m = zErr instanceof Error ? zErr.message : String(zErr);
      return fail(`Thử lại qua Zernio thất bại: ${m}`, 502);
    }

    const newStatus: "posted" | "failed" = result.status === "failed" ? "failed" : "posted";
    const realUrl = result.platformPostUrl || null;

    const updatedPost = await updatePost(id, auth.user.id, {
      status: newStatus,
      post_url: realUrl,
      payload: {
        ...(post.payload || {}),
        error_message: result.errorMessage || undefined,
      },
    });

    const resolved = updatedPost || { ...post, status: newStatus, post_url: realUrl };
    if (resolved.draft_id) {
      await syncDraftStatusFromScheduledPosts(resolved.draft_id, auth.user.id);
    }

    return success({ post: serializeLatePost(resolved), status: newStatus, url: realUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return fail(message, 500);
  }
}
