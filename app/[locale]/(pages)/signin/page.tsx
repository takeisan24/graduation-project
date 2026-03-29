"use client";

import { useState, FormEvent, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Eye, EyeOff, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import CreatorHubIcon from "@/components/shared/CreatorHubIcon";
import AuthBrandPanel from "@/components/shared/AuthBrandPanel";
import { Link } from "@/i18n/navigation";
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
  const [oauthProviderLoading, setOauthProviderLoading] = useState<"google" | "facebook" | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState("");

  const doRedirect = useCallback((url: string) => {
    setRedirectUrl(url);
    setShowSuccess(true);
    setTimeout(() => { window.location.href = url; }, 700);
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const redirectUrl = new URLSearchParams(window.location.search).get('redirect') ||
        new URLSearchParams(window.location.search).get('next') ||
        "/create";
      router.push(redirectUrl);
    }
  }, [authLoading, isAuthenticated, router]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "login", email, password }),
      });

      const raw = await response.json();
      const data = raw?.data ?? raw;

      if (!response.ok) {
        throw new Error(raw.error || "Login failed");
      }

      if (data?.session) {
        const { error: sessionError } = await supabaseClient.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) throw sessionError;

        // Wait for session persistence
        await new Promise<void>((resolve) => {
          let resolved = false;
          const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event) => {
            if (event === "SIGNED_IN" && !resolved) {
              resolved = true;
              subscription.unsubscribe();
              setTimeout(() => resolve(), 200);
            }
          });
          setTimeout(() => { if (!resolved) { resolved = true; resolve(); } }, 1000);
        });

        const { data: { session: finalSession } } = await supabaseClient.auth.getSession();
        if (!finalSession) throw new Error("Failed to persist session");
      } else {
        throw new Error("No session returned from API");
      }

      const nextParam = new URLSearchParams(window.location.search).get("redirect") ||
        new URLSearchParams(window.location.search).get("next");
      doRedirect(nextParam ? decodeURIComponent(nextParam) : `/${currentLocale}/create`);
    } catch (err: any) {
      setError(err.message || "An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: "google" | "facebook") => {
    if (oauthProviderLoading) return;
    setError(null);
    setIsLoading(true);
    setOauthProviderLoading(provider);

    try {
      const appUrl = getAppUrl();
      const redirectParam = new URLSearchParams(window.location.search).get('redirect') ||
        new URLSearchParams(window.location.search).get('next');
      const redirectTo = `${appUrl}/${currentLocale}/auth/success${redirectParam ? `?next=${encodeURIComponent(redirectParam)}` : ''}`;
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          scopes: provider === "google" ? "openid email profile" : "public_profile email",
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
    <div className="min-h-screen flex">
      <AuthBrandPanel variant="signin" />

      {/* Right panel - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <CreatorHubIcon className="h-9 w-9" />
            <span className="text-lg font-semibold tracking-tight">
              Creator<span className="gradient-text">Hub</span>
            </span>
          </div>

          {/* Title */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight mb-2">{t("title")}</h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Form */}
          <form className="space-y-5" onSubmit={handleLogin}>
            <div className="space-y-2">
              <Label htmlFor="email">{tCommon("email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={tCommon("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{tCommon("password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={tCommon("passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                  {t("rememberMe")}
                </Label>
              </div>
              <Link href="/forgot-password" className="text-sm text-utc-royal hover:underline">
                {t("forgotPassword")}
              </Link>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-12 text-base bg-gradient-to-r from-utc-royal to-utc-sky text-white shadow-sm hover:shadow-accent hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
              disabled={isLoading}
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("signingIn")}</>
              ) : (
                <>{t("signIn")}<ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-background text-muted-foreground">{t("orContinueWith")}</span>
              </div>
            </div>

            {/* Google OAuth */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-12"
              onClick={() => handleOAuthLogin("google")}
              disabled={isLoading || !!oauthProviderLoading}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {oauthProviderLoading === "google" ? t("oauthRedirecting") : tCommon("google")}
            </Button>

            {/* Links */}
            <div className="text-center pt-4">
              <span className="text-sm text-muted-foreground">{t("noAccount")} </span>
              <Link href="/signup" className="text-sm text-utc-royal hover:underline font-medium">
                {t("createAccount")}
              </Link>
            </div>
          </form>

          {/* Terms */}
          <p className="text-center text-xs text-muted-foreground mt-8">
            {t("termsText")}{" "}
            <Link href="/terms" className="text-utc-royal hover:underline">{t("termsOfService")}</Link>
            {" "}{t("and")}{" "}
            <Link href="/privacy" className="text-utc-royal hover:underline">{t("privacyPolicy")}</Link>
          </p>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccess}>
        <DialogContent className="sm:max-w-sm bg-card border-border [&>button]:hidden">
          <div className="flex flex-col items-center text-center py-4 space-y-4">
            <div className="h-14 w-14 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <h3 className="text-lg font-semibold">{t("successDialog.title")}</h3>
            <p className="text-sm text-muted-foreground">{t("successDialog.description")}</p>
            <Button
              className="w-full bg-gradient-to-r from-utc-royal to-utc-sky text-white"
              onClick={() => { window.location.href = redirectUrl; }}
            >
              {t("successDialog.redirect")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
