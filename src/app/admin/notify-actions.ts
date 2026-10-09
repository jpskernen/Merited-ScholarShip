'use server';

// Emails an Org Admin's page can trigger. Each action checks the caller and
// reads every name, address and status from the database, so a caller can't
// choose the recipient or the content (docs/13 S5: the old exported email
// functions were an open relay).
import { requireOrgRole } from '@/lib/auth-server';
import { getAppBaseUrl } from '@/lib/app-url';
import { getAdminDb } from '@/firebase/admin';
import { sendReviewAssignmentEmail, sendStatusUpdate } from '@/app/lib/notifications';

function failure(err: unknown) {
  console.error('Notify action failed:', err);
  return { success: false as const, error: err instanceof Error ? err.message : 'Could not send the email.' };
}

/**
 * Tells a student their application's current status. `applicationId` is
 * null only for legacy rows with no application record, which fall back to
 * the student's user document.
 */
export async function notifyStatusChange(idToken: string, target: { applicationId: string | null; studentId: string }) {
  try {
    const caller = await requireOrgRole(idToken, ['org_admin']);
    const db = getAdminDb();

    const studentSnap = await db.collection('users').doc(target.studentId).get();
    const student = studentSnap.data();
    if (!student?.email) throw new Error('The student has no email address on file.');

    let status: string | undefined;
    let scholarshipName: string | undefined;
    if (target.applicationId) {
      const application = (await db.collection('applications').doc(target.applicationId).get()).data();
      if (!application || application.studentId !== target.studentId || application.organizationId !== caller.orgId) {
        throw new Error('Application not found.');
      }
      status = application.status;
      scholarshipName = application.scholarshipName || undefined;
    } else {
      if ((student.organizationId || student.schoolId) !== caller.orgId) throw new Error('Student not found.');
      status = student.status;
    }
    if (!status) throw new Error('The application has no status to report.');

    const result = await sendStatusUpdate(student.email, student.name || 'Student', status, scholarshipName);
    return result.success
      ? { success: true as const, method: result.method }
      : { success: false as const, error: result.error || 'Could not send the email.' };
  } catch (err) {
    return failure(err);
  }
}

/** Tells a reviewer they were assigned to one of the caller's organization's scholarships. */
export async function notifyReviewAssignment(idToken: string, programId: string, reviewerUid: string) {
  try {
    const caller = await requireOrgRole(idToken, ['org_admin']);
    const db = getAdminDb();

    const program = (await db.collection('programs').doc(programId).get()).data();
    if (!program || (program.organizationId || program.schoolId) !== caller.orgId) throw new Error('Scholarship not found.');
    if (!(program.reviewerIds || []).includes(reviewerUid)) throw new Error('This reviewer is not assigned to the scholarship.');

    const reviewer = (await db.collection('users').doc(reviewerUid).get()).data();
    if (!reviewer?.email || (reviewer.organizationId || reviewer.schoolId) !== caller.orgId) throw new Error('Reviewer not found.');

    const result = await sendReviewAssignmentEmail({
      email: reviewer.email,
      reviewerName: reviewer.name || 'Reviewer',
      scholarshipName: program.name || 'a scholarship',
      origin: await getAppBaseUrl(),
    });
    return result.success
      ? { success: true as const, method: result.method }
      : { success: false as const, error: result.error || 'Could not send the email.' };
  } catch (err) {
    return failure(err);
  }
}
