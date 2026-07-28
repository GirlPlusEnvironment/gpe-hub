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

const campSeason = {
  id: "season-2026",
  slug: "camp-gpe-2026",
  name: "Camp GPE Summer",
  description: "Summer advocacy season.",
  starts_at: "2026-07-06T05:00:00.000Z",
  ends_at: "2026-08-29T04:59:59.000Z",
  status: "active",
  is_visible: true,
  point_rules: null,
  metadata: {},
};

const adminChallenges = [
  {
    id: "challenge-1",
    season_id: campSeason.id,
    action_type_id: null,
    slug: "create-a-short-video",
    title: "Create a Short Video",
    short_description: "Share a climate story.",
    instructions: "Post a short video and submit the link.",
    category: "create_content",
    point_value: 5,
    starts_at: "2026-07-20T05:00:00.000Z",
    ends_at: "2026-08-01T04:59:59.000Z",
    is_active: true,
    is_public: true,
    is_hub_visible: true,
    requires_proof: true,
    requires_review: true,
    auto_approve: false,
    allow_multiple_submissions: false,
    max_completions_per_member: 1,
    display_order: 10,
    action_url: null,
    related_url: null,
    week_number: 3,
    theme: "Tell your story.",
    icon: "🎥",
    cta_label: "Submit Video",
    submission_type: "video_link",
    verification_method: "team_review",
    badge_eligible: true,
    why_it_matters: "Stories move people.",
    related_kind: null,
    is_featured: true,
    metadata: {
      definition: {
        submission: {
          enabled: true,
          title: "Submit Your Challenge",
          fields: [{ id: "video_url", type: "video_url", label: "Video URL", required: true }],
        },
      },
    },
  },
  {
    id: "challenge-2",
    season_id: campSeason.id,
    action_type_id: null,
    slug: "draft-reflection",
    title: "Draft Reflection",
    short_description: "Upcoming reflection.",
    instructions: "Write a reflection.",
    category: "share_story",
    point_value: 5,
    starts_at: "2026-08-17T05:00:00.000Z",
    ends_at: "2026-08-29T04:59:59.000Z",
    is_active: false,
    is_public: true,
    is_hub_visible: false,
    requires_proof: false,
    requires_review: true,
    auto_approve: false,
    allow_multiple_submissions: false,
    max_completions_per_member: 1,
    display_order: 20,
    action_url: null,
    related_url: null,
    week_number: 7,
    theme: "Finish strong.",
    icon: "✍️",
    cta_label: "Submit Reflection",
    submission_type: "reflection",
    verification_method: "team_review",
    badge_eligible: false,
    why_it_matters: "Reflection builds leadership.",
    related_kind: null,
    is_featured: false,
    metadata: {},
  },
];

const adminSubmissions = [
  {
    id: "submission-1",
    season_id: campSeason.id,
    season_member_id: "season-member-1",
    user_id: testUser.id,
    neon_account_id: "neon-1",
    contact_email: "jordan@example.com",
    challenge_key: "multi_action",
    submitted_payload: {
      fields: {
        firstName: "Jordan",
        lastName: "Rivera",
        sourcePage: "dynamic_challenge_submission",
        submissionData: {
          video_url: "https://example.com/video",
        },
      },
    },
    proof_links: ["https://example.com/video"],
    review_status: "pending",
    member_link_status: "linked",
    created_at: "2026-07-24T15:00:00.000Z",
    gpe_camp_submission_actions: [
      {
        id: "action-1",
        submission_id: "submission-1",
        challenge_id: "challenge-1",
        action_type_id: null,
        other_description: null,
        proof_urls: ["https://example.com/video"],
        requested_points: 5,
        approved_points: null,
        review_status: "pending",
        reviewer_notes: null,
        gpe_challenges: {
          id: "challenge-1",
          title: "Create a Short Video",
          slug: "create-a-short-video",
          point_value: 5,
          requires_proof: true,
          requires_review: true,
          auto_approve: false,
          category: "create_content",
        },
      },
    ],
  },
];

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

  await page.route("**/rest/v1/posts?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/rest/v1/post_comments?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/rest/v1/listing_flags?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/rest/v1/moderation_audit_log?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/rest/v1/conversation_participants?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/rest/v1/gpe_seasons?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(campSeason) });
  });

  await page.route("**/rest/v1/gpe_camp_challenge_submissions?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(adminSubmissions) });
  });

  await page.route("**/rest/v1/gpe_challenges?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(adminChallenges) });
  });

  await page.route("**/rest/v1/hub_point_rules?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          action_type: "manual_admin_award",
          display_name: "Manual adjustment",
          point_value: 10,
          active: true,
          counts_for_ongoing: true,
          counts_for_season: false,
          counts_for_cabin: false,
          requires_approval: false,
          duplicate_strategy: "allow",
        },
      ]),
    });
  });

  await page.route("**/rest/v1/gpe_camp_cabin_leaderboard?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          season_id: campSeason.id,
          cabin_id: "cabin-1",
          cabin_name: "Cedar Cabin",
          points: 82,
          member_count: 4,
          rank: 1,
          updated_at: "2026-07-24T16:00:00.000Z",
        },
      ]),
    });
  });

  await page.route("**/rest/v1/rpc/admin_search_point_members", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          profile_id: "member-active-1",
          season_member_id: "season-member-active-1",
          full_name: "Jordan Rivera",
          first_name: "Jordan",
          last_name: "Rivera",
          email: "jordan@example.com",
          membership_status: "active",
          neon_account_id: "neon-1",
          ongoing_points: 21,
          seasonal_points: 16,
          cabin_points: 9,
          cabin_id: "cabin-1",
          cabin_name: "Cedar Cabin",
          season_id: campSeason.id,
          result_rank: 1,
        },
        {
          profile_id: "member-test-verify",
          season_member_id: "season-member-test-verify",
          full_name: "Verification Account",
          first_name: "Verification",
          last_name: "Account",
          email: "codex-registration-verify-20260721-2@example.com",
          membership_status: "expired",
          neon_account_id: "verify-20260721-2",
          ongoing_points: 999,
          seasonal_points: 999,
          cabin_points: 999,
          cabin_id: "cabin-1",
          cabin_name: "Cedar Cabin",
          season_id: campSeason.id,
          result_rank: 99,
        },
      ]),
    });
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

