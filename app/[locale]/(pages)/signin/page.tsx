"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Sparkles, Eye, EyeOff } from "lucide-react";
import Header from "@/components/shared/header";
import Footer from "@/components/shared/footer";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { useTranslations } from "next-intl";
import { getAppUrl } from "@/lib/utils/urlConfig";

export default function SignInPage() {
  const router = useRouter();
  const params = useParams();
  const currentLocale = (params?.locale as string) || "en";
  const { isAuthenticated, loading: authLoading } = useAuth();

  const t = useTranslations("SignInPage");
  const tCommon = useTranslations("Common.auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track which OAuth provider is in progress to give precise UI feedback and avoid double submits
  const [oauthProviderLoading, setOauthProviderLoading] = useState<
    "google" | "facebook" | null
  >(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const redirectUrl = new URLSearchParams(window.location.search).get('redirect') ||
        new URLSearchParams(window.location.search).get('next') ||
        "/create";
      router.push(redirectUrl);
    }
  }, [authLoading, isAuthenticated, router]);

  /**
   * Handle email/password login
   */
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "login",
          email,
          password,
        }),
      });

      const raw = await response.json();
      const data = raw?.data ?? raw;

      if (!response.ok) {
        throw new Error(raw.error || "Login failed");
      }

      // Set session in Supabase client (API returns { success, data: { session, user, creditsRemaining } })
      if (data?.session) {
        console.log("[SignIn] Setting session...", {
          hasAccessToken: !!data.session.access_token,
          hasRefreshToken: !!data.session.refresh_token,
        });

        const { error: sessionError, data: sessionData } =
          await supabaseClient.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });

        if (sessionError) {
          console.error("[SignIn] Session error:", sessionError);
          throw sessionError;
        }

        console.log("[SignIn] setSession completed, verifying persistence...");

        // Verify session was actually saved
        await new Promise<void>((resolve) => {
          let resolved = false;
          const maxWait = 1000;
          const startTime = Date.now();

          // Check session immediately and periodically
          const checkSession = async () => {
            const {
              data: { session: currentSession },
              error,
            } = await supabaseClient.auth.getSession();

            if (currentSession && !resolved) {
              console.log(
                "[SignIn] ✅ Session verified in localStorage:",
                currentSession.user.email
              );
              // Also check localStorage directly - Supabase uses a specific key format
              const allKeys = Object.keys(localStorage);
              const supabaseKeys = allKeys.filter(
                (key) => key.includes("supabase") || key.includes("auth")
              );
              console.log("[SignIn] localStorage keys found:", supabaseKeys);
              resolved = true;
              resolve();
            } else if (Date.now() - startTime > maxWait && !resolved) {
              console.warn(
                "[SignIn] ⚠️ Timeout waiting for session persistence"
              );
              resolved = true;
              resolve();
            } else if (!resolved) {
              setTimeout(checkSession, 50);
            }
          };

          // Also listen for SIGNED_IN event
          const {
            data: { subscription },
          } = supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log(
              "[SignIn] Auth state change:",
              event,
              session?.user?.email
            );
            if (event === "SIGNED_IN" && session && !resolved) {
              console.log("[SignIn] ✅ SIGNED_IN event received");
              resolved = true;
              subscription.unsubscribe();
              setTimeout(() => resolve(), 200); // Give vector time for localStorage write
            }
          });

          // Start checking
          setTimeout(checkSession, 50);

          // Fallback timeout
          setTimeout(() => {
            if (!resolved) {
              console.warn("[SignIn] Fallback timeout reached");
              subscription.unsubscribe();
              resolved = true;
              resolve();
            }
          }, maxWait);
        });

        // Final verification before redirect
        const {
          data: { session: finalSession },
        } = await supabaseClient.auth.getSession();
        if (!finalSession) {
          console.error("[SignIn] ❌ Session still not found after waiting!");
          throw new Error("Failed to persist session");
        }
        console.log("[SignIn] ✅ Final session check passed, redirecting...");
      } else {
        throw new Error("No session returned from API");
      }

      // Use window.location for a full page reload to ensure session is loaded
      // This prevents race conditions with React state updates
      // Use window.location for a full page reload to ensure session is loaded
      // This prevents race conditions with React state updates
      const nextParam = new URLSearchParams(window.location.search).get("redirect") ||
        new URLSearchParams(window.location.search).get("next");

      const redirectUrl = nextParam ? decodeURIComponent(nextParam) : `/${currentLocale}/create`;
      window.location.href = redirectUrl;
    } catch (err: any) {
      setError(err.message || "An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle OAuth login (Google/Facebook)
   */
  const handleOAuthLogin = async (provider: "google" | "facebook") => {
    // Prevent duplicate clicks while an OAuth flow is already in progress
    if (oauthProviderLoading) return;

    setError(null);
    setIsLoading(true);
    setOauthProviderLoading(provider);

    try {
      // Initiate OAuth flow directly on client so PKCE verifier is stored in browser
      const appUrl = getAppUrl();
      const redirectParam = new URLSearchParams(window.location.search).get('redirect') ||
        new URLSearchParams(window.location.search).get('next');
      const redirectTo = `${appUrl}/${currentLocale}/auth/success${redirectParam ? `?next=${encodeURIComponent(redirectParam)}` : ''}`;
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          scopes:
            provider === "google"
              ? "openid email profile"
              : "public_profile email",
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("Missing OAuth URL");
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || "An error occurred during OAuth login");
      setIsLoading(false);
      setOauthProviderLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <div className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-md">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>

          <Card className="p-8 bg-card border-border">
            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Form */}
            <form className="space-y-5" onSubmit={handleLogin}>
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">{tCommon("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={tCommon("emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                  required
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password">{tCommon("password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={tCommon("passwordPlaceholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-input text-primary focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-sm text-muted-foreground">
                    {t("rememberMe")}
                  </span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  {t("forgotPassword")}
                </Link>
              </div>

              {/* Sign In Button */}
              <Button
                type="submit"
                className="w-full h-11 text-base"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : t("signIn")}
              </Button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-card text-muted-foreground">
                    {t("orContinueWith")}
                  </span>
                </div>
              </div>

              {/* Social Sign In Buttons */}
              <div className="grid grid-cols-1 gap-3">
                {/* Google */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => handleOAuthLogin("google")}
                  disabled={isLoading || !!oauthProviderLoading}
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>

                  {oauthProviderLoading === "google"
                    ? "Redirecting…"
                    : tCommon("google")}
                </Button>

                {/* Facebook */}
                {/* <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => handleOAuthLogin("facebook")}
                  disabled={isLoading || !!oauthProviderLoading}
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="#1877F2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>

                  {oauthProviderLoading === "facebook"
                    ? "Redirecting…"
                    : tCommon("facebook")}
                </Button> */}
              </div>

              {/* Create Account Link */}
              <div className="text-center pt-4">
                <span className="text-sm text-muted-foreground">
                  {t("noAccount")}{" "}
                </span>
                <Link
                  href="/signup"
                  className="text-sm text-primary hover:underline font-medium"
                >
                  {t("createAccount")}
                </Link>
              </div>
            </form>
          </Card>

          {/* Additional Info */}
          <p className="text-center text-xs text-muted-foreground mt-6">
            {t("termsText")}{" "}
            <Link href="/terms" className="text-primary hover:underline">
              {t("termsOfService")}
            </Link>{" "}
            {t("and")}{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              {t("privacyPolicy")}
            </Link>
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
