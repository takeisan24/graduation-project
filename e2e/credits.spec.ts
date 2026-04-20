import { test, expect } from "@playwright/test";

test.describe("Credits - API Protection", () => {
  test("GET /api/usage should return 401 without authentication", async ({
    request,
  }) => {
    const response = await request.get("/api/usage");
    expect(response.status()).toBe(401);
  });

  test("GET /api/usage/history should return 401 without authentication", async ({
    request,
  }) => {
    const response = await request.get("/api/usage/history");
    expect(response.status()).toBe(401);
  });

  test("GET /api/limits should return 401 without authentication", async ({
    request,
  }) => {
    const response = await request.get("/api/limits");
    expect(response.status()).toBe(401);
  });
});
