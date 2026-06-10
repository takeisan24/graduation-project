import { randomUUID } from "crypto";
import {
  createScheduledPost,
  getLatePosts,
  getPostById,
  updatePost,
  type PostPayload,
  type ScheduledPost,
} from "@/lib/services/db/posts";
import {
  findConnectionById,
  findConnectionsByIds,
  type Connection,
} from "@/lib/services/db/connections";
import { syncDraftStatusFromScheduledPosts } from "@/lib/services/db/projects";
import {
  isZernioConfigured,
  createZernioPost as callZernioPost,
  getZernioPost,
  extractZernioResult,
  pollZernioUntilTerminal,
} from "@/lib/zernio";

type CreateInternalLatePostParams = {
  userId: string;
  connection: Connection;
  text: string;
  mediaUrls?: string[];
  draftId?: string | null;
  scheduledAt?: string | null;
  contentType?: string | null;
  timezone?: string | null;
  status?: "scheduled" | "posted" | "failed";
};

type ResolvedLatePost = {
  post: ScheduledPost;
  postStatus: ScheduledPost["status"];
  newStatus: ScheduledPost["status"];
  statusChanged: boolean;
};

function normalizePlatform(platform?: string | null): string {
  return (platform || "general").trim().toLowerCase();
}

function getConnectionUsername(connection?: Connection | null): string {
  const metadata = connection?.profile_metadata || {};
  return String(
    metadata.username ||
      connection?.profile_name ||
      metadata.email ||
      "unknown-account"
  );
}

function buildPlatformPayload(
  post: ScheduledPost,
  connection?: Connection | null,
  postUrl?: string | null
) {
  const username = getConnectionUsername(connection);
  const avatarUrl =
    connection?.profile_metadata?.avatar_url ||
    connection?.profile_metadata?.profilePicture ||
    "/shego.jpg";

  return {
    platform: normalizePlatform(post.platform),
    platformPostUrl: postUrl || undefined,
    url: postUrl || undefined,
    post_url: postUrl || undefined,
    username,
    displayName: connection?.profile_name || username,
    avatar_url: avatarUrl,
    profilePicture: avatarUrl,
    accountId: {
      username,
      displayName: connection?.profile_name || username,
      avatar_url: avatarUrl,
      profilePicture: avatarUrl,
    },
  };
}

function buildBasePayload(params: {
  connection: Connection;
  text: string;
  mediaUrls?: string[];
  contentType?: string | null;
  timezone?: string | null;
}): PostPayload {
  const mediaUrls = params.mediaUrls || [];
  return {
    connected_account_id: params.connection.id,
    // Luôn đông cứng username đã giải mã (qua chuỗi fallback getConnectionUsername) vào payload,
    // để modal "Bài đã đăng" hiển thị ĐÚNG tài khoản kể cả khi connection bị xóa/đổi sau này.
    connected_account_metadata: {
      ...(params.connection.profile_metadata || {}),
      username: getConnectionUsername(params.connection),
      displayName: params.connection.profile_name || getConnectionUsername(params.connection),
    },
    platform: normalizePlatform(params.connection.platform),
    text: params.text,
    text_content: params.text,
    mediaUrls,
    media_urls: mediaUrls,
    content_type: params.contentType || undefined,
    timezone: params.timezone || undefined,
  };
}

export function serializeLatePost(post: ScheduledPost) {
  return {
    id: post.id,
    platform: post.platform,
    scheduled_at: post.scheduled_at,
    late_job_id: post.late_job_id,
    status: post.status,
    post_url: post.post_url,
    url: post.post_url,
    payload: post.payload,
    created_at: post.created_at,
    updated_at: post.updated_at,
    getlate_profile_id: post.getlate_profile_id,
    getlate_account_id: post.getlate_account_id,
  };
}

export async function getOwnedConnectionOrNull(connectionId: string, userId: string) {
  const connection = await findConnectionById(connectionId, userId);
  if (!connection || connection.user_id !== userId) {
    return null;
  }
  return connection;
}

