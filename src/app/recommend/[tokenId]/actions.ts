
'use server';
// The recommender submitting this is never signed in - the token ID itself is
// their only credential. Rather than opening up anonymous writes on the
// `users` collection's security rules, this runs as a trusted server action
// via the Admin SDK (bypasses rules entirely) and re-validates the token
// itself server-side before writing anything.

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/firebase/admin';
import { sendNotification } from '@/app/lib/notifications';

export async function submitTypedRecommendation(tokenId: string, text: string, tokenData: any) {
  try {
    const db = getAdminDb();
    const tokenRef = db.collection('recommendationTokens').doc(tokenId);
    const tokenSnap = await tokenRef.get();

    if (!tokenSnap.exists) {
      return { success: false, error: 'This recommendation link is no longer valid.' };
    }
    const currentToken = tokenSnap.data()!;
    if (currentToken.used) {
      return { success: false, error: 'This recommendation has already been submitted.' };
    }

    // Firebase Storage isn't provisioned for this project yet, so the typed
    // recommendation is stored as plain text in Firestore rather than
    // rendered to a PDF and uploaded. See recommendationLetterText{index} on
    // the student's user doc, and letterText on the token doc.

    // 1. Update Token Document
    await tokenRef.update({
      used: true,
      letterText: text, // Saved for easy admin viewing
      updatedAt: FieldValue.serverTimestamp()
    });

    // 2. Update Student Application
    const studentRef = db.collection('users').doc(tokenData.applicationId);
    const studentSnap = await studentRef.get();
    const studentData = studentSnap.exists ? studentSnap.data() : null;

    const index = tokenData.requestIndex || 1;
    await studentRef.update({
      [`recommendationStatus${index}`]: 'Received',
      [`recommendationLetterText${index}`]: text,
      updatedAt: FieldValue.serverTimestamp()
    });

    // 3. Send Confirmation Emails
    // To Recommender
    await sendNotification({
      to: tokenData.recommenderEmail,
      subject: 'Recommendation Submitted Successfully',
      type: 'Recommendation Received',
      text: `Your recommendation letter for ${tokenData.studentName} has been received. Thank you.`,
      html: `<p>Hello ${tokenData.recommenderName},</p><p>Your recommendation letter for <strong>${tokenData.studentName}</strong> has been submitted successfully to the ScholarShip selection committee. Thank you for supporting their academic journey.</p>`
    });

    // To Student
    if (studentData?.email) {
      await sendNotification({
        to: studentData.email,
        subject: 'Endorsement Received',
        type: 'Recommendation Received',
        text: `A recommendation letter has been uploaded by ${tokenData.recommenderName}.`,
        html: `<p>Hi ${studentData.name},</p><p>We have received a new recommendation letter for your portfolio from <strong>${tokenData.recommenderName}</strong>.</p>`
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('Submission Error:', error);
    return { success: false, error: error.message };
  }
}
