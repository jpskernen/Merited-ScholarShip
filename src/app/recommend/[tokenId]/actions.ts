
'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/firebase/admin';
import { sendNotification } from '@/app/lib/notifications';
import { appUrl, escapeHtml, renderEmail } from '@/app/lib/email-template';
import { applicationId, LEGACY_SCHOLARSHIP_ID } from '@/types/application';
import { writeAudit } from '@/lib/audit';
import { assertPdf, uploadPdf } from '@/lib/storage-server';

type LetterPayload =
  | { kind: 'text'; text: string }
  | { kind: 'file'; fileUrl: string };


async function resolveApplicationRef(tokenApplicationId: string) {
  const db = getAdminDb();

  const direct = db.collection('applications').doc(tokenApplicationId);
  if ((await direct.get()).exists) return direct;

  const legacy = db.collection('applications').doc(applicationId(tokenApplicationId, LEGACY_SCHOLARSHIP_ID));
  if ((await legacy.get()).exists) return legacy;

  return null;
}


async function applyRecommendation(tokenData: any, index: number, payload: LetterPayload) {
  const db = getAdminDb();

  const letterFields = payload.kind === 'text'
    ? { [`recommendationLetterText${index}`]: payload.text }
    : { [`recommendationLetter${index}`]: payload.fileUrl };

  const update = {
    [`recommendationStatus${index}`]: 'Received',
    ...letterFields,
    updatedAt: FieldValue.serverTimestamp(),
  };

  const appRef = await resolveApplicationRef(tokenData.applicationId);



  
  if (!appRef) {
   
    const studentRef = db.collection('users').doc(tokenData.applicationId);
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists) {
      return { ok: false as const, error: 'The application this request belongs to no longer exists.' };
    }
    await studentRef.update(update);
    return { ok: true as const, student: studentSnap.data()! };
  }

  await appRef.update(update);
  const application = (await appRef.get()).data()!;

  const studentSnap = await db.collection('users').doc(application.studentId).get();
  const student = studentSnap.exists ? studentSnap.data()! : null;

  return { ok: true as const, student };
}

async function notifyBothParties(tokenData: any, student: any) {
  await sendNotification({
    to: tokenData.recommenderEmail,
    subject: 'Recommendation Submitted Successfully',
    type: 'Recommendation Received',
    text: `Your recommendation letter for ${tokenData.studentName} has been received. Thank you.`,
    html: renderEmail({
      title: 'Your recommendation has been received',
      preheader: `Thank you for supporting ${tokenData.studentName}.`,
      greeting: `Hello <strong>${escapeHtml(tokenData.recommenderName)}</strong>,`,
      body: [
        `Your recommendation letter for <strong>${escapeHtml(tokenData.studentName)}</strong> has been submitted to the selection committee.`,
        'Thank you for taking the time to support their academic journey. There is nothing further you need to do.',
      ],
    })
  });

  if (student?.email) {
    await sendNotification({
      to: student.email,
      subject: 'Endorsement Received',
      type: 'Recommendation Received',
      text: `A recommendation letter has been submitted by ${tokenData.recommenderName}.`,
      html: renderEmail({
        title: 'A recommendation letter has arrived',
        preheader: `${tokenData.recommenderName} has submitted your recommendation.`,
        greeting: `Hi <strong>${escapeHtml(student.name)}</strong>,`,
        body: [
          `<strong>${escapeHtml(tokenData.recommenderName)}</strong> has submitted a recommendation letter for your portfolio.`,
        ],
        button: appUrl('/dashboard') ? { label: 'View my application', url: appUrl('/dashboard')! } : undefined,
      })
    });
  }
}

const MAX_LETTER_LENGTH = 60000;

/** Whether a token's expiresAt (Timestamp, Date or string) is in the past. */
function isTokenExpired(expiresAt: any): boolean {
  if (!expiresAt) return false;
  const expires = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
  return !isNaN(expires.getTime()) && expires.getTime() < Date.now();
}


