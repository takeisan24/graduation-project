import { expect, test, type Page } from "@playwright/test";
import {
  openAuthenticatedCreatePage,
  readStorageJson,
} from "./helpers/createSection";

test.describe.configure({ mode: "serial" });

function visibleTestId(page: Page, testId: string) {
  return page.locator(`[data-testid="${testId}"]:visible`).first();
}

async function ensureSourceFormOpen(page: Page) {
  if (await visibleTestId(page, "goal-tab-awareness").isVisible().catch(() => false)) {
    return;
  }

  if (await visibleTestId(page, "empty-state-add-source-button").isVisible().catch(() => false)) {
    await visibleTestId(page, "empty-state-add-source-button").click();
  }

  if (await visibleTestId(page, "create-add-source-button").isVisible().catch(() => false)) {
    await visibleTestId(page, "create-add-source-button").click();
  }

  await expect(visibleTestId(page, "goal-tab-awareness")).toBeVisible({ timeout: 15000 });
}

async function selectFramework(page: Page) {
  await ensureSourceFormOpen(page);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await visibleTestId(page, "goal-tab-awareness").click({ force: true });
    await expect(visibleTestId(page, "goal-tab-awareness")).toHaveAttribute("data-state", "active", {
      timeout: 5000,
    });

    await visibleTestId(page, "niche-chip-travel").click({ force: true });

    if (await visibleTestId(page, "framework-card-authentic-review").isVisible().catch(() => false)) {
      await visibleTestId(page, "framework-card-authentic-review").click();
      await visibleTestId(page, "source-form-next-step").click();
      await expect(visibleTestId(page, "source-idea-textarea")).toBeVisible({ timeout: 15000 });
      return;
    }

    await page.waitForTimeout(500);
  }

  await expect(visibleTestId(page, "framework-card-authentic-review")).toBeVisible({ timeout: 15000 });
}

async function generateSinglePost(page: Page, options?: { attachment?: "youtube" | "file" }) {
  await selectFramework(page);
  await visibleTestId(page, "source-idea-textarea").fill("Make a compelling travel post about Da Nang.");

  if (options?.attachment === "youtube") {
    await visibleTestId(page, "source-open-attachment-picker").click();
    await visibleTestId(page, "source-type-youtube").click();
    await visibleTestId(page, "source-youtube-url").fill("https://youtu.be/dQw4w9WgXcQ");
  }

  if (options?.attachment === "file") {
    await visibleTestId(page, "source-open-attachment-picker").click();
    await visibleTestId(page, "source-type-file").click();
    await visibleTestId(page, "source-file-input").setInputFiles({
      name: "brief.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("fake pdf content"),
    });
  }

  if (await visibleTestId(page, "source-submit-button").isVisible().catch(() => false)) {
    await visibleTestId(page, "source-submit-button").click();
  }

  await expect(visibleTestId(page, "platform-checkbox-facebook")).toBeVisible({ timeout: 15000 });
  await visibleTestId(page, "platform-checkbox-facebook").evaluate((node) => {
    (node as HTMLInputElement).click();
  });
  const generationRequest = page.waitForResponse((response) =>
    response.url().includes("/api/ai/generate-from-source") &&
    response.request().method() === "POST"
  );
  await visibleTestId(page, "generate-posts-button").evaluate((node) => {
    (node as HTMLButtonElement).click();
  });
  await generationRequest;

  await expect(visibleTestId(page, "post-editor-textarea")).toHaveValue(
    /Generated facebook content #1/
  , { timeout: 15000 });
}

