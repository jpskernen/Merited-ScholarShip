'use server';

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { Applicant, ApplicantSchema } from '@/types/applicant';
import { firebaseConfig } from '@/firebase/config';

// Initialize Firebase Admin for server-side operations
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

async function uploadFile(file: File, path: string): Promise<string> {
    const fileRef = ref(storage, `${path}/${Date.now()}-${file.name}`);
    const snapshot = await uploadBytes(fileRef, file);
    return getDownloadURL(snapshot.ref);
}

export async function saveApplicantData(userId: string, formData: FormData) {
  try {
    const rawData = Object.fromEntries(formData.entries());

    // Convert checkbox/switch values to boolean and GPA to number
    const data = {
        ...rawData,
        gpa: parseFloat(rawData.gpa as string),
        firstChoiceAccepted: rawData.firstChoiceAccepted === 'true',
        secondChoiceAccepted: rawData.secondChoiceAccepted === 'true',
        thirdChoiceAccepted: rawData.thirdChoiceAccepted === 'true',
        // 'isBlind' is controlled by admin, should not be in applicant form
    };
    
    // Validate all data except files first
    const validatedFields = ApplicantSchema.safeParse(data);

    if (!validatedFields.success) {
      return { 
        success: false, 
        error: 'Invalid data provided.',
        issues: validatedFields.error.flatten().fieldErrors,
      };
    }
    
    const { ...applicantData } = validatedFields.data;

    // Handle file uploads separately
    const fileUploadPromises: Promise<[string, string]>[] = [];
    
    const uploadAndTrack = (fieldName: string) => {
        const file = formData.get(fieldName);
        if (file instanceof File && file.size > 0) {
            const path = `${userId}/${fieldName}`;
            fileUploadPromises.push(uploadFile(file, path).then(url => [fieldName, url]));
        }
    };
    
    uploadAndTrack('transcripts');
    uploadAndTrack('resume');
    uploadAndTrack('acceptanceLetter');
    
    const uploadedFileUrls = await Promise.all(fileUploadPromises);
    const fileUrls = Object.fromEntries(uploadedFileUrls);

    // Merge uploaded file URLs with existing data
    // If a file URL exists from a previous save, it will be in applicantData
    const finalData = {
        ...applicantData,
        ...fileUrls
    };

    const docRef = doc(db, 'users', userId);
    
    // Use setDoc with merge to create or update the document
    await setDoc(docRef, finalData, { merge: true });
    
    return { success: true, id: userId };

  } catch (error) {
    console.error('Error saving applicant data:', error);
    if (error instanceof Error) {
        return { success: false, error: error.message };
    }
    return { success: false, error: 'An unknown error occurred.' };
  }
}
