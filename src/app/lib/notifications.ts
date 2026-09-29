
'use server';

import nodemailer from 'nodemailer';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/firebase/admin';

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const FROM_EMAIL = process.env.GMAIL_FROM_EMAIL || GMAIL_USER || 'scholarships@meritedapp.com';

const transporter = GMAIL_USER && GMAIL_APP_PASSWORD
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    })
  : null;

export type NotificationType =
  | 'Welcome'
  | 'Recommendation Request'
  | 'Recommendation Received'
  | 'Recommendation Reminder'
  | 'Submission Confirmed'
  | 'Status Changed'
  | 'Reviewer Invitation'
  | 'Admin Invitation';

interface EmailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
  type: NotificationType;
}

/**
 * Dispatches an email via Gmail SMTP and logs the attempt in Firestore.
 */
export async function sendNotification(params: EmailParams) {
  let delivered = false;
  let deliveryMethod = 'Simulation';

  try {
    if (transporter) {
      await transporter.sendMail({
        to: params.to,
        from: FROM_EMAIL,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      delivered = true;
      deliveryMethod = 'Gmail SMTP';
    }
  } catch (error: any) {
    console.error(`Notification Error [${params.type}]:`, error.response?.body || error.message);
    return { success: false, error: error.message };
  }

  // Log to the Firestore outbox separately: a logging failure shouldn't be
  // reported as a delivery failure when the send above succeeded. Uses the
  // Admin SDK since this runs in a server action with no browser auth session.
  try {
    await getAdminDb().collection('sent_emails').add({
      recipient: params.to,
      subject: params.subject,
      body: params.text,
      type: params.type,
      delivered,
      deliveryMethod,
      sentAt: FieldValue.serverTimestamp()
    });
  } catch (error: any) {
    console.error(`Outbox log failed [${params.type}]:`, error.message);
  }

  return { success: true, method: deliveryMethod };
}

export async function sendWelcomeEmail(email: string, name: string) {
  return sendNotification({
    to: email,
    subject: 'Welcome to Merited',
    type: 'Welcome',
    text: `Hello ${name}, welcome to the Merited scholarship platform. Your account is ready.`,
    html: `<h1>Welcome to Merited</h1><p>Hello <strong>${name}</strong>,</p><p>Your student profile has been created. You can now browse and apply for institutional scholarships.</p>`
  });
}

export async function sendSubmissionConfirmation(email: string, name: string) {
  return sendNotification({
    to: email,
    subject: 'Application Received',
    type: 'Submission Confirmed',
    text: `Hello ${name}, your scholarship portfolio has been securely submitted for committee review.`,
    html: `<h1>Application Confirmed</h1><p>Hi ${name},</p><p>Great work! Your portfolio is now locked and undergoing review by the selection committee.</p>`
  });
}

export async function sendStatusUpdate(email: string, name: string, status: string) {
  return sendNotification({
    to: email,
    subject: 'Status Update: Your Scholarship Application',
    type: 'Status Changed',
    text: `Hello ${name}, your application status has been updated to: ${status}.`,
    html: `<h1>Decision Update</h1><p>Hello ${name},</p><p>There has been an update to your scholarship application status. Your new status is: <strong>${status}</strong>.</p><p>Log in to your dashboard for more details.</p>`
  });
}

export async function sendInvitationEmail(params: {
  email: string;
  subject: string;
  body: string;
  role: 'Reviewer' | 'Admin';
}) {
  return sendNotification({
    to: params.email,
    subject: params.subject,
    type: params.role === 'Admin' ? 'Admin Invitation' : 'Reviewer Invitation',
    text: params.body,
    html: params.body.replace(/\n/g, '<br />'),
  });
}

export async function sendRecommendationReminderEmail(params: {
  email: string;
  studentName: string;
  recommenderName: string;
  tokenLink: string;
}) {
  return sendNotification({
    to: params.email,
    subject: `Reminder: ${params.studentName} is waiting for your recommendation letter`,
    type: 'Recommendation Reminder',
    text: `Hello ${params.recommenderName}, this is a reminder that ${params.studentName} has requested a recommendation. Please upload it via this secure link: ${params.tokenLink}`,
    html: `<h1>Recommendation Reminder</h1><p>Hello ${params.recommenderName},</p><p>This is a follow-up regarding the recommendation request for <strong>${params.studentName}</strong>.</p><p>Please upload your letter via this secure link: <a href="${params.tokenLink}">${params.tokenLink}</a></p>`
  });
}
