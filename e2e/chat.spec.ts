import { test, expect } from "@playwright/test";

test.describe("Chat - API Protection", () => {
  test("POST /api/chat should return 401 without authentication", async ({
    request,
  }) => {
    const response = await request.post("/api/chat", {
      data: { message: "test message" },
    });
    expect(response.status()).toBe(401);
  });

  test("GET /api/chat/sessions should return 401 without authentication", async ({
    request,
  }) => {
    const response = await request.get("/api/chat/sessions");
    expect(response.status()).toBe(401);
  });
});
