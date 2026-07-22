import { expect, test, type Page } from "@playwright/test";
import { supabaseAuthStorageKey } from "./helpers";

const testUser = {
  id: "00000000-0000-0000-0000-000000000020",
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
  member_status: "active",
};

const season = {
  id: "season-2026",
  slug: "camp-gpe-2026",
  name: "Camp GPE 2026",
  description: "Summer advocacy season.",
  starts_at: "2026-07-06T05:00:00.000Z",
  ends_at: "2026-08-29T04:59:59.000Z",
  status: "active",
  is_visible: true,
  point_rules: null,
};

function challenge(overrides: Record<string, unknown>) {
  return {
    id: overrides.id,
    season_id: season.id,
    action_type_id: null,
    slug: overrides.slug,
    title: overrides.title,
    short_description: overrides.short_description,
    instructions: overrides.instructions || "Complete the action and submit proof for Team GPE review.",
    category: overrides.category,
    point_value: overrides.point_value,
    starts_at: overrides.starts_at,
    ends_at: overrides.ends_at,
    is_active: true,
    is_public: true,
    is_hub_visible: true,
    requires_proof: Boolean(overrides.requires_proof),
    requires_review: true,
    auto_approve: false,
    allow_multiple_submissions: false,
    max_completions_per_member: 1,
    display_order: overrides.display_order,
    action_url: overrides.action_url || null,
    week_number: overrides.week_number,
    theme: overrides.theme,
    icon: overrides.icon || null,
    cta_label: overrides.cta_label || null,
    submission_type: overrides.submission_type || null,
    verification_method: overrides.verification_method || "team_review",
    badge_eligible: Boolean(overrides.badge_eligible),
    why_it_matters: overrides.why_it_matters || "This action helps members turn climate concern into community advocacy.",
    related_kind: overrides.related_kind || null,
    related_url: overrides.related_url || null,
    is_featured: Boolean(overrides.is_featured),
    action_type_slug: overrides.category,
    action_type_label: String(overrides.category).replaceAll("_", " "),
    season_slug: season.slug,
    season_name: season.name,
  };
}

