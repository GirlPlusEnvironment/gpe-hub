import { test, expect } from "@playwright/test";
import { installSmokeGuards } from "./helpers";

const protectedRoutes = [
  "/",
  "/explore",
  "/community",
  "/messages",
  "/submit",
  "/submit/job",
  "/profile",
  "/favorites",
  "/submissions",
  "/leaderboard",
  "/camp-gpe/challenges",
  "/admin",
  "/admin/camp",
];

for (const route of protectedRoutes) {
  test(`${route} redirects without auth`, async ({ page }) => {
    const assertClean = await installSmokeGuards(page);
    await page.goto(route);
    await expect(page).toHaveURL(/\/login/);
    await assertClean();
  });
}
