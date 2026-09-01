'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore'
import { getFunctions, Functions } from 'firebase/functions';
import { getStorage, FirebaseStorage } from 'firebase/storage';

export function initializeFirebase() {
  if (typeof window === 'undefined') {
    return { firebaseApp: null, auth: null, firestore: null, functions: null, storage: null };
  }

  const existingApp = getApps().length > 0 ? getApp() : null;
  if (existingApp) {
    return getSdks(existingApp);
  }

  let firebaseApp: FirebaseApp;

  try {
    if (!firebaseConfig.projectId || firebaseConfig.projectId.includes('your_')) {
      console.warn('Firebase Project ID is missing or placeholder. Initialization deferred.');
      return { firebaseApp: null, auth: null, firestore: null, functions: null, storage: null };
    }
    firebaseApp = initializeApp(firebaseConfig);
  } catch (e) {
    console.error('Firebase initialization failed:', e);
    return { firebaseApp: null, auth: null, firestore: null, functions: null, storage: null };
  }

  return getSdks(firebaseApp);
}

export function getSdks(firebaseApp: FirebaseApp) {
  const hasValidApiKey = firebaseApp.options.apiKey && !firebaseApp.options.apiKey.includes('your_');
  
  const auth = hasValidApiKey ? getAuth(firebaseApp) : null;
  const firestore = getFirestore(firebaseApp);
  const functions = getFunctions(firebaseApp);
  const storage = getStorage(firebaseApp);

  return {
    firebaseApp,
    auth,
    firestore,
    functions,
    storage
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
