// src/lib/org-switch-server.ts
//
// An applicant's organization is fixed at signup (docs/07 D7: one
// organization per student). This is the escape hatch for a student who
// picked the wrong one: they ask, a platform admin approves or denies.
// Server-only. UI: (main)/settings (request) and admin/platform (resolve).
import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/firebase/admin';
import { requireOrgRole, setUserClaims, type Caller } from '@/lib/auth-server';
import { getActiveOrganization } from '@/lib/org-server';
import { writeAudit } from '@/lib/audit';

export type OrgSwitchRequest = {
  id: string;
  studentId: string;
  studentEmail: string | null;
  studentName: string | null;
  currentOrgId: string;
  requestedOrgId: string;
  requestedOrgName: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: unknown;
};

export async function requestOrgSwitchAs(idToken: string, requestedOrgId: string, reason: string) {
  const caller = await requireOrgRole(idToken, ['applicant']);
  const db = getAdminDb();

  const target = await getActiveOrganization(requestedOrgId);
  if (!target) throw new Error('That organization could not be found.');
  if (target.id === caller.orgId) throw new Error('You are already part of that organization.');

  const existing = await db.collection('orgSwitchRequests')
    .where('studentId', '==', caller.uid)
    .where('status', '==', 'pending')
    .limit(1)
    .get();
  if (!existing.empty) throw new Error('You already have a pending switch request. Please wait for it to be resolved.');

  const profile = (await db.collection('users').doc(caller.uid).get()).data();

  const ref = db.collection('orgSwitchRequests').doc();
  await ref.set({
    id: ref.id,
    studentId: caller.uid,
    studentEmail: caller.email,
    studentName: profile?.name ?? null,
    currentOrgId: caller.orgId,
    requestedOrgId: target.id,
    requestedOrgName: target.name,
    reason: reason.trim().slice(0, 500),
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
  });

  await writeAudit({
    organizationId: caller.orgId,
    action: 'Organization switch requested',
    actorId: caller.uid,
    actorName: caller.email,
    targetId: ref.id,
    targetType: 'user',
    subject: caller.email,
    details: { requestedOrgId: target.id },
  });

  return { requestId: ref.id };
}

export async function resolveOrgSwitchRequestAs(caller: Caller, requestId: string, approve: boolean) {
  const db = getAdminDb();
  const ref = db.collection('orgSwitchRequests').doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Request not found.');
  const request = snap.data() as OrgSwitchRequest;
  if (request.status !== 'pending') throw new Error('This request has already been resolved.');

  if (approve) {
    await db.collection('users').doc(request.studentId).set({
      organizationId: request.requestedOrgId,
      schoolId: request.requestedOrgId,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await setUserClaims(request.studentId, { orgId: request.requestedOrgId, role: 'applicant' });
  }

  await ref.set({
    status: approve ? 'approved' : 'denied',
    resolvedAt: FieldValue.serverTimestamp(),
    resolvedBy: caller.uid,
  }, { merge: true });

  await writeAudit({
    organizationId: request.requestedOrgId,
    action: approve ? 'Organization switch approved' : 'Organization switch denied',
    actorId: caller.uid,
    actorName: caller.email,
    targetId: request.studentId,
    targetType: 'user',
    subject: request.studentEmail,
    details: { fromOrgId: request.currentOrgId, toOrgId: request.requestedOrgId },
  });

  return { resolved: true as const };
}
