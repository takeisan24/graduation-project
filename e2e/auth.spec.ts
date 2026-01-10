import { test, expect } from "@playwright/test";

test.describe("Sign In Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/signin");
  });

  test("should load the sign in page", async ({ page }) => {
    // Title/heading should be visible
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
  });

  test("should display email and password fields", async ({ page }) => {
    const emailInput = page.locator('input[id="email"]');
    const passwordInput = page.locator('input[id="password"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test("should have password visibility toggle", async ({ page }) => {
    const passwordInput = page.locator('input[id="password"]');
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Click the eye icon to toggle visibility
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
    // Google button with SVG icon
    const googleButton = page.locator("button").filter({ hasText: /Google/i });
    await expect(googleButton).toBeVisible();
  });

  test("should have link to sign up page", async ({ page }) => {
    const signUpLink = page.locator('a[href*="signup"]');
    await expect(signUpLink).toBeVisible();
  });

  test("should show validation on empty submit", async ({ page }) => {
    // Submit with empty fields - HTML5 validation should prevent submission
    const submitButton = page
      .locator('button[type="submit"]')
      .filter({ hasText: /sign in/i });
    await submitButton.click();

    // Email field should be invalid (HTML5 required)
    const emailInput = page.locator('input[id="email"]');
    const isInvalid = await emailInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid
    );
    expect(isInvalid).toBe(true);
  });

  test("should attempt login with invalid credentials", async ({ page }) => {
    const emailInput = page.locator('input[id="email"]');
    const passwordInput = page.locator('input[id="password"]');

    await emailInput.fill("invalid@example.com");
    await passwordInput.fill("wrongpassword123");

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Wait for API response - should show error or button returns to non-loading state
    await page.waitForTimeout(5000);

    // Either error message is shown or button is re-enabled (no longer "Signing in...")
    const errorMessage = page.locator('[class*="destructive"]');
    const hasError = await errorMessage.isVisible().catch(() => false);
    const buttonText = await submitButton.textContent();
    const isNotLoading = !buttonText?.includes("Signing in");

    // At least one should be true: error shown or form is interactive again
    expect(hasError || isNotLoading).toBe(true);
  });

  test("should have terms of service and privacy policy links", async ({
    page,
  }) => {
    const termsLink = page.locator('a[href*="terms"]');
    const privacyLink = page.locator('a[href*="privacy"]');

    await expect(termsLink).toBeVisible();
    await expect(privacyLink).toBeVisible();
  });
});

test.describe("Sign Up Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/signup");
  });

  test("should load the sign up page", async ({ page }) => {
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
  });

  test("should display all required form fields", async ({ page }) => {
    const firstName = page.locator('input[id="firstName"]');
    const lastName = page.locator('input[id="lastName"]');
    const email = page.locator('input[id="email"]');
    const password = page.locator('input[id="password"]');
    const confirmPassword = page.locator('input[id="confirmPassword"]');

    await expect(firstName).toBeVisible();
    await expect(lastName).toBeVisible();
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();
    await expect(confirmPassword).toBeVisible();
  });

  test("should have password and confirm password toggle", async ({
    page,
  }) => {
    const passwordInput = page.locator('input[id="password"]');
    const confirmPasswordInput = page.locator('input[id="confirmPassword"]');

    await expect(passwordInput).toHaveAttribute("type", "password");
    await expect(confirmPasswordInput).toHaveAttribute("type", "password");

    // Toggle password visibility
    const toggleButtons = page
      .locator(".relative")
      .filter({ has: page.locator('input[type="password"]') })
      .locator("button");
    const count = await toggleButtons.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("should have Google OAuth button", async ({ page }) => {
    const googleButton = page.locator("button").filter({ hasText: /Google/i });
    await expect(googleButton).toBeVisible();
  });

  test("should have link to sign in page", async ({ page }) => {
    const signInLink = page.locator('a[href*="signin"]');
    await expect(signInLink).toBeVisible();
  });

  test("should validate required fields on submit", async ({ page }) => {
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // HTML5 validation should prevent submission
    const firstNameInput = page.locator('input[id="firstName"]');
    const isInvalid = await firstNameInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid
    );
    expect(isInvalid).toBe(true);
  });

  test("should fill form and attempt signup", async ({ page }) => {
    await page.locator('input[id="firstName"]').fill("Test");
    await page.locator('input[id="lastName"]').fill("User");
    await page.locator('input[id="email"]').fill("test@example.com");
    await page.locator('input[id="password"]').fill("TestPassword123!");
    await page.locator('input[id="confirmPassword"]').fill("TestPassword123!");

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Wait for API response
    await page.waitForTimeout(5000);

    // Either success modal, error message, or button back to interactive
    const successModal = page.locator('[role="dialog"]');
    const errorMessage = page.locator('[class*="destructive"]');

    const hasSuccess = await successModal.isVisible().catch(() => false);
    const hasError = await errorMessage.isVisible().catch(() => false);
    const buttonText = await submitButton.textContent();
    const isNotLoading = !buttonText?.includes("Signing up");

    // Form submission should produce some result
    expect(hasSuccess || hasError || isNotLoading).toBe(true);
  });
});

test.describe("Forgot Password Page", () => {
  test("should load the forgot password page", async ({ page }) => {
    await page.goto("/en/forgot-password");
    await expect(page.locator("body")).toBeVisible();
  });
});
