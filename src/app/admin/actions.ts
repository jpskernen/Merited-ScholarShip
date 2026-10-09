'use server';

import { requireOrgRole } from '@/lib/auth-server';

/**
 * Server Action to check the health of system integrations. Org Admins only.
 * Email goes through Gmail SMTP (src/app/lib/notifications.ts); the old
 * SendGrid check reported "not configured" even when email worked.
 */
export async function getSystemHealth(idToken: string) {
  await requireOrgRole(idToken, ['org_admin']);

  const gmailUser = process.env.GMAIL_USER;
  const fromEmail = process.env.GMAIL_FROM_EMAIL || gmailUser;

  return {
    email: {
      provider: 'Gmail SMTP',
      isConfigured: !!(gmailUser && process.env.GMAIL_APP_PASSWORD),
      senderVerified: !!fromEmail,
      senderEmail: fromEmail || 'Not Set',
    },
    environment: process.env.NODE_ENV || 'production'
  };
}
