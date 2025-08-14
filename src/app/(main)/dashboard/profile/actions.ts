// src/app/(main)/dashboard/profile/actions.ts
'use server';

import { db, storage } from '@/lib/firebase';
import { Applicant, ApplicantSchema } from '@/types/applicant';
import { addDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

async function uploadFile(file: File | null, path: string): Promise<string> {
    if (file && file.size > 0) {
      const fileRef = ref(storage, `${path}/${Date.now()}-${file.name}`);
      const snapshot = await uploadBytes(fileRef, file);
      return getDownloadURL(snapshot.ref);
    }
    return '';
}

export async function saveApplicantData(formData: FormData) {
  try {
    const data = Object.fromEntries(formData.entries());

    const transcriptUrl = await uploadFile(formData.get('transcripts') as File | null, 'transcripts');
    const resumeUrl = await uploadFile(formData.get('resume') as File | null, 'resumes');
    const acceptanceLetterUrl = await uploadFile(formData.get('acceptanceLetter') as File | null, 'acceptanceLetters');
    
    // Construct the applicant data object
    const applicantData: Omit<Applicant, 'id'> = {
      name: data.name as string,
      email: data.email as string,
      gpa: parseFloat(data.gpa as string),
      major: data.major as string,
      school: data.school as string,
      interests: data.interests as string,
      activities: data.activities as string,
      essay: data.essay as string,
      transcripts: transcriptUrl || data.transcripts as string,
      resume: resumeUrl || data.resume as string,
      acceptanceLetter: acceptanceLetterUrl || data.acceptanceLetter as string,
      isBlind: false,
      firstChoiceSchool: data.firstChoiceSchool as string,
      firstChoiceAccepted: data.firstChoiceAccepted === 'true',
      secondChoiceSchool: data.secondChoiceSchool as string,
      secondChoiceAccepted: data.secondChoiceAccepted === 'true',
    };

    // Use partial schema because not all fields are required on update.
    const validatedData = ApplicantSchema.partial().parse(applicantData);
    
    // Add to Firestore
    const docRef = await addDoc(collection(db, 'applicants'), validatedData);
    
    return { success: true, id: docRef.id };

  } catch (error) {
    console.error('Error saving applicant data:', error);
    if (error instanceof Error) {
        return { success: false, error: error.message };
    }
    return { success: false, error: 'An unknown error occurred.' };
  }
}