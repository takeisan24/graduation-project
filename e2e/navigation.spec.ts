import { test, expect } from "@playwright/test";

test.describe("Locale Routing", () => {
  test("should redirect root / to a locale-prefixed page", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForURL(/\/(en|vi)(\/|$)/);
    expect(page.url()).toMatch(/\/(en|vi)(\/|$)/);
  });

  test("should load /en locale with header", async ({ page }) => {
    await page.goto("/en");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("header")).toBeVisible();
  });

  test("should load /vi locale with header", async ({ page }) => {
    await page.goto("/vi");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("header")).toBeVisible();
  });
});

test.describe("Public Page Navigation", () => {
  test("should navigate from landing to sign in via header link", async ({
    page,
  }) => {
    await page.goto("/en");
    await page.waitForLoadState("networkidle");

    const signInLink = page.locator('header a[href*="signin"]').first();
    await expect(signInLink).toBeVisible();
    await signInLink.click();
    await page.waitForURL(/signin/);
    expect(page.url()).toContain("signin");
  });

  test("should navigate from sign in to sign up", async ({ page }) => {
    await page.goto("/en/signin");
    await page.waitForLoadState("networkidle");

    const signUpLink = page.locator('a[href*="signup"]');
    await expect(signUpLink).toBeVisible();
    await signUpLink.click();
    await page.waitForURL(/signup/);
    expect(page.url()).toContain("signup");
  });

  test("should navigate from sign up to sign in", async ({ page }) => {
    await page.goto("/en/signup");
    await page.waitForLoadState("networkidle");

    const signInLink = page.locator('a[href*="signin"]');
    await expect(signInLink).toBeVisible();
    await signInLink.click();
    await page.waitForURL(/signin/);
    expect(page.url()).toContain("signin");
  });

  test("should load pricing page with heading", async ({ page }) => {
    await page.goto("/en/pricing");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("should load terms page with content", async ({ page }) => {
    await page.goto("/en/terms");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("should load privacy page with content", async ({ page }) => {
    await page.goto("/en/privacy");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toBeVisible();
  });
});

test.describe("Protected Route Redirects (unauthenticated)", () => {
  const protectedRoutes = [
    "create",
    "connections",
    "settings",
    "calendar",
    "drafts",
    "published",
    "failed",
    "videos",
    "operations",
    "api-dashboard",
    "profile",
  ];

  for (const route of protectedRoutes) {
    test(`/${route} should redirect unauthenticated user to signin`, async ({
      page,
    }) => {
      await page.goto(`/en/${route}`, { waitUntil: "domcontentloaded" });

      // Wait for the redirect to signin to happen
      await page.waitForURL(/signin/, { timeout: 15000 });
      expect(page.url()).toContain("signin");
    });
  }
});
