import { NextRequest } from "next/server";
import { listZernioAccounts } from "@/lib/zernio";
import { resolvePendingConnection } from "@/lib/zernioState";
import { createConnectionLegacy, findConnectionByUserPlatformAndProfileId } from "@/lib/services/db/connections";
import { buildPopupResponse } from "@/lib/utils/connectionPopup";

export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const provider = params.provider.toLowerCase();
  const state = req.nextUrl.searchParams.get("state");
  const returnTo = req.nextUrl.searchParams.get("returnTo") || `${req.nextUrl.origin}/vi/connections`;

  if (!state) {
    return buildPopupResponse({ success: false, provider, returnTo, message: "Missing OAuth state" });
  }

  const pending = resolvePendingConnection(state);
  if (!pending) {
    return buildPopupResponse({ success: false, provider, returnTo, message: "Invalid or expired OAuth state" });
  }
  console.log(`[connections/callback/${provider}] pending OK: user=${pending.userId} platform=${pending.platform} existing=${pending.existingAccountIds.length}`);

  try {
    // Đồng bộ TẤT CẢ tài khoản từ Zernio vào connected_accounts của người dùng.
    // Cách này bền hơn việc chỉ tìm "tài khoản mới so với lúc bắt đầu": nó xử lý cả
    // trường hợp tài khoản đã được kết nối sẵn trên Zernio từ lần thử trước.
    // Idempotent: bỏ qua tài khoản đã tồn tại trong cơ sở dữ liệu.
    const allAccounts = await listZernioAccounts();
    console.log(`[connections/callback/${provider}] zernio accounts=${allAccounts.length}`);
    let saved = 0;
    for (const acc of allAccounts) {
      const chPlatform = acc.platform === "twitter" ? "x" : acc.platform;
      const existing = await findConnectionByUserPlatformAndProfileId(pending.userId, chPlatform, acc._id);
      if (existing) continue;
      const created = await createConnectionLegacy({
        user_id: pending.userId,
        platform: chPlatform,
        access_token: "zernio-managed",
        refresh_token: null,
        profile_name: acc.displayName || acc.username,
        profile_id: acc._id,
        expires_at: null,
        getlate_account_id: acc._id,
        profile_metadata: {
          username: acc.username,
          avatar_url: acc.profilePicture || acc.metadata?.profileData?.profilePicture || acc.avatarUrl || null,
        },
      });
      if (created) saved++;
    }
    console.log(`[connections/callback/${provider}] đã lưu ${saved} kết nối mới vào CSDL`);

    return buildPopupResponse({ success: true, provider, returnTo: pending.returnTo });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    console.error(`[connections/callback/${provider}]`, message);
    return buildPopupResponse({ success: false, provider, returnTo: pending.returnTo, message });
  }
}
