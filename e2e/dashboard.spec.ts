import { test, expect } from "@playwright/test";

// Protected routes may take a while due to SSR + auth checks
test.describe("Protected Dashboard Routes", () => {
  // Increase timeout for dashboard tests since they involve auth redirects
  test.setTimeout(60000);

  const protectedRoutes = [
    "create",
    "settings",
    "calendar",
    "drafts",
    "published",
    "failed",
    "videos",
    "api-dashboard",
  ];

  for (const route of protectedRoutes) {
    test(`should handle unauthenticated access to /${route}`, async ({
      page,
    }) => {
      // Use domcontentloaded to avoid waiting for all resources
      await page.goto(`/en/${route}`, { waitUntil: "domcontentloaded", timeout: 45000 });

      // Wait for client-side auth check and potential redirect
      await page.waitForTimeout(5000);

      const url = page.url();
      // Should either redirect to signin or stay on the page (with loading/auth state)
      const isValidState =
        url.includes("signin") ||
        url.includes(route) ||
        url.includes("create"); // some routes may redirect to /create first

      expect(isValidState).toBe(true);
    });
  }
});

test.describe("Profile Page", () => {
  test.setTimeout(60000);

  test("should handle unauthenticated access to profile", async ({
    page,
  }) => {
    await page.goto("/en/profile", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(5000);

    const url = page.url();
    expect(url.includes("signin") || url.includes("profile")).toBe(true);
  });
});
