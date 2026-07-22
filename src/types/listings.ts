export interface Poster {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface BaseListing {
  id: string;
  title: string;
  description: string;
  summary?: string;
  image: string;
  tags?: string[];
  category: "jobs" | "events" | "fundraisers" | "resources";
  submitted_by?: Poster;
  created_at?: string;
}

export interface JobListing extends BaseListing {
  category: "jobs";
  location: string;
  jobType: "Full-time" | "Part-time" | "Contract" | "Remote";
  workArrangement?: string;
  experienceLevel: "Entry-level" | "Mid-level" | "Senior";
  salary: string;
  company?: string;
  organizationLogo?: string;
  requirements?: string[];
  responsibilities?: string[];
  qualifications?: string[];
  benefits?: string[];
  applicationDeadline?: string;
  postingDate?: string;
  contactEmail?: string;
  applicationUrl?: string;
  source?: string;
}

export interface EventListing extends BaseListing {
  category: "events";
  date: string;
  time?: string;
  timezone?: string;
  location: string;
  format?: string;
  eventType: "Conference" | "Workshop" | "Festival" | "Meetup" | "Expo" | "Panel";
  cost: string;
  organizer?: string;
  maxAttendees?: number;
  registrationUrl?: string;
  registrationDeadline?: string;
  contactEmail?: string;
  speakers?: string[];
  agenda?: string[];
}

export interface FundraiserListing extends BaseListing {
  category: "fundraisers";
  goalAmount: string;
  fundingType?: string;
  awardRange?: string;
  eligibility?: string;
  rollingOrFixed?: string;
  geographicEligibility?: string;
  targetAudience?: string;
  climateFocus?: string;
  currentAmount: string;
  deadline: string;
  organizer: string;
  contactEmail?: string;
  donationUrl?: string;
  applicationRequirements?: string[];
  updates?: string[];
  progressPercentage?: number;
  source?: string;
}

export interface ResourceListing extends BaseListing {
  category: "resources";
  resourceType: "Toolkit" | "Video" | "Guide" | "Handbook" | "Technical Guide" | "Database";
  topic: string;
  difficultyLevel: "Beginner" | "Intermediate" | "Advanced";
  author?: string;
  audience?: string;
  downloadUrl?: string;
  lastUpdated?: string;
  publicationDate?: string;
  fileSize?: string;
  source?: string;
}

export type Listing = JobListing | EventListing | FundraiserListing | ResourceListing;
