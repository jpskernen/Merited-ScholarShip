'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { Functions } from 'firebase/functions';
import { FirebaseStorage } from 'firebase/storage';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  functions: Functions | null;
  storage: FirebaseStorage | null;
}

interface UserAuthState {
  user: User | null;
  role: string | null;
  userData: any | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface FirebaseContextState {
  areServicesAvailable: boolean;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  functions: Functions | null;
  storage: FirebaseStorage | null;
  user: User | null;
  role: string | null;
  userData: any | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  functions: Functions | null;
  storage: FirebaseStorage | null;
  user: User | null;
  role: string | null;
  userData: any | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface UserHookResult {
  user: User | null;
  role: string | null;
  userData: any | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
  functions,
  storage,
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    role: null,
    userData: null,
    isUserLoading: true,
    userError: null,
  });

  useEffect(() => {
    if (!auth || !firestore) {
      setUserAuthState(prev => ({ ...prev, isUserLoading: false }));
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (!firebaseUser) {
          setUserAuthState({
            user: null,
            role: null,
            userData: null,
            isUserLoading: false,
            userError: null,
          });
          return;
        }

        try {
          // Perform parallel lookups to determine role
          const [userDoc, adminDoc, reviewerDoc] = await Promise.all([
            getDoc(doc(firestore, 'users', firebaseUser.uid)),
            getDoc(doc(firestore, 'roles_admin', firebaseUser.uid)),
            getDoc(doc(firestore, 'reviewers', firebaseUser.uid))
          ]);

          const dbUserData = userDoc.exists() ? userDoc.data() : null;
          
          let role = 'Applicant';
          
          const isHardcodedAdmin = firebaseUser.email === 'peyton.vandenbemden@gmail.com';
          const isHardcodedReviewer = firebaseUser.email === 'reviewer@test.com' || firebaseUser.uid === 'vj3d8Nz7O5QA1XXlK5QtCj03OZF2';

          if (adminDoc.exists() || isHardcodedAdmin) {
            role = 'Admin';
          } else if (reviewerDoc.exists() || dbUserData?.role?.toLowerCase() === 'reviewer' || isHardcodedReviewer) {
            role = 'Reviewer';
          } else if (dbUserData?.role) {
            // Standardize role casing
            const rawRole = dbUserData.role.toLowerCase();
            if (rawRole === 'admin') role = 'Admin';
            else if (rawRole === 'reviewer') role = 'Reviewer';
            else role = 'Applicant';
          }

          // Force Organization ID for test reviewer if missing
          if (firebaseUser.uid === 'vj3d8Nz7O5QA1XXlK5QtCj03OZF2' && dbUserData && !dbUserData.organizationId) {
             dbUserData.organizationId = 'scholarship-hib4j';
             dbUserData.schoolId = 'scholarship-hib4j';
          }

          setUserAuthState({
            user: firebaseUser,
            role: role,
            userData: dbUserData,
            isUserLoading: false,
            userError: null,
          });
        } catch (error: any) {
          console.error("Role resolution error:", error);
          setUserAuthState({
            user: firebaseUser,
            role: 'Applicant',
            userData: null,
            isUserLoading: false,
            userError: error,
          });
        }
      },
      (error) => {
        setUserAuthState({ user: null, role: null, userData: null, isUserLoading: false, userError: error });
      }
    );
    return () => unsubscribe();
  }, [auth, firestore]);

  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth && storage);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp,
      firestore,
      auth,
      functions,
      storage,
      user: userAuthState.user,
      role: userAuthState.role,
      userData: userAuthState.userData,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
    };
  }, [firebaseApp, firestore, auth, functions, storage, userAuthState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);
  if (context === undefined) throw new Error('useFirebase must be used within a FirebaseProvider.');
  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    functions: context.functions,
    storage: context.storage,
    user: context.user,
    role: context.role,
    userData: context.userData,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
};

export const useAuth = () => useFirebase().auth;
export const useFirestore = () => useFirebase().firestore;
export const useFirebaseApp = () => useFirebase().firebaseApp;
export const useFunctions = () => useFirebase().functions;
export const useStorage = () => useFirebase().storage;

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T & {__memo?: boolean} {
  const memoized = useMemo(factory, deps) as any;
  if (memoized && typeof memoized === 'object') memoized.__memo = true;
  return memoized;
}

export const useUser = (): UserHookResult => {
  const { user, role, userData, isUserLoading, userError } = useFirebase();
  return { user, role, userData, isUserLoading, userError };
};
