'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import { requireUser, setUserClaims } from '@/lib/auth-server';
import { sendWelcomeEmail } from '@/app/lib/notifications';

/**
 * Finishes a new student account (docs/07 §3.2):
 *  - gives it the applicant role in the default organization. Never changes an
 *    account that already has a role, so it can't be used to switch roles or
 *    organizations;
 *  - sends the welcome email once, to the account's own login address.
 */
export async function completeSignup(idToken: string) {
  try {
    const caller = await requireUser(idToken);

    const userRef = getAdminDb().collection('users').doc(caller.uid);

    if (!caller.role) {
      const orgId = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
      if (!orgId) throw new Error('NEXT_PUBLIC_DEFAULT_ORG_ID is not set.');
      await setUserClaims(caller.uid, { orgId, role: 'applicant' });
      // The browser can't write these fields (firestore.rules, users).
      await userRef.set({
        id: caller.uid,
        role: 'applicant',
        organizationId: orgId,
        schoolId: orgId,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    const profile = (await userRef.get()).data();
    if (caller.email && !profile?.welcomeEmailSentAt) {
      const name = profile?.name || (await getAdminAuth().getUser(caller.uid)).displayName || 'Student';
      const sent = await sendWelcomeEmail(caller.email, name);
      if (sent.success) await userRef.set({ welcomeEmailSentAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    return { success: true as const };
  } catch (err) {
    console.error('Signup completion failed:', err);
    return { success: false as const, error: err instanceof Error ? err.message : 'Could not finish setting up your account.' };
  }
}
