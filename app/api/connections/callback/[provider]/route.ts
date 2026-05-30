import { NextRequest } from "next/server";
import { listZernioAccounts } from "@/lib/zernio";
import { resolvePendingConnection } from "@/lib/zernioState";
import { createConnectionLegacy } from "@/lib/services/db/connections";
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
    // Fetch all accounts from Zernio to find the newly connected one
    const allAccounts = await listZernioAccounts();
    const newAccount = allAccounts.find(a => !pending.existingAccountIds.includes(a._id));
    console.log(`[connections/callback/${provider}] zernio accounts=${allAccounts.length} newAccount=${newAccount?._id ?? "NONE"}`);
    if (!newAccount) {
      console.warn(`[connections/callback/${provider}] Không phát hiện tài khoản mới (Zernio có thể chưa cập nhật kịp danh sách).`);
    }

    if (newAccount) {
      await createConnectionLegacy({
        user_id: pending.userId,
        platform: pending.platform,
        access_token: "zernio-managed",
        refresh_token: null,
        profile_name: newAccount.displayName || newAccount.username,
        profile_id: newAccount._id,
        expires_at: null,
        getlate_account_id: newAccount._id,
        profile_metadata: {
          username: newAccount.username,
          avatar_url: newAccount.avatarUrl || null,
        },
      });
    }

    return buildPopupResponse({ success: true, provider, returnTo: pending.returnTo });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    console.error(`[connections/callback/${provider}]`, message);
    return buildPopupResponse({ success: false, provider, returnTo: pending.returnTo, message });
  }
}
