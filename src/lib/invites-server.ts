// src/lib/invites-server.ts
//
// Reviewer and admin invitations (docs/07 §3.2, runbook T4). Server-only:
//  - invites store no password and nothing is sent to an AI model (S8);
//  - the invitee chooses their own password when accepting;
//  - the account, the role claims and the role documents are written here,
//    with the Admin SDK, never by the invitee's browser.
import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import { sendInvitationEmail } from '@/app/lib/notifications';
import { appLink } from './app-url';
import { profileRoleFor, requireUser, setUserClaims, type Caller } from './auth-server';
import { staffEligibilityError, type StaffRole } from './staff-eligibility';

export type InviteKind = 'reviewer' | 'admin';

const INVITE_DAYS = 14;

const COLLECTION: Record<InviteKind, 'invites' | 'admin_invites'> = { reviewer: 'invites', admin: 'admin_invites' };
const ROLE: Record<InviteKind, StaffRole> = { reviewer: 'reviewer', admin: 'org_admin' };
// users.role uses 'admin' where the claim says 'org_admin' (profileRoleFor).
const PROFILE_TO_CLAIM_ROLE: Record<string, string> = { admin: 'org_admin', reviewer: 'reviewer', applicant: 'applicant' };
const ROLE_DOC: Record<InviteKind, 'reviewers' | 'roles_admin'> = { reviewer: 'reviewers', admin: 'roles_admin' };
const PATH: Record<InviteKind, string> = { reviewer: '/reviewer/invite/', admin: '/admin/invite/' };

/** A refusal whose message is safe to show to the person sending or accepting the invite. */
export class StaffEligibilityError extends Error {}

/**
 * One email, one account, one organization, one role (docs/07 D1, backlog S-6).
 * Throws StaffEligibilityError if `email` may not become `role` in `orgId`
 * (the rules are in ./staff-eligibility). Returns the existing account, or
 * null if there is none.
 *
 * The account's organization and role come from its claims, falling back to
 * its profile for an account the claims backfill never reached.
 */
export async function assertCanJoinAsStaff(rawEmail: string, orgId: string, role: StaffRole) {
  const email = rawEmail.trim().toLowerCase();
  let account;
  try {
    account = await getAdminAuth().getUserByEmail(email);
  } catch (err: any) {
    if (err?.code === 'auth/user-not-found') return null;
    throw err;
  }

  const claims = account.customClaims || {};
  const profile = (await getAdminDb().collection('users').doc(account.uid).get()).data() || {};
  const refusal = staffEligibilityError(email, {
    orgId: claims.orgId || profile.organizationId || profile.schoolId || null,
    role: claims.role || PROFILE_TO_CLAIM_ROLE[profile.role] || null,
  }, orgId, role);
  if (refusal) throw new StaffEligibilityError(refusal);
  return account;
}

/** Link built on the server (src/lib/app-url.ts), never from a URL the browser sends. */
function inviteLink(kind: InviteKind, inviteId: string): Promise<string> {
  return appLink(PATH[kind] + inviteId);
}

function inviteEmail(kind: InviteKind, link: string, orgName: string) {
  const what = kind === 'admin' ? 'an administrator' : 'a scholarship reviewer';
  const subject = kind === 'admin'
    ? `You're invited to administer ${orgName} on Merited`
    : `You're invited to review scholarship applications for ${orgName}`;
  const body = [
    'Hello,',
    '',
    `You have been invited to join ${orgName} on Merited as ${what}.`,
    '',
    `Open this link to set your password and activate your account. The link expires in ${INVITE_DAYS} days:`,
    link,
    '',
    'If you were not expecting this invitation, you can ignore this email.',
  ].join('\n');
  return { subject, body };
}

async function orgName(orgId: string): Promise<string> {
  const snap = await getAdminDb().collection('organizations').doc(orgId).get();
  return (snap.exists && snap.data()!.name) || 'your organization';
}

async function sendInvite(kind: InviteKind, inviteId: string, email: string, orgId: string) {
  const link = await inviteLink(kind, inviteId);
  const { subject, body } = inviteEmail(kind, link, await orgName(orgId));
  const result = await sendInvitationEmail({ email, subject, body, role: kind === 'admin' ? 'Admin' : 'Reviewer' });
  if (result.success) {
    await getAdminDb().collection(COLLECTION[kind]).doc(inviteId).update({
      emailSent: true,
      lastEmailSentAt: FieldValue.serverTimestamp(),
    });
  }
  return { link, emailSent: !!result.success, method: (result as { method?: string }).method ?? null };
}

/** Creates a Pending invite in the inviter's organization and emails the link. */
export async function createInviteFor(inviter: Caller & { orgId: string }, kind: InviteKind, rawEmail: string) {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');

  const db = getAdminDb();
  const pending = await db.collection(COLLECTION[kind])
    .where('email', '==', email).where('status', '==', 'Pending').limit(1).get();
  if (!pending.empty) throw new Error('There is already a pending invitation for this email.');
  await assertCanJoinAsStaff(email, inviter.orgId, ROLE[kind]);

  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);
  const ref = await db.collection(COLLECTION[kind]).add({
    email,
    role: ROLE[kind],
    organizationId: inviter.orgId,
    schoolId: inviter.orgId,
    status: 'Pending',
    emailSent: false,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: inviter.uid,
    expiresAt,
  });
  return { inviteId: ref.id, ...(await sendInvite(kind, ref.id, email, inviter.orgId)) };
}

