import { google } from "googleapis";
import { supabase } from "@/lib/supabase";
import { decryptToken, encryptToken } from "@/lib/crypto";

/**
 * Lấy Access Token hợp lệ (Tự động refresh nếu hết hạn)
 * @param connectionId ID của bản ghi trong bảng connected_accounts
 */
export async function getValidAccessToken(connectionId: string): Promise<string> {
  // 1. Lấy thông tin connection từ DB
  const { data: conn, error } = await supabase
    .from("connected_accounts")
    .select("access_token, refresh_token, expires_at, platform")
    .eq("id", connectionId)
    .single();

  if (error || !conn) throw new Error("Connection not found");
  if (conn.platform !== 'youtube') throw new Error("Not a YouTube connection");

  // 2. Kiểm tra xem Token còn hạn không (trừ hao 5 phút cho an toàn)
  const expiryDate = conn.expires_at ? new Date(conn.expires_at).getTime() : 0;
  const now = Date.now();
  const buffer = 5 * 60 * 1000; // 5 phút

  if (expiryDate > now + buffer) {
    // Token còn sống -> Giải mã và dùng luôn
    return decryptToken(conn.access_token);
  }

  // 3. Token hết hạn -> Tiến hành Refresh
  console.log(`[YouTube] Token expired for connection ${connectionId}, refreshing...`);

  if (!conn.refresh_token) {
    throw new Error("Refresh token missing. User needs to reconnect.");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  // Set refresh token để lấy access token mới
  oauth2Client.setCredentials({
    refresh_token: decryptToken(conn.refresh_token)
  });

  try {
    // Gọi Google để lấy token mới
    const { credentials } = await oauth2Client.refreshAccessToken();
    const newAccessToken = credentials.access_token;
    const newExpiryDate = credentials.expiry_date;

    if (!newAccessToken) throw new Error("Failed to retrieve new access token");

    // 4. Lưu Token mới vào DB
    await supabase
      .from("connected_accounts")
      .update({
        access_token: encryptToken(newAccessToken),
        expires_at: newExpiryDate ? new Date(newExpiryDate).toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq("id", connectionId);

    return newAccessToken;

  } catch (err: any) {
    console.error("[YouTube] Refresh token failed:", err);
    // Nếu lỗi "invalid_grant", nghĩa là user đã revoke quyền -> Cần đánh dấu để user kết nối lại
    throw err;
  }
}