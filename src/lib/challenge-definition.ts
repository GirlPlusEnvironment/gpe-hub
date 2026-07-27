import type { CampChallenge } from "@/lib/camp";

export type ChallengeOpenFlowKind =
  | "external_action"
  | "submission_form"
  | "toolkit"
  | "completion_page";

export type ChallengeOpenFlowDefinition = {
  kind?: ChallengeOpenFlowKind;
  type?: ChallengeOpenFlowKind | "external" | string;
  label?: string;
  url?: string;
  return_url?: string;
  secondary_label?: string;
  secondary_url?: string;
};

export type ChallengeDefinition = {
  hero?: {
    cover_image_url?: string;
    background_color?: string;
    accent_color?: string;
  };
  open_flow?: ChallengeOpenFlowDefinition;
  submission?: {
    enabled?: boolean;
    title?: string;
    instructions?: string;
    type?: string;
    fields?: ChallengeSubmissionField[];
  };
  resources?: {
    toolkit_url?: string;
    petition_url?: string;
    event_url?: string;
    video_url?: string;
  };
  completion?: {
    message?: string;
    url?: string;
    badge_image_url?: string;
    xp_animation?: string;
  };
  notifications?: Record<string, unknown>;
};

export type ChallengeSubmissionFieldType =
  | "text"
  | "textarea"
  | "url"
  | "checkbox"
  | "select"
  | "file"
  | "image"
  | "video_url";

export type ChallengeSubmissionField = {
  id: string;
  type: ChallengeSubmissionFieldType;
  label: string;
  required?: boolean;
  helper_text?: string;
  options?: string[];
  accepted_file_types?: string[];
};

export function challengeMetadata(challenge: CampChallenge | null | undefined) {
  return challenge?.metadata && typeof challenge.metadata === "object" ? challenge.metadata : {};
}

export function challengeDefinition(challenge: CampChallenge | null | undefined): ChallengeDefinition {
  const metadata = challengeMetadata(challenge);
  const definition = metadata.definition;
  return definition && typeof definition === "object" && !Array.isArray(definition)
    ? definition as ChallengeDefinition
    : {};
}

function normalizeOpenFlowKind(value: unknown): ChallengeOpenFlowKind | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "external") return "external_action";
  if (normalized === "external_action" || normalized === "submission_form" || normalized === "toolkit" || normalized === "completion_page") {
    return normalized;
  }
  return null;
}

export function mergeChallengeDefinition(
  metadata: Record<string, unknown>,
  definitionPatch: ChallengeDefinition,
) {
  const currentDefinition = metadata.definition && typeof metadata.definition === "object" && !Array.isArray(metadata.definition)
    ? metadata.definition as ChallengeDefinition
    : {};

  return {
    ...metadata,
    definition: {
      ...currentDefinition,
      ...definitionPatch,
      hero: {
        ...currentDefinition.hero,
        ...definitionPatch.hero,
      },
      open_flow: {
        ...currentDefinition.open_flow,
        ...definitionPatch.open_flow,
      },
      submission: {
        ...currentDefinition.submission,
        ...definitionPatch.submission,
      },
      resources: {
        ...currentDefinition.resources,
        ...definitionPatch.resources,
      },
      completion: {
        ...currentDefinition.completion,
        ...definitionPatch.completion,
      },
      notifications: {
        ...currentDefinition.notifications,
        ...definitionPatch.notifications,
      },
    },
  };
}

function normalizeUrl(url: string | null | undefined) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) return trimmed;
  return `https://${trimmed}`;
}

function inferredOpenFlowKind(challenge: CampChallenge): ChallengeOpenFlowKind {
  const type = String(challenge.submission_type || challenge.category || "").toLowerCase();
  if (type.includes("petition") || challenge.related_kind === "petition") return "external_action";
  if (type.includes("toolkit") || challenge.related_kind === "toolkit") return "toolkit";
  return "submission_form";
}

