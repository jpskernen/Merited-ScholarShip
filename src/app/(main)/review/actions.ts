'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/firebase/admin';
import { AuthError, requireOrgRole } from '@/lib/auth-server';
import { appLink } from '@/lib/app-url';
import { sendReviewSubmittedEmail } from '@/app/lib/notifications';
import { criterionKey, NEUTRAL_SCORE, type RubricCriterion } from '@/lib/rubric';

function failure(error: unknown) {
  if (!(error instanceof AuthError)) console.error('Review action failed:', error);
  const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  return { success: false as const, error: message };
}

export async function notifyAdminsReviewSubmitted(idToken: string, applicationId: string) {
  try {
    const caller = await requireOrgRole(idToken, ['reviewer', 'org_admin']);
    if (!applicationId) return { success: false as const, error: 'No application was named.' };

    const db = getAdminDb();
    const appSnap = await db.collection('applications').doc(applicationId).get();
    const application = appSnap.data();
    if (!application || application.organizationId !== caller.orgId) {
      return { success: false as const, error: 'Application not found.' };
    }

    const reviewRef = appSnap.ref.collection('reviews').doc(caller.uid);
    const review = (await reviewRef.get()).data();
    if (!review || review.status !== 'Submitted') {
      return { success: false as const, error: 'There is no submitted review to report.' };
    }
    if (review.adminNotifiedAt) return { success: true as const, sent: 0 };

    const program = (await db.collection('programs').doc(application.scholarshipId).get()).data();
    const rubric: RubricCriterion[] = program?.rubric || [];
    const scoreById = new Map<string, number>(
      (review.criteriaScores || []).map((s: any) => [s.criteriaId, Number(s.score)]),
    );
    const criteria = rubric.map((c) => ({
      label: c.label,
      weight: Number(c.weight) || 0,
      score: scoreById.get(criterionKey(c)) ?? NEUTRAL_SCORE,
    }));

    const student = application.studentId
      ? (await db.collection('users').doc(application.studentId).get()).data()
      : null;
    const studentName = student?.name || application.studentName || 'an applicant';

    const admins = await db.collection('users')
      .where('organizationId', '==', caller.orgId)
      .where('role', '==', 'admin')
      .get();
    const recipients = admins.docs.map((d) => d.data()).filter((u) => u.email);
    if (recipients.length === 0) return { success: true as const, sent: 0 };

    const reviewUrl = await appLink(
      `/admin/applicants/${application.studentId || applicationId}?application=${encodeURIComponent(applicationId)}`,
    );

    const results = await Promise.all(recipients.map((admin) => sendReviewSubmittedEmail({
      email: admin.email,
      adminName: admin.name || 'Admin',
      reviewerName: review.reviewerName || 'A reviewer',
      studentName,
      scholarshipName: program?.name || application.scholarshipName || 'a scholarship',
      totalScore: typeof review.totalScore === 'number' ? review.totalScore : null,
      recommendation: review.recommendation || '',
      markForDiscussion: !!review.markForDiscussion,
      criteria,
      notes: review.notes || '',
      reviewUrl,
    })));

    const sent = results.filter((r) => r.success).length;
    if (sent > 0) await reviewRef.update({ adminNotifiedAt: FieldValue.serverTimestamp() });
    return { success: true as const, sent };
  } catch (error) {
    return failure(error);
  }
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
