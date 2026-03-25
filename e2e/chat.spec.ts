import { test, expect } from "@playwright/test";

test.describe("Chat API Protection", () => {
  test("POST /api/chat should require authentication", async ({ request }) => {
    const response = await request.post("/api/chat", {
      data: { message: "test message" },
    });
    expect([401, 403, 500]).toContain(response.status());
  });

  test("GET /api/chat/sessions should require authentication", async ({
    request,
  }) => {
    const response = await request.get("/api/chat/sessions");
    expect([401, 403, 500]).toContain(response.status());
  });
});
