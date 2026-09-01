'use server';

/**
 * Server Action to check the health of system integrations.
 */
export async function getSystemHealth() {
  const sendgridKey = process.env.SENDGRID_API_KEY;
  const sendgridEmail = process.env.SENDGRID_FROM_EMAIL;
  
  return {
    sendgrid: {
      isConfigured: !!(sendgridKey && !sendgridKey.includes('YOUR_SENDGRID')),
      senderVerified: !!sendgridEmail,
      senderEmail: sendgridEmail || 'Not Set'
    },
    environment: process.env.NODE_ENV || 'production'
  };
}
