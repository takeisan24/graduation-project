import type { Page, Route } from "@playwright/test";

type MockAccount = {
  id: string;
  platform: string;
  profile_name: string;
  profile_metadata: {
    username: string;
    avatar_url?: string;
  };
};

type PublishedPost = {
  id: string;
  platform: string;
  content: string;
  time: string;
  status: string;
  url: string;
  profileName: string;
  profilePic: string;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
  };
};

type ScheduledPost = {
  id: string;
  platform: string;
  scheduled_at: string;
  late_job_id: string;
  status: string;
  post_url: string | null;
  payload: {
    text: string;
    text_content: string;
    connected_account_id?: string;
  };
};

export type CreateSectionMockOptions = {
  accounts?: MockAccount[];
  publishShouldFail?: boolean;
  scheduleShouldFail?: boolean;
  generateMalformedResponse?: boolean;
  generateShouldFail?: boolean;
};

export type CreateSectionMockState = {
  publishedPosts: PublishedPost[];
  failedPosts: Array<Record<string, unknown>>;
  scheduledPosts: ScheduledPost[];
};

const DEFAULT_ACCOUNTS: MockAccount[] = [
  {
    id: "acc-facebook-1",
    platform: "facebook",
    profile_name: "Creator Hub FB",
    profile_metadata: {
      username: "creatorhub.fb",
      avatar_url: "/shego.jpg",
    },
  },
  {
    id: "acc-youtube-1",
    platform: "youtube",
    profile_name: "Creator Hub YT",
    profile_metadata: {
      username: "creatorhub.yt",
      avatar_url: "/shego.jpg",
    },
  },
];

function buildSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  return {
    access_token: "playwright-access-token",
    refresh_token: "playwright-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: {
      id: "playwright-user-id",
      email: "playwright@example.com",
      app_metadata: { provider: "email" },
      user_metadata: { full_name: "Playwright User" },
      aud: "authenticated",
      role: "authenticated",
      created_at: new Date().toISOString(),
    },
  };
}

