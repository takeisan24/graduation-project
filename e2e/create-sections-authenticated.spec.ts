import { expect, test, type Page } from "@playwright/test";
import {
  openAuthenticatedCreatePage,
  readStorageJson,
} from "./helpers/createSection";

function visibleTestId(page: Page, testId: string) {
  return page.locator(`[data-testid="${testId}"]:visible`).first();
}

async function generateSinglePost(page: Page, options?: { attachment?: "youtube" | "file" }) {
  await expect(visibleTestId(page, "empty-state-add-source-button")).toBeVisible();
  await visibleTestId(page, "empty-state-add-source-button").click();

  await expect(visibleTestId(page, "create-add-source-button")).toBeVisible();
  await visibleTestId(page, "create-add-source-button").click();

  await expect(visibleTestId(page, "goal-tab-awareness")).toBeVisible();
  await visibleTestId(page, "goal-tab-awareness").click();
  await visibleTestId(page, "niche-chip-travel").click();
  await visibleTestId(page, "framework-card-authentic-review").click();
  await visibleTestId(page, "source-form-next-step").click();

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

  await visibleTestId(page, "source-submit-button").click();

  await expect(visibleTestId(page, "platform-checkbox-facebook")).toBeVisible();
  await visibleTestId(page, "platform-checkbox-facebook").check({ force: true });
  await visibleTestId(page, "generate-posts-button").click({ force: true });

  await expect(visibleTestId(page, "post-editor-textarea")).toHaveValue(
    /Generated facebook content #1/
  );
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

    await visibleTestId(page, "empty-state-add-source-button").click();
    await visibleTestId(page, "create-add-source-button").click();
    await visibleTestId(page, "goal-tab-awareness").click();
    await visibleTestId(page, "niche-chip-travel").click();
    await visibleTestId(page, "framework-card-authentic-review").click();
    await visibleTestId(page, "source-form-next-step").click();

    await visibleTestId(page, "source-idea-textarea").fill("Create a short post from a YouTube video.");
    await visibleTestId(page, "source-open-attachment-picker").click();
    await visibleTestId(page, "source-type-youtube").click();
    await visibleTestId(page, "source-youtube-url").fill("https://youtube.com/");

    await expect(page.getByText(/Link không hợp lệ/i)).toBeVisible();
    await expect(visibleTestId(page, "source-submit-button")).toBeDisabled();
  });

  test("edge case: oversized file blocks source submission", async ({ page }) => {
    await openAuthenticatedCreatePage(page);

    await visibleTestId(page, "empty-state-add-source-button").click();
    await visibleTestId(page, "create-add-source-button").click();
    await visibleTestId(page, "goal-tab-awareness").click();
    await visibleTestId(page, "niche-chip-travel").click();
    await visibleTestId(page, "framework-card-authentic-review").click();
    await visibleTestId(page, "source-form-next-step").click();

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
