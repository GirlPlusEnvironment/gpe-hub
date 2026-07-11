import { supabase } from "@/lib/supabaseClient";
import type {
  Listing,
  JobListing,
  EventListing,
  FundraiserListing,
  ResourceListing,
  Poster,
} from "@/types/listings";
import { awardPoints, deductPoints } from "./points";
import { validateContent } from "./profanityFilter";

type ListingCategory = Listing["category"];

type ListingRow = {
  id: string;
  category: ListingCategory;
  title: string;
  summary?: string | null;
  description?: string | null;
  image_url?: string | null;
  location?: string | null;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  submitted_by?: string | null;
  is_removed?: boolean | null; 
  profiles?: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

type FavoriteRow = {
  id: string;
  profile_id: string;
  listing_id: string;
};

const DEFAULT_IMAGES: Record<ListingCategory, string> = {
  jobs: "https://images.unsplash.com/photo-1551836022-4c4c79ecde51?w=900&h=600&fit=crop",
  events: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900&h=600&fit=crop",
  fundraisers: "https://images.unsplash.com/photo-1521737604893-96fceff52b22?w=900&h=600&fit=crop",
  resources: "https://images.unsplash.com/photo-1450101215322-bf5cd27642fc?w=900&h=600&fit=crop",
};

const ensureString = (value: unknown, fallback = ""): string =>
  typeof value === "string" && value.trim().length > 0 ? value : fallback;

const ensureNumberString = (value: unknown, fallback = ""): string => {
  if (typeof value === "number") {
    return value.toString();
  }
  return ensureString(value, fallback);
};

const ensureStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => ensureString(item)).filter(Boolean);
  }
  return [];
};

const ensureEnum = <T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] => {
  if (typeof value === "string" && allowed.includes(value as T[number])) {
    return value as T[number];
  }
  return fallback;
};

const sanitizeMetadata = (metadata: unknown): Record<string, unknown> =>
  metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};

const transformJob = (row: ListingRow): JobListing => {
  const metadata = sanitizeMetadata(row.metadata);

  const jobTypeOptions = ["Full-time", "Part-time", "Contract", "Remote"] as const;
  const experienceOptions = ["Entry-level", "Mid-level", "Senior"] as const;
  const legacyWorkArrangements = ensureStringArray(metadata.work_arrangements);
  const derivedJobType = legacyWorkArrangements.find((value) =>
    jobTypeOptions.includes(value as (typeof jobTypeOptions)[number]),
  );

  const location =
    ensureString(metadata.location) ||
    ensureString(metadata.state) ||
    ensureString(row.location) ||
    "Remote";

  const poster: Poster | undefined = row.profiles ? {
    id: row.profiles.id,
    username: row.profiles.username,
    full_name: row.profiles.full_name,
    avatar_url: row.profiles.avatar_url,
  } : undefined;

  return {
    id: row.id,
    category: "jobs",
    title: ensureString(row.title, "Untitled Job"),
    summary: ensureString(row.summary ?? metadata.summary ?? ""),
    description:
      ensureString(row.description ?? metadata.description) ||
      "More information will be available soon.",
    image: ensureString(metadata.image_url ?? row.image_url, DEFAULT_IMAGES.jobs),
    tags: ensureStringArray(metadata.tags ?? row.tags),
    submitted_by: poster,
    created_at: row.created_at ?? undefined,
    location,
    jobType: ensureEnum(
      metadata.job_type ?? metadata.jobType ?? derivedJobType,
      jobTypeOptions,
      "Full-time",
    ),
    experienceLevel: ensureEnum(
      metadata.experience_level ?? metadata.experienceLevel,
      experienceOptions,
      "Mid-level",
    ),
    salary: ensureString(metadata.salary ?? metadata.compensation, "Compensation shared on request"),
    company: ensureString(metadata.company ?? metadata.organisation ?? ""),
    requirements: ensureStringArray(metadata.requirements),
    benefits: ensureStringArray(metadata.benefits),
    applicationDeadline: ensureString(metadata.application_deadline ?? metadata.deadline ?? ""),
    contactEmail: ensureString(metadata.contact_email ?? metadata.email ?? ""),
    applicationUrl: ensureString(metadata.application_url ?? metadata.url ?? ""),
  };
};

