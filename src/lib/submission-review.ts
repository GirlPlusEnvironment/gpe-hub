import {
  approveCampSubmissionAction,
  markCampSubmissionAction,
  reopenCampSubmissionAction,
} from "@/lib/camp";
import type { ReviewStatus } from "@/lib/review-status";

export type SubmissionType =
  | "camp"
  | "petition"
  | "event"
  | "listing"
  | "funding"
  | "resource";

export type ReviewSubmissionTarget = {
  id: string;
  type: SubmissionType;
};

export async function approveSubmission(
  submission: ReviewSubmissionTarget,
  params: { reviewerNotes?: string | null; points?: number | null },
) {
  if (submission.type === "camp") {
    await approveCampSubmissionAction({
      actionId: submission.id,
      notes: params.reviewerNotes,
      points: params.points,
    });
    return;
  }

  throw new Error(`${submission.type} approval is waiting for the unified review migration.`);
}

export async function updateSubmissionStatus(
  submission: ReviewSubmissionTarget,
  params: { status: Exclude<ReviewStatus, "pending" | "approved" | "archived">; reviewerNotes?: string | null },
) {
  if (submission.type === "camp") {
    await markCampSubmissionAction({
      actionId: submission.id,
      status: params.status,
      notes: params.reviewerNotes,
    });
    return;
  }

  throw new Error(`${submission.type} review is waiting for the unified review migration.`);
}

export async function reopenSubmission(
  submission: ReviewSubmissionTarget,
  params: { reviewerNotes?: string | null },
) {
  if (submission.type === "camp") {
    await reopenCampSubmissionAction({
      actionId: submission.id,
      notes: params.reviewerNotes,
    });
    return;
  }

  throw new Error(`${submission.type} reopening is waiting for the unified review migration.`);
}