function isOwnLetterUrl(tokenId: string, fileUrl: string): boolean {
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  let url: URL;
  try {
    url = new URL(fileUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com' || !bucket) return false;
  const prefix = `/v0/b/${bucket}/o/`;
  if (!url.pathname.startsWith(prefix)) return false;
  return decodeURIComponent(url.pathname.slice(prefix.length)) === `recommendations/${tokenId}.pdf`;
}


export async function uploadRecommendationLetterFile(tokenId: string, file: File) {
  try {
    const invalid = assertPdf(file);
    if (invalid) return { success: false, error: invalid };

    const tokenSnap = await getAdminDb().collection('recommendationTokens').doc(tokenId).get();
    if (!tokenSnap.exists) return { success: false, error: 'This recommendation link is no longer valid.' };
    const token = tokenSnap.data()!;
    if (token.used) return { success: false, error: 'This recommendation has already been submitted.' };
    if (token.cancelled) return { success: false, error: 'This recommendation request has been cancelled by the student.' };
    if (isTokenExpired(token.expiresAt)) {
      return { success: false, error: 'This recommendation link has expired. Please ask the student to send a new request.' };
    }

    const url = await uploadPdf(`recommendations/${tokenId}.pdf`, file);
    return { success: true, url };
  } catch (error: any) {
    console.error('Recommendation letter upload failed:', error);
    return { success: false, error: 'Your letter could not be uploaded. Please try again.' };
  }
}

async function submitRecommendation(tokenId: string, payload: LetterPayload) {
  try {
    if (payload.kind === 'text') {
      const text = payload.text?.trim() || '';
      if (!text) return { success: false, error: 'Please write your letter before submitting.' };
      if (text.length > MAX_LETTER_LENGTH) return { success: false, error: 'The letter is too long.' };
    } else if (!isOwnLetterUrl(tokenId, payload.fileUrl)) {
      return { success: false, error: 'The uploaded file could not be verified. Please upload it again.' };
    }

    const db = getAdminDb();
    const tokenRef = db.collection('recommendationTokens').doc(tokenId);

 
    const claim = await db.runTransaction(async (tx) => {
      const snap = await tx.get(tokenRef);
      if (!snap.exists) return { error: 'This recommendation link is no longer valid.' };
      const token = snap.data()!;
      if (token.used) return { error: 'This recommendation has already been submitted.' };
      if (token.cancelled) return { error: 'This recommendation request has been cancelled by the student.' };
      if (isTokenExpired(token.expiresAt)) {
        return { error: 'This recommendation link has expired. Please ask the student to send a new request.' };
      }
      tx.update(tokenRef, { used: true, submittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      return { token };
    });
    if ('error' in claim) {
      const token = (await tokenRef.get()).data();
      await writeAudit({
        organizationId: token?.organizationId,
        action: 'Recommendation link rejected',
        actorName: token?.recommenderName ?? null,
        targetId: tokenId,
        targetType: 'recommendationToken',
        subject: token?.recommenderEmail ?? null,
        details: { applicationId: token?.applicationId ?? null, reason: claim.error },
      });
      return { success: false, error: claim.error };
    }

    // 2. Land the letter. If that fails, release the link again so the
    //    recommender can simply retry. The letter is not copied onto the
    //    token: anyone holding the link can read the token (docs/13 S10).
    const index = claim.token.requestIndex || 1;
    let applied;
    try {
      applied = await applyRecommendation(claim.token, index, payload);
    } catch (error) {
      applied = { ok: false as const, error: 'Your letter could not be saved. Please try again.' };
      console.error('Recommendation write failed:', error);
    }
    if (!applied.ok) {
      await tokenRef.update({ used: false, submittedAt: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
      return { success: false, error: applied.error };
    }

    await writeAudit({
      organizationId: claim.token.organizationId,
      action: 'Recommendation letter received',
      actorName: claim.token.recommenderName ?? null,
      targetId: claim.token.applicationId ?? null,
      targetType: 'application',
      subject: claim.token.studentName ?? null,
      details: { slot: index, kind: payload.kind, tokenId, recommenderEmail: claim.token.recommenderEmail ?? null },
    });

    // 3. Notifications are best-effort: the letter is already safely stored, so
    //    an email failure must not report the submission as failed.
    try {
      await notifyBothParties(claim.token, applied.student);
    } catch (error: any) {
      console.error('Recommendation notification failed:', error.message);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Submission Error:', error);
    return { success: false, error: 'Your letter could not be submitted. Please try again.' };
  }
}

export async function submitTypedRecommendation(tokenId: string, text: string) {
  return submitRecommendation(tokenId, { kind: 'text', text });
}

export async function submitUploadedRecommendation(tokenId: string, fileUrl: string) {
  return submitRecommendation(tokenId, { kind: 'file', fileUrl });
}
