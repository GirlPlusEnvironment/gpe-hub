import type {
  Listing,
  JobListing,
  EventListing,
  FundraiserListing,
  ResourceListing,
} from "@/types/listings";

export type SortOption =
  | "most_recent"
  | "title_asc"
  | "title_desc"
  | "jobs_salary_desc"
  | "jobs_salary_asc"
  | "jobs_experience"
  | "jobs_deadline"
  | "events_date"
  | "events_cost"
  | "fundraisers_deadline"
  | "fundraisers_progress"
  | "fundraisers_amount"
  | "resources_difficulty"
  | "resources_updated";

export const getSortOptions = (category: Listing["category"]): Array<{ value: SortOption; label: string }> => {
  const baseOptions = [
    { value: "most_recent" as SortOption, label: "Most Recent" },
    { value: "title_asc" as SortOption, label: "Title (A-Z)" },
    { value: "title_desc" as SortOption, label: "Title (Z-A)" },
  ];

  switch (category) {
    case "jobs":
      return [
        ...baseOptions,
        { value: "jobs_salary_desc" as SortOption, label: "Salary (High to Low)" },
        { value: "jobs_salary_asc" as SortOption, label: "Salary (Low to High)" },
        { value: "jobs_experience" as SortOption, label: "Experience Level" },
        { value: "jobs_deadline" as SortOption, label: "Application Deadline" },
      ];
    case "events":
      return [
        ...baseOptions,
        { value: "events_date" as SortOption, label: "Event Date (Upcoming)" },
        { value: "events_cost" as SortOption, label: "Cost (Low to High)" },
      ];
    case "fundraisers":
      return [
        ...baseOptions,
        { value: "fundraisers_deadline" as SortOption, label: "Deadline (Upcoming)" },
        { value: "fundraisers_progress" as SortOption, label: "Progress (Most Funded)" },
        { value: "fundraisers_amount" as SortOption, label: "Amount Raised (High to Low)" },
      ];
    case "resources":
      return [
        ...baseOptions,
        { value: "resources_difficulty" as SortOption, label: "Difficulty Level" },
        { value: "resources_updated" as SortOption, label: "Last Updated" },
      ];
    default:
      return baseOptions;
  }
};

const parseAmount = (amountStr: string): number => {
  // Remove currency symbols and commas, extract numeric value
  const cleaned = amountStr.replace(/[$,]/g, "").trim();
  const match = cleaned.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
};

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr || dateStr.toLowerCase().includes("coming soon") || dateStr.toLowerCase().includes("ongoing")) {
    return null;
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const experienceLevelOrder = {
  "Entry-level": 1,
  "Mid-level": 2,
  "Senior": 3,
};

const difficultyLevelOrder = {
  "Beginner": 1,
  "Intermediate": 2,
  "Advanced": 3,
};

export const sortListings = (listings: Listing[], sortOption: SortOption): Listing[] => {
  const sorted = [...listings];

  switch (sortOption) {
    case "most_recent":
      return sorted.sort((a, b) => {
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bDate - aDate; // Most recent first
      });

    case "title_asc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));

    case "title_desc":
      return sorted.sort((a, b) => b.title.localeCompare(a.title));

    case "jobs_salary_desc":
      return sorted.sort((a, b) => {
        const jobA = a as JobListing;
        const jobB = b as JobListing;
        return parseAmount(jobB.salary) - parseAmount(jobA.salary);
      });

    case "jobs_salary_asc":
      return sorted.sort((a, b) => {
        const jobA = a as JobListing;
        const jobB = b as JobListing;
        return parseAmount(jobA.salary) - parseAmount(jobB.salary);
      });

    case "jobs_experience":
      return sorted.sort((a, b) => {
        const jobA = a as JobListing;
        const jobB = b as JobListing;
        const levelA = experienceLevelOrder[jobA.experienceLevel] || 0;
        const levelB = experienceLevelOrder[jobB.experienceLevel] || 0;
        return levelB - levelA; // Senior first
      });

    case "jobs_deadline":
      return sorted.sort((a, b) => {
        const jobA = a as JobListing;
        const jobB = b as JobListing;
        const dateA = parseDate(jobA.applicationDeadline || "");
        const dateB = parseDate(jobB.applicationDeadline || "");
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.getTime() - dateB.getTime(); // Soonest first
      });

    case "events_date":
      return sorted.sort((a, b) => {
        const eventA = a as EventListing;
        const eventB = b as EventListing;
        const dateA = parseDate(eventA.date);
        const dateB = parseDate(eventB.date);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.getTime() - dateB.getTime(); // Soonest first
      });

    case "events_cost":
      return sorted.sort((a, b) => {
        const eventA = a as EventListing;
        const eventB = b as EventListing;
        // Handle "Free" events
        if (eventA.cost.toLowerCase().includes("free")) return -1;
        if (eventB.cost.toLowerCase().includes("free")) return 1;
        return parseAmount(eventA.cost) - parseAmount(eventB.cost);
      });

    case "fundraisers_deadline":
      return sorted.sort((a, b) => {
        const fundA = a as FundraiserListing;
        const fundB = b as FundraiserListing;
        const dateA = parseDate(fundA.deadline);
        const dateB = parseDate(fundB.deadline);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.getTime() - dateB.getTime(); // Soonest first
      });

    case "fundraisers_progress":
      return sorted.sort((a, b) => {
        const fundA = a as FundraiserListing;
        const fundB = b as FundraiserListing;
        const progressA = fundA.progressPercentage ?? 0;
        const progressB = fundB.progressPercentage ?? 0;
        return progressB - progressA; // Highest progress first
      });

    case "fundraisers_amount":
      return sorted.sort((a, b) => {
        const fundA = a as FundraiserListing;
        const fundB = b as FundraiserListing;
        return parseAmount(fundB.currentAmount) - parseAmount(fundA.currentAmount);
      });

    case "resources_difficulty":
      return sorted.sort((a, b) => {
        const resA = a as ResourceListing;
        const resB = b as ResourceListing;
        const levelA = difficultyLevelOrder[resA.difficultyLevel] || 0;
        const levelB = difficultyLevelOrder[resB.difficultyLevel] || 0;
        return levelA - levelB; // Beginner first
      });

    case "resources_updated":
      return sorted.sort((a, b) => {
        const resA = a as ResourceListing;
        const resB = b as ResourceListing;
        const dateA = parseDate(resA.lastUpdated || "");
        const dateB = parseDate(resB.lastUpdated || "");
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.getTime() - dateA.getTime(); // Most recently updated first
      });

    default:
      return sorted;
  }
};

