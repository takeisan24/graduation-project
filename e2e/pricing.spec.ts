import { test, expect } from "@playwright/test";

test.describe("Pricing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/pricing");
    // Wait for framer-motion animations to complete
    await page.waitForTimeout(1500);
  });

  test("should load the pricing page", async ({ page }) => {
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
  });

  test("should display plan names (at least 4 plan headings)", async ({
    page,
  }) => {
    // Plans are rendered as h3 elements within cards
    const planHeadings = page.locator("h3");
    const count = await planHeadings.count();
    // At least 4 plan headings in the pricing cards section
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test("should display pricing amounts", async ({ page }) => {
    // Price text like "$0", "$19", etc. with /mo suffix
    const priceElements = page.locator('[class*="text-4xl"]');
    const count = await priceElements.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test("should have CTA buttons for plans", async ({ page }) => {
    // CTA buttons inside links to checkout
    const ctaButtons = page.locator('a[href*="checkout"] button');
    const count = await ctaButtons.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test("should display feature lists in plan cards", async ({ page }) => {
    // Feature rows with checkmark or X icons
    const featureRows = page.locator("li").filter({
      has: page.locator("span"),
    });
    const count = await featureRows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should display credit system section", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(800);

    // Credit system has grid rows with action/cost/note
    const creditRows = page.locator('[class*="grid"][class*="md:grid-cols-3"]');
    const count = await creditRows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should display top-up packages with Credits text", async ({
    page,
  }) => {
    await page.evaluate(() => window.scrollTo(0, 2500));
    await page.waitForTimeout(800);

    const creditsText = page.getByText(/Credits/);
    const count = await creditsText.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("should display FAQ section at bottom", async ({ page }) => {
    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight)
    );
    await page.waitForTimeout(800);

    const faqItems = page.locator("h3").last();
    await expect(faqItems).toBeVisible();
  });

  test("should have the header and footer", async ({ page }) => {
    await expect(page.locator("header")).toBeVisible();

    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight)
    );
    await page.waitForTimeout(500);
    await expect(page.locator("footer")).toBeVisible();
  });
});
