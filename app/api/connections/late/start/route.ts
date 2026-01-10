import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/utils/urlConfig";
import jwt from "jsonwebtoken";

// Domain auth.getlate.dev does not exist (DNS verified)
// NOTE: /api/v1/oauth/authorize returns 404 (verified)
// Try /oauth/authorize (without /api/v1)
const LATE_AUTHORIZE_URL = process.env.LATE_OAUTH_AUTHORIZE_URL || "https://getlate.dev/oauth/authorize";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const returnTo = url.searchParams.get("returnTo") || ""; // e.g. https://app.example.com/settings/connections
  const userId = url.searchParams.get("userId") || ""; // optional alternative if frontend passes userId

  // Build state as JWT: { userId, returnTo, iat, exp }
  const payload = { userId, returnTo };
  const state = jwt.sign(payload, process.env.OAUTH_STATE_SECRET!, { expiresIn: "10m" });

  // Build redirect URI from getAppUrl (standardized)
  const appUrl = getAppUrl();
  const redirectUri = `${appUrl}/api/auth/callback/late`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LATE_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope: "profiles:write posts:write", // adjust to Late.dev spec
    state,
  });

  const redirectUrl = `${LATE_AUTHORIZE_URL}?${params.toString()}`;
  return NextResponse.redirect(redirectUrl);
}
