import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createConnectionLegacy, findConnectionByUserPlatformAndProfileId } from "@/lib/services/db/connections";

const SUPPORTED_PROVIDER_TO_PLATFORM: Record<string, string> = {
  tiktok: "tiktok",
  instagram: "instagram",
  youtube: "youtube",
  facebook: "facebook",
  twitter: "x",
  threads: "threads",
  linkedin: "linkedin",
  pinterest: "pinterest",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPopupResponse(params: {
  success: boolean;
  provider: string;
  returnTo: string;
  message?: string;
}) {
  const { success, provider, returnTo, message } = params;
  const origin = (() => {
    try {
      return new URL(returnTo).origin;
    } catch {
      return "";
    }
  })();

  const payload = success
    ? `{ type: "oauth-success", provider: "${escapeHtml(provider)}" }`
    : `{ type: "oauth-error", provider: "${escapeHtml(provider)}", error: "${escapeHtml(message || "Connection failed")}" }`;

  const redirectUrl = (() => {
    try {
      const url = new URL(returnTo);
      url.searchParams.set("oauth_callback", success ? "success" : "error");
      url.searchParams.set("provider", provider);
      if (success) {
        url.searchParams.set("connected", "true");
      } else if (message) {
        url.searchParams.set("error", message);
      }
      return url.toString();
    } catch {
      return returnTo;
    }
  })();

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${success ? "Connection complete" : "Connection failed"}</title>
  </head>
  <body>
    <script>
      (function () {
        try {
          if (window.opener) {
            ${origin ? `window.opener.postMessage(${payload}, "${escapeHtml(origin)}");` : `window.opener.postMessage(${payload}, "*");`}
          }
        } catch (err) {}
        try {
          if (window.opener) {
            window.close();
            return;
          }
        } catch (err) {}
        window.location.replace(${JSON.stringify(redirectUrl)});
      })();
    </script>
  </body>
</html>`;

  return new NextResponse(html, {
    status: success ? 200 : 500,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

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

    const profileId = `demo-${platform}-${user.id}`;
    const existing = await findConnectionByUserPlatformAndProfileId(user.id, platform, profileId);

    if (!existing) {
      const displayName = `Demo ${platform.charAt(0).toUpperCase()}${platform.slice(1)} Account`;
      const created = await createConnectionLegacy({
        user_id: user.id,
        platform,
        access_token: `demo-token-${platform}-${Date.now()}`,
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

    return buildPopupResponse({
      success: true,
      provider,
      returnTo,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/connections/start/[provider] error:", message);

    const returnTo = req.nextUrl.searchParams.get("returnTo") || `${req.nextUrl.origin}/vi/settings`;
    return buildPopupResponse({
      success: false,
      provider: params.provider,
      returnTo,
      message,
    });
  }
}
