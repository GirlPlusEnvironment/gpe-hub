import { test, expect } from "@playwright/test";
import { expectNoHorizontalOverflow, installSmokeGuards } from "./helpers";

const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

for (const viewport of viewports) {
  test(`public auth screens do not overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const assertClean = await installSmokeGuards(page);
    await page.setViewportSize(viewport);
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goto("/reset-password");
    await expect(page.getByText(/account recovery/i)).toBeVisible();
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await assertClean();
  });
}
