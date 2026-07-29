export type ResendLifecycleTemplateKey =
  | "public-action-follow-up"
  | "petition-thank-you"
  | "action-network-petition-thank-you"
  | "event-follow-up"
  | "survey-thank-you"
  | "volunteer-interest"
  | "camp-gpe-submission"
  | "graduate-highlight-submission"
  | "hub-welcome"
  | "complete-your-profile"
  | "first-badge"
  | "member-welcome"
  | "existing-member-hub-invite"
  | "hub-user-nonmember"
  | "hub-activated"
  | "pending-points"
  | "points-earned"
  | "badge-unlocked"
  | "challenge-completed"
  | "weekly-progress"
  | "monthly-digest"
  | "leaderboard-update"
  | "camp-reminder"
  | "become-a-member"
  | "member-anniversary"
  | "renewal-reminder"
  | "win-back"
  | "invite-friend"
  | "invited-friend-joined"
  | "post-event-follow-up"
  | "resource-released"
  | "jobs-digest"
  | "newsletter";

type BaseLifecycleVariables = {
  firstName?: string;
  displayName?: string;
  hubUrl?: string;
  preferencesUrl?: string;
};

export type ResendLifecycleTemplateVariables = {
  "public-action-follow-up": BaseLifecycleVariables & {
    actionName: string;
    takeActionUrl: string;
    communityResourcesUrl: string;
    joinHubUrl: string;
    inviteUrl: string;
  };
  "petition-thank-you": BaseLifecycleVariables & {
    petitionName: string;
    campaignName: string;
    takeActionUrl: string;
  };
  "action-network-petition-thank-you": BaseLifecycleVariables & {
    petitionName: string;
    campaignName: string;
    awardedPoints: string;
    pendingPoints: string;
  };
  "event-follow-up": BaseLifecycleVariables & {
    eventName: string;
    discussionUrl: string;
  };
  "survey-thank-you": BaseLifecycleVariables & {
    surveyName: string;
    communityResourcesUrl: string;
  };
  "volunteer-interest": BaseLifecycleVariables & {
    websiteUrl: string;
  };
  "camp-gpe-submission": BaseLifecycleVariables & {
    submissionName: string;
    campUrl: string;
  };
  "graduate-highlight-submission": BaseLifecycleVariables & {
    communityResourcesUrl: string;
  };
  "hub-welcome": BaseLifecycleVariables & {
    profileUrl: string;
  };
  "complete-your-profile": BaseLifecycleVariables & {
    profileUrl: string;
  };
  "first-badge": BaseLifecycleVariables & {
    badgeName: string;
    badgesUrl: string;
  };
  "member-welcome": BaseLifecycleVariables & {
    invitePageUrl: string;
    membershipId: string;
    membershipTermId: string;
  };
  "existing-member-hub-invite": BaseLifecycleVariables & {
    email: string;
    hubInviteUrl: string;
  };
  "hub-user-nonmember": BaseLifecycleVariables & {
    membershipUrl: string;
    membershipHelpUrl: string;
  };
  "hub-activated": BaseLifecycleVariables;
  "pending-points": BaseLifecycleVariables & {
    points: string;
    actionName: string;
    claimUrl: string;
    recipientEmail: string;
    pendingAwardId: string;
  };
  "points-earned": BaseLifecycleVariables & {
    points: string;
    actionName: string;
    totalPoints: string;
    pointsUrl: string;
    nextActionUrl: string;
    pointEventId: string;
  };
  "badge-unlocked": BaseLifecycleVariables & {
    badgeName: string;
    badgesUrl: string;
  };
  "challenge-completed": BaseLifecycleVariables & {
    challengeTitle: string;
    points: string;
    totalPoints: string;
    nextChallengeUrl: string;
    cabinRank?: string;
    personalRank?: string;
    submissionId: string;
  };
  "weekly-progress": BaseLifecycleVariables & {
    weeklyPoints: string;
    campUrl: string;
  };
  "monthly-digest": BaseLifecycleVariables & {
    monthlyHighlights: string;
  };
  "leaderboard-update": BaseLifecycleVariables & {
    leaderboardPosition: string;
    pointsUrl: string;
  };
  "camp-reminder": BaseLifecycleVariables & {
    campUrl: string;
    challengeTitle: string;
  };
  "become-a-member": BaseLifecycleVariables & {
    membershipUrl: string;
    membershipHelpUrl: string;
  };
  "member-anniversary": BaseLifecycleVariables & {
    anniversaryYear: string;
  };
  "renewal-reminder": BaseLifecycleVariables & {
    renewalUrl: string;
  };
  "win-back": BaseLifecycleVariables & {
    membershipUrl: string;
  };
  "invite-friend": BaseLifecycleVariables & {
    inviterName: string;
    personalNote?: string;
    inviteLandingUrl: string;
    invitationId: string;
  };
  "invited-friend-joined": BaseLifecycleVariables & {
    friendFirstName: string;
    inviterFirstName: string;
    invitationId: string;
    joinedUserId: string;
  };
  "post-event-follow-up": BaseLifecycleVariables & {
    eventName: string;
    discussionUrl: string;
    points?: string;
    eventId: string;
    attendeeId: string;
  };
  "resource-released": BaseLifecycleVariables & {
    resourceTitle: string;
    resourceUrl: string;
  };
  "jobs-digest": BaseLifecycleVariables & {
    jobsUrl: string;
  };
  "newsletter": BaseLifecycleVariables & {
    newsletterUrl: string;
  };
};

export type ResendLifecycleEmailRequest<K extends ResendLifecycleTemplateKey = ResendLifecycleTemplateKey> = {
  templateKey: K;
  recipientEmail: string;
  recipientUserId?: string | null;
  neonAccountId?: string | null;
  eventType: string;
  sourceType?: string | null;
  sourceId?: string | null;
  idempotencyKey: string;
  category: string;
  variables: ResendLifecycleTemplateVariables[K];
};
