import { test, expect } from "@playwright/test";

test.describe("Connections - API Protection", () => {
  test("GET /api/connections should return 401 without authentication", async ({
    request,
  }) => {
    const response = await request.get("/api/connections");
    expect(response.status()).toBe(401);
  });
});

test.describe("Connections - Settings Page Unauthenticated", () => {
  test("should redirect /settings to signin when not authenticated", async ({
    page,
  }) => {
    await page.goto("/en/settings", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/signin/, { timeout: 15000 });
    expect(page.url()).toContain("signin");
  });
});
