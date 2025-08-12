// src/lib/applicants.ts
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Applicant } from '@/types/applicant';

export async function getApplicants(): Promise<Applicant[]> {
  const querySnapshot = await getDocs(collection(db, 'applicants'));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Applicant));
}

export async function getApplicant(id: string): Promise<Applicant | null> {
  const docRef = doc(db, 'applicants', id);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Applicant;
  } else {
    return null;
  }
}
