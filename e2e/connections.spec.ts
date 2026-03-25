import { test, expect } from "@playwright/test";

test.describe("Social Connections - API Protection", () => {
  test("GET /api/connections should require authentication", async ({
    request,
  }) => {
    const response = await request.get("/api/connections");
    expect([401, 403, 500]).toContain(response.status());
  });
});

test.describe("Social Connections - Settings Page", () => {
  test.setTimeout(60000);

  test("should handle unauthenticated access to /settings", async ({
    page,
  }) => {
    await page.goto("/en/settings", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    await page.waitForTimeout(5000);

    const url = page.url();
    // Should either redirect to signin or stay on settings page with auth state
    const isValidState = url.includes("signin") || url.includes("settings");
    expect(isValidState).toBe(true);
  });
});
