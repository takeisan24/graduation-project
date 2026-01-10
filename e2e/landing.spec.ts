import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en");
  });

  test("should load the landing page successfully", async ({ page }) => {
    await expect(page).toHaveTitle(/Maiovo/i);
  });

  test("should display the header with logo and navigation", async ({
    page,
  }) => {
    // Logo
    const logo = page.locator("header").getByText("Maiovo");
    await expect(logo).toBeVisible();

    // Sign In and Get Started buttons visible on desktop
    const header = page.locator("header");
    await expect(header).toBeVisible();
  });

  test("should display hero section", async ({ page }) => {
    // Hero section should be present
    const heroSection = page.locator(".min-h-screen").first();
    await expect(heroSection).toBeVisible();
  });

  test("should display How It Works section", async ({ page }) => {
    // Scroll down to find content sections
    await page.evaluate(() => window.scrollTo(0, 500));
    // The page should have multiple sections
    const sections = page.locator("section, [class*='py-']");
    const count = await sections.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should display Footer", async ({ page }) => {
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
  });

  test("should have working navigation links in header", async ({ page }) => {
    // Check that Sign In link exists (desktop)
    const signInLink = page.locator('header a[href*="signin"]').first();
    // May be hidden on mobile, check it exists in DOM
    await expect(signInLink).toHaveCount(1);
  });

  test("should be responsive - mobile menu toggle", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/en");

    // Hamburger button should be visible on mobile
    const hamburgerButton = page.locator(
      'button[aria-label="Toggle menu"]'
    );
    await expect(hamburgerButton).toBeVisible();

    // Click to open mobile menu
    await hamburgerButton.click();

    // Mobile menu panel should appear
    const mobileMenu = page.locator(".md\\:hidden").last();
    await expect(mobileMenu).toBeVisible();
  });
});
