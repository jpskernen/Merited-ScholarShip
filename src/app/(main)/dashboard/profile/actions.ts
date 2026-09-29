
'use server';

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/firebase/admin';
import { Applicant, ApplicantSchema } from '@/types/applicant';
import { firebaseConfig } from '@/firebase/config';
import { sendSubmissionConfirmation, sendNotification, sendRecommendationReminderEmail } from '@/app/lib/notifications';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const storage = getStorage(app);

async function uploadFile(file: File, path: string): Promise<string> {
    const fileRef = ref(storage, path);
    const snapshot = await uploadBytes(fileRef, file);
    return getDownloadURL(snapshot.ref);
}

export async function saveApplicantData(userId: string, formData: FormData, isSubmit: boolean = false) {
  try {
    const db = getAdminDb();
    const rawData = Object.fromEntries(formData.entries());
    const docRef = db.collection('users').doc(userId);
    const existingSnap = await docRef.get();
    const existingData = existingSnap.exists ? existingSnap.data() : {};

    const dataToSave: any = { ...existingData };

    for (const [key, value] of Object.entries(rawData)) {
        if (value instanceof File && value.size > 0) {
            const path = `applications/${userId}/${key}/${Date.now()}-${value.name}`;
            dataToSave[key] = await uploadFile(value, path);
        } else if (typeof value === 'string' && key !== 'gpa') {
            dataToSave[key] = value;
        } else if (key === 'gpa') {
            dataToSave[key] = value === '' ? 0 : parseFloat(value as string);
        }
    }

    const organizationId = dataToSave.organizationId || dataToSave.schoolId || 'scholarship-hib4j';

    if (isSubmit) {
      dataToSave.status = 'Submitted';
      dataToSave.submissionDate = new Date().toISOString();

      // Create a specific application record in the hierarchical sub-collection
      const scholarshipId = 'general-portfolio'; // Default if not specified
      const appRef = db
        .collection('organizations').doc(organizationId)
        .collection('scholarships').doc(scholarshipId)
        .collection('applications').doc(userId);
      await appRef.set({
        id: userId,
        studentId: userId,
        organizationId: organizationId,
        scholarshipId: scholarshipId,
        status: 'Submitted',
        data: dataToSave,
        submittedAt: FieldValue.serverTimestamp()
      });
    } else if (!dataToSave.status) {
      dataToSave.status = 'Draft';
    }

    dataToSave.updatedAt = FieldValue.serverTimestamp();

    const validationSchema = isSubmit ? ApplicantSchema : ApplicantSchema.partial();
    const validated = validationSchema.safeParse(dataToSave);

    if (!validated.success) {
      const fieldErrors = validated.error.issues
        .map(issue => `${issue.path.join('.') || 'form'}: ${issue.message}`)
        .join('; ');
      return { success: false, error: `Validation failed - ${fieldErrors}` };
    }

    await docRef.set(validated.data, { merge: true });

    if (isSubmit && dataToSave.email) {
      await sendSubmissionConfirmation(dataToSave.email, dataToSave.name || 'Student');
    }

    return { success: true, id: userId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendRecommendationRequest(params: {
  applicationId: string;
  studentName: string;
  recommenderName: string;
  recommenderEmail: string;
  recommenderTitle: string;
  requestIndex: number;
  origin: string;
}) {
  try {
    const db = getAdminDb();
    const tokenRef = await db.collection('recommendationTokens').add({
      applicationId: params.applicationId,
      studentName: params.studentName,
      recommenderName: params.recommenderName,
      recommenderEmail: params.recommenderEmail,
      scholarshipTitle: 'General Portfolio',
      requestIndex: params.requestIndex,
      used: false,
      cancelled: false,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    const tokenLink = `${params.origin}/recommend/${tokenRef.id}`;

    const emailResult = await sendNotification({
      to: params.recommenderEmail,
      subject: `Recommendation Request for ${params.studentName}`,
      type: 'Recommendation Request',
      text: `Hello ${params.recommenderName}, ${params.studentName} has requested a recommendation. Link: ${tokenLink}`,
      html: `<p>Hello ${params.recommenderName},</p><p><strong>${params.studentName}</strong> has requested a recommendation letter. Please upload it via this secure link: <a href="${tokenLink}">${tokenLink}</a></p>`
    });

    await db.collection('users').doc(params.applicationId).set({
      [`recommendationStatus${params.requestIndex}`]: 'Pending',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

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

    await db.collection('users').doc(params.applicationId).update({
      [`recommendationLastReminder${params.requestIndex}`]: new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp()
    });

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

    // 2. Reset student record
    await db.collection('users').doc(params.applicationId).update({
      [`recommendationStatus${params.requestIndex}`]: 'Not Requested',
      [`recommenderName${params.requestIndex}`]: '',
      [`recommenderEmail${params.requestIndex}`]: '',
      [`recommenderTitle${params.requestIndex}`]: '',
      [`recommendationLastReminder${params.requestIndex}`]: null,
      updatedAt: FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
