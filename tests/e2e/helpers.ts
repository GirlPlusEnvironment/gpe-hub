import { expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const allowedConsolePatterns = [
  /Failed to load resource/i,
  /Invalid API key/i,
  /AuthApiError/i,
  /supabase/i,
];

export async function installSmokeGuards(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("gpe-test-mode", "true");
  });

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (!allowedConsolePatterns.some((pattern) => pattern.test(text))) {
        consoleErrors.push(text);
      }
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    if (url.startsWith(page.url().split("/").slice(0, 3).join("/"))) {
      failedRequests.push(`${request.method()} ${url}`);
    }
  });

  return async () => {
    expect(pageErrors, "unexpected page errors").toEqual([]);
    expect(consoleErrors, "unexpected console errors").toEqual([]);
    expect(failedRequests, "failed same-origin requests").toEqual([]);
  };
}

export async function expectNoHorizontalOverflow(page: Page) {
  const hasHorizontalOverflow = await page.evaluate(() => (
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  ));
  expect(hasHorizontalOverflow).toBe(false);
}

export async function runAxeSmoke(page: Page, testInfo: TestInfo) {
  const results = await new AxeBuilder({ page })
    .disableRules(["color-contrast"])
    .analyze();

  await testInfo.attach("axe-results", {
    body: JSON.stringify(results.violations, null, 2),
    contentType: "application/json",
  });

  const serious = results.violations.filter((violation) => (
    violation.impact === "critical" || violation.impact === "serious"
  ));
  expect(serious).toEqual([]);
}
