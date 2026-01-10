import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { fail } from "@/lib/response";
import { initiateOAuthFlow, SUPPORTED_PROVIDERS, type Provider } from "@/lib/services/late/connectionService";
import { checkProfilePaywall } from "@/lib/paywall";

// SUPPORTED_PROVIDERS and Provider type are now exported from connectionService

/**
 * GET /api/late/connections/[provider]/start
 * Initiate OAuth flow to connect a social media account via late.dev
 * 
 * Flow:
 * 1. User clicks "Connect [Provider]" button
 * 2. Frontend calls this endpoint
 * 3. Backend redirects to late.dev OAuth with state containing userId and provider
 * 4. late.dev handles provider-specific OAuth
 * 5. late.dev redirects back to callback endpoint
 * 
 * @param req - NextRequest with provider in params
 * @returns Redirect to late.dev OAuth authorization URL
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    // Authenticate user
    const user = await requireAuth(req);
    if (!user) {
      return fail("Unauthorized", 401);
    }

    // Check profile limit before starting connection flow
    const profilePaywallCheck = await checkProfilePaywall(user.id);
    if (!profilePaywallCheck.allowed) {
      return fail(JSON.stringify({
        message: `Bạn đã kết nối tối đa tài khoản mxh. Ngắt kết nối 1 tài khoản không sử dụng hoặc nâng cấp gói plan của bạn.`,
        upgradeRequired: profilePaywallCheck.upgradeRequired,
        currentLimit: profilePaywallCheck.currentLimit,
        limitReached: profilePaywallCheck.limitReached,
        reason: profilePaywallCheck.reason
      }), 403);
    }

    const { provider } = params;
    
    // Get return URL from query params
    const returnTo = req.nextUrl.searchParams.get("returnTo") || "";
    const jsonMode = req.nextUrl.searchParams.get("json") === "1";
    const popupMode = req.nextUrl.searchParams.get("popup") === "1";
    
    // Use service layer to initiate OAuth flow
    const result = await initiateOAuthFlow({
      provider,
      userId: user.id,
      returnTo,
      popupMode,
      jsonMode
    });
    
    if (!result.success) {
      return fail(result.error || "Failed to initiate OAuth flow", 500);
    }
    
    // Handle Bluesky credentials requirement
    if (result.requiresCredentials) {
      if (jsonMode) {
        return NextResponse.json({
          success: true,
          requiresCredentials: true,
          provider: "bluesky",
          profileId: result.profileId || null,
          message: "Bluesky requires credentials. Please provide identifier and password.",
          endpoint: "/api/late/connections/bluesky/credentials"
        });
      }
      return fail("Bluesky connection requires credentials. Please use POST endpoint with credentials.", 400);
    }
    
    // If json=1 is provided, return the OAuth redirect URL as JSON
    if (jsonMode) {
      return NextResponse.json({ 
        success: true, 
        url: result.oauthRedirectUrl
      });
    }
    
    // Otherwise, redirect user directly to OAuth provider
    if (result.oauthRedirectUrl) {
      return NextResponse.redirect(result.oauthRedirectUrl, { status: 302 });
    }
    
    return fail("Failed to get OAuth redirect URL", 500);
    
  } catch (err: any) {
    console.error("[late/connections/start] Error:", err);
    return fail(err.message || "Failed to initiate OAuth flow", 500);
  }
}

