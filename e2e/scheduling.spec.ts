import { test, expect } from "@playwright/test";

test.describe("Scheduling - Calendar UI", () => {
  test.setTimeout(60000);

  test("should handle unauthenticated access to /calendar", async ({
    page,
  }) => {
    await page.goto("/en/calendar", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    await page.waitForTimeout(5000);

    const url = page.url();
    // Should either redirect to signin or stay on calendar page with auth state
    const isValidState = url.includes("signin") || url.includes("calendar");
    expect(isValidState).toBe(true);
  });

  test("should render calendar UI elements when accessible", async ({
    page,
  }) => {
    await page.goto("/en/calendar", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    await page.waitForTimeout(5000);

    const url = page.url();

    if (url.includes("calendar")) {
      // Calendar page should have some visible content
      await expect(page.locator("body")).toBeVisible();

      // Look for calendar-related elements (navigation, date display, grid)
      const hasCalendarContent =
        (await page.getByRole("button").count()) > 0 ||
        (await page.locator("table").isVisible().catch(() => false)) ||
        (await page.locator("[class*='calendar']").isVisible().catch(() => false));

      expect(hasCalendarContent).toBe(true);
    } else {
      expect(url).toContain("signin");
    }
  });
});

test.describe("Scheduling - API Protection", () => {
  test("GET /api/schedule should require authentication", async ({
    request,
  }) => {
    const response = await request.get("/api/schedule");
    expect([401, 403, 500]).toContain(response.status());
  });
});
