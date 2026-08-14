import { expect, test } from "@playwright/test";
import { openAuthenticatedSectionPage } from "./helpers/createSection";

function toIsoDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function toTimeLabel(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function buildSectionSeedData() {
  const now = new Date();
  const draftUpdatedAt = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const publishedAt = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
  const scheduledAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
  const failedAt = new Date(now.getTime() - 60 * 60 * 1000);

  return {
    accounts: [
      {
        id: "acc-facebook-1",
        platform: "facebook",
        profile_name: "Creator Hub FB",
        created_at: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
        profile_metadata: {
          username: "creatorhub.fb",
          avatar_url: "/shego.jpg",
        },
      },
      {
        id: "acc-youtube-1",
        platform: "youtube",
        profile_name: "Creator Hub YT",
        created_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
        profile_metadata: {
          username: "creatorhub.yt",
          avatar_url: "/shego.jpg",
        },
      },
    ],
    drafts: [
      {
        id: "draft-manual-1",
        project_id: "project-e2e-1",
        platform: "Facebook",
        text_content: "Draft pipeline for Da Nang itinerary with CTA for final thesis demo.",
        media_urls: ["/shego.jpg"],
        status: "draft" as const,
        created_at: draftUpdatedAt,
        updated_at: draftUpdatedAt,
      },
    ],
    publishedPosts: [
      {
        id: "published-manual-1",
        platform: "youtube",
        content: "Published launch recap for CreatorHub with strong demo narrative.",
        time: publishedAt,
        status: "posted",
        url: "https://youtube.com/watch?v=published-manual-1",
        profileName: "@creatorhub.yt",
        profilePic: "/shego.jpg",
        engagement: {
          likes: 48,
          comments: 9,
          shares: 5,
        },
      },
    ],
    failedPosts: [
      {
        id: "failed-manual-1",
        platform: "linkedin",
        content: "Failed LinkedIn teaser for internship defense and thesis showcase.",
        date: toIsoDate(failedAt),
        time: toTimeLabel(failedAt),
        error: "Rate limit exceeded",
        errorMessage: "Rate limit exceeded",
        profileName: "Creator Hub LI",
        profilePic: "/shego.jpg",
        scheduledAt: failedAt.toISOString(),
        lateJobId: "late-failed-manual-1",
        getlateAccountId: "late-account-linkedin-1",
        media: ["/shego.jpg"],
      },
    ],
    scheduledPosts: [
      {
        id: "scheduled-manual-1",
        platform: "instagram",
        scheduled_at: scheduledAt,
        late_job_id: "late-scheduled-manual-1",
        status: "scheduled",
        post_url: null,
        payload: {
          text: "Scheduled Instagram carousel for thesis progress and demo readiness.",
          text_content: "Scheduled Instagram carousel for thesis progress and demo readiness.",
          connected_account_id: "acc-facebook-1",
        },
      },
    ],
    profileIdentities: [
      { identity_id: "identity-google-1", provider: "google" },
      { identity_id: "identity-email-1", provider: "email" },
    ],
  };
}

test.describe("Create Sections - Manual QA Coverage", () => {
  test("drafts section shows saved draft and can reopen it in editor", async ({ page }) => {
    await openAuthenticatedSectionPage(page, "/en/drafts", buildSectionSeedData());

    await expect(page.getByText(/Draft pipeline for Da Nang itinerary/i)).toBeVisible();
    await page.getByRole("button", { name: /Edit/i }).first().click();

    await expect(page).toHaveURL(/\/en\/create$/);
    await expect(page.locator('[data-testid="post-editor-textarea"]').first()).toHaveValue(
      /Draft pipeline for Da Nang itinerary/i
    );
  });

  test("calendar section hydrates scheduled content into the daily agenda", async ({ page }) => {
    await openAuthenticatedSectionPage(page, "/en/calendar", buildSectionSeedData());

    await expect(page.getByText(/Daily agenda/i)).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText(/Scheduled Instagram carousel for thesis progress and demo readiness/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("published section renders summary cards and published content", async ({ page }) => {
    await openAuthenticatedSectionPage(page, "/en/published", buildSectionSeedData());

    await expect(page.getByText("Published output")).toBeVisible();
    await expect(page.getByText("Linked posts")).toBeVisible();
    await expect(page.getByText(/Published launch recap for CreatorHub/i)).toBeVisible();
  });

  test("failed section renders recovery queue with failed content", async ({ page }) => {
    await openAuthenticatedSectionPage(page, "/en/failed", buildSectionSeedData());

    await expect(page.getByText("Pipeline errors")).toBeVisible();
    await expect(page.getByText("Retry ready")).toBeVisible();
    await expect(page.getByText(/Failed LinkedIn teaser for internship defense/i)).toBeVisible();
  });

  test("operations section aggregates seeded activity across the workflow", async ({ page }) => {
    await openAuthenticatedSectionPage(page, "/en/operations", buildSectionSeedData());

    await expect(page.getByText(/Drafts in progress/i)).toBeVisible();
    await expect(page.getByText(/Current priorities/i)).toBeVisible();
    await page.getByRole("tab", { name: /Activity/i }).click();
    await expect(page.getByText(/Published launch recap for CreatorHub/i)).toBeVisible();
  });

  test("connections section shows connected accounts and available integrations", async ({ page }) => {
    await openAuthenticatedSectionPage(page, "/en/connections", buildSectionSeedData());

    await expect(page.getByRole("heading", { name: "Connected Accounts" })).toBeVisible();
    await expect(page.getByText("@creatorhub.fb")).toBeVisible();
    await expect(page.getByText("@creatorhub.yt")).toBeVisible();
    await expect(page.getByText(/Available integrations/i)).toBeVisible();
  });

  test("profile section shows authenticated account details and linked providers", async ({ page }) => {
    await openAuthenticatedSectionPage(page, "/en/profile", buildSectionSeedData());

    await expect(page.getByText("Playwright User")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("playwright@example.com").nth(1)).toBeVisible();
    await expect(page.getByText("Basic Information")).toBeVisible();
    await expect(page.getByText("Login methods", { exact: true })).toBeVisible();
    await expect(page.getByText("Google", { exact: true })).toBeVisible();
  });
});
