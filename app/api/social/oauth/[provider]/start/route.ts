import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/utils/urlConfig";
import { requireAuth } from "@/lib/auth";
import { fail } from "@/lib/response";

const PROVIDER_CONFIG: Record<string, { authUrl: string; clientId: string; scope: string }> = {
  "late": {
    authUrl: "https://late.dev/oauth/authorize",
    clientId: process.env.LATE_CLIENT_ID!,
    scope: "write:post",
  },
  "instagram": {
    authUrl: "https://api.instagram.com/oauth/authorize",
    clientId: process.env.INSTAGRAM_CLIENT_ID!,
    scope: "user_profile,user_media",
  },
  "tiktok": {
    authUrl: "https://www.tiktok.com/auth/authorize/",
    clientId: process.env.TIKTOK_CLIENT_ID!,
    scope: "user.info.basic,video.list",
  },
  "x": {
    authUrl: "https://twitter.com/i/oauth2/authorize",
    clientId: process.env.X_CLIENT_ID!,
    scope: "tweet.read users.read offline.access",
  },
  "facebook": {
    authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    clientId: process.env.FACEBOOK_CLIENT_ID!,
    scope: "pages_manage_posts,pages_read_engagement",
  },
  "linkedin": {
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    clientId: process.env.LINKEDIN_CLIENT_ID!,
    scope: "w_member_social",
  },
  "threads": {
    authUrl: "https://www.threads.net/oauth/authorize",
    clientId: process.env.THREADS_CLIENT_ID!,
    scope: "instagram_basic,instagram_content_publish",
  },
  "bluesky": {
    authUrl: "https://bsky.app/xrpc/com.atproto.server.createSession",
    clientId: process.env.BLUESKY_CLIENT_ID!,
    scope: "com.atproto.repo,com.atproto.identity",
  },
  "youtube": {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    clientId: process.env.YOUTUBE_CLIENT_ID!,
    scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube",
  },
  "pinterest": {
    authUrl: "https://www.pinterest.com/oauth/",
    clientId: process.env.PINTEREST_CLIENT_ID!,
    scope: "boards:read,pins:read,pins:write",
  }
};

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const user = await requireAuth(req);
  if (!user) return fail("Unauthorized", 401);

  const { provider } = params;
  const cfg = PROVIDER_CONFIG[provider];
  if (!cfg) return fail("Unknown provider", 400);

  const redirectUri = `${getAppUrl()}/api/social/oauth/${provider}/callback`;

  const state = Buffer.from(JSON.stringify({ uid: user.id, provider })).toString("base64url");

  const url = new URL(cfg.authUrl);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", cfg.scope);
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
