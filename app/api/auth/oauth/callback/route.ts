import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fail } from "@/lib/response";
import { getAppUrl } from "@/lib/utils/urlConfig";


// ✅ Force dynamic rendering for API route
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/oauth/callback
 * Handle OAuth callback from Supabase
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    console.log('[OAuth] Callback URL received:', url.toString())
    const code = url.searchParams.get('code');
    const localeFromQuery = url.searchParams.get('locale');
    const error = url.searchParams.get('error');
    const error_description = url.searchParams.get('error_description');

    if (error) {
      return fail(`OAuth error: ${error_description || error}`, 400);
    }

    if (!code) {
      return fail("Missing authorization code", 400);
    }

    // Exchange code for session using anon client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!supabaseUrl || !anonKey) {
      return fail("Missing NEXT_PUBLIC_SUPABASE env vars", 500);
    }
    // Create anon client (no session persistence needed on server)
    const oauthClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

    const { data, error: exchangeError } = await oauthClient.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      return fail(exchangeError.message, 400);
    }

    // Ensure user profile via service layer (RPC now returns credits_balance directly)
    let creditsBalance = 0;
    if (data.user?.id) {
      try {
        const { ensureUserProfile } = await import("@/lib/services/db/users");
        const creditsFromRPC = await ensureUserProfile(
          data.user.id,
          data.user.email,
          data.user.user_metadata?.full_name || data.user.user_metadata?.name,
          data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture
        );

        if (creditsFromRPC !== null && creditsFromRPC !== undefined) {
          creditsBalance = creditsFromRPC;
        }
      } catch (e) {
        console.warn('[OAuth] ensure_user_profile RPC warning:', e);
      }
    }

    // Redirect to frontend with success
    // Resolve app URL for final redirect using normalization helper
    const appUrl = getAppUrl();

    /**
     * Support i18n path prefixes: prefer query ?locale, then NEXT_LOCALE cookie, fallback 'vi'
     */
    const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value;
    const locale = (localeFromQuery || cookieLocale || 'vi').trim();

    // Include credits in session data
    const sessionData = {
      ...data.session,
      creditsRemaining: creditsBalance
    };

    const frontendUrl = `${appUrl}/${locale}/auth/success?session=${encodeURIComponent(JSON.stringify(sessionData))}`;
    console.log('[OAuth] Redirecting to frontend URL:', frontendUrl)
    return NextResponse.redirect(frontendUrl, { status: 303 });

  } catch (err: any) {
    console.error("OAuth callback error:", err);
    return fail(err.message || "Server error", 500);
  }
}


