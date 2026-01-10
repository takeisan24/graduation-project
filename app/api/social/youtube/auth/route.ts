import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/utils/urlConfig";

export const dynamic = 'force-dynamic';

import { google } from "googleapis";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response"; // Sử dụng hàm helper response

export async function GET(req: NextRequest) {
  try {
    // 1. Check login (User phải đăng nhập Maiovo mới được kết nối Youtube)
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    // --- LOGIC MỚI: XÁC ĐỊNH REDIRECT URI ĐỘNG ---
    // Lấy Base URL từ biến môi trường (Ưu tiên) hoặc Origin của request
    const baseUrl = getAppUrl();
    const redirectUri = `${baseUrl}/api/social/youtube/callback`;
    // ----------------------------------------------

    // 2. Cấu hình OAuth2 Client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    // 3. Tạo URL Authorization
    const scopes = [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile"
    ];

    // State dùng để truyền userId qua callback (để biết ai đang kết nối)
    // Có thể mã hóa thêm để bảo mật hơn nếu cần
    // Lấy locale từ URL gọi API (nếu có) hoặc mặc định
    // Ví dụ FE gọi: /api/social/youtube/auth?locale=vi
    const locale = req.nextUrl.searchParams.get("locale") || "vi";

    // Truyền locale vào state để Callback biết đường quay về đúng ngôn ngữ
    const state = JSON.stringify({
      userId: user.id,
      locale: locale
    });

    const authorizationUrl = oauth2Client.generateAuthUrl({
      access_type: "offline", // BẮT BUỘC: Để lấy Refresh Token
      scope: scopes,
      include_granted_scopes: true,
      state: state,
      prompt: "consent" // BẮT BUỘC: Để Google luôn trả về Refresh Token
    });

    // 4. Redirect user sang Google
    // Thay vì redirect, trả về URL dưới dạng JSON
    return success({ url: authorizationUrl });

  } catch (error: any) {
    console.error("[YouTube Auth] Error:", error);
    return fail("Failed to initiate YouTube connection", 500);
  }
}