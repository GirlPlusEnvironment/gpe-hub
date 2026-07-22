import { test, expect, type Page } from "@playwright/test";
import { supabaseAuthStorageKey } from "./helpers";

const testUser = {
  id: "00000000-0000-0000-0000-000000000010",
  aud: "authenticated",
  role: "authenticated",
  email: "member@example.com",
  email_confirmed_at: "2026-07-22T00:00:00.000Z",
  phone: "",
  confirmed_at: "2026-07-22T00:00:00.000Z",
  last_sign_in_at: "2026-07-22T00:00:00.000Z",
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
  neon_account_id: null,
  member_status: "active",
  points: 25,
  created_at: "2026-07-22T00:00:00.000Z",
  updated_at: "2026-07-22T00:00:00.000Z",
};

const rows = [
  {
    id: "job-001",
    category: "jobs",
    title: "Climate Justice Organizer",
    summary: "Lead campaigns with frontline communities.",
    description: "This role supports member-led climate justice campaigns across regions.",
    image_url: "",
    location: "Remote, US",
    tags: ["organizing", "climate"],
    created_at: "2026-07-01T00:00:00.000Z",
    is_removed: false,
    submitted_by: testUser.id,
    profiles: { id: testUser.id, username: "test-member", full_name: "Test Member", avatar_url: null },
    metadata: {
      company: "GPE Partner Org",
      job_type: "Full-time",
      work_arrangement: "Remote",
      salary: "$70,000 - $80,000",
      application_deadline: "2026-08-15",
      application_url: "jobs.example.org/apply",
      source: "Partner Feed",
      responsibilities: ["Coordinate campaigns", "Support member leaders"],
      qualifications: ["Community organizing experience"],
    },
  },
  {
    id: "resource-001",
    category: "resources",
    title: "Energy Justice Toolkit",
    summary: "A guide for local energy justice campaigns.",
    description: "Use this toolkit to plan outreach, testimony, and coalition strategy.",
    image_url: "",
    location: null,
    tags: ["energy", "toolkit"],
    created_at: "2026-06-10T00:00:00.000Z",
    is_removed: false,
    submitted_by: testUser.id,
    profiles: { id: testUser.id, username: "test-member", full_name: "Test Member", avatar_url: null },
    metadata: {
      resource_type: "Toolkit",
      topic: "Energy Justice",
      audience: "Local organizers",
      publication_date: "2026-06-01",
      download_url: "resources.example.org/toolkit.pdf",
      file_size: "2 MB",
      source: "GPE Library",
    },
  },
  {
    id: "resource-002",
    category: "resources",
    title: "Energy Testimony Template",
    summary: "A related resource for energy hearings.",
    description: "Template language for testimony.",
    image_url: "",
    location: null,
    tags: ["energy"],
    created_at: "2026-05-01T00:00:00.000Z",
    is_removed: false,
    submitted_by: testUser.id,
    profiles: { id: testUser.id, username: "test-member", full_name: "Test Member", avatar_url: null },
    metadata: {
      resource_type: "Guide",
      topic: "Energy Justice",
      download_url: "https://resources.example.org/template",
    },
  },
  {
    id: "resource-003",
    category: "resources",
    title: "Air Quality Video Briefing",
    summary: "A video explainer for community air monitoring.",
    description: "Watch this briefing before planning a local air monitoring campaign.",
    image_url: "",
    location: null,
    tags: ["air", "video"],
    created_at: "2026-04-10T00:00:00.000Z",
    is_removed: false,
    submitted_by: testUser.id,
    profiles: { id: testUser.id, username: "test-member", full_name: "Test Member", avatar_url: null },
    metadata: {
      resource_type: "Video",
      topic: "Air Quality",
      author: "GPE Media",
      download_url: "videos.example.org/air-briefing",
    },
  },
  {
    id: "funding-001",
    category: "fundraisers",
    title: "Community Climate Mini-Grants",
    summary: "Small grants for youth-led climate justice projects.",
    description: "Funding supports local climate action, training, and outreach costs.",
    image_url: "",
    location: "United States",
    tags: ["grants", "climate"],
    created_at: "2026-07-05T00:00:00.000Z",
    is_removed: false,
    submitted_by: testUser.id,
    profiles: { id: testUser.id, username: "test-member", full_name: "Test Member", avatar_url: null },
    metadata: {
      organizer: "GPE Grants Team",
      funding_type: "Mini-grant",
      award_range: "$500 - $2,000",
      eligibility: "Youth-led teams",
      deadline: "2026-09-01",
      rolling_or_fixed: "Fixed",
      geographic_eligibility: "US",
      target_audience: "Young organizers",
      climate_focus: "Environmental justice",
      application_requirements: ["Project budget", "Community partner"],
      donation_url: "funding.example.org/apply",
      source: "Grant Portal",
    },
  },
  {
    id: "event-001",
    category: "events",
    title: "Climate Justice Skillshare",
    summary: "A virtual training for campaign teams.",
    description: "Join organizers for a practical skillshare on campaign planning.",
    image_url: "",
    location: "Zoom",
    tags: ["training", "climate"],
    created_at: "2026-07-06T00:00:00.000Z",
    is_removed: false,
    submitted_by: testUser.id,
    profiles: { id: testUser.id, username: "test-member", full_name: "Test Member", avatar_url: null },
    metadata: {
      organizer: "GPE Events",
      event_type: "Workshop",
      format: "Virtual",
      date: "2026-08-20",
      time: "6:00 PM",
      timezone: "ET",
      registration_deadline: "2026-08-19",
      registration_url: "events.example.org/register",
      speakers: ["GPE Organizer"],
      agenda: ["Welcome", "Campaign planning"],
    },
  },
  {
    id: "event-closed",
    category: "events",
    title: "Past Registration Training",
    summary: "A past event.",
    description: "This event has closed registration.",
    image_url: "",
    location: "Online",
    tags: ["training"],
    created_at: "2026-01-01T00:00:00.000Z",
    is_removed: false,
    submitted_by: testUser.id,
    profiles: { id: testUser.id, username: "test-member", full_name: "Test Member", avatar_url: null },
    metadata: {
      organizer: "GPE Events",
      event_type: "Workshop",
      date: "2026-01-15",
      registration_deadline: "2026-01-10",
      registration_url: "events.example.org/closed",
    },
  },
];

