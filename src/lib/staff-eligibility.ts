// src/lib/staff-eligibility.ts
//
// One email, one account, one organization, one role (docs/07 D1, backlog S-6).
// The decision used when inviting, assigning or accepting staff, kept free of
// Firebase so it can be unit-tested (tests/unit/staff-eligibility.test.mjs).
// The lookups live in assertCanJoinAsStaff (src/lib/invites-server.ts).

export type StaffRole = 'reviewer' | 'org_admin';

/** The existing account's organization and role, from its claims or profile. */
export type ExistingAccount = { orgId: string | null; role: string | null };

/**
 * Returns why `email` can't become `role` in `orgId`, or null if it can.
 * The only change allowed for an existing account is a reviewer of the same
 * organization becoming its administrator.
 */
export function staffEligibilityError(
  email: string,
  account: ExistingAccount,
  orgId: string,
  role: StaffRole,
): string | null {
  if (account.orgId && account.orgId !== orgId) {
    return `${email} already has an account in another organization. Use a different email.`;
  }
  if (account.role === 'org_admin') {
    return `${email} is already an administrator of this organization.`;
  }
  if (account.role === 'reviewer') {
    return role === 'reviewer' ? `${email} is already a reviewer of this organization.` : null;
  }
  // An applicant, or an account that never finished setting up. Signup only
  // creates student accounts, so both are treated as students.
  return `${email} is already registered as a student account. Staff need a different email.`;
}
