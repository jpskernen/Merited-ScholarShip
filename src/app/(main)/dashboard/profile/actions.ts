// src/app/(main)/dashboard/profile/actions.ts
'use server';

import { db, storage } from '@/lib/firebase';
import { Applicant, ApplicantSchema } from '@/types/applicant';
import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

async function uploadFile(file: File, path: string): Promise<string> {
    const fileRef = ref(storage, `${path}/${Date.now()}-${file.name}`);
    const snapshot = await uploadBytes(fileRef, file);
    return getDownloadURL(snapshot.ref);
}

export async function saveApplicantData(formData: FormData) {
  try {
    const rawData = Object.fromEntries(formData.entries());
    
    // Convert checkbox/switch values to boolean
    const data = {
        ...rawData,
        gpa: rawData.gpa,
        firstChoiceAccepted: rawData.firstChoiceAccepted === 'true',
        secondChoiceAccepted: rawData.secondChoiceAccepted === 'true',
        thirdChoiceAccepted: rawData.thirdChoiceAccepted === 'true',
    };
    
    const validatedFields = ApplicantSchema.safeParse(data);

    if (!validatedFields.success) {
      return { 
        success: false, 
        error: 'Invalid data provided.',
        issues: validatedFields.error.flatten().fieldErrors,
      };
    }
    
    const { 
        id, 
        transcripts, 
        resume, 
        acceptanceLetter, 
        ...applicantData 
    } = validatedFields.data;

    const fileUploads: Promise<[string, string|null]>[] = [];

    const uploadAndTrack = (file: File | string | undefined, path: string, fieldName: string) => {
        if (file instanceof File) {
            fileUploads.push(uploadFile(file, path).then(url => [fieldName, url]));
        }
    };
    
    uploadAndTrack(transcripts, 'transcripts', 'transcripts');
    uploadAndTrack(resume, 'resumes', 'resume');
    uploadAndTrack(acceptanceLetter, 'acceptanceLetters', 'acceptanceLetter');
    
    const uploadedFileUrls = await Promise.all(fileUploads);
    const fileUrls = Object.fromEntries(uploadedFileUrls);

    const finalData = {
        ...applicantData,
        ...fileUrls
    };

    // In a real app, you'd get the applicant's ID from their session or a hidden form field.
    // For now, we'll create a new one if no ID exists.
    const applicantId = id || 'mock-applicant-id'; // This should be the real user's applicant ID
    const docRef = doc(db, 'applicants', applicantId);
    
    await setDoc(docRef, finalData, { merge: true });
    
    return { success: true, id: applicantId };

  } catch (error) {
    console.error('Error saving applicant data:', error);
    if (error instanceof Error) {
        return { success: false, error: error.message };
    }
    return { success: false, error: 'An unknown error occurred.' };
  }
}
