// src/app/(main)/dashboard/profile/actions.ts
'use server';

import { db, storage } from '@/lib/firebase';
import { Applicant, ApplicantSchema } from '@/types/applicant';
import { addDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export async function saveApplicantData(formData: FormData) {
  try {
    const data = Object.fromEntries(formData.entries());

    // Handle file uploads first
    const transcriptFile = formData.get('transcripts') as File | null;
    const resumeFile = formData.get('resume') as File | null;
    
    let transcriptUrl = '';
    let resumeUrl = '';

    if (transcriptFile && transcriptFile.size > 0) {
      const transcriptRef = ref(storage, `transcripts/${Date.now()}-${transcriptFile.name}`);
      const transcriptSnapshot = await uploadBytes(transcriptRef, transcriptFile);
      transcriptUrl = await getDownloadURL(transcriptSnapshot.ref);
    }

    if (resumeFile && resumeFile.size > 0) {
      const resumeRef = ref(storage, `resumes/${Date.now()}-${resumeFile.name}`);
      const resumeSnapshot = await uploadBytes(resumeRef, resumeFile);
      resumeUrl = await getDownloadURL(resumeSnapshot.ref);
    }
    
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
      transcripts: transcriptUrl,
      resume: resumeUrl,
      isBlind: false, // Default to not blind
    };

    // Validate with Zod schema (omitting id for creation)
    const validatedData = ApplicantSchema.omit({id: true}).parse(applicantData);
    
    // Add to Firestore
    const docRef = await addDoc(collection(db, 'applicants'), validatedData);
    
    return { success: true, id: docRef.id };

  } catch (error) {
    console.error('Error saving applicant data:', error);
    // Zod errors can be caught here and handled
    if (error instanceof Error) {
        return { success: false, error: error.message };
    }
    return { success: false, error: 'An unknown error occurred.' };
  }
}
