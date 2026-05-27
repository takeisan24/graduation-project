import { NextResponse } from "next/server";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildPopupResponse(params: {
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
