'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/firebase/admin';
import { AuthError, requireOrgRole } from '@/lib/auth-server';

function failure(error: unknown) {
  if (!(error instanceof AuthError)) console.error('Review action failed:', error);
  const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  return { success: false as const, error: message };
}

export async function markApplicationInReview(idToken: string, applicationId: string) {
  try {
    const caller = await requireOrgRole(idToken, ['reviewer', 'org_admin']);
    if (!applicationId) return { success: false as const, error: 'No application was named.' };

    const db = getAdminDb();
    const appRef = db.collection('applications').doc(applicationId);

    const first = await appRef.get();
    if (!first.exists || first.data()!.organizationId !== caller.orgId) {
      return { success: false as const, error: 'Application not found.' };
    }

    const programSnap = await db.collection('programs').doc(first.data()!.scholarshipId).get();
    const reviewerIds: string[] = programSnap.exists ? (programSnap.data()!.reviewerIds || []) : [];
    if (!reviewerIds.includes(caller.uid)) {
      return { success: false as const, error: 'You are not assigned to this scholarship.' };
    }

    const studentId: string | undefined = first.data()!.studentId;

    const changed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(appRef);
      if (!snap.exists || snap.data()!.status !== 'Submitted') return false;
      tx.update(appRef, { status: 'In Review', updatedAt: FieldValue.serverTimestamp() });
      return true;
    });

    if (changed && studentId) {
      const studentRef = db.collection('users').doc(studentId);
      const student = await studentRef.get();
      if (student.exists && student.data()!.legacyMirrorOf === applicationId) {
        await studentRef.update({ status: 'In Review', updatedAt: FieldValue.serverTimestamp() });
      }
    }

    return { success: true as const, changed };
  } catch (error) {
    return failure(error);
  }
}
