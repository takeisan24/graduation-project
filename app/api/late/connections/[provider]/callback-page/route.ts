import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/utils/urlConfig";

/**
 * GET /api/late/connections/[provider]/callback-page
 * Callback page for popup OAuth flow
 * This page sends a postMessage to the parent window and then closes itself
 * 
 * Query params:
 * - success: "true" or "false"
 * - provider: Provider name
 * - connectionId: Connection ID (if success)
 * - platform: Platform name (if success)
 * - error: Error message (if failed)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const { provider } = params;
  const url = new URL(req.url);
  const success = url.searchParams.get("success") === "true";
  const connectionId = url.searchParams.get("connectionId") || "";
  const platform = url.searchParams.get("platform") || provider;
  const error = url.searchParams.get("error") || "";
  const returnTo = url.searchParams.get("returnTo") || "";

  // Determine settings page URL (preserve locale if possible from returnTo)
  let settingsUrl = "/settings";
  if (returnTo) {
    try {
      const returnToUrl = new URL(returnTo);
      const pathParts = returnToUrl.pathname.split("/");
      if (pathParts.length > 1 && (pathParts[1] === "vi" || pathParts[1] === "en")) {
        settingsUrl = `/${pathParts[1]}/settings`;
      }
    } catch (e) {
      // If returnTo is not a valid URL, use default settings path
      console.warn("[callback-page] Invalid returnTo URL:", returnTo);
    }
  }

  // Return HTML page that sends postMessage to parent and closes
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Connecting ${provider}...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #0a0a0a;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .spinner {
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-top: 3px solid #fff;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .success {
      color: #10b981;
    }
    .error {
      color: #ef4444;
    }
  </style>
</head>
<body>
  <div class="container">
    ${success ? (
      `<div class="success">
        <div class="spinner"></div>
        <p>Successfully connected ${platform}!</p>
        <p style="font-size: 0.875rem; opacity: 0.7;">Closing window...</p>
      </div>`
    ) : (
      `<div class="error">
        <p>Failed to connect ${provider}</p>
        <p style="font-size: 0.875rem; opacity: 0.7;">${error || "Unknown error"}</p>
        <p style="font-size: 0.875rem; opacity: 0.7;">Closing window...</p>
      </div>`
    )}
  </div>
  <script>
    (function() {
      try {
        var hasOpener = !!window.opener;
        if (hasOpener) {
          var targetOrigin = "*";
          try {
            if (window.opener.location && window.opener.location.origin) {
              targetOrigin = window.opener.location.origin;
            } else if (${JSON.stringify(getAppUrl())}) {
              targetOrigin = ${JSON.stringify(getAppUrl())};
            } else {
              targetOrigin = window.location.origin;
            }
          } catch (originErr) {
            console.warn("Unable to determine opener origin, defaulting to wildcard target.", originErr);
          }

          // Send message to parent window
          window.opener.postMessage({
            type: ${success ? '"oauth-success"' : '"oauth-error"'},
            provider: "${provider}",
            source: "oauth-callback",
            sourceOrigin: window.location.origin,
            ${success ? `connectionId: "${connectionId}", platform: "${platform}"` : `error: ${JSON.stringify(error)}`}
          }, targetOrigin);
          
          // Close popup after a short delay
          setTimeout(function() {
            window.close();
          }, ${success ? 1000 : 2000});
        } else {
          // Full-page flow (no window.opener) - redirect back to settings page
          var redirectUrl = ${JSON.stringify(settingsUrl)};
          // Add query params to indicate OAuth callback completion for auto-refresh on FE
          var url = new URL(redirectUrl, window.location.origin);
          url.searchParams.set("oauth_callback", ${success ? '"success"' : '"error"'});
          url.searchParams.set("provider", "${provider}");
          ${success ? `url.searchParams.set("connected", "true");` : `url.searchParams.set("error", ${JSON.stringify(error)});`}
          redirectUrl = url.toString();
          
          console.log("[callback-page] No window.opener detected, redirecting to settings:", redirectUrl);
          
          // Show message briefly then redirect
          setTimeout(function() {
            window.location.href = redirectUrl;
          }, ${success ? 1000 : 2000});
        }
      } catch (e) {
        console.error("Callback page error:", e);
        // On error, still try to redirect to settings (without extra params)
        var fallbackUrl = ${JSON.stringify(settingsUrl)};
        setTimeout(function() {
          window.location.href = fallbackUrl;
        }, 2000);
      }
    })();
  </script>
</body>
</html>
  `;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
    },
  });
}

