import { NextRequest } from "next/server";
import { encryptToken } from "@/lib/crypto";
import { success, fail } from "@/lib/response";
import { createConnection } from "@/lib/services/db/connections";
import { getAppUrl } from "@/lib/utils/urlConfig";

const TOKEN_ENDPOINTS: Record<string, string> = {
  "late": "https://late.dev/oauth/token",
  "instagram": "https://api.instagram.com/oauth/access_token",
  "tiktok": "https://open-api.tiktok.com/oauth/access_token/",
  "x": "https://api.twitter.com/2/oauth2/token",
  "facebook": "https://graph.facebook.com/v18.0/oauth/access_token",
  "linkedin": "https://www.linkedin.com/oauth/v2/accessToken",
  "threads": "https://graph.instagram.com/access_token",
  "bluesky": "https://bsky.app/xrpc/com.atproto.server.createSession",
  "youtube": "https://oauth2.googleapis.com/token",
  "pinterest": "https://api.pinterest.com/v5/oauth/token"
};

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const { provider } = params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) return fail("Missing code/state", 400);

  const parsed = JSON.parse(Buffer.from(state, "base64url").toString());
  const userId = parsed.uid;

  const tokenUrl = TOKEN_ENDPOINTS[provider];
  if (!tokenUrl) return fail("Unknown provider", 400);

  const redirectUri = `${getAppUrl()}/api/social/oauth/${provider}/callback`;

  // Exchange code for token (simplified — thực tế mỗi provider khác nhau một chút)
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: process.env[`${provider.toUpperCase()}_CLIENT_ID`]!,
      client_secret: process.env[`${provider.toUpperCase()}_CLIENT_SECRET`]!,
      redirect_uri: redirectUri
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    return fail(`Token exchange failed: ${txt}`, 400);
  }
  const tokenResp = await res.json();

  const accessToken = tokenResp.access_token;
  const refreshToken = tokenResp.refresh_token;
  const expiresIn = tokenResp.expires_in;

  // Get profile information from the provider
  let profileId = "";
  let profileName = "";

  try {
    // This is a simplified example - in reality, you'd need to call each provider's API
    // to get the user's profile information
    if (provider === "instagram") {
      // Call Instagram API to get user profile
      const profileRes = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`);
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        profileId = profileData.id;
        profileName = profileData.username;
      }
    } else if (provider === "tiktok") {
      // Call TikTok API to get user profile
      const profileRes = await fetch(`https://open-api.tiktok.com/user/info/?access_token=${accessToken}`);
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        profileId = profileData.data?.user?.open_id || "";
        profileName = profileData.data?.user?.display_name || "";
      }
    } else if (provider === "x") {
      // Call X API to get user profile
      const profileRes = await fetch(`https://api.twitter.com/2/users/me`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        profileId = profileData.data?.id || "";
        profileName = profileData.data?.username || "";
      }
    } else if (provider === "facebook") {
      // Call Facebook API to get user profile
      const profileRes = await fetch(`https://graph.facebook.com/me?fields=id,name&access_token=${accessToken}`);
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        profileId = profileData.id || "";
        profileName = profileData.name || "";
      }
    } else if (provider === "linkedin") {
      // Call LinkedIn API to get user profile
      const profileRes = await fetch(`https://api.linkedin.com/v2/people/~`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        profileId = profileData.id || "";
        profileName = profileData.localizedFirstName + " " + profileData.localizedLastName || "";
      }
    } else if (provider === "threads") {
      // Call Threads API to get user profile (uses Instagram Graph API)
      const profileRes = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`);
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        profileId = profileData.id || "";
        profileName = profileData.username || "";
      }
    } else if (provider === "bluesky") {
      // Bluesky uses AT Protocol, different from OAuth
      // For now, we'll use a placeholder approach
      profileId = "bluesky_user";
      profileName = "Bluesky User";
    } else if (provider === "youtube") {
      // Call YouTube API to get user profile
      const profileRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData.items && profileData.items.length > 0) {
          profileId = profileData.items[0].id || "";
          profileName = profileData.items[0].snippet?.title || "";
        }
      }
    } else if (provider === "pinterest") {
      // Call Pinterest API to get user profile
      const profileRes = await fetch(`https://api.pinterest.com/v5/user_account`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        profileId = profileData.id || "";
        profileName = profileData.username || "";
      }
    }
  } catch (error) {
    console.error("Error fetching profile:", error);
  }

  // Create or update connection via service layer
  // Note: This is a legacy OAuth flow, using profile_id instead of getlate_profile_id
  // We'll use createConnection which handles upsert logic
  const connection = await createConnection({
    user_id: userId,
    getlate_profile_id: "", // Not used in legacy flow
    getlate_account_id: "", // Not used in legacy flow
    platform: provider,
    profile_id: profileId || null,
    profile_name: profileName || null,
    access_token: encryptToken(accessToken),
    refresh_token: refreshToken ? encryptToken(refreshToken) : null,
    expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    late_profile_id: null,
    social_media_account_id: null,
    profile_metadata: {}
  });

  if (!connection) {
    return fail("Failed to save connection", 500);
  }

  return success({ message: `Connected ${provider}`, provider });
}
