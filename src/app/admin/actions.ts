'use server';

import { AuthError, requireUser } from '@/lib/auth-server';


export async function getSystemHealth(idToken: string) {

  const caller = await requireUser(idToken);
  if (!caller.platformAdmin && caller.role !== 'org_admin') {
    throw new AuthError('You do not have permission to do this.');
  }

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