/** Re-sends an existing Pending invite from the inviter's own organization. */
export async function resendInviteFor(inviter: Caller & { orgId: string }, kind: InviteKind, inviteId: string) {
  const snap = await getAdminDb().collection(COLLECTION[kind]).doc(inviteId).get();
  const invite = snap.data();
  if (!invite || (invite.organizationId || invite.schoolId) !== inviter.orgId) throw new Error('Invitation not found.');
  if (invite.status !== 'Pending') throw new Error('This invitation has already been used.');
  // The email may have been registered since the invite was created.
  await assertCanJoinAsStaff(invite.email, inviter.orgId, ROLE[kind]);
  return sendInvite(kind, inviteId, invite.email, inviter.orgId);
}

function inviteExpired(invite: FirebaseFirestore.DocumentData): boolean {
  const expires = invite.expiresAt?.toDate?.()
    ?? (invite.createdAt?.toDate ? new Date(invite.createdAt.toDate().getTime() + INVITE_DAYS * 86400000) : null);
  return !!expires && expires.getTime() < Date.now();
}

export type AcceptResult =
  | { success: true; email: string }
  | { success: false; code: 'invalid' | 'used' | 'expired' | 'account-exists' | 'wrong-account' | 'other-org' | 'not-eligible' | 'input'; error: string };

/**
 * Accepts an invite. Two ways in:
 *  - new account: `details` has the name and password the invitee chose;
 *  - existing account: the invitee is signed in and passes their ID token,
 *    whose email must match the invite.
 */
export async function acceptInviteAs(
  kind: InviteKind,
  inviteId: string,
  details: { name: string; password: string } | null,
  idToken?: string,
): Promise<AcceptResult> {
  const db = getAdminDb();
  const auth = getAdminAuth();
  const inviteRef = db.collection(COLLECTION[kind]).doc(inviteId);
  const invite = (await inviteRef.get()).data();

  if (!invite) return { success: false, code: 'invalid', error: 'This invitation link is not valid.' };
  if (invite.status !== 'Pending') return { success: false, code: 'used', error: 'This invitation has already been used. Please sign in instead.' };
  if (inviteExpired(invite)) return { success: false, code: 'expired', error: 'This invitation has expired. Ask your administrator to send a new one.' };

  const orgId: string | undefined = invite.organizationId || invite.schoolId;
  if (!orgId) return { success: false, code: 'invalid', error: 'This invitation is not linked to an organization.' };
  const email = String(invite.email).toLowerCase();
  const role = ROLE[kind];

  let uid: string;
  let name: string;
  let isNew = false;

  if (idToken) {
    const caller = await requireUser(idToken);
    if (caller.email !== email) {
      return { success: false, code: 'wrong-account', error: `This invitation is for ${email}. Sign in with that account to accept it.` };
    }
    if (caller.orgId && caller.orgId !== orgId) {
      return { success: false, code: 'other-org', error: 'Your account already belongs to another organization.' };
    }
    // Also refuses a student account, which would otherwise turn into staff
    // here, including through an invite sent before this check existed.
    try {
      await assertCanJoinAsStaff(email, orgId, role);
    } catch (err) {
      if (err instanceof StaffEligibilityError) return { success: false, code: 'not-eligible', error: err.message };
      throw err;
    }
    uid = caller.uid;
    name = (await auth.getUser(uid)).displayName || '';
  } else {
    if (!details?.name?.trim()) return { success: false, code: 'input', error: 'Please enter your full name.' };
    if (!details.password || details.password.length < 8) return { success: false, code: 'input', error: 'Your password must be at least 8 characters.' };
    try {
      // The link was emailed to this address, so opening it proves the inbox.
      const user = await auth.createUser({ email, password: details.password, displayName: details.name.trim(), emailVerified: true });
      uid = user.uid;
      name = details.name.trim();
      isNew = true;
    } catch (err: any) {
      if (err?.code === 'auth/email-already-exists') {
        return { success: false, code: 'account-exists', error: 'An account with this email already exists. Sign in with it, then open this invitation link again.' };
      }
      throw err;
    }
  }

  const batch = db.batch();
  batch.set(db.collection('users').doc(uid), {
    id: uid,
    ...(name ? { name } : {}),
    email,
    role: profileRoleFor(role),
    organizationId: orgId,
    schoolId: orgId,
    ...(isNew ? { createdAt: FieldValue.serverTimestamp() } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  // Kept for the current Firestore rules, which still read these documents.
  // The rules move to claims in runbook T6.
  batch.set(db.collection(ROLE_DOC[kind]).doc(uid), {
    id: uid,
    role: profileRoleFor(role),
    organizationId: orgId,
    schoolId: orgId,
    assignedByInvite: inviteId,
    assignedDate: FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.update(inviteRef, { status: 'Accepted', acceptedAt: FieldValue.serverTimestamp(), acceptedBy: uid });
  await batch.commit();

  await setUserClaims(uid, { orgId, role });
  return { success: true, email };
}