test.describe("Create Sections - Authenticated UI", () => {
  test("happy path: generate post and save draft", async ({ page }) => {
    await openAuthenticatedCreatePage(page);
    await generateSinglePost(page);

    await visibleTestId(page, "save-draft-button").click();
    await expect(page.getByText(/Đã lưu bản nháp thành công/i)).toBeVisible();

    await page.goto("/en/drafts", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Generated facebook content #1/)).toBeVisible();
  });

  test("happy path: publish now updates published section", async ({ page }) => {
    await openAuthenticatedCreatePage(page);
    await generateSinglePost(page);

    await visibleTestId(page, "open-publish-modal-button").click();
    await expect(visibleTestId(page, "publish-modal")).toBeVisible();
    await visibleTestId(page, "publish-confirm-button").click();

    await expect(page.getByText(/đã được đăng thành công/i)).toBeVisible();

    await page.goto("/en/published", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Generated facebook content #1/)).toBeVisible();
  });

  test("happy path: schedule next slot persists pending and calendar events", async ({
    page,
  }) => {
    await openAuthenticatedCreatePage(page);
    await generateSinglePost(page, { attachment: "youtube" });

    await visibleTestId(page, "open-publish-modal-button").click();
    await visibleTestId(page, "publish-time-select").selectOption("next free slot");
    await visibleTestId(page, "publish-confirm-button").click();

    await expect(page.getByText(/Đã lên lịch 1 bài đăng/i)).toBeVisible();

    const pendingPosts = await readStorageJson<Array<{ content: string }>>(
      page,
      "pendingScheduledPosts"
    );
    expect(pendingPosts?.length).toBe(1);
    expect(pendingPosts?.[0]?.content).toContain("Generated facebook content #1");

    const calendarEvents = await readStorageJson<Record<string, Array<{ content: string }>>>(
      page,
      "calendarEvents"
    );
    expect(calendarEvents).not.toBeNull();
    const flattened = Object.values(calendarEvents || {}).flat();
    expect(flattened.some((event) => event.content.includes("Generated facebook content #1"))).toBeTruthy();
  });

  test("edge case: invalid youtube url blocks source submission", async ({ page }) => {
    await openAuthenticatedCreatePage(page);

    await selectFramework(page);

    await visibleTestId(page, "source-idea-textarea").fill("Create a short post from a YouTube video.");
    await visibleTestId(page, "source-open-attachment-picker").click();
    await visibleTestId(page, "source-type-youtube").click();
    await visibleTestId(page, "source-youtube-url").fill("https://youtube.com/");

    await expect(page.getByText(/Link không hợp lệ/i)).toBeVisible();
    await expect(visibleTestId(page, "source-submit-button")).toBeDisabled();
  });

  test("edge case: oversized file blocks source submission", async ({ page }) => {
    await openAuthenticatedCreatePage(page);

    await selectFramework(page);

    await visibleTestId(page, "source-idea-textarea").fill("Create a post from a file.");
    await visibleTestId(page, "source-open-attachment-picker").click();
    await visibleTestId(page, "source-type-file").click();
    await visibleTestId(page, "source-file-input").setInputFiles({
      name: "large.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
    });

    await expect(page.getByText(/Kích thước file không được vượt quá 10MB/i)).toBeVisible();
    await expect(visibleTestId(page, "source-submit-button")).toBeDisabled();
  });

  test("edge case: publish now requires connected account selection", async ({ page }) => {
    await openAuthenticatedCreatePage(page, { accounts: [] });
    await generateSinglePost(page);

    await visibleTestId(page, "open-publish-modal-button").click();
    await visibleTestId(page, "publish-confirm-button").click();

    await expect(page.getByText(/Vui lòng chọn tài khoản để đăng bài/i)).toBeVisible();
  });

  test("edge case: schedule failure does not create pending posts", async ({ page }) => {
    await openAuthenticatedCreatePage(page, { scheduleShouldFail: true });
    await generateSinglePost(page, { attachment: "file" });

    await visibleTestId(page, "open-publish-modal-button").click();
    await visibleTestId(page, "publish-time-select").selectOption("next free slot");
    await visibleTestId(page, "publish-confirm-button").click();

    const pendingPosts = await readStorageJson<Array<unknown>>(page, "pendingScheduledPosts");
    expect(pendingPosts ?? []).toHaveLength(0);
  });
});
