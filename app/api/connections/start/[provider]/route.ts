import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createConnectionLegacy, findConnectionByUserPlatformAndProfileId } from "@/lib/services/db/connections";
import { checkProfileLimit } from "@/lib/usage";
import { isZernioConfigured, getZernioConnectUrl, listZernioAccounts } from "@/lib/zernio";
import { createPendingConnection } from "@/lib/zernioState";
import { buildPopupResponse } from "@/lib/utils/connectionPopup";

const SUPPORTED_PROVIDER_TO_PLATFORM: Record<string, string> = {
  tiktok: "tiktok",
  instagram: "instagram",
  youtube: "youtube",
  facebook: "facebook",
  x: "x",
  twitter: "x",
  threads: "threads",
  linkedin: "linkedin",
  pinterest: "pinterest",
};

export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const user = await requireAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const provider = params.provider.toLowerCase();
    const platform = SUPPORTED_PROVIDER_TO_PLATFORM[provider];
    if (!platform) {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    const returnTo = req.nextUrl.searchParams.get("returnTo") || `${req.nextUrl.origin}/vi/settings`;
    const wantsJson = req.nextUrl.searchParams.get("json") === "1";
    const isPopupMode = req.nextUrl.searchParams.get("popup") === "1";
    const shouldComplete = req.nextUrl.searchParams.get("complete") === "1";

    // --- Zernio real OAuth mode ---
    if (wantsJson && !shouldComplete && isZernioConfigured()) {
      try {
        const existingAccounts = await listZernioAccounts();
        const existingIds = existingAccounts.map(a => a._id);

        const state = createPendingConnection({
          userId: user.id,
          platform,
          returnTo,
          isPopup: isPopupMode,
          existingAccountIds: existingIds,
        });

        const callbackUrl = `${req.nextUrl.origin}/api/connections/callback/${provider}?state=${state}&returnTo=${encodeURIComponent(returnTo)}`;
        const authUrl = await getZernioConnectUrl(platform, callbackUrl);
        return NextResponse.json({ url: authUrl, isExternal: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Zernio error";
        console.error("[connections/start] Zernio error, falling back to local preview:", msg);
        // Fall through to local preview mode below
      }
    }

    // --- Local preview mode: return URL for ?complete=1 step ---
    if (wantsJson && !shouldComplete) {
      const url = `${req.nextUrl.origin}/api/connections/start/${provider}?complete=1&popup=${isPopupMode ? "1" : "0"}&returnTo=${encodeURIComponent(returnTo)}`;
      return NextResponse.json({ url }, { status: 200 });
    }

    if (!shouldComplete) {
      return NextResponse.redirect(
        new URL(`/api/connections/start/${provider}?complete=1&popup=${isPopupMode ? "1" : "0"}&returnTo=${encodeURIComponent(returnTo)}`, req.nextUrl.origin),
        { status: 302 }
      );
    }

    // --- Local preview: create a simulated connection in DB ---
    const profileId = `preview-${platform}-${user.id.slice(0, 8)}`;
    const existing = await findConnectionByUserPlatformAndProfileId(user.id, platform, profileId);

    if (!existing) {
      const limitCheck = await checkProfileLimit(user.id);
      if (!limitCheck.canAdd) {
        return buildPopupResponse({
          success: false,
          provider,
          returnTo,
          message: `Profile limit reached (${limitCheck.current}/${limitCheck.limit})`,
        });
      }
      const displayName = `Preview ${platform.charAt(0).toUpperCase()}${platform.slice(1)} Account`;
      const created = await createConnectionLegacy({
        user_id: user.id,
        platform,
        access_token: `preview-token-${platform}-${Date.now()}`,
        refresh_token: null,
        profile_name: displayName,
        profile_id: profileId,
        expires_at: null,
      });

      if (!created) {
        return buildPopupResponse({
          success: false,
          provider,
          returnTo,
          message: "Không thể tạo kết nối mô phỏng cho tài khoản này.",
        });
      }
    }

    return buildPopupResponse({ success: true, provider, returnTo });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/connections/start/[provider] error:", message);
    const returnTo = req.nextUrl.searchParams.get("returnTo") || `${req.nextUrl.origin}/vi/settings`;
    return buildPopupResponse({ success: false, provider: params.provider, returnTo, message });
  }
}
