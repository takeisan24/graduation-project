import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en");
    await page.waitForLoadState("networkidle");
  });

  test("should have correct page title", async ({ page }) => {
    await expect(page).toHaveTitle(/CreatorHub/i);
  });

  test("should display header with logo", async ({ page }) => {
    const logo = page.locator("header").getByText("CreatorHub");
    await expect(logo).toBeVisible();
  });

  test("should have sign in link in header", async ({ page }) => {
    const signInLink = page.locator('header a[href*="signin"]').first();
    await expect(signInLink).toBeVisible();
  });

  test("should display hero section", async ({ page }) => {
    const heroSection = page.locator(".min-h-screen").first();
    await expect(heroSection).toBeVisible();
  });

  test("should display CTA buttons in hero", async ({ page }) => {
    // There should be at least one call-to-action button/link in the hero area
    const ctaButtons = page
      .locator(".min-h-screen")
      .first()
      .locator('a, button')
      .filter({ hasText: /.+/ });
    const count = await ctaButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should display footer", async ({ page }) => {
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
  });

  test("should have footer with CreatorHub branding", async ({ page }) => {
    const footer = page.locator("footer");
    await expect(footer).toContainText(/CreatorHub/i);
  });

  test("should be responsive - hamburger menu on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/en");
    await page.waitForLoadState("networkidle");

    const hamburgerButton = page.locator('button[aria-label="Toggle menu"]');
    await expect(hamburgerButton).toBeVisible();

    await hamburgerButton.click();

    // Mobile menu should appear after clicking hamburger
    const mobileMenu = page.locator(".md\\:hidden").last();
    await expect(mobileMenu).toBeVisible();
  });
});
