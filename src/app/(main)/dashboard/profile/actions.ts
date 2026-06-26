'use server';

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { Applicant, ApplicantSchema } from '@/types/applicant';
import { firebaseConfig } from '@/firebase/config';
import sgMail from '@sendgrid/mail';

// Initialize Firebase for server-side operations
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

    if (isSubmit) {
      dataToSave.status = 'Submitted';
      dataToSave.submissionDate = new Date().toISOString();
    } else if (!dataToSave.status) {
      dataToSave.status = 'Draft';
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

    // If submitted, create an entry in the applications subcollection for history
    if (isSubmit) {
      const appHistoryRef = collection(db, 'users', userId, 'applications');
      await addDoc(appHistoryRef, {
        scholarshipName: 'General Scholarship Portfolio',
        status: 'Submitted',
        submissionDate: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });
    }
    
    return { success: true, id: userId };

  } catch (error) {
    console.error('Error saving applicant data:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, error: message };
  }
}

/**
 * Server Action to handle recommendation requests securely.
 */
export async function sendRecommendationRequest(params: {
  applicationId: string;
  studentName: string;
  recommenderName: string;
  recommenderEmail: string;
  recommenderTitle: string;
  requestIndex: number;
  origin: string;
}) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'scholarships@meritedapp.com';
  let emailSent = false;

  try {
    // 1. Create a secure token in Firestore
    const tokenRef = await addDoc(collection(db, 'recommendationTokens'), {
      applicationId: params.applicationId,
      studentName: params.studentName,
      recommenderName: params.recommenderName,
      recommenderEmail: params.recommenderEmail,
      scholarshipTitle: 'General Scholarship Portfolio',
      requestIndex: params.requestIndex,
      used: false,
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });

    const tokenLink = `${params.origin}/recommend/${tokenRef.id}`;

    // 2. Dispatch Email via SendGrid if API key is present and valid
    if (apiKey && !apiKey.includes('YOUR_SENDGRID')) {
      sgMail.setApiKey(apiKey);
      const msg = {
        to: params.recommenderEmail,
        from: fromEmail,
        subject: `Recommendation Request for ${params.studentName}`,
        text: `Hello ${params.recommenderName},\n\n${params.studentName} has requested a recommendation letter for their scholarship application. Please upload your letter using the secure link below:\n\n${tokenLink}\n\nThank you for supporting student success.`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #111827;">Recommendation Request</h2>
            <p>Hello ${params.recommenderName},</p>
            <p><strong>${params.studentName}</strong> has requested a recommendation letter for their scholarship application.</p>
            <div style="margin: 30px 0; text-align: center;">
              <a href="${tokenLink}" style="background-color: #111827; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Upload Recommendation Letter</a>
            </div>
            <p style="color: #6b7280; font-size: 12px;">This link is secure and unique to this request. Do not share it.</p>
          </div>
        `,
      };
      
      try {
        await sgMail.send(msg);
        console.log(`Email successfully sent to ${params.recommenderEmail}`);
        emailSent = true;
      } catch (sgError: any) {
        console.error('SendGrid API Error:', sgError.response?.body || sgError.message);
      }
    } else {
      console.warn('SENDGRID_API_KEY is missing or using placeholder. Email dispatch skipped but logged to system outbox.');
    }

    // 3. Always log simulated email for visibility in the prototype dashboard
    await addDoc(collection(db, 'sent_emails'), {
      recipient: params.recommenderEmail,
      subject: `Recommendation Request for ${params.studentName}`,
      body: emailSent ? `Live email sent via SendGrid.` : `Simulated email (API Key missing). Link: ${tokenLink}`,
      type: 'Recommendation Request',
      deliveryMethod: emailSent ? 'SendGrid' : 'Simulation',
      sentAt: serverTimestamp()
    });

    // 4. Update the student document status
    const studentRef = doc(db, 'users', params.applicationId);
    await setDoc(studentRef, {
      [`recommendationStatus${params.requestIndex}`]: 'Pending',
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return { 
      success: true, 
      tokenId: tokenRef.id, 
      emailSent,
      deliveryMethod: emailSent ? 'SendGrid' : 'System Outbox'
    };
  } catch (error: any) {
    console.error('sendRecommendationRequest Error:', error);
    return { success: false, error: error.message || 'Failed to dispatch request.' };
  }
}
