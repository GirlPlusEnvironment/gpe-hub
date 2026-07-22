import { expect, test, type Page } from "@playwright/test";
import { configuredSupabaseUrl } from "./helpers";

const testUser = {
  id: "00000000-0000-0000-0000-000000000030",
  aud: "authenticated",
  role: "authenticated",
  email: "member@example.com",
  app_metadata: {},
  user_metadata: { full_name: "Test Member", avatar_url: "" },
  identities: [],
  created_at: "2026-07-22T00:00:00.000Z",
  updated_at: "2026-07-22T00:00:00.000Z",
};

const testProfile = {
  id: testUser.id,
  email: testUser.email,
  username: "test-member",
  full_name: "Test Member",
  first_name: "Test",
  last_name: "Member",
  avatar_url: null,
  bio: null,
  neon_account_id: "neon-123",
  member_status: "active",
  points: 0,
  created_at: "2026-07-22T00:00:00.000Z",
  updated_at: "2026-07-22T00:00:00.000Z",
};

const expectedSupabaseUrl = configuredSupabaseUrl;

function membershipResponse(overrides: Record<string, unknown>) {
  return {
    matched: false,
    isActiveMember: false,
    neonAccountId: null,
    membershipStatus: null,
    membershipLevel: null,
    membershipStartAt: null,
    membershipEndAt: null,
    hubAccess: "membership_required",
    outcome: "nonmember",
    publicState: "new_person",
    hubUserLinked: false,
    requiresManualReview: false,
    ...overrides,
  };
}

async function installBaseRoutes(page: Page, membership: Record<string, unknown> | "error") {
  const membershipRequests: string[] = [];
  const requestOrder: string[] = [];
  (page as Page & { membershipRequests?: string[] }).membershipRequests = membershipRequests;
  (page as Page & { requestOrder?: string[] }).requestOrder = requestOrder;

  await page.route("**/auth/v1/user", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "No session" }) });
  });

  await page.route("**/auth/v1/logout**", async (route) => {
    requestOrder.push("logout");
    await route.fulfill({ status: 204, contentType: "application/json", body: "" });
  });

  await page.route("**/functions/v1/neon-membership-check", async (route) => {
    requestOrder.push("membership");
    membershipRequests.push(route.request().url());
    if (membership === "error") {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Neon unavailable" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(membership) });
  });

  await page.route("**/auth/v1/token?grant_type=password", async (route) => {
    requestOrder.push("password");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: testUser,
      }),
    });
  });

  await page.route("**/rest/v1/profiles?**", async (route) => {
    requestOrder.push("profile");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(testProfile) });
  });

  await page.route("**/rest/v1/rpc/is_admin", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "false" });
  });

  await page.route("**/rest/v1/rpc/can_manage_camp", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "false" });
  });

  await page.route("**/rest/v1/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

async function submitLogin(page: Page, email = "member@example.com") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log In" }).last().click();
}

test("active member with Hub account enters the Hub", async ({ page }) => {
  await installBaseRoutes(page, membershipResponse({
    matched: true,
    isActiveMember: true,
    neonAccountId: "neon-123",
    membershipStatus: "Active",
    membershipLevel: "Member",
    hubAccess: "allowed",
    outcome: "active_member_existing_hub_user",
    publicState: "hub_user_active_member",
    hubUserLinked: true,
  }));

  await submitLogin(page);
  await expect(page).toHaveURL(/\/$/);
  const requestOrder = (page as Page & { requestOrder?: string[] }).requestOrder || [];
  expect(requestOrder.indexOf("password")).toBeGreaterThanOrEqual(0);
  expect(requestOrder.indexOf("membership")).toBeGreaterThan(requestOrder.indexOf("password"));
});

test("legacy active member with null cached status syncs profile before entering the Hub", async ({ page }) => {
  let profileRequestCount = 0;
  await installBaseRoutes(page, membershipResponse({
    authenticatedUserLinked: true,
    matched: true,
    isActiveMember: true,
    neonAccountId: "neon-legacy",
    membershipStatus: "Active",
    membershipLevel: "Member",
    membershipStartAt: "2026-01-01",
    membershipEndAt: "2026-12-31",
    hubAccess: "allowed",
    outcome: "active_member_existing_hub_user",
    publicState: "hub_user_active_member",
    hubUserLinked: true,
  }));

  await page.route("**/rest/v1/profiles?**", async (route) => {
    profileRequestCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...testProfile,
        neon_account_id: profileRequestCount > 1 ? "neon-legacy" : null,
        member_status: profileRequestCount > 1 ? "active" : null,
        membership_level: profileRequestCount > 1 ? "Member" : null,
        membership_start_date: profileRequestCount > 1 ? "2026-01-01" : null,
        membership_end_date: profileRequestCount > 1 ? "2026-12-31" : null,
        membership_last_synced_at: profileRequestCount > 1 ? "2026-07-22T17:00:00.000Z" : null,
        membership_access_state: profileRequestCount > 1 ? "active" : null,
      }),
    });
  });

  await submitLogin(page, "legacy@example.com");
  await expect(page).toHaveURL(/\/$/);
  expect(profileRequestCount).toBeGreaterThan(1);
});

