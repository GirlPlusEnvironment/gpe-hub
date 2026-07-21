export const gpeFormTestFixtures = [
  {
    name: "existing active member with Hub account",
    membershipOutcome: "active_member_existing_hub_user",
    formKey: "camp_gpe"
  },
  {
    name: "active member needing Hub invite",
    membershipOutcome: "active_member_needs_hub_invite",
    formKey: "gpe_grad_highlight"
  },
  {
    name: "inactive or expired member",
    membershipOutcome: "inactive_or_expired_member",
    formKey: "gpe_membership"
  },
  {
    name: "nonmember opting into membership",
    membershipOutcome: "nonmember",
    membershipRequest: { requested: true, consent: true, source: "camp_gpe" }
  },
  {
    name: "nonmember declining membership",
    membershipOutcome: "nonmember",
    membershipRequest: null
  },
  {
    name: "ambiguous duplicate email",
    membershipOutcome: "ambiguous_account",
    expectedSubmissionStatus: "requires_manual_review"
  },
  {
    name: "Neon unavailable after Supabase save",
    expectedSubmissionStatus: "partial_failure",
    neonSyncStatus: "failed"
  },
  {
    name: "repeated idempotent form submission",
    duplicate: true
  },
  {
    name: "duplicate Camp GPE registration",
    formKey: "camp_gpe",
    registrationState: "already_registered"
  },
  {
    name: "first-time Camp GPE registration",
    formKey: "camp_gpe",
    registrationState: "not_registered"
  },
  {
    name: "donation by member",
    formKey: "donation",
    paymentStatus: "payment_required",
    membershipOutcome: "active_member_existing_hub_user"
  },
  {
    name: "donation by nonmember",
    formKey: "donation",
    paymentStatus: "payment_required",
    membershipOutcome: "nonmember"
  },
  {
    name: "membership renewal or reactivation path",
    formKey: "gpe_membership",
    membershipOutcome: "inactive_or_expired_member",
    expectedBehavior: "do not create duplicate active membership; save request for configured renewal/reactivation"
  }
] as const;
