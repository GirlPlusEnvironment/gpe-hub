import { test, expect, type Page } from "@playwright/test";
import { expectNoHorizontalOverflow, supabaseAuthStorageKey } from "./helpers";

const testUser = {
  id: "00000000-0000-0000-0000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "admin@example.com",
  email_confirmed_at: "2026-07-22T00:00:00.000Z",
  phone: "",
  confirmed_at: "2026-07-22T00:00:00.000Z",
  last_sign_in_at: "2026-07-22T00:00:00.000Z",
  app_metadata: {},
  user_metadata: {
    full_name: "Admin Member With A Long Display Name",
    avatar_url: "",
  },
  identities: [],
  created_at: "2026-07-22T00:00:00.000Z",
  updated_at: "2026-07-22T00:00:00.000Z",
};

const testProfile = {
  id: testUser.id,
  email: testUser.email,
  username: "admin-member-with-a-long-handle",
  full_name: testUser.user_metadata.full_name,
  first_name: "Admin",
  last_name: "Member",
  avatar_url: null,
  bio: null,
  neon_account_id: null,
  member_status: "active",
  points: 1250,
  created_at: "2026-07-22T00:00:00.000Z",
  updated_at: "2026-07-22T00:00:00.000Z",
};

async function installAdminSupabaseStubs(page: Page) {
  await page.addInitScript(({ user, storageKey }) => {
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: expiresAt,
        user,
      }),
    );
  }, { user: testUser, storageKey: supabaseAuthStorageKey() });

  await page.route("**/auth/v1/user", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(testUser) });
  });

  await page.route("**/rest/v1/rpc/is_admin", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "true" });
  });

  await page.route("**/rest/v1/rpc/can_manage_camp", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "true" });
  });

  await page.route("**/rest/v1/profiles?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(testProfile),
    });
  });

  await page.route("**/rest/v1/listings?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/rest/v1/listing_flags?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/rest/v1/conversation_participants?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

async function expectAdminSidebarLayout(page: Page) {
  const sidebar = page.getByTestId("authenticated-sidebar");
  const branding = page.getByTestId("sidebar-branding");
  const navigation = page.getByTestId("sidebar-navigation");
  const accountControls = page.getByTestId("sidebar-account-controls");
  const logout = accountControls.getByRole("button", { name: /log out/i });

  await expect(sidebar).toBeVisible();
  await expect(branding).toBeVisible();
  await expect(logout).toBeVisible();

  await navigation.getByRole("link", { name: "Admin" }).scrollIntoViewIfNeeded();
  await expect(navigation.getByRole("link", { name: "Admin" })).toBeVisible();
  await navigation.getByRole("link", { name: "Team Review" }).scrollIntoViewIfNeeded();
  await expect(navigation.getByRole("link", { name: "Team Review" })).toBeVisible();

  const layout = await page.evaluate(() => {
    const sidebar = document.querySelector<HTMLElement>('[data-testid="authenticated-sidebar"]');
    const navigation = document.querySelector<HTMLElement>('[data-testid="sidebar-navigation"]');
    const accountControls = document.querySelector<HTMLElement>('[data-testid="sidebar-account-controls"]');
    if (!sidebar || !navigation || !accountControls) {
      throw new Error("Sidebar test hooks were not rendered.");
    }

    const sidebarRect = sidebar.getBoundingClientRect();
    const navigationStyle = window.getComputedStyle(navigation);
    const accountControlsRect = accountControls.getBoundingClientRect();

    return {
      viewportHeight: window.innerHeight,
      sidebarTop: sidebarRect.top,
      sidebarBottom: sidebarRect.bottom,
      sidebarHeight: sidebarRect.height,
      navigationMinHeight: navigationStyle.minHeight,
      navigationFlexGrow: navigationStyle.flexGrow,
      navigationOverflowY: navigationStyle.overflowY,
      navigationCanScroll: navigation.scrollHeight >= navigation.clientHeight,
      accountBottom: accountControlsRect.bottom,
    };
  });

  expect(layout.sidebarTop).toBeGreaterThanOrEqual(0);
  expect(layout.sidebarHeight).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.sidebarBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.navigationMinHeight).toBe("0px");
  expect(layout.navigationFlexGrow).toBe("1");
  expect(layout.navigationOverflowY).toMatch(/auto|scroll/);
  expect(layout.navigationCanScroll).toBe(true);
  expect(layout.accountBottom).toBeLessThanOrEqual(layout.viewportHeight);
  await expectNoHorizontalOverflow(page);
}

test("admin sidebar remains viewport-bound with pinned account controls", async ({ page }) => {
  await installAdminSupabaseStubs(page);

  await page.setViewportSize({ width: 1440, height: 768 });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin Hub" })).toBeVisible();
  await expectAdminSidebarLayout(page);

  await page.setViewportSize({ width: 1152, height: 614 });
  await expectAdminSidebarLayout(page);
});
