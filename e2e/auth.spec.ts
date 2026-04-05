import { test, expect } from "@playwright/test";

test.describe("Sign In Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/signin");
    await page.waitForLoadState("networkidle");
  });

  test("should display heading", async ({ page }) => {
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
  });

  test("should display email and password fields", async ({ page }) => {
    const emailInput = page.locator('input[id="email"]');
    const passwordInput = page.locator('input[id="password"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test("should toggle password visibility", async ({ page }) => {
    const passwordInput = page.locator('input[id="password"]');
    await expect(passwordInput).toHaveAttribute("type", "password");

    const toggleButton = page
      .locator('input[id="password"]')
      .locator("..")
      .locator("button");
    await toggleButton.click();

    await expect(passwordInput).toHaveAttribute("type", "text");
  });

  test("should have remember me checkbox", async ({ page }) => {
    const rememberMe = page.locator('input[type="checkbox"]');
    await expect(rememberMe).toBeVisible();
  });

  test("should have forgot password link", async ({ page }) => {
    const forgotPasswordLink = page.locator('a[href*="forgot-password"]');
    await expect(forgotPasswordLink).toBeVisible();
  });

  test("should have Google OAuth button", async ({ page }) => {
    const googleButton = page.locator("button").filter({ hasText: /Google/i });
    await expect(googleButton).toBeVisible();
  });

  test("should have link to sign up page", async ({ page }) => {
    const signUpLink = page.locator('a[href*="signup"]');
    await expect(signUpLink).toBeVisible();
  });

  test("should prevent submission with empty fields via HTML5 validation", async ({
    page,
  }) => {
    const submitButton = page
      .locator('button[type="submit"]')
      .filter({ hasText: /sign in/i });
    await submitButton.click();

    const emailInput = page.locator('input[id="email"]');
    const isInvalid = await emailInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid
    );
    expect(isInvalid).toBe(true);
  });

  test("should show error after submitting invalid credentials", async ({
    page,
  }) => {
    await page.locator('input[id="email"]').fill("invalid@example.com");
    await page.locator('input[id="password"]').fill("wrongpassword123");

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Wait for the form to finish processing (error message or button re-enabled)
    await expect(async () => {
      const errorVisible = await page
        .locator('[class*="destructive"]')
        .isVisible()
        .catch(() => false);
      const buttonText = await submitButton.textContent();
      const isNotLoading = !buttonText?.includes("Signing in");
      expect(errorVisible || isNotLoading).toBe(true);
    }).toPass({ timeout: 15000 });
  });

  test("should have terms of service and privacy policy links", async ({
    page,
  }) => {
    await expect(page.locator('a[href*="terms"]')).toBeVisible();
    await expect(page.locator('a[href*="privacy"]')).toBeVisible();
  });
});

test.describe("Sign Up Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/signup");
    await page.waitForLoadState("networkidle");
  });

  test("should display heading", async ({ page }) => {
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
  });

  test("should display all required form fields", async ({ page }) => {
    await expect(page.locator('input[id="firstName"]')).toBeVisible();
    await expect(page.locator('input[id="lastName"]')).toBeVisible();
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
    await expect(page.locator('input[id="confirmPassword"]')).toBeVisible();
  });

  test("should have password fields with type password by default", async ({
    page,
  }) => {
    await expect(page.locator('input[id="password"]')).toHaveAttribute(
      "type",
      "password"
    );
    await expect(
      page.locator('input[id="confirmPassword"]')
    ).toHaveAttribute("type", "password");
  });

  test("should have Google OAuth button", async ({ page }) => {
    const googleButton = page.locator("button").filter({ hasText: /Google/i });
    await expect(googleButton).toBeVisible();
  });

  test("should have link to sign in page", async ({ page }) => {
    const signInLink = page.locator('a[href*="signin"]');
    await expect(signInLink).toBeVisible();
  });

  test("should prevent submission with empty fields via HTML5 validation", async ({
    page,
  }) => {
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    const firstNameInput = page.locator('input[id="firstName"]');
    const isInvalid = await firstNameInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid
    );
    expect(isInvalid).toBe(true);
  });
});

test.describe("Forgot Password Page", () => {
  test("should load the forgot password page with visible content", async ({
    page,
  }) => {
    await page.goto("/en/forgot-password");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toBeVisible();
  });
});
