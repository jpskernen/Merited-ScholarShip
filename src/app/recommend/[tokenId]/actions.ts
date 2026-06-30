
'use client';
// Note: This file is intentionally client-side for now because jspdf and storage uploads 
// often rely on client-side context for simplicity in this prototype. 
// However, the function logic is structured for E2E flow.

import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getStorage } from 'firebase/storage';
import { jsPDF } from 'jspdf';
import { sendNotification } from '@/app/lib/notifications';
import { getApps, initializeApp, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export async function submitTypedRecommendation(tokenId: string, text: string, tokenData: any) {
  try {
    // 1. Generate PDF from text
    const docPdf = new jsPDF();
    const margin = 20;
    const width = docPdf.internal.pageSize.getWidth() - (margin * 2);
    
    docPdf.setFontSize(16);
    docPdf.text('Recommendation Letter', margin, 20);
    
    docPdf.setFontSize(10);
    docPdf.text(`For: ${tokenData.studentName}`, margin, 30);
    docPdf.text(`By: ${tokenData.recommenderName}`, margin, 35);
    docPdf.text(`Date: ${new Date().toLocaleDateString()}`, margin, 40);
    
    docPdf.setFontSize(11);
    const splitText = docPdf.splitTextToSize(text, width);
    docPdf.text(splitText, margin, 50);
    
    const pdfBlob = docPdf.output('blob');

    // 2. Upload to Storage
    const storageRef = ref(storage, `recommendations/${tokenId}.pdf`);
    await uploadBytes(storageRef, pdfBlob);
    const downloadURL = await getDownloadURL(storageRef);

    // 3. Update Token Document
    const tokenRef = doc(db, 'recommendationTokens', tokenId);
    await updateDoc(tokenRef, {
      used: true,
      fileUrl: downloadURL,
      letterText: text, // Saved for easy admin viewing
      updatedAt: serverTimestamp()
    });

    // 4. Update Student Application
    const studentRef = doc(db, 'users', tokenData.applicationId);
    const studentSnap = await getDoc(studentRef);
    const studentData = studentSnap.exists() ? studentSnap.data() : null;

    const index = tokenData.requestIndex || 1;
    await updateDoc(studentRef, {
      [`recommendationStatus${index}`]: 'Received',
      [`recommendationLetter${index}`]: downloadURL,
      updatedAt: serverTimestamp()
    });

    // 5. Send Confirmation Emails
    // To Recommender
    await sendNotification({
      to: tokenData.recommenderEmail,
      subject: 'Recommendation Submitted Successfully',
      type: 'Recommendation Received',
      text: `Your recommendation letter for ${tokenData.studentName} has been received. Thank you.`,
      html: `<p>Hello ${tokenData.recommenderName},</p><p>Your recommendation letter for <strong>${tokenData.studentName}</strong> has been submitted successfully to the ScholarShip selection committee. Thank you for supporting their academic journey.</p>`
    });

    // To Student
    if (studentData?.email) {
      await sendNotification({
        to: studentData.email,
        subject: 'Endorsement Received',
        type: 'Recommendation Received',
        text: `A recommendation letter has been uploaded by ${tokenData.recommenderName}.`,
        html: `<p>Hi ${studentData.name},</p><p>We have received a new recommendation letter for your portfolio from <strong>${tokenData.recommenderName}</strong>.</p>`
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('Submission Error:', error);
    return { success: false, error: error.message };
  }
}
