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

function buildSyntheticPostUrl(post: ScheduledPost, connection?: Connection | null): string {
  const platform = normalizePlatform(post.platform);
  const username = getConnectionUsername(connection).replace(/^@/, "");
  return `https://${platform}.com/${username}/post/${post.id}`;
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
    connected_account_metadata: params.connection.profile_metadata || {
      username: params.connection.profile_name || "Unknown Account",
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
  const connection = await findConnectionById(connectionId);
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

  const tempPost = {
    id: "pending",
    platform: normalizePlatform(params.connection.platform),
  } as ScheduledPost;
  const postUrl =
    status === "posted"
      ? buildSyntheticPostUrl(tempPost, params.connection).replace("/pending", "")
      : null;
  const platformPayload = buildPlatformPayload(tempPost, params.connection, postUrl);

  const payload: PostPayload = {
    ...basePayload,
    late_dev_response: {
      post: {
        platforms: [platformPayload],
        url: postUrl || undefined,
        post_url: postUrl || undefined,
      },
    },
    status_check_response:
      status === "posted"
        ? {
            post: {
              platforms: [platformPayload],
              url: postUrl || undefined,
              post_url: postUrl || undefined,
            },
            platforms: [platformPayload],
          }
        : undefined,
    engagement:
      status === "posted"
        ? { likes: 0, comments: 0, shares: 0 }
        : undefined,
  };

  const createdPost = await createScheduledPost({
    user_id: params.userId,
    draft_id: params.draftId || null,
    platform: normalizePlatform(params.connection.platform),
    scheduled_at: scheduledAt,
    late_job_id: randomUUID(),
    status,
    post_url: postUrl,
    getlate_profile_id: params.connection.getlate_profile_id || params.connection.late_profile_id || null,
    getlate_account_id: params.connection.getlate_account_id || null,
    payload,
  });

  if (!createdPost) {
    throw new Error("Failed to create scheduled post");
  }

  if (status !== "posted") {
    return createdPost;
  }

  const finalUrl = buildSyntheticPostUrl(createdPost, params.connection);
  const updatedPayload: PostPayload = {
    ...createdPost.payload,
    late_dev_response: {
      post: {
        platforms: [buildPlatformPayload(createdPost, params.connection, finalUrl)],
        url: finalUrl,
        post_url: finalUrl,
      },
    },
    status_check_response: {
      post: {
        platforms: [buildPlatformPayload(createdPost, params.connection, finalUrl)],
        url: finalUrl,
        post_url: finalUrl,
      },
      platforms: [buildPlatformPayload(createdPost, params.connection, finalUrl)],
    },
    engagement: { likes: 0, comments: 0, shares: 0 },
  };

  const updatedPost = await updatePost(createdPost.id, params.userId, {
    post_url: finalUrl,
    payload: updatedPayload,
  });

  return updatedPost || createdPost;
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
  const finalUrl = post.post_url || buildSyntheticPostUrl(post, connection);
  const platformPayload = buildPlatformPayload(post, connection, finalUrl);
  const updatedPayload: PostPayload = {
    ...(post.payload || {}),
    status_check_response: {
      post: {
        platforms: [platformPayload],
        url: finalUrl,
        post_url: finalUrl,
      },
      platforms: [platformPayload],
    },
    late_dev_response: {
      post: {
        platforms: [platformPayload],
        url: finalUrl,
        post_url: finalUrl,
      },
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
