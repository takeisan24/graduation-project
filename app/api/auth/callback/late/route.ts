import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/utils/urlConfig";
import jwt from "jsonwebtoken";
import { createLateClient } from "@/lib/late/client";
import { fail, success } from "@/lib/response";
import { createConnection } from "@/lib/services/db/connections";


// ✅ Force dynamic rendering for API route
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    console.log(req);
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    if (!code || !state) return fail("Missing code/state", 400);

    // verify state JWT
    let payload: any;
    try {
      payload = jwt.verify(state, process.env.OAUTH_STATE_SECRET!);
    } catch (e) {
      return fail("Invalid/expired state", 400);
    }

    const { userId, returnTo } = payload as { userId?: string; returnTo?: string };

    // Build redirect URI from getAppUrl (standardized)
    const appUrl = getAppUrl();
    const redirectUri = `${appUrl}/api/auth/callback/late`;

    const late = createLateClient();
    const tokenResp: any = await late.exchangeCodeForToken(code, redirectUri);
    const access_token = tokenResp.access_token;
    const refresh_token = tokenResp.refresh_token;
    const expires_in = tokenResp.expires_in ?? null;

    // create profile resource in Late (server's Late account), using user's provider access_token
    const profile: any = await late.createProfileWithAccessToken(access_token);
    const profile_id = profile?.id ?? null;
    const profile_name = profile?.name ?? profile?.username ?? null;

    // Save connected account via service layer (associate with userId from state)
    // WARNING: For security, encrypt tokens at rest in production. Here saved plaintext for demo.
    if (!userId) {
      return fail("User ID not found in state", 400);
    }

    const connection = await createConnection({
      user_id: userId,
      getlate_profile_id: "", // Not used in legacy late.dev OAuth flow
      getlate_account_id: "", // Not used in legacy late.dev OAuth flow
      platform: "late",
      profile_id: profile_id || null,
      profile_name: profile_name || null,
      access_token: access_token || null,
      refresh_token: refresh_token || null,
      expires_at: expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null,
      late_profile_id: null,
      social_media_account_id: null,
      profile_metadata: {}
    });

    if (!connection) {
      console.error("save connected_account error");
      return fail("Failed to persist connection", 500);
    }

    // Redirect back to UI if returnTo provided
    if (returnTo) {
      return NextResponse.redirect(returnTo);
    }
    return success({ saved: true, connection });
  } catch (err: any) {
    console.error("callback error", err);
    return fail(err.message || "callback error", 500);
  }
}