const challenges = [
  challenge({
    id: "c1",
    slug: "beat-heat-extreme-weather-petition",
    title: "Sign the Extreme Weather Petition",
    short_description: "Ask leaders to protect our communities from dangerous heat.",
    category: "sign_petition",
    point_value: 1,
    starts_at: "2026-07-06T05:00:00.000Z",
    ends_at: "2026-07-18T04:59:59.000Z",
    display_order: 110,
    week_number: 1,
    theme: "Hot Girl Summer starts with protecting our communities.",
    icon: "☀️",
    cta_label: "Open Petition",
    submission_type: "petition",
    related_kind: "petition",
    action_url: "girlplusenvironment.org/extreme-weather-action",
    is_featured: true,
    badge_eligible: true,
  }),
  challenge({
    id: "c2",
    slug: "beat-heat-story-sticker",
    title: "Complete the Camp GPE Story Sticker",
    short_description: "Use the Camp GPE sticker to invite your community.",
    category: "repost_gpe",
    point_value: 2,
    starts_at: "2026-07-06T05:00:00.000Z",
    ends_at: "2026-07-18T04:59:59.000Z",
    display_order: 120,
    week_number: 1,
    theme: "Hot Girl Summer starts with protecting our communities.",
    cta_label: "Open Submission Flow",
    submission_type: "social_link",
  }),
  challenge({
    id: "c3",
    slug: "beat-heat-short-video",
    title: "Create a Short Video",
    short_description: "Make a short video about extreme weather.",
    category: "create_content",
    point_value: 5,
    starts_at: "2026-07-06T05:00:00.000Z",
    ends_at: "2026-07-18T04:59:59.000Z",
    display_order: 130,
    week_number: 1,
    theme: "Hot Girl Summer starts with protecting our communities.",
    submission_type: "video_link",
  }),
  challenge({
    id: "c4",
    slug: "tell-your-story-climate-story",
    title: "Share Your Climate Story",
    short_description: "Tell people how climate shows up in your life.",
    category: "share_story",
    point_value: 5,
    starts_at: "2026-07-20T05:00:00.000Z",
    ends_at: "2026-08-01T04:59:59.000Z",
    display_order: 210,
    week_number: 3,
    theme: "Your story could be the reason someone takes action.",
    submission_type: "story_link",
    is_featured: true,
  }),
  challenge({
    id: "c5",
    slug: "tell-your-story-camp-graphics",
    title: "Post Using Camp GPE Graphics",
    short_description: "Use Camp GPE graphics to invite people in.",
    category: "repost_gpe",
    point_value: 2,
    starts_at: "2026-07-20T05:00:00.000Z",
    ends_at: "2026-08-01T04:59:59.000Z",
    display_order: 220,
    week_number: 3,
    theme: "Your story could be the reason someone takes action.",
    cta_label: "Open Toolkit",
    submission_type: "social_link",
    related_kind: "toolkit",
  }),
  challenge({
    id: "c6",
    slug: "tell-your-story-encourage-petition-signatures",
    title: "Encourage Signatures for the Petition",
    short_description: "Ask friends or followers to sign the petition.",
    category: "recruit_friend",
    point_value: 2,
    starts_at: "2026-07-20T05:00:00.000Z",
    ends_at: "2026-08-01T04:59:59.000Z",
    display_order: 230,
    week_number: 3,
    theme: "Your story could be the reason someone takes action.",
    submission_type: "social_link",
  }),
  challenge({
    id: "c7",
    slug: "sign-high-energy-bills-petition",
    title: "Sign the High Energy Bills Petition",
    short_description: "Tell Congress communities need relief from high energy bills.",
    category: "sign_petition",
    point_value: 1,
    starts_at: "2026-08-03T05:00:00.000Z",
    ends_at: "2026-08-15T04:59:59.000Z",
    display_order: 310,
    week_number: 5,
    theme: "Everyone deserves energy that keeps us safe, not stressed.",
    cta_label: "Open Petition",
    submission_type: "petition",
    related_kind: "petition",
    action_url: "https://www.girlplusenvironment.org/high-energy-bills-action",
    is_featured: true,
  }),
  challenge({
    id: "c8",
    slug: "energy-justice-utility-costs-video",
    title: "Create a Video About Utility Costs",
    short_description: "Explain how high energy bills affect your community.",
    category: "create_content",
    point_value: 5,
    starts_at: "2026-08-03T05:00:00.000Z",
    ends_at: "2026-08-15T04:59:59.000Z",
    display_order: 320,
    week_number: 5,
    theme: "Everyone deserves energy that keeps us safe, not stressed.",
    submission_type: "video_link",
  }),
  challenge({
    id: "c9",
    slug: "energy-justice-share-energy-bill-fact",
    title: "Share a Fact About Energy Bills",
    short_description: "Post or submit a fact about energy affordability.",
    category: "learn",
    point_value: 2,
    starts_at: "2026-08-03T05:00:00.000Z",
    ends_at: "2026-08-15T04:59:59.000Z",
    display_order: 330,
    week_number: 5,
    theme: "Everyone deserves energy that keeps us safe, not stressed.",
    submission_type: "social_link",
  }),
  challenge({
    id: "c10",
    slug: "finish-strong-favorite-lesson",
    title: "Share Your Favorite Lesson from Camp",
    short_description: "Reflect on one thing Camp GPE taught you.",
    category: "share_story",
    point_value: 5,
    starts_at: "2026-08-17T05:00:00.000Z",
    ends_at: "2026-08-29T04:59:59.000Z",
    display_order: 410,
    week_number: 7,
    theme: "Summer may end, but advocacy does not.",
    submission_type: "reflection",
    is_featured: true,
  }),
  challenge({
    id: "c11",
    slug: "finish-strong-final-petitions",
    title: "Encourage People to Sign Final Petitions",
    short_description: "Make one final push for Camp GPE petition actions.",
    category: "sign_petition",
    point_value: 2,
    starts_at: "2026-08-17T05:00:00.000Z",
    ends_at: "2026-08-29T04:59:59.000Z",
    display_order: 420,
    week_number: 7,
    theme: "Summer may end, but advocacy does not.",
    submission_type: "social_link",
    action_url: "https://www.girlplusenvironment.org/high-energy-bills-action",
  }),
  challenge({
    id: "c12",
    slug: "finish-strong-advocacy-reflection",
    title: "Reflect on Your Advocacy Journey",
    short_description: "Share how your climate advocacy changed during Camp GPE.",
    category: "share_story",
    point_value: 2,
    starts_at: "2026-08-17T05:00:00.000Z",
    ends_at: "2026-08-29T04:59:59.000Z",
    display_order: 430,
    week_number: 7,
    theme: "Summer may end, but advocacy does not.",
    submission_type: "reflection",
  }),
];

