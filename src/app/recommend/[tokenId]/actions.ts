
'use server';
// The recommender submitting this is never signed in - the token ID itself is
// their only credential. Rather than opening up anonymous writes on the
// `users` collection's security rules, this runs as a trusted server action
// via the Admin SDK (bypasses rules entirely) and re-validates the token
// itself server-side before writing anything.
//
// Both submission paths (typed letter and uploaded PDF) go through here. The
// PDF path used to write from the browser instead, which meant its writes were
// rejected by the security rules while the token had already been flipped to
// used — burning the link and leaving the student on "Pending" forever.

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/firebase/admin';
import { sendNotification } from '@/app/lib/notifications';
import { appUrl, escapeHtml, renderEmail } from '@/app/lib/email-template';
import { applicationId, LEGACY_SCHOLARSHIP_ID } from '@/types/application';

type LetterPayload =
  | { kind: 'text'; text: string }
  | { kind: 'file'; fileUrl: string };

/**
 * Tokens issued from 2026-09-30 carry an `applications/{id}`. Tokens issued
 * before that carry the student's uid, so fall back to their legacy general
 * portfolio application, and finally to the user document itself, rather than
 * rejecting a recommender who is holding a link that was valid when it was sent.
 */
async function resolveApplicationRef(tokenApplicationId: string) {
  const db = getAdminDb();

  const direct = db.collection('applications').doc(tokenApplicationId);
  if ((await direct.get()).exists) return direct;

  const legacy = db.collection('applications').doc(applicationId(tokenApplicationId, LEGACY_SCHOLARSHIP_ID));
  if ((await legacy.get()).exists) return legacy;

  return null;
}

/**
 * Writes the letter everywhere it needs to land, and returns the student so the
 * caller can notify them. Deliberately does NOT touch the token: the token is
 * only marked used once this has succeeded, so a failure here leaves the
 * recommender's link still usable.
 */
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
    // Pure legacy: no application record exists at all, so the student's user
    // document is still the only place this letter can live.
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

  const studentRef = db.collection('users').doc(application.studentId);
  const studentSnap = await studentRef.get();
  const student = studentSnap.exists ? studentSnap.data()! : null;

  // Keep the legacy mirror in step when this is the application reviewers are
  // currently reading, otherwise a letter that arrives after submission would
  // be invisible to them. See mirrorToLegacyUserDocument.
  if (student?.legacyMirrorOf === appRef.id) {
    await studentRef.update(update);
  }

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

/**
 * The uploaded letter must be the file the recommender page stores for this
 * token, recommendations/{tokenId}.pdf in this project's bucket. Anything else
 * (another student's file, an outside link) is refused, since reviewers open
 * it from the application (docs/13 §3).
 */
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

    // 1. Claim the link in a transaction, so two submissions at the same
    //    moment can't both go through. Everything comes from the stored
    //    token, never from the browser.
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
    if ('error' in claim) return { success: false, error: claim.error };

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
