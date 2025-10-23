
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

    // 1. Get existing data to preserve old file URLs if no new file is uploaded
    const existingDoc = await getDoc(docRef);
    const existingData = existingDoc.exists() ? existingDoc.data() : {};

    // 2. Prepare data object for validation and saving
    const dataToSave: { [key: string]: any } = {
        ...existingData, // Start with existing data
    };

    // 3. Process and merge form data
    for (const [key, value] of Object.entries(rawData)) {
        if (value instanceof File) {
            // Skip empty file inputs
            if (value.size === 0) {
                continue;
            }
        }
        
        // Convert checkbox values from 'on' to boolean
        if (key.endsWith('Accepted') && typeof value === 'string') {
            dataToSave[key] = value === 'on';
        } else if (key === 'gpa') {
            dataToSave[key] = parseFloat(value as string);
        } else {
             dataToSave[key] = value;
        }
    }
    
    // 4. Handle file uploads and update URLs
    const fileFields: (keyof Applicant)[] = ['transcripts', 'resume', 'acceptanceLetter'];
    for (const fieldName of fileFields) {
        const file = formData.get(fieldName) as File | null;
        if (file && file.size > 0) {
            const path = `${userId}/${fieldName}/${Date.now()}-${file.name}`;
            const downloadURL = await uploadFile(file, path);
            dataToSave[fieldName] = downloadURL;
        } else if (existingData && existingData[fieldName]) {
            // If no new file, keep the old one
            dataToSave[fieldName] = existingData[fieldName];
        } else {
            // If no new file and no old file, ensure it's undefined
            delete dataToSave[fieldName];
        }
    }

    // 5. Validate the final merged data
    // We remove file fields before validation if they are just empty strings
    // Zod will handle the actual validation logic based on the schema
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

    // 6. Save the final, validated data to Firestore
    await setDoc(docRef, validatedFields.data, { merge: true });
    
    return { success: true, id: userId };

  } catch (error) {
    console.error('Error saving applicant data:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, error: message };
  }
}