const transformEvent = (row: ListingRow): EventListing => {
  const metadata = sanitizeMetadata(row.metadata);
  const eventTypeOptions = ["Conference", "Workshop", "Festival", "Meetup", "Expo", "Panel"] as const;

  const location =
    ensureString(metadata.location) || ensureString(row.location) || "Location to be announced";

  const poster: Poster | undefined = row.profiles ? {
    id: row.profiles.id,
    username: row.profiles.username,
    full_name: row.profiles.full_name,
    avatar_url: row.profiles.avatar_url,
  } : undefined;

  return {
    id: row.id,
    category: "events",
    title: ensureString(row.title, "Untitled Event"),
    summary: ensureString(row.summary ?? metadata.summary ?? ""),
    description:
      ensureString(row.description ?? metadata.description) ||
      "Event details will be announced soon.",
    image: ensureString(metadata.image_url ?? row.image_url, DEFAULT_IMAGES.events),
    tags: ensureStringArray(metadata.tags ?? row.tags),
    submitted_by: poster,
    created_at: row.created_at ?? undefined,
    date: ensureString(metadata.date ?? metadata.start_date ?? "Date coming soon"),
    time: ensureString(metadata.time ?? metadata.start_time ?? ""),
    location,
    eventType: ensureEnum(metadata.event_type ?? metadata.type, eventTypeOptions, "Conference"),
    cost: ensureString(metadata.cost ?? metadata.price ?? "Free"),
    organizer: ensureString(metadata.organizer ?? metadata.host ?? ""),
    maxAttendees: typeof metadata.max_attendees === "number" ? metadata.max_attendees : undefined,
    registrationUrl: ensureString(metadata.registration_url ?? metadata.url ?? ""),
    contactEmail: ensureString(metadata.contact_email ?? metadata.email ?? ""),
    agenda: ensureStringArray(metadata.agenda),
  };
};

const transformFundraiser = (row: ListingRow): FundraiserListing => {
  const metadata = sanitizeMetadata(row.metadata);

  const poster: Poster | undefined = row.profiles ? {
    id: row.profiles.id,
    username: row.profiles.username,
    full_name: row.profiles.full_name,
    avatar_url: row.profiles.avatar_url,
  } : undefined;

  return {
    id: row.id,
    category: "fundraisers",
    title: ensureString(row.title, "Untitled Fundraiser"),
    summary: ensureString(row.summary ?? metadata.summary ?? ""),
    description:
      ensureString(row.description ?? metadata.description) ||
      "Additional fundraising details will be shared soon.",
    image: ensureString(metadata.image_url ?? row.image_url, DEFAULT_IMAGES.fundraisers),
    tags: ensureStringArray(metadata.tags ?? row.tags),
    submitted_by: poster,
    created_at: row.created_at ?? undefined,
    goalAmount: ensureString(
      metadata.goal_amount ?? metadata.goal ?? metadata.amount ?? "Goal to be announced",
    ),
    currentAmount: ensureString(metadata.current_amount ?? metadata.raised ?? "0"),
    deadline: ensureString(metadata.deadline ?? metadata.end_date ?? "Ongoing"),
    organizer: ensureString(
      metadata.organizer ?? metadata.host ?? metadata.source ?? "Organizer to be announced",
    ),
    contactEmail: ensureString(metadata.contact_email ?? metadata.email ?? ""),
    donationUrl: ensureString(metadata.donation_url ?? metadata.link ?? metadata.url ?? ""),
    updates: ensureStringArray(metadata.updates),
    progressPercentage:
      typeof metadata.progress_percentage === "number"
        ? metadata.progress_percentage
        : undefined,
  };
};

const transformResource = (row: ListingRow): ResourceListing => {
  const metadata = sanitizeMetadata(row.metadata);

  const resourceTypeOptions = [
    "Toolkit",
    "Video",
    "Guide",
    "Handbook",
    "Technical Guide",
    "Database",
  ] as const;
  const difficultyOptions = ["Beginner", "Intermediate", "Advanced"] as const;

  const poster: Poster | undefined = row.profiles ? {
    id: row.profiles.id,
    username: row.profiles.username,
    full_name: row.profiles.full_name,
    avatar_url: row.profiles.avatar_url,
  } : undefined;

  return {
    id: row.id,
    category: "resources",
    title: ensureString(row.title, "Untitled Resource"),
    summary: ensureString(row.summary ?? metadata.summary ?? ""),
    description:
      ensureString(row.description ?? metadata.description) ||
      "Resource description will be published soon.",
    image: ensureString(metadata.image_url ?? row.image_url, DEFAULT_IMAGES.resources),
    tags: ensureStringArray(metadata.tags ?? row.tags),
    submitted_by: poster,
    created_at: row.created_at ?? undefined,
    resourceType: ensureEnum(
      metadata.resource_type ?? metadata.resource_category ?? metadata.type,
      resourceTypeOptions,
      "Guide",
    ),
    topic: ensureString(metadata.topic ?? metadata.resource_category ?? "General"),
    difficultyLevel: ensureEnum(
      metadata.difficulty_level ?? metadata.level,
      difficultyOptions,
      "Beginner",
    ),
    author: ensureString(metadata.author ?? ""),
    downloadUrl: ensureString(metadata.download_url ?? metadata.url ?? ""),
    lastUpdated: ensureString(metadata.last_updated ?? metadata.updated_at ?? ""),
    fileSize: ensureNumberString(metadata.file_size ?? metadata.size, ""),
  };
};