async function installCampStubs(page: Page) {
  await page.addInitScript(({ user, storageKey }) => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user,
      }),
    );
  }, { user: testUser, storageKey: supabaseAuthStorageKey() });

  await page.route("**/auth/v1/user", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(testUser) });
  });

  await page.route("**/rest/v1/rpc/is_admin", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "false" });
  });

  await page.route("**/rest/v1/rpc/can_manage_camp", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "false" });
  });

  await page.route("**/rest/v1/profiles?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(testProfile) });
  });

  await page.route("**/rest/v1/conversation_participants?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/rest/v1/gpe_seasons?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(season) });
  });

  await page.route("**/rest/v1/gpe_hub_camp_challenges?**", async (route) => {
    const url = new URL(route.request().url());
    const slugFilter = url.searchParams.get("slug");
    const slug = slugFilter?.startsWith("eq.") ? slugFilter.slice(3) : "";
    const body = slug ? challenges.find((item) => item.slug === slug) ?? null : challenges;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.route("**/rest/v1/gpe_season_members?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "season-member-1",
        season_id: season.id,
        user_id: testUser.id,
        contact_email: testUser.email,
        neon_account_id: null,
        cabin_id: null,
        joined_at: "2026-07-06T05:00:00.000Z",
        status: "active",
        gpe_cabins: null,
      }),
    });
  });

  await page.route("**/rest/v1/gpe_camp_challenge_submissions?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/rest/v1/gpe_camp_points_ledger?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

test.beforeEach(async ({ page }) => {
  await installCampStubs(page);
});

test("Camp challenge board shows every scheduled week and opens internal details", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 768 });
  await page.goto("/camp-gpe/challenges");

  await expect(page.getByText("Hot Girl Summer starts with protecting our communities.")).toBeVisible();
  await expect(page.getByText("Your story could be the reason someone takes action.")).toBeVisible();
  await expect(page.getByText("Everyone deserves energy that keeps us safe, not stressed.")).toBeVisible();
  await expect(page.getByText("Summer may end, but advocacy does not.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Sign the Extreme Weather Petition/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Share Your Climate Story/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Sign the High Energy Bills Petition/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Reflect on Your Advocacy Journey/ })).toBeVisible();

  await page
    .locator("article", { hasText: "Sign the Extreme Weather Petition" })
    .getByRole("button", { name: "Open Details" })
    .click();
  await expect(page).toHaveURL(/\/camp-gpe\/challenges\/beat-heat-extreme-weather-petition$/);
  await expect(page.locator("h1", { hasText: "Sign the Extreme Weather Petition" })).toBeVisible();
});

test("Camp challenge detail survives refresh and renders safe external CTA", async ({ page }) => {
  await page.goto("/camp-gpe/challenges/beat-heat-extreme-weather-petition");
  await expect(page.getByText("Why It Matters")).toBeVisible();

  await page.reload();
  await expect(page.locator("h1", { hasText: "Sign the Extreme Weather Petition" })).toBeVisible();

  const cta = page.getByRole("link", { name: /open petition/i }).first();
  await expect(cta).toHaveAttribute("href", "https://girlplusenvironment.org/extreme-weather-action");
  await expect(cta).toHaveAttribute("target", "_blank");
  await expect(cta).toHaveAttribute("rel", /noopener/);
  await expect(cta).toHaveAttribute("rel", /noreferrer/);
});

test("invalid Camp challenge slug shows designed not found state", async ({ page }) => {
  await page.goto("/camp-gpe/challenges/not-a-real-challenge");
  await expect(page.getByRole("heading", { name: "Challenge Not Found" })).toBeVisible();
  await expect(page.getByRole("link", { name: /back to challenges/i })).toBeVisible();
});

test("Challenge type filter keeps late joiners able to browse by action type", async ({ page }) => {
  await page.goto("/camp-gpe/challenges");
  await page.getByRole("tab", { name: "sign petition" }).click();

  await expect(page.getByRole("heading", { name: /Sign the Extreme Weather Petition/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Sign the High Energy Bills Petition/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Create a Short Video/ })).toHaveCount(0);
});

test("mobile challenge detail remains usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/camp-gpe/challenges/tell-your-story-camp-graphics");

  await expect(page.locator("h1", { hasText: "Post Using Camp GPE Graphics" })).toBeVisible();
  await expect(page.getByText("Submission Requirements")).toBeVisible();
  await expect(page.getByRole("link", { name: /submit for points/i })).toBeVisible();
});
