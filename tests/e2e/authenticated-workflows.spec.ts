import { test } from "@playwright/test";

test.describe("authenticated smoke workflows", () => {
  test.skip("dashboard, leaderboard, messages, submit, listing detail, and admin flows require seeded auth storage state", async () => {
    // Intentionally skipped until CI has a non-production Supabase test project or mocked auth storage state.
    // Do not use production member credentials for this suite.
  });
});
