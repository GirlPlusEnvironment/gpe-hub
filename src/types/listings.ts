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
  experienceLevel: "Entry-level" | "Mid-level" | "Senior";
  salary: string;
  company?: string;
  requirements?: string[];
  benefits?: string[];
  applicationDeadline?: string;
  contactEmail?: string;
  applicationUrl?: string;
}

export interface EventListing extends BaseListing {
  category: "events";
  date: string;
  time?: string;
  location: string;
  eventType: "Conference" | "Workshop" | "Festival" | "Meetup" | "Expo" | "Panel";
  cost: string;
  organizer?: string;
  maxAttendees?: number;
  registrationUrl?: string;
  contactEmail?: string;
  agenda?: string[];
}

export interface FundraiserListing extends BaseListing {
  category: "fundraisers";
  goalAmount: string;
  currentAmount: string;
  deadline: string;
  organizer: string;
  contactEmail?: string;
  donationUrl?: string;
  updates?: string[];
  progressPercentage?: number;
}

export interface ResourceListing extends BaseListing {
  category: "resources";
  resourceType: "Toolkit" | "Video" | "Guide" | "Handbook" | "Technical Guide" | "Database";
  topic: string;
  difficultyLevel: "Beginner" | "Intermediate" | "Advanced";
  author?: string;
  downloadUrl?: string;
  lastUpdated?: string;
  fileSize?: string;
}

export type Listing = JobListing | EventListing | FundraiserListing | ResourceListing;

