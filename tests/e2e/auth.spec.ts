import { test, expect } from "@playwright/test";
import { configuredSupabaseUrl, expectNoHorizontalOverflow, installSmokeGuards, runAxeSmoke } from "./helpers";

test("login page renders and validates empty input", async ({ page }, testInfo) => {
  const assertClean = await installSmokeGuards(page);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log In" }).last()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await runAxeSmoke(page, testInfo);
  await assertClean();
});

test("password reset page renders", async ({ page }, testInfo) => {
  const assertClean = await installSmokeGuards(page);
  await page.goto("/reset-password");
  await expect(page.getByText(/account recovery/i)).toBeVisible();
  await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await runAxeSmoke(page, testInfo);
  await assertClean();
});

test("password reset page removes recovery tokens from the visible URL", async ({ page }) => {
  const assertClean = await installSmokeGuards(page);
  await page.goto("/reset-password#error=access_denied&error_description=expired&access_token=secret&type=recovery");
  await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page).not.toHaveURL(/access_token|type=recovery|error_description/);
  await assertClean();
});

test("root recovery links open the reset password flow instead of login", async ({ page }) => {
  const assertClean = await installSmokeGuards(page);
  await page.goto("/#error=access_denied&error_description=expired&access_token=secret&type=recovery");
  await expect(page.getByText(/account recovery/i)).toBeVisible();
  await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page).not.toHaveURL(/\/login/);
  await assertClean();
});

test("reset mode sends a generic activation request through Supabase functions", async ({ page }) => {
  const assertClean = await installSmokeGuards(page);
  const activationRequests: string[] = [];

  await page.route("**/auth/v1/user", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "No session" }) });
  });

  await page.route("**/functions/v1/hub-account-activation", async (route) => {
    activationRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requestAccepted: true,
        message: "If that email belongs to an active GPE member, we’ll send secure Hub access instructions.",
      }),
    });
  });

  await page.goto("/login?mode=reset");
  await page.getByLabel("Email").fill("member@example.com");
  await page.getByRole("button", { name: "Send Reset Link" }).click();
  await expect(page.getByRole("status")).toContainText("If that email belongs to an active GPE member");

  expect(activationRequests).toHaveLength(1);
  const requestUrl = new URL(activationRequests[0]);
  expect(requestUrl.origin).toBe(configuredSupabaseUrl().origin);
  expect(requestUrl.pathname).toBe("/functions/v1/hub-account-activation");
  expect(requestUrl.origin).not.toBe(new URL(page.url()).origin);
  await assertClean();
});

test("protected routes redirect unauthenticated users", async ({ page }) => {
  const assertClean = await installSmokeGuards(page);
  await page.goto("/leaderboard");
  await expect(page).toHaveURL(/\/login/);
  await assertClean();
});
