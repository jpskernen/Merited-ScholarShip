// src/lib/platform-server.ts
//
// Platform Admin operations (docs/07 §4 provisioning flow, runbook T4):
//   createOrganization -> assignOrgAdmin -> the Org Admin invites reviewers.
// Server-only. UI: src/app/admin/platform/page.tsx (runbook 2.1).
import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/firebase/admin';
import { DEFAULT_ORG_SETTINGS } from './org';
import { setUserClaims, type Caller } from './auth-server';
import { assertCanJoinAsStaff, createInviteFor, resendInviteFor } from './invites-server';
import { writeAudit } from './audit';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/** Creates organizations/{orgId} and its config/settings. Returns the new orgId. */
export async function createOrganizationAs(caller: Caller, rawName: string): Promise<{ orgId: string }> {
  const name = rawName.trim();
  if (name.length < 2) throw new Error('Please enter the organization name.');
  const base = slugify(name);
  if (!base) throw new Error('The organization name must contain letters or numbers.');

  const db = getAdminDb();
  let orgId = base;
  for (let n = 2; (await db.collection('organizations').doc(orgId).get()).exists; n++) orgId = `${base}-${n}`;

  const orgRef = db.collection('organizations').doc(orgId);
  const settings = JSON.parse(JSON.stringify(DEFAULT_ORG_SETTINGS));
  settings.branding.displayName = name;

  const batch = db.batch();
  batch.set(orgRef, { id: orgId, name, status: 'active', createdAt: FieldValue.serverTimestamp(), createdBy: caller.uid });
  batch.set(orgRef.collection('config').doc('settings'), { ...settings, updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();

  await writeAudit({
    organizationId: orgId,
    action: 'Organization created',
    actorId: caller.uid,
    actorName: caller.email,
    targetId: orgId,
    targetType: 'organization',
    subject: name,
  });
  return { orgId };
}

/**
 * Makes `email` the Org Admin of `orgId`. A reviewer of that organization is
 * promoted directly; an email with no account gets an admin invitation. Any
 * other existing account (a student, a member of another organization, an
 * existing admin) is refused by assertCanJoinAsStaff (backlog S-6).
 */
export async function assignOrgAdminAs(caller: Caller, orgId: string, rawEmail: string) {
  const email = rawEmail.trim().toLowerCase();
  const db = getAdminDb();
  if (!(await db.collection('organizations').doc(orgId).get()).exists) throw new Error('Organization not found.');

  const existing = await assertCanJoinAsStaff(email, orgId, 'org_admin');

  if (!existing) {
    const invite = await createInviteFor({ ...caller, orgId }, 'admin', email);
    return { assigned: false as const, invited: true as const, ...invite };
  }

  const batch = db.batch();
  batch.set(db.collection('users').doc(existing.uid), {
    role: 'admin', organizationId: orgId, schoolId: orgId, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  // Kept for the current Firestore rules until runbook T6.
  batch.set(db.collection('roles_admin').doc(existing.uid), {
    id: existing.uid, role: 'admin', organizationId: orgId, schoolId: orgId,
    grantedBy: caller.uid, grantedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();

  await setUserClaims(existing.uid, { orgId, role: 'org_admin' });

  await writeAudit({
    organizationId: orgId,
    action: 'Role granted',
    actorId: caller.uid,
    actorName: caller.email,
    targetId: existing.uid,
    targetType: 'user',
    subject: email,
    details: { role: 'org_admin', grantedBy: 'platform admin' },
  });
  return { assigned: true as const, invited: false as const, uid: existing.uid };
}

/** Re-sends a Pending Org Admin invitation of any organization. */
export async function resendOrgAdminInviteAs(caller: Caller, inviteId: string) {
  const invite = (await getAdminDb().collection('admin_invites').doc(inviteId).get()).data();
  const orgId: string | undefined = invite?.organizationId || invite?.schoolId;
  if (!orgId) throw new Error('Invitation not found.');
  return resendInviteFor({ ...caller, orgId }, 'admin', inviteId);
}
