
'use server';

import nodemailer from 'nodemailer';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/firebase/admin';
import { appUrl, escapeHtml, getEmailLogoAttachment, renderEmail, textToHtml } from './email-template';

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
  | 'Review Assigned'
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
      // The header logo rides along as a Content-ID attachment so it renders
      // without a publicly reachable URL. Returns undefined once
      // EMAIL_LOGO_URL points at a hosted copy.
      const logo = getEmailLogoAttachment();

      await transporter.sendMail({
        to: params.to,
        from: FROM_EMAIL,
        subject: params.subject,
        text: params.text,
        html: params.html,
        attachments: logo ? [logo] : undefined,
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
    html: renderEmail({
      title: 'Welcome to Merited',
      preheader: 'Your student profile is ready — start exploring scholarships.',
      greeting: `Hello <strong>${escapeHtml(name)}</strong>,`,
      body: [
        'Your student profile has been created. You can now browse and apply for institutional scholarships.',
      ],
      button: appUrl('/dashboard') ? { label: 'Go to my dashboard', url: appUrl('/dashboard')! } : undefined,
    }),
  });
}

export async function sendSubmissionConfirmation(email: string, name: string) {
  return sendNotification({
    to: email,
    subject: 'Application Received',
    type: 'Submission Confirmed',
    text: `Hello ${name}, your scholarship portfolio has been securely submitted for committee review.`,
    html: renderEmail({
      title: 'Application Confirmed',
      preheader: 'Your portfolio is with the selection committee.',
      greeting: `Hi <strong>${escapeHtml(name)}</strong>,`,
      body: [
        'Great work — your portfolio has been submitted and is now with the selection committee for review.',
        'You will hear from us by email as soon as a decision has been made. No further action is needed from you right now.',
      ],
      button: appUrl('/dashboard/applications')
        ? { label: 'View my applications', url: appUrl('/dashboard/applications')! }
        : undefined,
    }),
  });
}

export async function sendStatusUpdate(email: string, name: string, status: string) {
  return sendNotification({
    to: email,
    subject: 'Status Update: Your Scholarship Application',
    type: 'Status Changed',
    text: `Hello ${name}, your application status has been updated to: ${status}.`,
    html: renderEmail({
      title: 'Your application status has changed',
      preheader: `New status: ${status}`,
      greeting: `Hello <strong>${escapeHtml(name)}</strong>,`,
      body: [
        `There has been an update to your scholarship application. Your status is now <strong>${escapeHtml(status)}</strong>.`,
        'Log in to your dashboard to see the full details.',
      ],
      button: appUrl('/dashboard') ? { label: 'Open my dashboard', url: appUrl('/dashboard')! } : undefined,
    }),
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
    // The body is generated per invitation, so it is escaped and linkified
    // rather than trusted as HTML.
    html: renderEmail({
      title: params.subject,
      preheader: `You have been invited to join as ${params.role === 'Admin' ? 'an administrator' : 'a reviewer'}.`,
      body: [textToHtml(params.body)],
    }),
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
    html: renderEmail({
      title: 'A reminder about your recommendation letter',
      preheader: `${params.studentName} is still waiting on your letter.`,
      greeting: `Hello <strong>${escapeHtml(params.recommenderName)}</strong>,`,
      body: [
        `This is a follow-up about the recommendation letter requested by <strong>${escapeHtml(params.studentName)}</strong>.`,
        'Uploading it takes just a couple of minutes using the secure link below.',
      ],
      button: { label: 'Upload recommendation letter', url: params.tokenLink },
      showPlainLink: true,
      note: 'This link is personal to you — please do not forward it.',
    }),
  });
}

export async function sendReviewAssignmentEmail(params: {
  email: string;
  reviewerName: string;
  scholarshipName: string;
  /** The admin's window.location.origin, so the link works before deploy. */
  origin?: string;
}) {
  const portalUrl = params.origin ? `${params.origin}/review` : appUrl('/review');

  return sendNotification({
    to: params.email,
    subject: `You have been assigned to review ${params.scholarshipName}`,
    type: 'Review Assigned',
    text: `Hello ${params.reviewerName}, you have been added to the selection committee for ${params.scholarshipName}. Applications are waiting for your review${portalUrl ? ` at ${portalUrl}` : ''}.`,
    html: renderEmail({
      title: 'You have been added to a review committee',
      preheader: `${params.scholarshipName} is ready for your review.`,
      greeting: `Hello <strong>${escapeHtml(params.reviewerName)}</strong>,`,
      body: [
        `You have been assigned to the selection committee for <strong>${escapeHtml(params.scholarshipName)}</strong>.`,
        'You can now read the applications submitted to this program and score them against its evaluation rubric.',
      ],
      button: portalUrl ? { label: 'Open the review portal', url: portalUrl } : undefined,
    }),
  });
}
