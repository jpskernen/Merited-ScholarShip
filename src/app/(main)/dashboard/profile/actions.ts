
'use server';

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { Applicant, ApplicantSchema } from '@/types/applicant';
import { firebaseConfig } from '@/firebase/config';

// Initialize Firebase for server-side operations
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

async function uploadFile(file: File, path: string): Promise<string> {
    const fileRef = ref(storage, path);
    const snapshot = await uploadBytes(fileRef, file);
    return getDownloadURL(snapshot.ref);
}

export async function saveApplicantData(userId: string, formData: FormData) {
  try {
    const rawData = Object.fromEntries(formData.entries());
    const docRef = doc(db, 'users', userId);

    const existingDoc = await getDoc(docRef);
    const existingData = existingDoc.exists() ? existingDoc.data() : {};

    const dataToSave: { [key: string]: any } = {
        ...existingData,
    };

    for (const [key, value] of Object.entries(rawData)) {
        if (value instanceof File) {
            if (value.size === 0) continue;
        }
        
        if (key.endsWith('Accepted') && typeof value === 'string') {
            dataToSave[key] = value === 'on';
        } else if (key === 'gpa') {
            dataToSave[key] = parseFloat(value as string);
        } else {
             dataToSave[key] = value;
        }
    }
    
    const fileFields: (keyof Applicant)[] = [
      'transcripts', 
      'resume', 
      'acceptanceLetter', 
      'recommendationLetter1', 
      'recommendationLetter2'
    ];

    for (const fieldName of fileFields) {
        const file = formData.get(fieldName) as File | null;
        if (file && file.size > 0) {
            const path = `${userId}/${fieldName}/${Date.now()}-${file.name}`;
            const downloadURL = await uploadFile(file, path);
            dataToSave[fieldName] = downloadURL;
        } else if (existingData && existingData[fieldName]) {
            dataToSave[fieldName] = existingData[fieldName];
        } else {
            delete dataToSave[fieldName];
        }
    }

    const finalDataForValidation = { ...dataToSave };
    for (const field of fileFields) {
        if (finalDataForValidation[field] === '') {
            delete finalDataForValidation[field];
        }
    }
    
    const validatedFields = ApplicantSchema.safeParse(finalDataForValidation);

    if (!validatedFields.success) {
      console.error('Validation Errors:', validatedFields.error.flatten().fieldErrors);
      return { 
        success: false, 
        error: 'Invalid data provided.',
        issues: validatedFields.error.flatten().fieldErrors,
      };
    }

    await setDoc(docRef, validatedFields.data, { merge: true });
    
    return { success: true, id: userId };

  } catch (error) {
    console.error('Error saving applicant data:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, error: message };
  }
}
