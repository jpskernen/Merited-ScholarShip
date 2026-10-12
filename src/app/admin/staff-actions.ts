'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import { AuthError, profileRoleFor, requireOrgRole, setUserClaims } from '@/lib/auth-server';
import { writeAudit } from '@/lib/audit';

export type StaffKind = 'reviewer' | 'admin';

const PROFILE_ROLE: Record<StaffKind, 'reviewer' | 'admin'> = { reviewer: 'reviewer', admin: 'admin' };
const CLAIM_ROLE: Record<StaffKind, 'reviewer' | 'org_admin'> = { reviewer: 'reviewer', admin: 'org_admin' };
const ROLE_DOC: Record<StaffKind, 'reviewers' | 'roles_admin'> = { reviewer: 'reviewers', admin: 'roles_admin' };

export type StaffMember = {
  uid: string;
  name: string | null;
  email: string | null;
  claimOrgId: string | null;
  claimRole: string | null;
  claimsOk: boolean;
  panels: number;
};

function failure(error: unknown) {
  if (!(error instanceof AuthError) && !(error instanceof StaffActionError)) {
    console.error('Staff action failed:', error);
  }
  const message = error instanceof AuthError || error instanceof StaffActionError
    ? error.message
    : 'Something went wrong. Please try again.';
  return { success: false as const, error: message };
}

class StaffActionError extends Error {}

export async function listStaff(idToken: string, kind: StaffKind) {
  try {
    const caller = await requireOrgRole(idToken, ['org_admin']);
    const db = getAdminDb();

    const snapshot = await db.collection('users')
      .where('organizationId', '==', caller.orgId)
      .where('role', '==', PROFILE_ROLE[kind])
      .get();

    const programs = kind === 'reviewer'
      ? (await db.collection('programs').where('organizationId', '==', caller.orgId).get()).docs
      : [];

    const members: StaffMember[] = await Promise.all(snapshot.docs.map(async (docSnap) => {
      const profile = docSnap.data();
      let claims: Record<string, any> = {};
      let authEmail: string | null = null;
      try {
        const account = await getAdminAuth().getUser(docSnap.id);
        claims = account.customClaims || {};
        authEmail = account.email ?? null;
      } catch {}
      return {
        uid: docSnap.id,
        name: profile.name ?? null,
        email: authEmail || profile.email || null,
        claimOrgId: typeof claims.orgId === 'string' ? claims.orgId : null,
        claimRole: typeof claims.role === 'string' ? claims.role : null,
        claimsOk: claims.orgId === caller.orgId && claims.role === CLAIM_ROLE[kind],
        panels: programs.filter((program) => (program.data().reviewerIds || []).includes(docSnap.id)).length,
      };
    }));

    members.sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''));
    return { success: true as const, members };
  } catch (error) {
    return failure(error);
  }
}

export async function repairStaffAccount(idToken: string, kind: StaffKind, uid: string) {
  try {
    const caller = await requireOrgRole(idToken, ['org_admin']);
    const db = getAdminDb();

    const profileSnap = await db.collection('users').doc(uid).get();
    const profile = profileSnap.data();
    if (!profileSnap.exists || !profile) throw new StaffActionError('That account no longer exists.');

    const profileOrg = profile.organizationId || profile.schoolId;
    if (profileOrg !== caller.orgId) throw new StaffActionError('That account belongs to another organization.');
    if (profile.role !== PROFILE_ROLE[kind]) {
      throw new StaffActionError(`That account is not a ${kind === 'admin' ? 'administrator' : 'reviewer'} of this organization.`);
    }

    await setUserClaims(uid, { orgId: caller.orgId, role: CLAIM_ROLE[kind] });
    await db.collection(ROLE_DOC[kind]).doc(uid).set({
      id: uid,
      role: PROFILE_ROLE[kind],
      organizationId: caller.orgId,
      schoolId: caller.orgId,
      repairedAt: FieldValue.serverTimestamp(),
      repairedBy: caller.uid,
    }, { merge: true });

    await writeAudit({
      organizationId: caller.orgId,
      action: 'Role granted',
      actorId: caller.uid,
      actorName: caller.email,
      targetId: uid,
      targetType: 'user',
      subject: profile.email || null,
      details: { role: CLAIM_ROLE[kind], grantedBy: 'repair' },
    });

    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function removeStaffAccess(idToken: string, kind: StaffKind, uid: string) {
  try {
    const caller = await requireOrgRole(idToken, ['org_admin']);
    const db = getAdminDb();

    if (uid === caller.uid) {
      throw new StaffActionError('You cannot remove your own access. Ask another administrator to do it.');
    }

    const profileSnap = await db.collection('users').doc(uid).get();
    const profile = profileSnap.data();
    if (!profileSnap.exists || !profile) throw new StaffActionError('That account no longer exists.');

    const profileOrg = profile.organizationId || profile.schoolId;
    if (profileOrg !== caller.orgId) throw new StaffActionError('That account belongs to another organization.');
    if (profile.role !== PROFILE_ROLE[kind]) {
      throw new StaffActionError('That account no longer holds this role.');
    }

    if (kind === 'admin') {
      const admins = await db.collection('users')
        .where('organizationId', '==', caller.orgId)
        .where('role', '==', 'admin')
        .count().get()
        .then((result) => result.data().count)
        .catch(() => null);
      if (admins !== null && admins <= 1) {
        throw new StaffActionError('This is the only administrator of the organization. Add another one first.');
      }
    }

    const batch = db.batch();
    batch.set(db.collection('users').doc(uid), {
      role: 'revoked',
      accessRemovedAt: FieldValue.serverTimestamp(),
      accessRemovedBy: caller.uid,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    batch.delete(db.collection(ROLE_DOC[kind]).doc(uid));

    let panels = 0;
    if (kind === 'reviewer') {
      const programs = await db.collection('programs').where('organizationId', '==', caller.orgId).get();
      programs.docs.forEach((program) => {
        if ((program.data().reviewerIds || []).includes(uid)) {
          panels += 1;
          batch.update(program.ref, { reviewerIds: FieldValue.arrayRemove(uid), updatedAt: FieldValue.serverTimestamp() });
        }
      });
    }
    await batch.commit();

    await getAdminAuth().setCustomUserClaims(uid, {});

    await writeAudit({
      organizationId: caller.orgId,
      action: 'Staff access removed',
      actorId: caller.uid,
      actorName: caller.email,
      targetId: uid,
      targetType: 'user',
      subject: profile.email || profile.name || null,
      details: { role: profileRoleFor(CLAIM_ROLE[kind]), panelsRemovedFrom: panels },
    });

    return { success: true as const, panels };
  } catch (error) {
    return failure(error);
  }
}
