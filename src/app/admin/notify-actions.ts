'use server';


import { requireOrgRole } from '@/lib/auth-server';
import { getAppBaseUrl } from '@/lib/app-url';
import { getAdminDb } from '@/firebase/admin';
import { sendReviewAssignmentEmail } from '@/app/lib/notifications';

function failure(err: unknown) {
  console.error('Notify action failed:', err);
  return { success: false as const, error: err instanceof Error ? err.message : 'Could not send the email.' };
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
