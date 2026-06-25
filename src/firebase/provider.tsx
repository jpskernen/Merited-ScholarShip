'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { Functions } from 'firebase/functions';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  functions: Functions;
}

// Internal state for user authentication and role metadata
interface UserAuthState {
  user: User | null;
  role: string | null;
  userData: any | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Combined state for the Firebase context
export interface FirebaseContextState {
  areServicesAvailable: boolean;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  functions: Functions | null;
  user: User | null;
  role: string | null;
  userData: any | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  functions: Functions;
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
          // Fetch role and user data from Firestore
          const [userDoc, adminDoc, reviewerDoc] = await Promise.all([
            getDoc(doc(firestore, 'users', firebaseUser.uid)),
            getDoc(doc(firestore, 'roles_admin', firebaseUser.uid)),
            getDoc(doc(firestore, 'reviewers', firebaseUser.uid))
          ]);

          const dbUserData = userDoc.exists() ? userDoc.data() : null;
          
          // Bootstrap role checks
          const isBootstrapAdmin = firebaseUser.email === 'peyton.vandenbemden@gmail.com';
          const isBootstrapReviewer = [
            'hello@merited.com',
            'hellow@meritedapp.com',
            'hello@meritedapp.com',
            'kernenpm@gmail.com'
          ].includes(firebaseUser.email || '');

          let role = dbUserData?.role || null;
          if (isBootstrapAdmin || adminDoc.exists()) role = 'Admin';
          else if (isBootstrapReviewer || reviewerDoc.exists() || role === 'Reviewer') role = 'Reviewer';
          else if (!role) role = 'Applicant';

          setUserAuthState({
            user: firebaseUser,
            role: role,
            userData: dbUserData,
            isUserLoading: false,
            userError: null,
          });
        } catch (error: any) {
          console.error("FirebaseProvider: Role fetch error:", error);
          setUserAuthState({
            user: firebaseUser,
            role: 'Applicant', // Fallback
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
    const servicesAvailable = !!(firebaseApp && firestore && auth && functions);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      functions: servicesAvailable ? functions : null,
      user: userAuthState.user,
      role: userAuthState.role,
      userData: userAuthState.userData,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
    };
  }, [firebaseApp, firestore, auth, functions, userAuthState]);

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
  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth || !context.functions) {
    throw new Error('Firebase core services not available.');
  }
  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    functions: context.functions,
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

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T & {__memo?: boolean} {
  const memoized = useMemo(factory, deps) as any;
  if (memoized && typeof memoized === 'object') memoized.__memo = true;
  return memoized;
}

export const useUser = (): UserHookResult => {
  const { user, role, userData, isUserLoading, userError } = useFirebase();
  return { user, role, userData, isUserLoading, userError };
};