export async function seedAuthenticatedSession(page: Page) {
  const session = buildSession();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

  await page.addInitScript(
    ({ seededSession, seededSupabaseUrl, seededBaseUrl }) => {
      window.localStorage.clear();

      const projectRef = (() => {
        try {
          const parsed = new URL(seededSupabaseUrl);
          return parsed.hostname.split(".")[0] || "project";
        } catch {
          return "project";
        }
      })();

      const baseUrlInfo = new URL(seededBaseUrl);
      const hostname = baseUrlInfo.hostname;
      const port = baseUrlInfo.port;
      const domain = port ? `${hostname}:${port}` : hostname;
      const domainHash = domain
        .replace(/[^a-zA-Z0-9]/g, "-")
        .toLowerCase()
        .substring(0, 32);
      const storageKey = `sb-${projectRef}-${domainHash}-auth-token`;

      window.localStorage.setItem("__e2e_supabase_session", JSON.stringify(seededSession));
      window.localStorage.setItem(storageKey, JSON.stringify(seededSession));
      window.localStorage.setItem("hasSeenOnboarding", "true");
      window.localStorage.setItem("hasCompletedFirstFlow", "true");
    },
    { seededSession: session, seededSupabaseUrl: supabaseUrl, seededBaseUrl: baseUrl }
  );
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export async function installCreateSectionMocks(
  page: Page,
  options: CreateSectionMockOptions = {}
) {
  const state: CreateSectionMockState = {
    publishedPosts: [],
    failedPosts: [],
    scheduledPosts: [],
  };

  const accounts = options.accounts ?? DEFAULT_ACCOUNTS;

  await page.route("**/api/late/connections", async (route) => {
    await fulfillJson(route, {
      success: true,
      data: { connections: accounts },
    });
  });

  await page.route(/.*\/api\/usage(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, {
      success: true,
      data: {
        credits: {
          balance: 42,
          remaining: 42,
          used: 8,
          total: 50,
        },
        plan: "pro",
        limits: {
          profiles: {
            current: accounts.length,
            limit: 10,
          },
        },
      },
    });
  });

  await page.route(/.*\/api\/usage\/storage(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, {
      success: true,
      data: {
        usedBytes: 512 * 1024 * 1024,
        limitGB: 10,
        usagePercent: 5.12,
      },
    });
  });

  await page.route(/.*\/api\/usage\/history(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, {
      success: true,
      data: {
        history: [],
      },
    });
  });

  await page.route(/.*\/api\/limits(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, {
      success: true,
      data: {
        profiles: {
          current: accounts.length,
          limit: 10,
        },
      },
    });
  });

  await page.route("**/api/posts/published/tiktok-urls", async (route) => {
    await fulfillJson(route, { success: true, data: { updatedUrls: {} } });
  });

  await page.route(/.*\/api\/posts\/published(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, {
      success: true,
      data: {
        posts: state.publishedPosts,
        count: state.publishedPosts.length,
      },
    });
  });

  await page.route(/.*\/api\/posts\/failed(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, {
      success: true,
      data: {
        posts: state.failedPosts,
        count: state.failedPosts.length,
      },
    });
  });

  await page.route("**/api/v1/strategy-config", async (route) => {
    await fulfillJson(route, {
      success: true,
      data: {
        goals: [
          {
            id: "goal-awareness",
            slug: "awareness",
            label: "Awareness",
            description: "Build awareness",
          },
        ],
        niches: [
          {
            id: "niche-travel",
            slug: "travel",
            label: "Travel",
            description: "Travel niche",
          },
        ],
        frameworks: [
          {
            id: "framework-authentic-review",
            slug: "authentic-review",
            title: "Authentic Review",
            description: "Review framework",
            icon_name: "Sparkles",
            goals: ["goal-awareness"],
            niches: ["niche-travel"],
            placeholders: ["Chia sẻ trải nghiệm thực tế", "Nêu điểm nổi bật"],
            base_prompt_text: "Write social posts from the provided source.",
          },
        ],
      },
    });
  });

  await page.route("**/api/ai/generate-from-source", async (route) => {
    if (options.generateShouldFail) {
      await fulfillJson(
        route,
        { success: false, error: "Generation failed in test" },
        500
      );
      return;
    }

    const requestBody = route.request().postDataJSON() as {
      platforms?: string[];
    };
    const platforms = requestBody.platforms || ["facebook"];

    if (options.generateMalformedResponse) {
      await fulfillJson(route, {
        success: true,
        data: { response: "No JSON block here" },
      });
      return;
    }

    const posts = platforms.map((platform, index) => ({
      action: "create_post",
      platform: platform[0].toUpperCase() + platform.slice(1),
      content: `Generated ${platform} content #${index + 1}`,
      summary_for_chat: `Generated ${platform} draft #${index + 1}`,
    }));

    await fulfillJson(route, {
      success: true,
      data: {
        response: `\`\`\`json\n${JSON.stringify(posts, null, 2)}\n\`\`\``,
      },
    });
  });

  await page.route("**/api/late/posts/check-pending", async (route) => {
    await fulfillJson(route, {
      success: true,
      data: { results: [], errors: [] },
    });
  });

  await page.route(/.*\/api\/late\/posts\/[^/]+\/check-status$/, async (route) => {
    const postId = route.request().url().split("/").slice(-2, -1)[0];
    const matched = state.scheduledPosts.find((item) => item.id === postId);
    await fulfillJson(route, {
      success: true,
      data: {
        post: matched || null,
        postStatus: matched?.status || "scheduled",
        newStatus: matched?.status || "scheduled",
        statusChanged: false,
      },
    });
  });

  await page.route(/.*\/api\/late\/posts\/[^/]+\/reschedule$/, async (route) => {
    const postId = route.request().url().split("/").slice(-2, -1)[0];
    const body = route.request().postDataJSON() as { newScheduleAt?: string };
    const target = state.scheduledPosts.find((item) => item.id === postId);

    if (target && body.newScheduleAt) {
      target.scheduled_at = body.newScheduleAt;
      target.status = "scheduled";
    }

    await fulfillJson(route, {
      success: true,
      data: { post: target || null },
    });
  });

  await page.route(/.*\/api\/late\/posts\/[^/]+$/, async (route) => {
    const method = route.request().method();
    const postId = route.request().url().split("/").pop() || "";

    if (method === "DELETE") {
      state.scheduledPosts = state.scheduledPosts.filter((item) => item.id !== postId);
      state.publishedPosts = state.publishedPosts.filter((item) => item.id !== postId);
      await fulfillJson(route, { success: true, data: { deleted: true, id: postId } });
      return;
    }

    const matched = state.scheduledPosts.find((item) => item.id === postId);
    await fulfillJson(route, {
      success: true,
      data: { post: matched || null },
    });
  });

  await page.route("**/api/late/posts", async (route) => {
    if (route.request().method() !== "POST") {
      await fulfillJson(route, { success: true, data: { posts: [] } });
      return;
    }

    if (options.publishShouldFail) {
      await fulfillJson(
        route,
        { success: false, error: "Publish failed in test" },
        500
      );
      return;
    }

    const body = route.request().postDataJSON() as {
      connectedAccountId: string;
      text: string;
    };
    const platform =
      accounts.find((item) => item.id === body.connectedAccountId)?.platform || "facebook";
    const createdAt = new Date().toISOString();
    const newId = `published-${state.publishedPosts.length + 1}`;
    const url = `https://${platform}.com/post/${newId}`;

    state.publishedPosts.unshift({
      id: newId,
      platform,
      content: body.text,
      time: createdAt,
      status: "posted",
      url,
      profileName: "@creatorhub",
      profilePic: "/shego.jpg",
      engagement: { likes: 0, comments: 0, shares: 0 },
    });

    await fulfillJson(route, {
      success: true,
      data: {
        latePost: {
          id: newId,
          url,
          status: "posted",
          post_url: url,
          late_job_id: `late-${newId}`,
          platform,
        },
        scheduledPost: {
          id: newId,
          status: "posted",
          post_url: url,
          late_job_id: `late-${newId}`,
          platform,
        },
      },
    });
  });

  await page.route("**/api/schedule", async (route) => {
    if (route.request().method() === "GET") {
      await fulfillJson(route, {
        success: true,
        data: state.scheduledPosts,
      });
      return;
    }

    if (options.scheduleShouldFail) {
      await fulfillJson(
        route,
        { success: false, error: "Schedule failed in test" },
        500
      );
      return;
    }

    const body = route.request().postDataJSON() as {
      scheduledAt: string;
      posts: Array<{
        platform: string;
        text: string;
        connectedAccountId?: string;
        profileIds?: string[];
      }>;
    };

    const createdPosts: ScheduledPost[] = body.posts.flatMap((post, index) => {
      const accountId = post.connectedAccountId || post.profileIds?.[0] || accounts[0]?.id;
      const newScheduledPost: ScheduledPost = {
        id: `scheduled-${state.scheduledPosts.length + index + 1}`,
        platform: post.platform,
        scheduled_at: body.scheduledAt,
        late_job_id: `late-job-${state.scheduledPosts.length + index + 1}`,
        status: "scheduled",
        post_url: null,
        payload: {
          text: post.text,
          text_content: post.text,
          connected_account_id: accountId,
        },
      };
      state.scheduledPosts.push(newScheduledPost);
      return newScheduledPost;
    });

    await fulfillJson(route, {
      success: true,
      data: {
        scheduledPosts: createdPosts,
        errors: [],
        message: "Scheduled successfully",
      },
    });
  });

  return state;
}

export async function openAuthenticatedCreatePage(
  page: Page,
  options: CreateSectionMockOptions = {}
) {
  await seedAuthenticatedSession(page);
  const state = await installCreateSectionMocks(page, options);
  await page.goto("/en/create", { waitUntil: "domcontentloaded" });
  return state;
}

export async function readStorageJson<T>(page: Page, key: string): Promise<T | null> {
  return page.evaluate((storageKey) => {
    const value = window.localStorage.getItem(storageKey);
    return value ? JSON.parse(value) : null;
  }, key);
}
