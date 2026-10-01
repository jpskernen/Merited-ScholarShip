
'use server';

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/firebase/admin';
import { ProfileSchema } from '@/types/applicant';
import { ApplicationSchema, applicationId, LEGACY_SCHOLARSHIP_ID } from '@/types/application';
import { firebaseConfig } from '@/firebase/config';
import { sendSubmissionConfirmation, sendNotification, sendRecommendationReminderEmail } from '@/app/lib/notifications';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const storage = getStorage(app);

async function uploadFile(file: File, path: string): Promise<string> {
    const fileRef = ref(storage, path);
    const snapshot = await uploadBytes(fileRef, file);
    return getDownloadURL(snapshot.ref);
}

/**
 * Entered once by the student and reused by every application they open. The
 * client's 2026-09-29 answer: "basic profile details like name and GPA shared".
 */
const SHARED_PROFILE_FIELDS = new Set([
  'name', 'email', 'secondaryEmail', 'address', 'gpa',
  'major', 'school', 'interests', 'schoolId', 'organizationId',
]);

/**
 * Saves one application. A student has one of these per scholarship, each with
 * its own essay, its own recommenders and its own submission status, so
 * submitting the Merit Scholarship no longer locks them out of applying to the
 * Academic Excellence Scholarship.
 *
 * Shared profile fields are split out and written to users/{uid}; everything
 * else is written to applications/{studentId}_{scholarshipId}.
 */