export async function getOwnedConnectionsByIds(
  connectionIds: string[],
  userId: string,
  platform?: string
) {
  const uniqueIds = Array.from(new Set(connectionIds.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const minimalConnections = await findConnectionsByIds(uniqueIds, userId);
  const validIds = minimalConnections
    .filter((connection) => {
      if (!platform) return true;
      return normalizePlatform(connection.platform) === normalizePlatform(platform);
    })
    .map((connection) => connection.id);

  const resolvedConnections = await Promise.all(
    validIds.map((id) => getOwnedConnectionOrNull(id, userId))
  );

  return resolvedConnections.filter(Boolean) as Connection[];
}

export async function createInternalLatePost(params: CreateInternalLatePostParams) {
  const status = params.status || "scheduled";
  const scheduledAt =
    params.scheduledAt || (status === "posted" ? new Date().toISOString() : null);

  if (!scheduledAt) {
    throw new Error("scheduledAt is required for scheduled posts");
  }

  const basePayload = buildBasePayload({
    connection: params.connection,
    text: params.text,
    mediaUrls: params.mediaUrls,
    contentType: params.contentType,
    timezone: params.timezone,
  });

  const platform = normalizePlatform(params.connection.platform);
  const zernioAccountId = params.connection.getlate_account_id;
  const useRealZernio = !!(zernioAccountId && isZernioConfigured());

  // ───────────── ĐĂNG THẬT QUA ZERNIO ─────────────
  if (useRealZernio) {
    const publishNow = status === "posted";

    // 1) Gọi Zernio. Lỗi cứng (mạng/4xx) → NÉM RA để route báo lỗi rõ ràng (fail loud).
    //    Tuyệt đối KHÔNG bịa URL/giả lập thành công.
    let zernioPost;
    try {
      zernioPost = await callZernioPost({
        targets: [{ platform, accountId: zernioAccountId! }],
        content: params.text,
        publishNow,
        scheduledFor: !publishNow ? scheduledAt : undefined,
        mediaUrls: params.mediaUrls,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Zernio publish failed";
      throw new Error(`Đăng qua Zernio thất bại: ${msg}`);
    }

    // 2) Đăng-ngay: publish của Zernio là bất đồng bộ → poll để lấy URL thật.
    let result = extractZernioResult(zernioPost);
    if (publishNow && result.status === "pending") {
      result = await pollZernioUntilTerminal(zernioPost._id);
    }

    const realUrl = result.platformPostUrl || null;
    const mappedStatus: ScheduledPost["status"] =
      result.status === "failed"
        ? "failed"
        : result.status === "posted"
          ? "posted"
          : publishNow
            ? "posted" // đã publishNow nhưng URL chưa kịp về → URL sẽ được poll bổ sung qua check-status
            : "scheduled";

    const platformPayload = buildPlatformPayload(
      { id: zernioPost._id, platform } as ScheduledPost,
      params.connection,
      realUrl
    );

    const payload: PostPayload = {
      ...basePayload,
      late_job_id: zernioPost._id,
      late_dev_response: {
        post: { platforms: [platformPayload], url: realUrl || undefined, post_url: realUrl || undefined },
      },
      ...(mappedStatus === "posted"
        ? {
            status_check_response: {
              post: { platforms: [platformPayload], url: realUrl || undefined, post_url: realUrl || undefined },
              platforms: [platformPayload],
            },
            engagement: { likes: 0, comments: 0, shares: 0 },
          }
        : {}),
      ...(result.errorMessage
        ? { error_message: result.errorMessage, error_details: { message: result.errorMessage } }
        : {}),
    };

    const createdPost = await createScheduledPost({
      user_id: params.userId,
      draft_id: params.draftId || null,
      connected_account_id: params.connection.id,
      platform,
      scheduled_at: scheduledAt,
      late_job_id: zernioPost._id,
      status: mappedStatus,
      post_url: realUrl,
      getlate_profile_id: params.connection.getlate_profile_id || null,
      getlate_account_id: zernioAccountId!,
      payload,
    });
    if (!createdPost) throw new Error("Failed to save Zernio post to DB");
    return createdPost;
  }

  // ───────────── KHÔNG CÓ ZERNIO (kết nối mô phỏng): lưu THẬT THÀ, KHÔNG bịa URL ─────────────
  // post_url = null → UI sẽ disable nút "Mở bài viết". Không tạo link giả.
  const platformPayload = buildPlatformPayload(
    { id: "pending", platform } as ScheduledPost,
    params.connection,
    null
  );
  const payload: PostPayload = {
    ...basePayload,
    late_dev_response: { post: { platforms: [platformPayload] } },
    ...(status === "posted"
      ? {
          status_check_response: { post: { platforms: [platformPayload] }, platforms: [platformPayload] },
          engagement: { likes: 0, comments: 0, shares: 0 },
        }
      : {}),
  };

  const createdPost = await createScheduledPost({
    user_id: params.userId,
    draft_id: params.draftId || null,
    connected_account_id: params.connection.id,
    platform,
    scheduled_at: scheduledAt,
    late_job_id: randomUUID(),
    status,
    post_url: null,
    getlate_profile_id: params.connection.getlate_profile_id || params.connection.late_profile_id || null,
    getlate_account_id: params.connection.getlate_account_id || null,
    payload,
  });

  if (!createdPost) {
    throw new Error("Failed to create scheduled post");
  }

  return createdPost;
}

export async function resolveInternalLatePost(post: ScheduledPost): Promise<ResolvedLatePost> {
  if (post.status !== "scheduled") {
    return {
      post,
      postStatus: post.status,
      newStatus: post.status,
      statusChanged: false,
    };
  }

  const scheduledTime = new Date(post.scheduled_at);
  if (Number.isNaN(scheduledTime.getTime()) || scheduledTime.getTime() > Date.now()) {
    return {
      post,
      postStatus: post.status,
      newStatus: post.status,
      statusChanged: false,
    };
  }

  const connectionId = post.payload?.connected_account_id;
  const connection = connectionId
    ? await getOwnedConnectionOrNull(connectionId, post.user_id)
    : null;

  // ───────────── Bài Zernio thật → POLL trạng thái + URL thật ─────────────
  if (post.getlate_account_id && isZernioConfigured() && post.late_job_id) {
    let result;
    try {
      const zPost = await getZernioPost(post.late_job_id);
      result = extractZernioResult(zPost);
    } catch {
      // Không poll được lúc này → giữ nguyên 'scheduled', thử lại lần check sau.
      return { post, postStatus: post.status, newStatus: post.status, statusChanged: false };
    }

    if (result.status === "pending") {
      return { post, postStatus: post.status, newStatus: post.status, statusChanged: false };
    }

    const newStatus: ScheduledPost["status"] = result.status === "failed" ? "failed" : "posted";
    const realUrl = result.platformPostUrl || null;
    const platformPayload = buildPlatformPayload(post, connection, realUrl);
    const updatedPayload: PostPayload = {
      ...(post.payload || {}),
      status_check_response: {
        post: { platforms: [platformPayload], url: realUrl || undefined, post_url: realUrl || undefined },
        platforms: [platformPayload],
      },
      late_dev_response: {
        post: { platforms: [platformPayload], url: realUrl || undefined, post_url: realUrl || undefined },
      },
      engagement: post.payload?.engagement || { likes: 0, comments: 0, shares: 0 },
      ...(result.errorMessage ? { error_message: result.errorMessage } : {}),
    };

    const updatedPost = await updatePost(post.id, post.user_id, {
      status: newStatus,
      post_url: realUrl,
      payload: updatedPayload,
    });
    const resolvedPost = updatedPost || { ...post, status: newStatus, post_url: realUrl, payload: updatedPayload };

    if (resolvedPost.draft_id) {
      await syncDraftStatusFromScheduledPosts(resolvedPost.draft_id, resolvedPost.user_id);
    }

    return { post: resolvedPost, postStatus: newStatus, newStatus, statusChanged: true };
  }

  // ───────────── Không phải bài Zernio (mô phỏng): chuyển 'posted', KHÔNG bịa URL ─────────────
  const finalUrl = post.post_url || null;
  const platformPayload = buildPlatformPayload(post, connection, finalUrl);
  const updatedPayload: PostPayload = {
    ...(post.payload || {}),
    status_check_response: {
      post: { platforms: [platformPayload], url: finalUrl || undefined, post_url: finalUrl || undefined },
      platforms: [platformPayload],
    },
    late_dev_response: {
      post: { platforms: [platformPayload], url: finalUrl || undefined, post_url: finalUrl || undefined },
    },
    engagement: post.payload?.engagement || { likes: 0, comments: 0, shares: 0 },
  };

  const updatedPost = await updatePost(post.id, post.user_id, {
    status: "posted",
    post_url: finalUrl,
    payload: updatedPayload,
  });

  const resolvedPost = updatedPost || {
    ...post,
    status: "posted",
    post_url: finalUrl,
    payload: updatedPayload,
  };

  if (resolvedPost.draft_id) {
    await syncDraftStatusFromScheduledPosts(resolvedPost.draft_id, resolvedPost.user_id);
  }

  return {
    post: resolvedPost,
    postStatus: "posted",
    newStatus: "posted",
    statusChanged: true,
  };
}

export async function getResolvedInternalLatePost(postId: string, userId: string) {
  const post = await getPostById(postId);
  if (!post || post.user_id !== userId) {
    return null;
  }

  return resolveInternalLatePost(post);
}

export async function getResolvedInternalLatePosts(postIds: string[], userId: string) {
  const results = await Promise.all(
    postIds.map(async (postId) => {
      const resolved = await getResolvedInternalLatePost(postId, userId);
      return resolved ? { postId, ...resolved } : null;
    })
  );

  return results.filter(
    (item): item is { postId: string } & ResolvedLatePost => Boolean(item)
  );
}

export async function getAllInternalLatePosts(userId: string) {
  const posts = await getLatePosts(userId);
  return posts.map((post) => ({
    ...post,
    url: post.post_url,
  }));
}
