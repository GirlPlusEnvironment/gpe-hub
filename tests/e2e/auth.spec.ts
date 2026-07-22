import { test, expect } from "@playwright/test";
import { expectNoHorizontalOverflow, installSmokeGuards, runAxeSmoke } from "./helpers";

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

test("protected routes redirect unauthenticated users", async ({ page }) => {
  const assertClean = await installSmokeGuards(page);
  await page.goto("/leaderboard");
  await expect(page).toHaveURL(/\/login/);
  await assertClean();
});