export function resolveChallengeOpenFlow(challenge: CampChallenge) {
  const definition = challengeDefinition(challenge);
  const openFlow = definition.open_flow || {};
  const resources = definition.resources || {};
  const kind = normalizeOpenFlowKind(openFlow.kind) || normalizeOpenFlowKind(openFlow.type) || inferredOpenFlowKind(challenge);
  const fallbackExternal = normalizeUrl(
    openFlow.url ||
    (kind === "toolkit" ? resources.toolkit_url : null) ||
    (kind === "external_action" ? resources.petition_url : null) ||
    challenge.related_url ||
    challenge.action_url,
  );
  const submissionHref = `/camp-gpe/challenges/${challenge.slug}/submit`;
  const completionHref = `/camp-gpe/challenges/${challenge.slug}?status=complete`;
  const isExternalHref = (href: string) => !href.startsWith("/");

  if (kind === "external_action" || kind === "toolkit") {
    if (!fallbackExternal) {
      return {
        kind,
        label: openFlow.label || challenge.cta_label || (kind === "toolkit" ? "Open Toolkit" : "Open Action"),
        href: "",
        external: false,
        returnHref: submissionHref,
        secondaryLabel: openFlow.secondary_label || "Submit for Points",
        secondaryHref: normalizeUrl(openFlow.secondary_url) || submissionHref,
        invalid: true,
        invalidReason: kind === "toolkit" ? "Toolkit URL is missing." : "External action URL is missing.",
      };
    }
    return {
      kind,
      label: openFlow.label || challenge.cta_label || (kind === "toolkit" ? "Open Toolkit" : "Open Action"),
      href: fallbackExternal,
      external: isExternalHref(fallbackExternal),
      returnHref: normalizeUrl(openFlow.return_url) || submissionHref,
      secondaryLabel: openFlow.secondary_label || "Submit for Points",
      secondaryHref: normalizeUrl(openFlow.secondary_url) || submissionHref,
    };
  }

  if (kind === "completion_page") {
    const href = normalizeUrl(openFlow.url || definition.completion?.url) || completionHref;
    return {
      kind,
      label: openFlow.label || challenge.cta_label || "View Completion",
      href,
      external: isExternalHref(href),
      returnHref: submissionHref,
      secondaryLabel: openFlow.secondary_label || "Submit for Points",
      secondaryHref: normalizeUrl(openFlow.secondary_url) || submissionHref,
    };
  }

  const href = normalizeUrl(openFlow.url) || submissionHref;
  return {
    kind: "submission_form" as const,
    label: openFlow.label || challenge.cta_label || "Submit Challenge",
    href,
    external: isExternalHref(href),
    returnHref: completionHref,
    secondaryLabel: openFlow.secondary_label || "Submit for Points",
    secondaryHref: normalizeUrl(openFlow.secondary_url) || submissionHref,
  };
}

export function describeResolvedChallengeFlow(challenge: CampChallenge) {
  const definition = challengeDefinition(challenge);
  const flow = resolveChallengeOpenFlow(challenge);
  return {
    slug: challenge.slug,
    configuredKind: definition.open_flow?.kind || null,
    configuredType: definition.open_flow?.type || null,
    resolvedKind: flow.kind,
    destination: flow.href,
    external: flow.external,
    submissionEnabled: definition.submission?.enabled !== false,
  };
}

export function defaultSubmissionFields(challenge: CampChallenge): ChallengeSubmissionField[] {
  const type = String(challenge.submission_type || challenge.category || "").toLowerCase();
  if (type.includes("petition")) {
    return [
      { id: "completed_petition", type: "checkbox", label: "I completed the petition", required: true, options: ["yes"] },
      { id: "proof", type: "image", label: "Screenshot or confirmation URL", required: Boolean(challenge.requires_proof) },
    ];
  }
  if (type.includes("video")) {
    return [
      { id: "video_url", type: "video_url", label: "Video URL", required: true },
      { id: "caption", type: "textarea", label: "Caption or description" },
      { id: "proof", type: "image", label: "Screenshot or proof URL", required: Boolean(challenge.requires_proof) },
    ];
  }
  if (type.includes("story") || type.includes("social")) {
    return [
      { id: "story_url", type: "url", label: "Story or post URL", required: true },
      { id: "proof", type: "image", label: "Screenshot URL", required: Boolean(challenge.requires_proof) },
      { id: "notes", type: "textarea", label: "Notes" },
    ];
  }
  if (type.includes("reflection")) {
    return [
      { id: "reflection", type: "textarea", label: "Reflection", required: true },
      { id: "image", type: "image", label: "Image URL", required: Boolean(challenge.requires_proof) },
    ];
  }
  return [
    { id: "proof", type: "url", label: "Proof URL", required: Boolean(challenge.requires_proof) },
    { id: "notes", type: "textarea", label: "Notes" },
  ];
}

export function submissionFieldsForChallenge(challenge: CampChallenge): ChallengeSubmissionField[] {
  const fields = challengeDefinition(challenge).submission?.fields;
  return Array.isArray(fields) && fields.length > 0 ? fields : defaultSubmissionFields(challenge);
}
