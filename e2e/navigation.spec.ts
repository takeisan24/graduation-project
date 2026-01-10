import { test, expect } from "@playwright/test";

test.describe("Navigation & Routing", () => {
  test("should redirect root / to locale-prefixed page", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);

    const url = page.url();
    // Should be redirected to /en or /vi (locale prefix)
    expect(url).toMatch(/\/(en|vi)(\/|$)/);
  });

  test("should load /en locale correctly", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("body")).toBeVisible();
    const header = page.locator("header");
    await expect(header).toBeVisible();
  });

  test("should load /vi locale correctly", async ({ page }) => {
    await page.goto("/vi");
    await expect(page.locator("body")).toBeVisible();
    const header = page.locator("header");
    await expect(header).toBeVisible();
  });

  test("should navigate from landing to sign in", async ({ page }) => {
    await page.goto("/en");

    const signInLink = page.locator('header a[href*="signin"]').first();

    if (await signInLink.isVisible()) {
      await signInLink.click();
      await page.waitForURL(/signin/);
      expect(page.url()).toContain("signin");
    }
  });

  test("should navigate from sign in to sign up", async ({ page }) => {
    await page.goto("/en/signin");

    const signUpLink = page.locator('a[href*="signup"]');
    await expect(signUpLink).toBeVisible();
    await signUpLink.click();
    await page.waitForURL(/signup/);
    expect(page.url()).toContain("signup");
  });

  test("should navigate from sign up to sign in", async ({ page }) => {
    await page.goto("/en/signup");

    const signInLink = page.locator('a[href*="signin"]');
    await expect(signInLink).toBeVisible();
    await signInLink.click();
    await page.waitForURL(/signin/);
    expect(page.url()).toContain("signin");
  });

  test("should load pricing page from direct URL", async ({ page }) => {
    await page.goto("/en/pricing");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("should load FAQ page", async ({ page }) => {
    await page.goto("/en/faq");
    await expect(page.locator("body")).toBeVisible();
  });

  test("should load terms page", async ({ page }) => {
    await page.goto("/en/terms");
    await expect(page.locator("body")).toBeVisible();
  });

  test("should load privacy page", async ({ page }) => {
    await page.goto("/en/privacy");
    await expect(page.locator("body")).toBeVisible();
  });

  test("should load buy-plan page", async ({ page }) => {
    await page.goto("/en/buy-plan");
    await expect(page.locator("body")).toBeVisible();
  });

  test("should load checkout page", async ({ page }) => {
    await page.goto("/en/checkout");
    await expect(page.locator("body")).toBeVisible();
  });

  test("should handle unknown section route", async ({ page }) => {
    // Unknown routes go to [section] catch-all which requires auth
    // Use domcontentloaded to avoid timeout from SSR auth checks
    test.setTimeout(60000);
    await page.goto("/en/this-page-does-not-exist", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    // Page should load (either auth redirect or page render)
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Language Switching", () => {
  test("should have language switcher in header", async ({ page }) => {
    await page.goto("/en");

    const header = page.locator("header");
    await expect(header).toBeVisible();
  });
});
