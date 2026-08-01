import { supabase } from "@/lib/supabaseClient";

export type MentorshipListingType = "mentor_offer" | "mentor_request";
export type MentorshipListingStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "matched"
  | "paused"
  | "closed"
  | "expired"
  | "rejected";

export type MentorshipListing = {
  id: string;
  profile_id: string;
  listing_type: MentorshipListingType;
  status: MentorshipListingStatus;
  display_name: string;
  headline: string;
  email: string | null;
  location: string | null;
  time_zone: string | null;
  communication_format: string | null;
  availability: string | null;
  intro: string | null;
  topics: string[];
  climate_focus: string[];
  career_stage: string | null;
  organization_role: string | null;
  meeting_frequency: string | null;
  remote_preference: string;
  profile_image_url: string | null;
  contact_consent: boolean;
  visibility: string;
  expires_at: string | null;
  support_needed: string | null;
  current_goals: string | null;
  skills_to_develop: string | null;
  preferred_mentor_experience: string | null;
  ideal_outcome: string | null;
  urgency: string | null;
  mentor_areas: string | null;
  experience_summary: string | null;
  best_positioned_to_support: string | null;
  mentee_capacity: number | null;
  mentorship_format: string | null;
  boundaries: string | null;
  professional_links: string | null;
  published_at: string | null;
  closed_at: string | null;
  moderation_note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

export type MentorshipMatchRequest = {
  id: string;
  listing_id: string;
  requester_profile_id: string;
  recipient_profile_id: string;
  mentor_profile_id: string;
  mentee_profile_id: string;
  status: string;
  message: string | null;
  fit_reason: string | null;
  proposed_availability: string | null;
  first_meeting_idea: string | null;
  created_at: string;
  updated_at: string;
};

export type LinkedWorkflowResult = {
  ok: boolean;
  status?: string;
  requestId?: string;
  matchId?: string;
  cabinId?: string;
  seasonId?: string;
  seasonMemberId?: string;
  conversationId?: string;
  linkedConversation?: {
    ok: boolean;
    created: boolean;
    conversationId: string;
    linkedConversationId: string;
  };
  alreadyProcessed?: boolean;
};

export type Cabin = {
  id: string;
  season_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  theme: string | null;
  visibility: string;
  max_members: number | null;
  location_mode: string;
  focus_area: string | null;
  invite_only: boolean;
  approval_required: boolean;
  lead_profile_id: string | null;
  conversation_id: string | null;
  community_agreement: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export function toListText(value: string[] | null | undefined) {
  return Array.isArray(value) && value.length > 0 ? value.join(", ") : "Open";
}

export function mentorshipBadge(listing: MentorshipListing) {
  return listing.listing_type === "mentor_offer" ? "Mentor offer" : "Mentor request";
}

export async function submitMentorshipListing(payload: Record<string, unknown>) {
  const normalized = {
    ...payload,
    topics: typeof payload.topics === "string" ? splitList(payload.topics) : payload.topics,
    climateFocus: typeof payload.climateFocus === "string" ? splitList(payload.climateFocus) : payload.climateFocus,
  };

  const { data, error } = await supabase.rpc("submit_mentorship_listing", {
    p_payload: normalized,
  });

  if (error) throw error;
  return data as MentorshipListing;
}

export async function fetchMentorshipListings() {
  const { data, error } = await supabase
    .from("hub_mentorship_listings")
    .select("*, profiles(full_name, username, avatar_url)")
    .in("status", ["published", "matched"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as MentorshipListing[];
}

export async function fetchMentorshipListing(id: string) {
  const { data, error } = await supabase
    .from("hub_mentorship_listings")
    .select("*, profiles(full_name, username, avatar_url)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as MentorshipListing | null;
}

export async function fetchMyMentorshipListings(profileId: string) {
  const { data, error } = await supabase
    .from("hub_mentorship_listings")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as MentorshipListing[];
}

export async function fetchReceivedMentorshipRequests(profileId: string) {
  const { data, error } = await supabase
    .from("hub_mentorship_match_requests")
    .select("*, hub_mentorship_listings(headline, listing_type, display_name)")
    .eq("recipient_profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Array<MentorshipMatchRequest & {
    hub_mentorship_listings?: {
      headline: string;
      listing_type: MentorshipListingType;
      display_name: string;
    } | null;
  }>;
}

export async function fetchMyMentorshipMatches(profileId: string) {
  const { data, error } = await supabase
    .from("hub_mentorship_matches")
    .select("*, hub_mentorship_listings(headline, listing_type)")
    .or(`mentor_profile_id.eq.${profileId},mentee_profile_id.eq.${profileId}`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Array<{
    id: string;
    listing_id: string;
    match_request_id: string;
    mentor_profile_id: string;
    mentee_profile_id: string;
    status: string;
    conversation_id: string | null;
    created_at: string;
    hub_mentorship_listings?: {
      headline: string;
      listing_type: MentorshipListingType;
    } | null;
  }>;
}

export async function updateMyMentorshipListingStatus(id: string, status: MentorshipListingStatus) {
  const { data, error } = await supabase
    .from("hub_mentorship_listings")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as MentorshipListing;
}

export async function requestMentorshipMatch(params: {
  listingId: string;
  message: string;
  fitReason: string;
  proposedAvailability: string;
  firstMeetingIdea: string;
}) {
  const { data, error } = await supabase.rpc("request_mentorship_match", {
    p_listing_id: params.listingId,
    p_message: params.message || null,
    p_fit_reason: params.fitReason || null,
    p_proposed_availability: params.proposedAvailability || null,
    p_first_meeting_idea: params.firstMeetingIdea || null,
  });

  if (error) throw error;
  return data as MentorshipMatchRequest;
}

export async function respondMentorshipMatchRequest(params: {
  requestId: string;
  decision: "accepted" | "declined" | "cancelled";
  responseNote?: string | null;
}) {
  const { data, error } = await supabase.rpc("respond_mentorship_match_request", {
    p_request_id: params.requestId,
    p_decision: params.decision,
    p_response_note: params.responseNote ?? null,
  });

  if (error) throw error;
  return data as LinkedWorkflowResult;
}

export async function createHubCabin(payload: Record<string, unknown>) {
  const { data, error } = await supabase.rpc("create_hub_cabin", {
    p_payload: payload,
  });

  if (error) throw error;
  return data as LinkedWorkflowResult;
}

export async function fetchCabins() {
  const { data, error } = await supabase
    .from("gpe_cabins")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Cabin[];
}

export async function fetchCabin(id: string) {
  const { data, error } = await supabase
    .from("gpe_cabins")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as Cabin | null;
}

export async function requestJoinCabin(params: {
  cabinId: string;
  introduction: string;
  joinReason: string;
  rulesConsent: boolean;
}) {
  const { data, error } = await supabase.rpc("request_join_hub_cabin", {
    p_cabin_id: params.cabinId,
    p_introduction: params.introduction || null,
    p_join_reason: params.joinReason || null,
    p_rules_consent: params.rulesConsent,
  });

  if (error) throw error;
  return data;
}

export async function respondCabinMembership(params: {
  cabinMemberId: string;
  decision: "approved" | "declined" | "removed";
  responseNote?: string | null;
}) {
  const { data, error } = await supabase.rpc("respond_hub_cabin_membership", {
    p_cabin_member_id: params.cabinMemberId,
    p_decision: params.decision,
    p_response_note: params.responseNote ?? null,
  });

  if (error) throw error;
  return data as LinkedWorkflowResult & {
    cabinMemberId?: string;
  };
}

export async function fetchAdminMentorshipListings() {
  const { data, error } = await supabase
    .from("hub_mentorship_listings")
    .select("*, profiles(full_name, username, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data || []) as MentorshipListing[];
}

export async function fetchAdminCabinMembers() {
  const { data, error } = await supabase
    .from("hub_cabin_members")
    .select("*, gpe_cabins(id,name,season_id,conversation_id,status), profiles(full_name,username,email)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data || []) as Array<{
    id: string;
    cabin_id: string;
    profile_id: string;
    role: string;
    status: string;
    introduction: string | null;
    join_reason: string | null;
    created_at: string;
    gpe_cabins?: Pick<Cabin, "id" | "name" | "season_id" | "conversation_id" | "status"> | null;
    profiles?: {
      full_name: string | null;
      username: string | null;
      email: string | null;
    } | null;
  }>;
}

export async function fetchMyCabinMemberships(profileId: string) {
  const { data, error } = await supabase
    .from("hub_cabin_members")
    .select("*, gpe_cabins(id,name,season_id,conversation_id,status,focus_area)")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Array<{
    id: string;
    cabin_id: string;
    profile_id: string;
    season_member_id: string | null;
    role: string;
    status: string;
    created_at: string;
    gpe_cabins?: Pick<Cabin, "id" | "name" | "season_id" | "conversation_id" | "status" | "focus_area"> | null;
  }>;
}
