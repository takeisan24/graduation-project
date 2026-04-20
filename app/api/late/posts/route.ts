import { NextRequest } from "next/server";
import { fail, success } from "@/lib/response";
import { withAuthOnly } from "@/lib/middleware/api-protected";
import { getDraftById } from "@/lib/services/db/projects";
import {
  createInternalLatePost,
  getAllInternalLatePosts,
  getOwnedConnectionOrNull,
  serializeLatePost,
} from "@/lib/services/posts/lateCompat";

export async function GET(req: NextRequest) {
  const auth = await withAuthOnly(req);
  if ("error" in auth) return auth.error;

  try {
    const posts = await getAllInternalLatePosts(auth.user.id);
    return success({ posts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return fail(message, 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await withAuthOnly(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { connectedAccountId, text, mediaUrls, contentType, draftId } = body || {};

    if (!connectedAccountId || !text || typeof text !== "string") {
      return fail("Missing required fields: connectedAccountId, text", 400);
    }

    if (draftId) {
      const draft = await getDraftById(String(draftId), auth.user.id);
      if (!draft) {
        return fail("Draft not found", 404);
      }
    }

    const connection = await getOwnedConnectionOrNull(String(connectedAccountId), auth.user.id);
    if (!connection) {
      return fail("Connected account not found", 404);
    }

    const post = await createInternalLatePost({
      userId: auth.user.id,
      connection,
      text,
      mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : [],
      draftId: typeof draftId === "string" ? draftId : null,
      contentType: typeof contentType === "string" ? contentType : null,
      status: "posted",
    });

    return success(
      {
        latePost: {
          ...serializeLatePost(post),
          url: post.post_url,
        },
        scheduledPost: serializeLatePost(post),
      },
      201
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return fail(message, 500);
  }
}
