import { test, expect } from "@playwright/test";

test.describe("API Routes - Protected Endpoints (unauthenticated)", () => {
  const protectedGetEndpoints = [
    "/api/me",
    "/api/usage",
    "/api/usage/history",
    "/api/connections",
    "/api/projects",
    "/api/schedule",
    "/api/limits",
    "/api/ai/models",
    "/api/chat/sessions",
  ];

  for (const endpoint of protectedGetEndpoints) {
    test(`GET ${endpoint} should return 401 without authentication`, async ({
      request,
    }) => {
      const response = await request.get(endpoint);
      expect(response.status()).toBe(401);
    });
  }

  test("POST /api/ai/generate-text should return 401 without authentication", async ({
    request,
  }) => {
    const response = await request.post("/api/ai/generate-text", {
      data: { prompt: "test" },
    });
    expect(response.status()).toBe(401);
  });

  test("POST /api/ai/generate-image should return 401 without authentication", async ({
    request,
  }) => {
    const response = await request.post("/api/ai/generate-image", {
      data: { prompt: "test image" },
    });
    expect(response.status()).toBe(401);
  });

  test("POST /api/chat should return 401 without authentication", async ({
    request,
  }) => {
    const response = await request.post("/api/chat", {
      data: { message: "test message" },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe("API Routes - Auth Endpoint", () => {
  test("POST /api/auth with missing fields should return 400", async ({
    request,
  }) => {
    const response = await request.post("/api/auth", {
      data: { mode: "login", email: "", password: "" },
    });
    expect(response.status()).toBe(400);
  });

  test("POST /api/auth login with invalid credentials should not return 200", async ({
    request,
  }) => {
    const response = await request.post("/api/auth", {
      data: {
        mode: "login",
        email: "nonexistent@test.com",
        password: "wrongpassword",
      },
    });
    expect(response.status()).not.toBe(200);
  });

  test("POST /api/auth with missing mode should return 400", async ({
    request,
  }) => {
    const response = await request.post("/api/auth", {
      data: { email: "test@test.com", password: "password123" },
    });
    expect(response.status()).toBe(400);
  });
});
