import { test, expect } from "@playwright/test";

test.describe("Dashboard - Unauthenticated Access", () => {
  const dashboardRoutes = [
    "create",
    "settings",
    "calendar",
    "drafts",
    "published",
    "failed",
    "videos",
    "api-dashboard",
  ];

  for (const route of dashboardRoutes) {
    test(`/en/${route} should redirect to signin when not authenticated`, async ({
      page,
    }) => {
      await page.goto(`/en/${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForURL(/signin/, { timeout: 15000 });
      expect(page.url()).toContain("signin");
    });
  }
});

test.describe("Profile Page - Unauthenticated Access", () => {
  test("should redirect to signin when not authenticated", async ({
    page,
  }) => {
    await page.goto("/en/profile", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/signin/, { timeout: 15000 });
    expect(page.url()).toContain("signin");
  });
});
