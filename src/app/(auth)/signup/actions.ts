'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import { requireUser, setUserClaims } from '@/lib/auth-server';
import { sendWelcomeEmail } from '@/app/lib/notifications';
import { getActiveOrganization } from '@/lib/org-server';


export async function completeSignup(idToken: string, requestedOrgId?: string | null) {
  try {
    const caller = await requireUser(idToken);

    const userRef = getAdminDb().collection('users').doc(caller.uid);

    if (!caller.role) {
      let orgId: string | null = null;
      if (requestedOrgId) {
        const org = await getActiveOrganization(requestedOrgId);
        orgId = org?.id ?? null;
      }
      if (!orgId) orgId = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? null;
      if (!orgId) throw new Error('NEXT_PUBLIC_DEFAULT_ORG_ID is not set.');

      await setUserClaims(caller.uid, { orgId, role: 'applicant' });
      
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