const transformRow = (row: ListingRow): Listing => {
  switch (row.category) {
    case "jobs":
      return transformJob(row);
    case "events":
      return transformEvent(row);
    case "fundraisers":
      return transformFundraiser(row);
    case "resources":
      return transformResource(row);
    default: {
      throw new Error(`Unsupported listing category: ${row.category}`);
    }
  }
};

export const fetchAllListings = async (): Promise<Listing[]> => {
  const { data, error } = await supabase
    .from("listings")
    .select(`
      *,
      profiles:submitted_by (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .eq("is_removed", false) // <-- ADD THIS
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch listings", error);
    throw error;
  }

  return ((data ?? []) as ListingRow[]).map(transformRow);
};

export const fetchListingsByCategory = async (category: ListingCategory): Promise<Listing[]> => {
  const { data, error } = await supabase
    .from("listings")
    .select(`
      *,
      profiles:submitted_by (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .eq("category", category)
    .eq("is_removed", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`Failed to fetch ${category} listings`, error);
    throw error;
  }

  return ((data ?? []) as ListingRow[]).map(transformRow);
};

export const fetchListingById = async (id: string): Promise<Listing | null> => {
  const { data, error } = await supabase
    .from("listings")
    .select(`
      *,
      profiles:submitted_by (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .eq("id", id)
    .eq("is_removed", false)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch listing by id", error);
    throw error;
  }

  return data ? transformRow(data as ListingRow) : null;
};

export const fetchFavoriteListingIds = async (profileId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("listing_favorites")
    .select("listing_id")
    .eq("profile_id", profileId);

  if (error) {
    console.error("Failed to fetch favorite listings", error);
    throw error;
  }

  return ((data ?? []) as Pick<FavoriteRow, "listing_id">[]).map((row) => row.listing_id);
};

export const fetchFavoriteListings = async (profileId: string): Promise<Listing[]> => {
  // Fetch only listings that the given profile has favorited
  const { data, error } = await supabase
    .from("listing_favorites")
    .select(
      `
        listings:listing_id (
          *,
          profiles:submitted_by (
            id,
            username,
            full_name,
            avatar_url
          )
        )
      `,
    )
    .eq("profile_id", profileId)
    .eq("listings.is_removed", false)
    .order("id", { ascending: false });

  if (error) {
    console.error("Failed to fetch favorite listings (full)", error);
    throw error;
  }

  const rows = (data ?? []) as any[];
  const listingRows: ListingRow[] = rows
    .map((r) => (r as any).listings as ListingRow | null)
    .filter((r): r is ListingRow => Boolean(r));
  return listingRows.map(transformRow);
};

export const addFavoriteListing = async (profileId: string, listingId: string) => {
  const { error } = await supabase
    .from("listing_favorites")
    .upsert({ profile_id: profileId, listing_id: listingId });

  if (error) {
    console.error("Failed to save favorite listing", error);
    throw error;
  }

  // Increment user points
  try {
    await awardPoints(profileId, 1);
  } catch (pointsError) {
    console.error("Failed to award points for favorite listing", pointsError);
  }
};

export const removeFavoriteListing = async (profileId: string, listingId: string) => {
  const { error } = await supabase
    .from("listing_favorites")
    .delete()
    .eq("profile_id", profileId)
    .eq("listing_id", listingId);

  if (error) {
    console.error("Failed to remove favorite listing", error);
    throw error;
  }

  // Decrement user points
  try {
    await deductPoints(profileId, 1);
  } catch (pointsError) {
    console.error("Failed to deduct points for favorite listing removal", pointsError);
  }
};

/**
 * Validates all text content in a listing before submission
 * @param listingData - The listing data to validate
 * @throws Error if any field contains profanity
 */
export function validateListingContent(listingData: {
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}): void {
  // Validate title
  validateContent(listingData.title);

  // Validate description if present
  if (listingData.description) {
    validateContent(listingData.description);
  }

  // Validate metadata fields that contain user-generated text
  if (listingData.metadata) {
    const metadata = listingData.metadata;

    // Job-specific fields
    if (typeof metadata.company === "string") {
      validateContent(metadata.company);
    }
    if (Array.isArray(metadata.requirements)) {
      metadata.requirements.forEach((req: unknown) => {
        if (typeof req === "string") {
          validateContent(req);
        }
      });
    }

    // Event-specific fields
    if (typeof metadata.organizer === "string") {
      validateContent(metadata.organizer);
    }
    if (typeof metadata.cost === "string") {
      validateContent(metadata.cost);
    }

    // Funding/Resource-specific fields
    if (typeof metadata.source === "string") {
      validateContent(metadata.source);
    }
    if (typeof metadata.amount === "string") {
      validateContent(metadata.amount);
    }
    if (typeof metadata.notes === "string") {
      validateContent(metadata.notes);
    }
  }
}
