// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  projectId: 'scholarship-hib4j',
  appId: '1:345364291560:web:5a490f54f942c3e29b4e5d',
  storageBucket: 'scholarship-hib4j.firebasestorage.app',
  apiKey: 'AIzaSyADX4nU03cEdfHuohhEIXmRjnvomVULXEE',
  authDomain: 'scholarship-hib4j.firebaseapp.com',
  messagingSenderId: '345364291560',
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, db, storage };
