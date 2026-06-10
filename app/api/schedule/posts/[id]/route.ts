import { NextRequest } from "next/server";
import { fail, success } from "@/lib/response";
import { withAuthOnly } from "@/lib/middleware/api-protected";
import { deletePost, getPostById } from "@/lib/services/db/posts";
import { syncDraftStatusFromScheduledPosts } from "@/lib/services/db/projects";
import { serializeLatePost } from "@/lib/services/posts/lateCompat";
import { isZernioConfigured, deleteZernioPost } from "@/lib/zernio";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await withAuthOnly(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const post = await getPostById(id);
    if (!post || post.user_id !== auth.user.id) {
      return fail("Post not found", 404);
    }

    return success({ post: serializeLatePost(post) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return fail(message, 500);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const auth = await withAuthOnly(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    // skipZernio=true → "Chỉ gỡ khỏi lịch": xoá bản ghi DB nhưng GIỮ lịch/bài trên Zernio dashboard.
    const skipZernio = req.nextUrl.searchParams.get("skipZernio") === "true";
    const post = await getPostById(id);
    if (!post || post.user_id !== auth.user.id) {
      return fail("Post not found", 404);
    }

    // Xoá THẬT trên Zernio để đồng bộ dashboard (nếu là bài Zernio thật).
    // Bài đã published Zernio không cho xoá (400) → bỏ qua, vẫn xoá khỏi DB hệ thống.
    if (!skipZernio && post.late_job_id && post.getlate_account_id && isZernioConfigured()) {
      try {
        await deleteZernioPost(post.late_job_id);
      } catch (zErr) {
        const m = zErr instanceof Error ? zErr.message : String(zErr);
        console.warn(`[schedule/posts/DELETE] Zernio delete post failed for ${post.late_job_id}:`, m);
      }
    }

    const deleted = await deletePost(id, auth.user.id);
    if (!deleted) {
      return fail("Unable to delete post", 404);
    }

    if (post.draft_id) {
      await syncDraftStatusFromScheduledPosts(post.draft_id, auth.user.id);
    }

    return success({ deleted: true, id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return fail(message, 500);
  }
}