test("login invokes the deployed Supabase Edge Function path", async ({ page }) => {
  await installBaseRoutes(page, membershipResponse({
    matched: false,
    outcome: "nonmember",
    publicState: "new_person",
  }));

  await submitLogin(page, "path-check@example.com");
  await expect(page.getByRole("heading", { name: "GPE Hub access is a member benefit." })).toBeVisible();
  const requests = (page as Page & { membershipRequests?: string[] }).membershipRequests || [];
  expect(requests).toHaveLength(1);
  const requestUrl = new URL(requests[0]);
  const supabaseUrl = expectedSupabaseUrl();
  expect(requestUrl.hostname).toBe(supabaseUrl.hostname);
  expect(requestUrl.port).toBe(supabaseUrl.port);
  expect(requestUrl.pathname).toBe("/functions/v1/neon-membership-check");
  expect(requestUrl.pathname).not.toBe("/api/neon-membership-check");
  expect(requestUrl.pathname).not.toBe("/functions/neon-membership-check");
  expect(requestUrl.origin).not.toBe(new URL(page.url()).origin);
});

test("failed password login offers safe Hub activation without app-origin function calls", async ({ page }) => {
  const activationRequests: string[] = [];

  await page.route("**/auth/v1/user", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "No session" }) });
  });

  await page.route("**/auth/v1/token?grant_type=password", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "invalid_grant", error_description: "Invalid login credentials" }),
    });
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

  await submitLogin(page, "activate@example.com");
  await expect(page.getByRole("alert")).toContainText("Activate or reset Hub access");
  await expect(page.getByRole("alert")).not.toContainText("Invalid login credentials");

  await page.getByRole("button", { name: /activate or reset hub access/i }).click();
  await expect(page.getByRole("status")).toContainText("If that email belongs to an active GPE member");

  expect(activationRequests).toHaveLength(1);
  const requestUrl = new URL(activationRequests[0]);
  const supabaseUrl = expectedSupabaseUrl();
  expect(requestUrl.origin).toBe(supabaseUrl.origin);
  expect(requestUrl.pathname).toBe("/functions/v1/hub-account-activation");
  expect(requestUrl.origin).not.toBe(new URL(page.url()).origin);
});

test("active member without Hub account sees activation workflow", async ({ page }) => {
  await installBaseRoutes(page, membershipResponse({
    matched: true,
    isActiveMember: true,
    neonAccountId: "neon-activation",
    membershipStatus: "Active",
    membershipLevel: "Member",
    hubAccess: "invite_required",
    outcome: "active_member_needs_hub_invite",
    publicState: "neon_member_needs_hub_activation",
    hubUserLinked: false,
  }));

  await submitLogin(page, "activation@example.com");
  await expect(page.getByRole("heading", { name: "You’re already a GPE member." })).toBeVisible();
  await expect(page.getByRole("button", { name: /activate hub/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /resend invitation/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /use another email/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /contact support/i })).toBeVisible();
});

test("contact-only record renders embedded membership fallback", async ({ page }) => {
  await installBaseRoutes(page, membershipResponse({
    matched: true,
    neonAccountId: "neon-contact",
    membershipStatus: null,
    hubAccess: "membership_required",
    outcome: "nonmember",
    publicState: "existing_constituent_no_membership",
  }));

  await submitLogin(page, "contact@example.com");
  await expect(page.getByRole("heading", { name: "GPE Hub access is a member benefit." })).toBeVisible();
  await expect(page.getByText("Campaign actions", { exact: true })).toBeVisible();
  const cta = page.getByRole("link", { name: /become a member/i });
  await expect(cta).toHaveAttribute("target", "_blank");
  await expect(cta).toHaveAttribute("rel", /noopener/);
  await expect(cta).toHaveAttribute("href", /return_to=/);
});

test("no Neon account renders the same membership experience", async ({ page }) => {
  await installBaseRoutes(page, membershipResponse({
    matched: false,
    outcome: "nonmember",
    publicState: "new_person",
  }));

  await submitLogin(page, "new-person@example.com");
  await expect(page.getByRole("heading", { name: "GPE Hub access is a member benefit." })).toBeVisible();
  await expect(page.getByRole("link", { name: /become a member/i })).toBeVisible();
});

test("expired member sees renewal workflow", async ({ page }) => {
  await installBaseRoutes(page, membershipResponse({
    matched: true,
    neonAccountId: "neon-expired",
    membershipStatus: "Expired",
    membershipLevel: "Member",
    membershipEndAt: "2026-01-15T00:00:00.000Z",
    outcome: "inactive_or_expired_member",
    publicState: "expired_member",
  }));

  await submitLogin(page, "expired@example.com");
  await expect(page.getByRole("heading", { name: "Your membership has expired." })).toBeVisible();
  await expect(page.getByText("Renew in Neon")).toBeVisible();
  await expect(page.getByRole("link", { name: /renew membership/i })).toBeVisible();
});

test("Neon service unavailable renders retry state", async ({ page }) => {
  await installBaseRoutes(page, "error");

  await submitLogin(page, "service-error@example.com");
  await expect(page.getByRole("heading", { name: "We could not confirm your membership right now." })).toBeVisible();
  await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();
});
