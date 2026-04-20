import { expect, test } from "@playwright/test";

test.describe("Create Sections - API Protection", () => {
  test("POST /api/late/posts should return 401 without auth", async ({ request }) => {
    const response = await request.post("/api/late/posts", {
      data: { connectedAccountId: "acc-1", text: "hello" },
    });
    expect(response.status()).toBe(401);
  });

  test("POST /api/late/posts/check-pending should return 401 without auth", async ({
    request,
  }) => {
    const response = await request.post("/api/late/posts/check-pending", {
      data: { postIds: ["1"] },
    });
    expect(response.status()).toBe(401);
  });

  test("GET /api/late/posts/:id/check-status should return 401 without auth", async ({
    request,
  }) => {
    const response = await request.get("/api/late/posts/test-id/check-status");
    expect(response.status()).toBe(401);
  });

  test("PATCH /api/late/posts/:id/reschedule should return 401 without auth", async ({
    request,
  }) => {
    const response = await request.patch("/api/late/posts/test-id/reschedule", {
      data: { newScheduleAt: new Date().toISOString() },
    });
    expect(response.status()).toBe(401);
  });

  test("DELETE /api/late/posts/:id should return 401 without auth", async ({ request }) => {
    const response = await request.delete("/api/late/posts/test-id");
    expect(response.status()).toBe(401);
  });
});