test("Team Review sidebar opens URL-backed Camp Admin workspace tabs", async ({ page }) => {
  await installAdminSupabaseStubs(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin");
  await page.getByTestId("sidebar-navigation").getByRole("link", { name: "Team Review" }).click();

  await expect(page.getByRole("heading", { name: "Camp Admin" })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/camp/);
  for (const tab of ["Overview", "Challenge Management", "Schedule", "Submission Review", "Moderation", "Cabins", "Rewards & Points", "Settings"]) {
    await expect(page.getByRole("tab", { name: tab })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Camp GPE Summer" })).toBeVisible();

  await page.getByRole("tab", { name: "Challenge Management" }).click();
  await expect(page).toHaveURL(/tab=challenges/);
  await expect(page.getByRole("heading", { name: "Challenges" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Create a Short Video/ })).toBeVisible();
  for (const editorTab of ["Overview", "Content", "Schedule", "Rewards", "Submission", "Resources", "Notifications", "History"]) {
    await expect(page.getByRole("tab", { name: editorTab }).last()).toBeVisible();
  }
  await expect(page.getByLabel("Challenge title")).toHaveValue("Create a Short Video");
  await expect(page.getByLabel("Internal admin name")).toBeVisible();
  await expect(page.getByLabel("Slug")).toHaveValue("create-a-short-video");
  await page.getByRole("tab", { name: "Submission" }).last().click();
  await expect(page.getByRole("heading", { name: "Field Builder" })).toBeVisible();
  await expect(page.getByLabel("Field ID")).toHaveValue("video_url");
  await expect(page.getByLabel("Label").first()).toHaveValue("Video URL");
  await page.getByRole("tab", { name: "Notifications" }).last().click();
  await expect(page.getByLabel("Approval message")).toBeVisible();
  await page.getByRole("tab", { name: "History" }).last().click();
  await expect(page.getByRole("heading", { name: "Version History" })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const tabPosition = await page.getByRole("tab", { name: "Challenge Management" }).evaluate((node) => window.getComputedStyle(node.parentElement?.parentElement || node).position);
  expect(tabPosition).toBe("sticky");
  await page.reload();
  await expect(page.getByRole("tab", { name: "Challenge Management" })).toHaveAttribute("data-state", "active");

  await page.getByRole("tab", { name: "Schedule", exact: true }).first().click();
  await expect(page).toHaveURL(/tab=schedule/);
  await expect(page.getByRole("tab", { name: "Timeline view" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Calendar view" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "List view" })).toBeVisible();
  await expect(page.getByRole("button", { name: "draft", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Draft Reflection/ })).toBeVisible();

  await page.getByRole("tab", { name: "Submission Review" }).click();
  await expect(page).toHaveURL(/tab=submissions/);
  await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();
  for (const statusTab of [/Pending \d+/, /Approved \d+/, /Rejected \d+/, /Needs Changes \d+/, /Duplicate \d+/]) {
    await expect(page.getByRole("tab", { name: statusTab })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /Jordan Rivera/ })).toBeVisible();
  await expect(page.getByText("Video URL")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeVisible();

  const nativeDialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    nativeDialogs.push(dialog.type());
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: /Approve and Edit Points/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Suggested points")).toHaveValue("5");
  expect(nativeDialogs).toEqual([]);
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("tab", { name: "Moderation" }).click();
  for (const tab of [/Reports 0/, /Listings 0/, /Posts 0/, /Comments 0/]) {
    await expect(page.getByRole("tab", { name: tab })).toBeVisible();
  }

  await page.getByRole("tab", { name: "Cabins" }).click();
  await expect(page.getByRole("heading", { name: "Cabin Management" })).toBeVisible();
  await expect(page.getByText("Cedar Cabin")).toBeVisible();
  await expect(page.getByText("Guarded from rankings: codex-registration-verify-20260721-2@example.com")).toBeVisible();
  await page.getByRole("button", { name: "Create cabin and chat" }).click();
  await expect(page.getByText("Conversation connected")).toBeVisible();

  await page.getByRole("tab", { name: "Rewards & Points" }).click();
  await expect(page.getByRole("heading", { name: "Point Rules and Ledger" })).toBeVisible();
  for (const tab of ["Point Rules", "Point Ledger", "Manual Adjustments", "Badges", "Achievements"]) {
    await expect(page.getByRole("tab", { name: tab })).toBeVisible();
  }

  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Global Camp Settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Draft" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish Changes" })).toBeVisible();
});
