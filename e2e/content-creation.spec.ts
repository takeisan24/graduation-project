import { test, expect } from "@playwright/test";

test.describe("Content Creation - Unauthenticated Access", () => {
  test("should redirect /create to signin when not authenticated", async ({
    page,
  }) => {
    await page.goto("/en/create", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/signin/, { timeout: 15000 });
    expect(page.url()).toContain("signin");
  });
});

test.describe("Content Creation - API Protection", () => {
  test("POST /api/ai/generate-text should return 401 without auth", async ({
    request,
  }) => {
    const response = await request.post("/api/ai/generate-text", {
      data: { prompt: "test" },
    });
    expect(response.status()).toBe(401);
  });

  test("POST /api/ai/generate-image should return 401 without auth", async ({
    request,
  }) => {
    const response = await request.post("/api/ai/generate-image", {
      data: { prompt: "test" },
    });
    expect(response.status()).toBe(401);
  });

  test("POST /api/ai/generate-from-source should return 401 without auth", async ({
    request,
  }) => {
    const response = await request.post("/api/ai/generate-from-source", {
      data: { source: "test" },
    });
    expect(response.status()).toBe(401);
  });
});
