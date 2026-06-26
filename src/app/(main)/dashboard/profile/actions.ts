'use server';

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { Applicant, ApplicantSchema } from '@/types/applicant';
import { firebaseConfig } from '@/firebase/config';
import { sendSubmissionConfirmation, sendNotification } from '@/app/lib/notifications';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

async function uploadFile(file: File, path: string): Promise<string> {
    const fileRef = ref(storage, path);
    const snapshot = await uploadBytes(fileRef, file);
    return getDownloadURL(snapshot.ref);
}

export async function saveApplicantData(userId: string, formData: FormData, isSubmit: boolean = false) {
  try {
    const rawData = Object.fromEntries(formData.entries());
    const docRef = doc(db, 'users', userId);
    const existingSnap = await getDoc(docRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : {};

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

    if (isSubmit) {
      dataToSave.status = 'Submitted';
      dataToSave.submissionDate = new Date().toISOString();
    } else if (!dataToSave.status) {
      dataToSave.status = 'Draft';
    }

    dataToSave.updatedAt = serverTimestamp();

    const validationSchema = isSubmit ? ApplicantSchema : ApplicantSchema.partial();
    const validated = validationSchema.safeParse(dataToSave);

    if (!validated.success) {
      return { success: false, error: 'Validation failed.' };
    }

    await setDoc(docRef, validated.data, { merge: true });

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
    const tokenRef = await addDoc(collection(db, 'recommendationTokens'), {
      applicationId: params.applicationId,
      studentName: params.studentName,
      recommenderName: params.recommenderName,
      recommenderEmail: params.recommenderEmail,
      scholarshipTitle: 'General Portfolio',
      requestIndex: params.requestIndex,
      used: false,
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    const tokenLink = `${params.origin}/recommend/${tokenRef.id}`;

    await sendNotification({
      to: params.recommenderEmail,
      subject: `Recommendation Request for ${params.studentName}`,
      type: 'Recommendation Request',
      text: `Hello ${params.recommenderName}, ${params.studentName} has requested a recommendation. Link: ${tokenLink}`,
      html: `<p>Hello ${params.recommenderName},</p><p><strong>${params.studentName}</strong> has requested a recommendation letter. Please upload it via this secure link: <a href="${tokenLink}">${tokenLink}</a></p>`
    });

    await setDoc(doc(db, 'users', params.applicationId), {
      [`recommendationStatus${params.requestIndex}`]: 'Pending',
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