export async function saveApplication(
  userId: string,
  scholarshipId: string,
  formData: FormData,
  isSubmit: boolean = false,
) {
  try {
    if (!scholarshipId) {
      return { success: false, error: 'No scholarship selected for this application.' };
    }

    const db = getAdminDb();
    const appId = applicationId(userId, scholarshipId);

    const userRef = db.collection('users').doc(userId);
    const appRef = db.collection('applications').doc(appId);

    const [userSnap, appSnap] = await Promise.all([userRef.get(), appRef.get()]);
    const existingProfile = userSnap.exists ? userSnap.data()! : {};
    const existingApplication = appSnap.exists ? appSnap.data()! : {};

    if (existingApplication.status && existingApplication.status !== 'Draft') {
      return { success: false, error: 'This application has already been submitted and can no longer be edited.' };
    }

    const profileToSave: any = { ...existingProfile };
    const applicationToSave: any = { ...existingApplication };

    for (const [key, value] of Object.entries(Object.fromEntries(formData.entries()))) {
      const target = SHARED_PROFILE_FIELDS.has(key) ? profileToSave : applicationToSave;

      if (value instanceof File && value.size > 0) {
        target[key] = await uploadFile(value, `applications/${userId}/${scholarshipId}/${key}/${Date.now()}-${value.name}`);
      } else if (key === 'gpa') {
        target[key] = value === '' ? 0 : parseFloat(value as string);
      } else if (typeof value === 'string') {
        target[key] = value;
      }
    }

    const organizationId = profileToSave.organizationId || profileToSave.schoolId || 'scholarship-hib4j';

    // Denormalised onto the application so My Status and the admin board can
    // render a row without a second read per scholarship.
    let scholarshipName = existingApplication.scholarshipName || '';
    if (!scholarshipName) {
      const programSnap = await db.collection('programs').doc(scholarshipId).get();
      scholarshipName = programSnap.exists
        ? (programSnap.data()!.name || 'Scholarship')
        : (scholarshipId === LEGACY_SCHOLARSHIP_ID ? 'General Scholarship Portfolio' : 'Scholarship');
    }

    Object.assign(applicationToSave, {
      id: appId,
      studentId: userId,
      scholarshipId,
      scholarshipName,
      organizationId,
      status: isSubmit ? 'Submitted' : (applicationToSave.status || 'Draft'),
      submissionDate: isSubmit ? new Date().toISOString() : (applicationToSave.submissionDate || null),
    });

    // Validate before writing anything, so a rejected submit can't leave a
    // half-written record behind.
    const profileValidation = (isSubmit ? ProfileSchema : ProfileSchema.partial()).safeParse(profileToSave);
    if (!profileValidation.success) {
      return { success: false, error: `Validation failed - ${formatIssues(profileValidation.error.issues)}` };
    }

    const applicationValidation = ApplicationSchema.safeParse(applicationToSave);
    if (!applicationValidation.success) {
      return { success: false, error: `Validation failed - ${formatIssues(applicationValidation.error.issues)}` };
    }

    await userRef.set(
      { ...profileValidation.data, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    await appRef.set(
      {
        ...applicationValidation.data,
        createdAt: existingApplication.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    if (isSubmit) {
      await mirrorToLegacyUserDocument(userId, applicationValidation.data);

      if (profileToSave.email) {
        await sendSubmissionConfirmation(profileToSave.email, profileToSave.name || 'Student');
      }
    }

    return { success: true, id: appId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

function formatIssues(issues: { path: (string | number)[]; message: string }[]) {
  return issues.map(issue => `${issue.path.join('.') || 'form'}: ${issue.message}`).join('; ');
}

/**
 * The reviewer queue, the reviewer scoring page and the admin committee board
 * all still read the flat users/{uid} document. Until those are migrated to
 * read `applications` directly, copy the most recently submitted application's
 * content back onto the user doc so they keep working unchanged.
 *
 * This is a compatibility shim with a known limitation: a student with two
 * submitted applications shows only their latest one to reviewers. Removing it
 * is the first task of the reviewer/admin migration — see
 * docs/09-E2E-BUG-HUNT-2026-09-30.md BUG-05 and BUG-11.
 */
async function mirrorToLegacyUserDocument(userId: string, application: any) {
  const db = getAdminDb();
  await db.collection('users').doc(userId).set({
    essay: application.essay ?? null,
    qualificationStatement: application.qualificationStatement ?? null,
    activities: application.activities ?? null,
    essays: application.essays ?? [],
    status: application.status,
    submissionDate: application.submissionDate,
    recommenderName1: application.recommenderName1 ?? '',
    recommenderEmail1: application.recommenderEmail1 ?? '',
    recommenderTitle1: application.recommenderTitle1 ?? '',
    recommendationStatus1: application.recommendationStatus1 ?? 'Not Requested',
    recommendationLetter1: application.recommendationLetter1 ?? null,
    recommendationLetterText1: application.recommendationLetterText1 ?? null,
    recommenderName2: application.recommenderName2 ?? '',
    recommenderEmail2: application.recommenderEmail2 ?? '',
    recommenderTitle2: application.recommenderTitle2 ?? '',
    recommendationStatus2: application.recommendationStatus2 ?? 'Not Requested',
    recommendationLetter2: application.recommendationLetter2 ?? null,
    recommendationLetterText2: application.recommendationLetterText2 ?? null,
    legacyMirrorOf: application.id,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

/**
 * mirrorToLegacyUserDocument only runs at submit time, but endorsements can be
 * invited, reminded and replaced after that. Without this, a recommender
 * invited post-submission would never reach the mirror and the reviewer would
 * see their letter with a blank attribution. No-op unless this application is
 * the one currently mirrored.
 */
async function syncRecommenderToLegacyMirror(
  studentId: string,
  appId: string,
  fields: Record<string, any>,
) {
  const db = getAdminDb();
  const studentRef = db.collection('users').doc(studentId);
  const snap = await studentRef.get();
  if (!snap.exists || snap.data()?.legacyMirrorOf !== appId) return;

  await studentRef.set({ ...fields, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

/**
 * Backfills an `applications` record for a student who built a portfolio before
 * 2026-09-30, so their existing work shows up as an application to the legacy
 * general portfolio rather than silently disappearing. No-op if they already
 * have any application.
 */
export async function ensureLegacyApplication(userId: string) {
  try {
    const db = getAdminDb();
    const existing = await db.collection('applications').where('studentId', '==', userId).limit(1).get();
    if (!existing.empty) return { success: true, migrated: false };

    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) return { success: true, migrated: false };
    const user = userSnap.data()!;
    if (!user.status) return { success: true, migrated: false };

    const appId = applicationId(userId, LEGACY_SCHOLARSHIP_ID);
    await db.collection('applications').doc(appId).set({
      id: appId,
      studentId: userId,
      scholarshipId: LEGACY_SCHOLARSHIP_ID,
      scholarshipName: 'General Scholarship Portfolio',
      organizationId: user.organizationId || user.schoolId || 'scholarship-hib4j',
      essay: user.essay ?? null,
      qualificationStatement: user.qualificationStatement ?? null,
      activities: user.activities ?? null,
      essays: user.essays ?? [],
      documents: user.documents ?? [],
      status: user.status,
      submissionDate: user.submissionDate ?? null,
      recommenderName1: user.recommenderName1 ?? '',
      recommenderEmail1: user.recommenderEmail1 ?? '',
      recommenderTitle1: user.recommenderTitle1 ?? '',
      recommendationStatus1: user.recommendationStatus1 ?? 'Not Requested',
      recommendationLetter1: user.recommendationLetter1 ?? null,
      recommendationLetterText1: user.recommendationLetterText1 ?? null,
      recommenderName2: user.recommenderName2 ?? '',
      recommenderEmail2: user.recommenderEmail2 ?? '',
      recommenderTitle2: user.recommenderTitle2 ?? '',
      recommendationStatus2: user.recommendationStatus2 ?? 'Not Requested',
      recommendationLetter2: user.recommendationLetter2 ?? null,
      recommendationLetterText2: user.recommendationLetterText2 ?? null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { success: true, migrated: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendRecommendationRequest(params: {
  applicationId: string;
  studentId: string;
  scholarshipId: string;
  scholarshipName?: string;
  studentName: string;
  recommenderName: string;
  recommenderEmail: string;
  recommenderTitle: string;
  requestIndex: number;
  origin: string;
}) {
  try {
    const db = getAdminDb();
    const scholarshipTitle = params.scholarshipName || 'General Portfolio';

    // applicationId is now a real applications/{id}, not the student's uid, so
    // inviting the same teacher for two scholarships creates two independent
    // tokens and two independent letters.
    const tokenRef = await db.collection('recommendationTokens').add({
      applicationId: params.applicationId,
      studentName: params.studentName,
      recommenderName: params.recommenderName,
      recommenderEmail: params.recommenderEmail,
      scholarshipTitle,
      requestIndex: params.requestIndex,
      used: false,
      cancelled: false,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    const tokenLink = `${params.origin}/recommend/${tokenRef.id}`;

    const emailResult = await sendNotification({
      to: params.recommenderEmail,
      subject: `Recommendation Request for ${params.studentName} — ${scholarshipTitle}`,
      type: 'Recommendation Request',
      text: `Hello ${params.recommenderName}, ${params.studentName} has requested a recommendation for the ${scholarshipTitle}. Link: ${tokenLink}`,
      html: `<p>Hello ${params.recommenderName},</p><p><strong>${params.studentName}</strong> has requested a recommendation letter for the <strong>${scholarshipTitle}</strong>. Please upload it via this secure link: <a href="${tokenLink}">${tokenLink}</a></p>`
    });

    // Identity fields are included because this can be the first write to a
    // brand-new application (a student may invite a recommender before saving
    // a draft). Without them the document would be created with no studentId,
    // making it invisible to the student's own query and unwritable under the
    // applications security rule.
    const appRef = db.collection('applications').doc(params.applicationId);
    const appExists = (await appRef.get()).exists;

    await appRef.set({
      ...(appExists ? {} : {
        id: params.applicationId,
        studentId: params.studentId,
        scholarshipId: params.scholarshipId,
        scholarshipName: scholarshipTitle,
        status: 'Draft',
      }),
      [`recommenderName${params.requestIndex}`]: params.recommenderName,
      [`recommenderEmail${params.requestIndex}`]: params.recommenderEmail,
      [`recommenderTitle${params.requestIndex}`]: params.recommenderTitle,
      [`recommendationStatus${params.requestIndex}`]: 'Pending',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await syncRecommenderToLegacyMirror(params.studentId, params.applicationId, {
      [`recommenderName${params.requestIndex}`]: params.recommenderName,
      [`recommenderEmail${params.requestIndex}`]: params.recommenderEmail,
      [`recommenderTitle${params.requestIndex}`]: params.recommenderTitle,
      [`recommendationStatus${params.requestIndex}`]: 'Pending',
    });

    return { success: true, deliveryMethod: emailResult.method };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendRecommendationReminder(params: {
  applicationId: string;
  requestIndex: number;
  origin: string;
}) {
  try {
    const db = getAdminDb();
    const querySnapshot = await db.collection('recommendationTokens')
      .where('applicationId', '==', params.applicationId)
      .where('requestIndex', '==', params.requestIndex)
      .where('used', '==', false)
      .where('cancelled', '==', false)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return { success: false, error: "Active invitation not found or already used/cancelled." };
    }

    const tokenDoc = querySnapshot.docs[0];
    const tokenData = tokenDoc.data();

    const now = new Date();
    const expiresAt = tokenData.expiresAt?.toDate ? tokenData.expiresAt.toDate() : new Date(tokenData.expiresAt);
    if (now > expiresAt) {
      return { success: false, error: "The recommendation link has expired." };
    }

    const tokenLink = `${params.origin}/recommend/${tokenDoc.id}`;
    const emailResult = await sendRecommendationReminderEmail({
      email: tokenData.recommenderEmail,
      studentName: tokenData.studentName || 'A Student',
      recommenderName: tokenData.recommenderName,
      tokenLink: tokenLink
    });

    if (!emailResult.success) {
      throw new Error(emailResult.error);
    }

    await db.collection('recommendationTokens').doc(tokenDoc.id).update({
      lastReminderSentAt: FieldValue.serverTimestamp()
    });

    await db.collection('applications').doc(params.applicationId).set({
      [`recommendationLastReminder${params.requestIndex}`]: new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, method: emailResult.method };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function cancelRecommendationRequest(params: {
  applicationId: string;
  requestIndex: number;
}) {
  try {
    const db = getAdminDb();
    // 1. Mark active token as cancelled
    const querySnapshot = await db.collection('recommendationTokens')
      .where('applicationId', '==', params.applicationId)
      .where('requestIndex', '==', params.requestIndex)
      .where('used', '==', false)
      .where('cancelled', '==', false)
      .limit(1)
      .get();

    if (!querySnapshot.empty) {
      const tokenDoc = querySnapshot.docs[0];
      await db.collection('recommendationTokens').doc(tokenDoc.id).update({
        cancelled: true,
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    // 2. Reset this application's recommender slot. Cancel is a recovery path,
    //    so it must not fail on an application that was never created — there
    //    is simply nothing to reset in that case.
    const appRef = db.collection('applications').doc(params.applicationId);
    const appSnap = await appRef.get();
    if (appSnap.exists) {
      const reset = {
        [`recommendationStatus${params.requestIndex}`]: 'Not Requested',
        [`recommenderName${params.requestIndex}`]: '',
        [`recommenderEmail${params.requestIndex}`]: '',
        [`recommenderTitle${params.requestIndex}`]: '',
        [`recommendationLastReminder${params.requestIndex}`]: null,
      };
      await appRef.update({ ...reset, updatedAt: FieldValue.serverTimestamp() });

      const studentId = appSnap.data()?.studentId;
      if (studentId) {
        await syncRecommenderToLegacyMirror(studentId, params.applicationId, reset);
      }
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
