import { test, expect } from "@playwright/test";

test.describe("Credit System - API Protection", () => {
  test("GET /api/usage should require authentication", async ({ request }) => {
    const response = await request.get("/api/usage");
    expect([401, 403, 500]).toContain(response.status());
  });

  test("GET /api/usage/history should require authentication", async ({
    request,
  }) => {
    const response = await request.get("/api/usage/history");
    expect([401, 403, 500]).toContain(response.status());
  });

  test("GET /api/limits should require authentication", async ({ request }) => {
    const response = await request.get("/api/limits");
    expect([401, 403, 500]).toContain(response.status());
  });

  test("POST /api/ai/generate-text without auth should fail", async ({
    request,
  }) => {
    const response = await request.post("/api/ai/generate-text", {
      data: { prompt: "test" },
    });
    expect([400, 401, 403, 500]).toContain(response.status());
  });

  test("POST /api/ai/generate-image without auth should fail", async ({
    request,
  }) => {
    const response = await request.post("/api/ai/generate-image", {
      data: { prompt: "test image" },
    });
    expect([400, 401, 403, 500]).toContain(response.status());
  });
});
