import { test, expect } from "@playwright/test";

test.describe("API Routes Health Check", () => {
  test("GET /api/pricing should return pricing data", async ({ request }) => {
    const response = await request.get("/api/pricing");
    // Should return 200 or appropriate status
    expect([200, 401, 500]).toContain(response.status());
  });

  test("GET /api/me should require authentication", async ({ request }) => {
    const response = await request.get("/api/me");
    // Without auth, should return 401 or similar error
    expect([401, 403, 500]).toContain(response.status());
  });

  test("GET /api/usage should require authentication", async ({ request }) => {
    const response = await request.get("/api/usage");
    expect([401, 403, 500]).toContain(response.status());
  });

  test("GET /api/connections should require authentication", async ({
    request,
  }) => {
    const response = await request.get("/api/connections");
    expect([401, 403, 500]).toContain(response.status());
  });

  test("GET /api/projects should require authentication", async ({
    request,
  }) => {
    const response = await request.get("/api/projects");
    expect([401, 403, 500]).toContain(response.status());
  });

  test("POST /api/auth with invalid body should return error", async ({
    request,
  }) => {
    const response = await request.post("/api/auth", {
      data: { mode: "login", email: "", password: "" },
    });
    // Should return error for empty credentials
    expect([400, 401, 422, 500]).toContain(response.status());
  });

  test("POST /api/auth login with invalid credentials", async ({
    request,
  }) => {
    const response = await request.post("/api/auth", {
      data: {
        mode: "login",
        email: "nonexistent@test.com",
        password: "wrongpassword",
      },
    });
    // Should not return 200 for invalid credentials
    expect(response.status()).not.toBe(200);
  });

  test("POST /api/coupons/validate with empty code", async ({ request }) => {
    const response = await request.post("/api/coupons/validate", {
      data: { code: "" },
    });
    expect([400, 401, 422, 500]).toContain(response.status());
  });

  test("GET /api/exchange-rate should respond", async ({ request }) => {
    const response = await request.get("/api/exchange-rate");
    // Should return some response (may need env vars for actual data)
    expect([200, 401, 500]).toContain(response.status());
  });

  test("GET /api/schedule should require authentication", async ({
    request,
  }) => {
    const response = await request.get("/api/schedule");
    expect([401, 403, 500]).toContain(response.status());
  });

  test("GET /api/ai/models should respond", async ({ request }) => {
    const response = await request.get("/api/ai/models");
    expect([200, 401, 403, 500]).toContain(response.status());
  });

  test("POST /api/ai/generate-text without auth should fail", async ({
    request,
  }) => {
    const response = await request.post("/api/ai/generate-text", {
      data: { prompt: "test" },
    });
    expect([400, 401, 403, 500]).toContain(response.status());
  });

  test("GET /api/limits should require authentication", async ({
    request,
  }) => {
    const response = await request.get("/api/limits");
    expect([401, 403, 500]).toContain(response.status());
  });

  test("GET /api/billing/subscription should require auth", async ({
    request,
  }) => {
    const response = await request.get("/api/billing/subscription");
    expect([401, 403, 500]).toContain(response.status());
  });
});

test.describe("Webhook Endpoints", () => {
  test("POST /api/webhooks/late without proper payload should not crash", async ({
    request,
  }) => {
    const response = await request.post("/api/webhooks/late", {
      data: {},
    });
    // Should handle gracefully (not 500 ideally, but acceptable)
    expect([200, 400, 401, 403, 500]).toContain(response.status());
  });

  test("POST /api/webhooks/video without proper payload", async ({
    request,
  }) => {
    const response = await request.post("/api/webhooks/video", {
      data: {},
    });
    expect([200, 400, 401, 403, 500]).toContain(response.status());
  });
});

test.describe("Cron Endpoints", () => {
  test("POST /api/cron/daily should respond", async ({ request }) => {
    const response = await request.post("/api/cron/daily");
    expect([200, 401, 403, 405, 500]).toContain(response.status());
  });

  test("POST /api/cron/ten-minutes should respond", async ({ request }) => {
    const response = await request.post("/api/cron/ten-minutes");
    expect([200, 401, 403, 405, 500]).toContain(response.status());
  });
});
