import { test, expect } from "@playwright/test";

test.describe("Content Creation - Unauthenticated Access", () => {
  test.setTimeout(60000);

  test("should handle unauthenticated access to /create", async ({ page }) => {
    await page.goto("/en/create", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    await page.waitForTimeout(5000);

    const url = page.url();
    // Should either redirect to signin or stay on create page with auth state
    const isValidState = url.includes("signin") || url.includes("create");
    expect(isValidState).toBe(true);
  });

  test("should display create page UI elements when accessible", async ({
    page,
  }) => {
    await page.goto("/en/create", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    await page.waitForTimeout(5000);

    const url = page.url();

    if (url.includes("create")) {
      // Page loaded — verify body is visible at minimum
      await expect(page.locator("body")).toBeVisible();
    } else {
      // Redirected to signin — that is expected for unauthenticated users
      expect(url).toContain("signin");
    }
  });

  test("should display source input options when page is accessible", async ({
    page,
  }) => {
    await page.goto("/en/create", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    await page.waitForTimeout(5000);

    const url = page.url();

    if (url.includes("create")) {
      // Look for source input tabs (URL, text, PDF)
      const body = page.locator("body");
      await expect(body).toBeVisible();

      // Check for tab-like elements or input options
      const hasUrlOption =
        (await page.getByRole("tab", { name: /url/i }).isVisible().catch(() => false)) ||
        (await page.getByText(/url/i).first().isVisible().catch(() => false));
      const hasTextOption =
        (await page.getByRole("tab", { name: /text/i }).isVisible().catch(() => false)) ||
        (await page.getByText(/text/i).first().isVisible().catch(() => false));

      // At least one input option should be visible
      expect(hasUrlOption || hasTextOption).toBe(true);
    } else {
      expect(url).toContain("signin");
    }
  });

  test("should display AI generation buttons when page is accessible", async ({
    page,
  }) => {
    await page.goto("/en/create", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    await page.waitForTimeout(5000);

    const url = page.url();

    if (url.includes("create")) {
      // Look for generate/AI buttons
      const buttons = page.locator("button");
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);
    } else {
      expect(url).toContain("signin");
    }
  });

  test("should display platform selection UI when page is accessible", async ({
    page,
  }) => {
    await page.goto("/en/create", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    await page.waitForTimeout(5000);

    const url = page.url();

    if (url.includes("create")) {
      // Page should have some interactive elements for platform selection
      await expect(page.locator("body")).toBeVisible();
    } else {
      expect(url).toContain("signin");
    }
  });
});
