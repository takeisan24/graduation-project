import { test, expect } from "@playwright/test";

test.describe("Scheduling - Unauthenticated Access", () => {
  test("should redirect /calendar to signin when not authenticated", async ({
    page,
  }) => {
    await page.goto("/en/calendar", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/signin/, { timeout: 15000 });
    expect(page.url()).toContain("signin");
  });
});

test.describe("Scheduling - API Protection", () => {
  test("GET /api/schedule should return 401 without authentication", async ({
    request,
  }) => {
    const response = await request.get("/api/schedule");
    expect(response.status()).toBe(401);
  });
});
