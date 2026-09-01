
'use server';

import sgMail from '@sendgrid/mail';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

// Initialize Firebase for logging
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'scholarships@meritedapp.com';

if (API_KEY && !API_KEY.includes('YOUR_SENDGRID')) {
  sgMail.setApiKey(API_KEY);
}

export type NotificationType = 
  | 'Welcome' 
  | 'Recommendation Request' 
  | 'Recommendation Received' 
  | 'Recommendation Reminder'
  | 'Submission Confirmed' 
  | 'Status Changed';

interface EmailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
  type: NotificationType;
}

/**
 * Dispatches an email via SendGrid and logs the attempt in Firestore.
 */
export async function sendNotification(params: EmailParams) {
  let delivered = false;
  let deliveryMethod = 'Simulation';

  try {
    if (API_KEY && !API_KEY.includes('YOUR_SENDGRID')) {
      await sgMail.send({
        to: params.to,
        from: FROM_EMAIL,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      delivered = true;
      deliveryMethod = 'SendGrid';
    }

    // Always log to Firestore Outbox
    await addDoc(collection(db, 'sent_emails'), {
      recipient: params.to,
      subject: params.subject,
      body: params.text,
      type: params.type,
      delivered,
      deliveryMethod,
      sentAt: serverTimestamp()
    });

    return { success: true, method: deliveryMethod };
  } catch (error: any) {
    console.error(`Notification Error [${params.type}]:`, error.response?.body || error.message);
    return { success: false, error: error.message };
  }
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