async function installSupabaseStubs(page: Page) {
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

  await page.route("**/rest/v1/listing_favorites?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/rest/v1/conversation_participants?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/rest/v1/listings?**", async (route) => {
    const url = new URL(route.request().url());
    const idFilter = url.searchParams.get("id");
    const id = idFilter?.startsWith("eq.") ? idFilter.slice(3) : "";
    const body = id ? rows.find((row) => row.id === id) ?? null : rows;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test.beforeEach(async ({ page }) => {
  await installSupabaseStubs(page);
});

test("clicking a job card opens an internal job detail page with external CTA", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 768 });
  await page.goto("/explore?category=jobs");
  await page.getByRole("heading", { name: "Climate Justice Organizer" }).click();
  await expect(page).toHaveURL(/\/jobs\/job-001$/);
  await expect(page.getByRole("heading", { name: "Climate Justice Organizer" })).toBeVisible();

  const cta = page.getByRole("link", { name: /apply on organization website/i });
  await expect(cta).toHaveAttribute("href", "https://jobs.example.org/apply");
  await expect(cta).toHaveAttribute("target", "_blank");
  await expect(cta).toHaveAttribute("rel", "noopener noreferrer");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Climate Justice Organizer" })).toBeVisible();
  await page.getByRole("button", { name: /back to jobs/i }).click();
  await expect(page).toHaveURL(/\/explore\?category=jobs$/);
});

test("clicking a resource card opens an internal resource detail page with related resources", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 768 });
  await page.goto("/explore?category=resources");
  await page.getByRole("heading", { name: "Energy Testimony Template" }).click();
  await expect(page).toHaveURL(/\/resources\/resource-002$/);
  await expect(page.getByRole("heading", { name: "Energy Testimony Template" })).toBeVisible();

  const cta = page.getByRole("link", { name: /download guide/i });
  await expect(cta).toHaveAttribute("href", "https://resources.example.org/template");
  await expect(cta).toHaveAttribute("target", "_blank");
  await expect(cta).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.getByRole("heading", { name: "Energy Justice Toolkit" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Energy Testimony Template" })).toBeVisible();
  await page.getByRole("button", { name: /back to resources/i }).click();
  await expect(page).toHaveURL(/\/explore\?category=resources$/);
});

test("funding and event cards open internal detail pages before external CTAs", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 768 });

  await page.goto("/explore?category=fundraisers");
  await page.getByRole("heading", { name: "Community Climate Mini-Grants" }).click();
  await expect(page).toHaveURL(/\/funding\/funding-001$/);
  await expect(page.getByRole("heading", { name: "Community Climate Mini-Grants" })).toBeVisible();
  const fundingCta = page.getByRole("link", { name: /apply for funding/i });
  await expect(fundingCta).toHaveAttribute("href", "https://funding.example.org/apply");
  await expect(fundingCta).toHaveAttribute("target", "_blank");
  await expect(fundingCta).toHaveAttribute("rel", "noopener noreferrer");
  await page.goBack();
  await expect(page).toHaveURL(/\/explore\?category=fundraisers$/);

  await page.goto("/explore?category=events");
  await page.getByRole("heading", { name: "Climate Justice Skillshare" }).click();
  await expect(page).toHaveURL(/\/events\/event-001$/);
  await expect(page.getByRole("heading", { name: "Climate Justice Skillshare" })).toBeVisible();
  const eventCta = page.getByRole("link", { name: /register for event/i });
  await expect(eventCta).toHaveAttribute("href", "https://events.example.org/register");
  await expect(eventCta).toHaveAttribute("target", "_blank");
  await expect(eventCta).toHaveAttribute("rel", "noopener noreferrer");

  await page.goto("/events/event-closed");
  await expect(page.getByText("Registration Closed")).toBeVisible();
  await expect(page.getByRole("link", { name: /register for event/i })).toHaveCount(0);
});

test("toolkit route loads directly and uses toolkit CTA", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 768 });
  await page.goto("/toolkits/resource-001");
  await expect(page.getByRole("heading", { name: "Energy Justice Toolkit" })).toBeVisible();
  const cta = page.getByRole("link", { name: /open toolkit/i });
  await expect(cta).toHaveAttribute("href", "https://resources.example.org/toolkit.pdf");
  await expect(cta).toHaveAttribute("target", "_blank");
  await expect(cta).toHaveAttribute("rel", "noopener noreferrer");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Energy Justice Toolkit" })).toBeVisible();
});

test("invalid detail IDs show designed not-found states", async ({ page }) => {
  await page.goto("/jobs/missing-job");
  await expect(page.getByText("Job Not Found")).toBeVisible();
  await expect(page.getByRole("button", { name: "Back to Explore" })).toBeVisible();

  await page.goto("/toolkits/resource-003");
  await expect(page.getByText("Toolkit Not Found")).toBeVisible();
});

test("mobile resource detail remains usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/resources/resource-002");
  await expect(page.getByRole("heading", { name: "Energy Testimony Template" })).toBeVisible();
  await expect(page.getByRole("link", { name: /download guide/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /back to resources/i })).toBeVisible();
});
