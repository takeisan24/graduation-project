import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { success, fail } from "@/lib/response";
import { getAppUrl } from "@/lib/utils/urlConfig";

/**
 * POST /api/auth/oauth
 * Handle OAuth authentication (sign in/up with Google, Facebook)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider, locale } = body as { provider?: string; locale?: string };

    if (!provider) return fail("provider is required", 400);

    // Validate provider
    const supportedProviders = ['google', 'facebook'];
    if (!supportedProviders.includes(provider)) {
      return fail("Unsupported provider. Supported: google, facebook", 400);
    }

    // Create an anon Supabase client for OAuth (service role is NOT allowed)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!supabaseUrl || !anonKey) {
      return fail("Missing NEXT_PUBLIC_SUPABASE env vars", 500);
    }
    // Use PKCE flow to ensure the provider returns a `code` (not an access_token hash)
    const oauthClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, flowType: 'pkce' } });

    // Resolve app URL for redirects using normalization helper
    const appUrl = getAppUrl();

    /**
     * Redirect directly to localized success page.
     * Rationale: Avoid PKCE verifier storage on server; let Supabase handle session
     * detection on client (detectSessionInUrl=true) and the success page will fallback
     * to getSession() if needed.
     */
    const effectiveLocale = (locale || 'vi').trim();
    const redirectTo = `${appUrl}/${effectiveLocale}/auth/success`;

    // Sign in with OAuth provider using the anon client
    const { data, error } = await oauthClient.auth.signInWithOAuth({
      provider: provider as 'google' | 'facebook',
      options: {
        redirectTo
      }
    });

    if (error) {
      return fail(error.message, 400);
    }

    // Return the provider URL to the client; the client will navigate with GET
    return NextResponse.json({ success: true, data: { url: data.url } }, { status: 200 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("OAuth auth error:", message);
    return fail(message, 500);
  }
}

