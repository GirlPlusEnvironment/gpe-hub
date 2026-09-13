import assert from "node:assert/strict";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function reconciliationStatus(identity) {
  if (identity.conflictingProfiles > 1 || identity.conflictingNeonAccounts > 1) return "needs_reconciliation";
  if (identity.profileId && identity.neonAccountId) return "matched";
  if (!identity.profileId && (identity.neonAccountId || identity.neonMembershipStatus === "active")) return "missing_hub";
  if (identity.profileId && !identity.neonAccountId) return "missing_neon";
  return "unmatched";
}

function manualAwardIdempotencyKey(profileId, timestamp, randomSuffix) {
  return `hub-members:${profileId}:${timestamp}:${randomSuffix}`;
}

assert.equal(normalizeEmail("  STAFF@GirlPlusEnvironment.ORG "), "staff@girlplusenvironment.org");
assert.equal(reconciliationStatus({ profileId: "hub-1", neonAccountId: "123" }), "matched");
assert.equal(reconciliationStatus({ profileId: null, neonAccountId: "123" }), "missing_hub");
assert.equal(reconciliationStatus({ profileId: "hub-1", neonAccountId: null }), "missing_neon");
assert.equal(reconciliationStatus({ profileId: "hub-1", neonAccountId: "123", conflictingProfiles: 2 }), "needs_reconciliation");
assert.equal(reconciliationStatus({ profileId: null, neonAccountId: null, neonMembershipStatus: "active" }), "missing_hub");

const keyA = manualAwardIdempotencyKey("profile-1", 123, "a");
const keyB = manualAwardIdempotencyKey("profile-1", 123, "b");
assert.match(keyA, /^hub-members:profile-1:123:a$/);
assert.notEqual(keyA, keyB);

console.log("hub participant reconciliation tests passed");
