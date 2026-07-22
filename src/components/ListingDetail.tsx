import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Briefcase,
  Building,
  Calendar,
  DollarSign,
  Download,
  ExternalLink,
  FileText,
  Heart,
  Play,
  Share2,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShareDialog } from "@/components/ShareDialog";
import { CampButton, Sticker, Tape } from "@/components/camp/CampDesign";
import { cn } from "@/lib/utils";
import { gpeCategoryConfig } from "@/lib/gpe";
import type { EventListing, FundraiserListing, JobListing, Listing, ResourceListing } from "@/types/listings";

interface ListingDetailProps {
  listing: Listing;
  onBack: () => void;
  isFavorited: boolean;
  isPending?: boolean;
  onToggleFavorite: (id: string) => void;
  relatedListings?: Listing[];
}

const categoryIcon = {
  jobs: Briefcase,
  events: Calendar,
  fundraisers: Building,
  resources: FileText,
};

const cleanText = (value?: string | null) => value?.trim() || "";

const normalizeExternalUrl = (value?: string | null) => {
  const trimmed = cleanText(value);
  if (!trimmed) return "";
  if (/^(https?:)?\/\//i.test(trimmed)) {
    return trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  }
  if (/^mailto:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const formatDate = (value?: string | null) => {
  const text = cleanText(value);
  if (!text) return "";
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return text;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
};

const DetailField = ({ label, value }: { label: string; value?: string | null }) => {
  const text = cleanText(value);
  if (!text) return null;
  return (
    <div className="rounded-[1.25rem] border-[3px] border-black bg-white px-4 py-3 shadow-gpe-sm">
      <div className="text-[10px] font-black uppercase text-black/55">{label}</div>
      <div className="mt-1 break-words text-sm font-black text-black">{text}</div>
    </div>
  );
};

const DetailList = ({ title, items }: { title: string; items?: string[] }) => {
  const visible = (items ?? []).map(cleanText).filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <section className="gpe-card bg-white p-5">
      <Tape>{title}</Tape>
      <ul className="mt-4 space-y-3">
        {visible.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-3 text-sm font-bold leading-relaxed text-black/75">
            <span className="mt-1 h-3 w-3 shrink-0 rounded-full border-[2px] border-black bg-gpe-yellow" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

const relatedPath = (listing: Listing) => {
  if (listing.category === "jobs") return `/jobs/${listing.id}`;
  if (listing.category === "resources") {
    return listing.resourceType === "Toolkit" ? `/toolkits/${listing.id}` : `/resources/${listing.id}`;
  }
  if (listing.category === "fundraisers") return `/funding/${listing.id}`;
  if (listing.category === "events") return `/events/${listing.id}`;
  return `/listing/${listing.id}`;
};

const resourceCta = (resource: ResourceListing) => {
  const type = resource.resourceType.toLowerCase();
  if (type.includes("toolkit")) return { label: "Open Toolkit", icon: FileText };
  if (type.includes("video")) return { label: "Watch Video", icon: Play };
  if (type.includes("guide") || type.includes("handbook")) return { label: "Download Guide", icon: Download };
  if (type.includes("article")) return { label: "Read Article", icon: FileText };
  return { label: "Open Resource", icon: ExternalLink };
};

const hasClosed = (value?: string | null) => {
  const text = cleanText(value);
  if (!text || /ongoing|rolling/i.test(text)) return false;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) && parsed < Date.now();
};

type DetailConfig = {
  label: string;
  backLabel: string;
  organizationLabel: string;
  organization?: string;
  source?: string;
  externalUrl?: string;
  cta: { label: string; icon: typeof ExternalLink; closedLabel?: string; isClosed?: boolean };
  summaryLabel: string;
  fields: Array<{ label: string; value?: string | null }>;
  lists: Array<{ title: string; items?: string[] }>;
};

const buildDetailConfig = (listing: Listing): DetailConfig => {
  if (listing.category === "jobs") {
    const job = listing as JobListing;
    return {
      label: "Job Detail",
      backLabel: "jobs",
      organizationLabel: "Organization",
      organization: job.company,
      source: job.source,
      externalUrl: job.applicationUrl,
      cta: { label: "Apply on Organization Website", icon: ExternalLink },
      summaryLabel: "Description",
      fields: [
        { label: "Location", value: job.location },
        { label: "Work style", value: job.workArrangement || job.jobType },
        { label: "Employment type", value: job.jobType },
        { label: "Compensation", value: job.salary },
        { label: "Deadline", value: job.applicationDeadline },
        { label: "Posted", value: formatDate(job.postingDate || listing.created_at) },
        { label: "Application URL", value: normalizeExternalUrl(job.applicationUrl) },
      ],
      lists: [
        { title: "Responsibilities", items: job.responsibilities },
        { title: "Qualifications", items: job.qualifications?.length ? job.qualifications : job.requirements },
        { title: "Benefits", items: job.benefits },
      ],
    };
  }

  if (listing.category === "resources") {
    const resource = listing as ResourceListing;
    return {
      label: resource.resourceType === "Toolkit" ? "Toolkit Detail" : "Resource Detail",
      backLabel: "resources",
      organizationLabel: "Source",
      organization: resource.author || resource.source,
      source: resource.source,
      externalUrl: resource.downloadUrl,
      cta: resourceCta(resource),
      summaryLabel: resource.resourceType === "Toolkit" ? "Toolkit overview" : "Summary",
      fields: [
        { label: "Resource type", value: resource.resourceType },
        { label: "Topic", value: resource.topic },
        { label: "Audience", value: resource.audience },
        { label: "Published", value: formatDate(resource.publicationDate) },
        { label: "Updated", value: formatDate(resource.lastUpdated) },
        { label: "File size", value: resource.fileSize },
        { label: "External source", value: normalizeExternalUrl(resource.downloadUrl) },
      ],
      lists: [],
    };
  }

  if (listing.category === "fundraisers") {
    const funding = listing as FundraiserListing;
    const isClosed = hasClosed(funding.deadline);
    return {
      label: "Funding Detail",
      backLabel: "funding",
      organizationLabel: "Organization",
      organization: funding.organizer,
      source: funding.source,
      externalUrl: funding.donationUrl,
      cta: { label: "Apply for Funding", icon: DollarSign, closedLabel: "Applications Closed", isClosed },
      summaryLabel: "Funding overview",
      fields: [
        { label: "Funding type", value: funding.fundingType },
        { label: "Amount or award range", value: funding.awardRange || funding.goalAmount },
        { label: "Eligibility", value: funding.eligibility },
        { label: "Deadline", value: funding.deadline },
        { label: "Rolling or fixed", value: funding.rollingOrFixed },
        { label: "Geographic eligibility", value: funding.geographicEligibility },
        { label: "Target audience", value: funding.targetAudience },
        { label: "Climate focus", value: funding.climateFocus },
        { label: "Source", value: funding.source },
      ],
      lists: [
        { title: "Application requirements", items: funding.applicationRequirements },
        { title: "Updates", items: funding.updates },
      ],
    };
  }

  const event = listing as EventListing;
  const isClosed = hasClosed(event.registrationDeadline);
  return {
    label: "Event Detail",
    backLabel: "events",
    organizationLabel: "Host",
    organization: event.organizer,
    externalUrl: event.registrationUrl,
    cta: { label: "Register for Event", icon: Calendar, closedLabel: "Registration Closed", isClosed },
    summaryLabel: "Event overview",
    fields: [
      { label: "Host organization", value: event.organizer },
      { label: "Event type", value: event.eventType },
      { label: "Format", value: event.format },
      { label: "Location", value: event.location },
      { label: "Date", value: formatDate(event.date) },
      { label: "Time", value: event.time },
      { label: "Timezone", value: event.timezone },
      { label: "Registration deadline", value: formatDate(event.registrationDeadline) },
      { label: "Cost", value: event.cost },
    ],
    lists: [
      { title: "Speakers", items: event.speakers },
      { title: "Agenda", items: event.agenda },
    ],
  };
};

const ListingDetail = ({
  listing,
  onBack,
  isFavorited,
  isPending = false,
  onToggleFavorite,
  relatedListings = [],
}: ListingDetailProps) => {
  const Icon = categoryIcon[listing.category];
  const categoryConfig = gpeCategoryConfig[listing.category];
  const tags = listing.tags ?? [];
  const isJob = listing.category === "jobs";
  const isResource = listing.category === "resources";
  const job = isJob ? (listing as JobListing) : null;
  const config = buildDetailConfig(listing);
  const externalUrl = normalizeExternalUrl(config.externalUrl);
  const CtaIcon = config.cta.icon;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CampButton variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to {config.backLabel}
        </CampButton>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => onToggleFavorite(listing.id)}
            disabled={isPending}
          >
            <Heart className={cn("mr-2 h-4 w-4", isFavorited && "fill-red-500 text-red-500")} />
            {isFavorited ? "Saved" : `Save ${config.backLabel.replace(/s$/, "")}`}
          </Button>
          <ShareDialog listingId={listing.id}>
            <Button variant="outline">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </ShareDialog>
        </div>
      </div>

      <section className="gpe-card overflow-hidden bg-white">
        <div className={cn("grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]", categoryConfig.surface)}>
          <div className="border-b-[4px] border-black bg-white p-5 sm:p-7 lg:border-b-0 lg:border-r-[4px]">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <Sticker accent="yellow" rotate="none">
                <Icon className="mr-2 h-4 w-4" />
                {config.label}
              </Sticker>
              {config.source && <Badge className="border-[3px] border-black bg-gpe-cyan text-black">{config.source}</Badge>}
            </div>
            <h1 className="max-w-4xl break-words font-header text-4xl uppercase leading-none sm:text-5xl lg:text-6xl">
              {listing.title}
            </h1>
            {config.organization && (
              <p className="mt-4 max-w-3xl text-lg font-black text-black/70">
                {config.organization}
              </p>
            )}
            {cleanText(listing.summary) && (
              <p className="mt-5 max-w-3xl text-base font-bold leading-relaxed text-black/70">
                {listing.summary}
              </p>
            )}
          </div>

          <aside className="bg-gpe-yellow p-5 sm:p-7">
            <div className="mb-5 flex items-center gap-4">
              {job?.organizationLogo ? (
                <img
                  src={normalizeExternalUrl(job.organizationLogo)}
                  alt={`${job.company || "Organization"} logo`}
                  className="h-16 w-16 rounded-[1rem] border-[3px] border-black bg-white object-contain p-1"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-[1rem] border-[3px] border-black bg-white">
                  <Building className="h-8 w-8" />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase text-black/55">
                  {config.organizationLabel}
                </div>
                <div className="break-words text-sm font-black">
                  {config.organization || "Not specified"}
                </div>
              </div>
            </div>

            {config.cta.isClosed ? (
              <div className="rounded-full border-[3px] border-black bg-white px-4 py-3 text-center text-sm font-black uppercase shadow-gpe-sm">
                {config.cta.closedLabel}
              </div>
            ) : externalUrl ? (
              <CampButton asChild className="w-full">
                <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                  <CtaIcon className="mr-2 h-4 w-4" />
                  {config.cta.label} ↗
                </a>
              </CampButton>
            ) : null}
          </aside>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="gpe-card bg-white p-5 sm:p-6">
            <Tape>{config.summaryLabel}</Tape>
            <p className="mt-4 whitespace-pre-wrap text-sm font-bold leading-relaxed text-black/75 sm:text-base">
              {listing.description}
            </p>
          </section>

          {config.lists.map((list) => (
            <DetailList key={list.title} title={list.title} items={list.items} />
          ))}
        </div>

        <aside className="space-y-5">
          <section className="gpe-card bg-white p-5">
            <Tape>At a glance</Tape>
            <div className="mt-4 grid gap-3">
              {config.fields.map((field) => (
                <DetailField key={field.label} label={field.label} value={field.value} />
              ))}
            </div>
          </section>

          {tags.length > 0 && (
            <section className="gpe-card bg-white p-5">
              <Tape>Tags</Tape>
              <div className="mt-4 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag} className="border-[3px] border-black bg-white text-black">
                    <Tag className="mr-1 h-3 w-3" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>

      {relatedListings.length > 0 && (
        <section className="space-y-4">
          <Sticker accent="cyan" rotate="none">
            Related {config.backLabel}
          </Sticker>
          <div className="grid gap-4 md:grid-cols-3">
            {relatedListings.map((related) => (
              <Link key={related.id} to={relatedPath(related)} className="gpe-card gpe-hover-lift bg-white p-5">
                <div className="text-[10px] font-black uppercase text-black/55">
                  {related.category}
                </div>
                <h2 className="mt-2 line-clamp-2 font-header text-xl uppercase leading-tight">
                  {related.title}
                </h2>
                <p className="mt-3 line-clamp-3 text-sm font-bold text-black/65">
                  {related.summary || related.description}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ListingDetail;
