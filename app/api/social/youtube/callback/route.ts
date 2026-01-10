import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/utils/urlConfig";
import { google } from "googleapis";
import { supabase } from "@/lib/supabase";
import { encryptToken } from "@/lib/crypto";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Xử lý lỗi từ Google hoặc user từ chối
  if (error || !code) {
    return NextResponse.redirect(`${getAppUrl()}/settings?oauth_callback=error&provider=youtube&error=${error || "no_code"}`);
  }
  // --- LOGIC MỚI: XÁC ĐỊNH BASE URL ---
  const baseUrl = getAppUrl();
  const redirectUri = `${baseUrl}/api/social/youtube/callback`;
  // ------------------------------------
  try {
    // 1. Parse State để lấy UserId
    // 1. Parse State
    const stateData = JSON.parse(state || "{}");
    const userId = stateData.userId;
    const locale = stateData.locale || "vi"; // Lấy lại locale đã lưu

    if (!userId) throw new Error("Invalid state: Missing user ID");

    // 2. Exchange Code lấy Token
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // 3. Lấy thông tin kênh YouTube
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const channelRes = await youtube.channels.list({
      part: ["snippet", "contentDetails"],
      mine: true,
    });

    const channel = channelRes.data.items?.[0];
    if (!channel) throw new Error("No YouTube channel found for this Google account");

    // Lấy thông tin User (Email/Avatar)
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // 4. Chuẩn bị dữ liệu lưu DB
    const accessToken = tokens.access_token!;
    const refreshToken = tokens.refresh_token; // Chỉ có ở lần đầu kết nối
    const expiryDate = tokens.expiry_date;

    // 5. Lưu vào connected_accounts (Upsert)
    // Lưu ý: Nếu user kết nối lại, cần update token mới. 
    // Nếu Google không trả về refresh_token (do user đã cấp quyền trước đó), ta GIỮ LẠI refresh_token cũ trong DB.

    // Kiểm tra xem đã có connection chưa để lấy refresh token cũ nếu cần
    const { data: existingConnection } = await supabase
      .from('connected_accounts')
      .select('refresh_token')
      .eq('user_id', userId)
      .eq('platform', 'youtube')
      .eq('profile_id', channel.id!)
      .single();

    const finalRefreshToken = refreshToken ? encryptToken(refreshToken) : existingConnection?.refresh_token;

    const connectionData = {
      user_id: userId,
      connection_provider: 'native', // Đánh dấu là Native
      platform: 'youtube',
      profile_id: channel.id!, // YouTube Channel ID
      profile_name: channel.snippet?.title || userInfo.data.name || "YouTube Channel",
      access_token: encryptToken(accessToken),
      refresh_token: finalRefreshToken,
      expires_at: expiryDate ? new Date(expiryDate).toISOString() : null,

      // Metadata cho UI
      profile_metadata: {
        username: channel.snippet?.customUrl || channel.snippet?.title,
        avatar_url: channel.snippet?.thumbnails?.default?.url || userInfo.data.picture,
        email: userInfo.data.email,
        subscriberCount: channel.statistics?.subscriberCount
      },

      // Metadata cho Upload (Native specific)
      platform_metadata: {
        uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads
      },

      updated_at: new Date().toISOString()
    };

    // Upsert vào DB (Dựa trên user_id + platform + profile_id là Unique Key trong schema mới)
    const { error: upsertError } = await supabase
      .from('connected_accounts')
      .upsert(connectionData, {
        onConflict: 'user_id,platform,profile_id'
      });

    if (upsertError) throw upsertError;

    // 6. Redirect về trang Settings với thông báo thành công
    return NextResponse.redirect(`${baseUrl}/${locale}/settings?oauth_callback=success&provider=youtube&connected=true`);

  } catch (err: any) {
    console.error("[YouTube Callback] Error:", err);
    const locale = JSON.parse(state || "{}").locale || "vi";
    return NextResponse.redirect(`${baseUrl}/${locale}/settings?oauth_callback=error&provider=youtube&error=${encodeURIComponent(err.message)}`);
  }
}