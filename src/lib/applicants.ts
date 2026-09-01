// src/lib/applicants.ts
import type { Applicant } from '@/types/applicant';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function getApplicants(): Promise<Applicant[]> {
  try {
    const usersCollection = collection(db, 'users');
    const querySnapshot = await getDocs(usersCollection);
    const applicants: Applicant[] = [];
    querySnapshot.forEach((doc) => {
      // Assuming the document data matches the Applicant type structure
      applicants.push({ id: doc.id, ...doc.data() } as Applicant);
    });
    return applicants;
  } catch (error) {
    console.error("Error fetching applicants:", error);
    return []; // Return an empty array in case of error
  }
}

export async function getApplicant(id: string): Promise<Applicant | null> {
  try {
    const docRef = doc(db, 'users', id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Applicant;
    } else {
      console.log("No such applicant!");
      return null;
    }
  } catch (error) {
    console.error("Error fetching applicant:", error);
    return null;
  }
}
