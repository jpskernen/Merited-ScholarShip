'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect, useCallback } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged, signOut } from 'firebase/auth';
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
  /**
   * Re-reads the signed-in user's role documents. onAuthStateChanged fires the
   * moment an account is created - before onboarding flows have written their
   * users/reviewers docs - so those flows must call this once they're done, or
   * the role stays stuck at the 'applicant' default until a full reload.
   */
  refreshUserRole: () => Promise<void>;
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
  refreshUserRole: () => Promise<void>;
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

  const resolveUserState = useCallback(async (firebaseUser: User, forceRefresh = false): Promise<UserAuthState> => {
    // Role and organization come from the ID token's custom claims, which only
    // server code can set (docs/07 §3.2). users.role is never trusted for
    // access: a user can edit their own user document.
    const [tokenResult, userDoc] = await Promise.all([
      firebaseUser.getIdTokenResult(forceRefresh),
      getDoc(doc(firestore!, 'users', firebaseUser.uid)),
    ]);
    const claims = tokenResult.claims;
    const dbUserData = userDoc.exists() ? userDoc.data() : null;

    let role: 'admin' | 'reviewer' | 'applicant';
    if (claims.platformAdmin === true || claims.role === 'org_admin') {
      role = 'admin';
    } else if (claims.role === 'reviewer') {
      role = 'reviewer';
    } else if (claims.role === 'applicant') {
      role = 'applicant';
    } else {
      // Transitional, for accounts the claims backfill hasn't reached yet
      // (docs/08 §8 releases code before the backfill). Only the role
      // documents, which a user can't create for themselves, count here.
      const [adminDoc, reviewerDoc] = await Promise.all([
        getDoc(doc(firestore!, 'roles_admin', firebaseUser.uid)),
        getDoc(doc(firestore!, 'reviewers', firebaseUser.uid)),
      ]);
      role = adminDoc.exists() ? 'admin' : reviewerDoc.exists() ? 'reviewer' : 'applicant';
    }

    const orgId = typeof claims.orgId === 'string' ? claims.orgId : null;
    return {
      user: firebaseUser,
      role,
      userData: {
        ...dbUserData,
        role,
        platformAdmin: claims.platformAdmin === true,
        // The token's organization wins over the (user-editable) document.
        ...(orgId ? { organizationId: orgId } : {}),
      },
      isUserLoading: false,
      userError: null,
    };
  }, [firestore]);

  const refreshUserRole = useCallback(async () => {
    const currentUser = auth?.currentUser;
    if (!currentUser || !firestore) return;
    try {
      // Force a token refresh so claims the server just changed are picked up.
      setUserAuthState(await resolveUserState(currentUser, true));
    } catch (error: any) {
      setUserAuthState(prev => ({ ...prev, userError: error }));
    }
  }, [auth, firestore, resolveUserState]);

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
          setUserAuthState(await resolveUserState(firebaseUser));
        } catch (error: any) {
          setUserAuthState({
            user: firebaseUser,
            role: 'applicant',
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
  }, [auth, firestore, resolveUserState]);

  const signedInUid = userAuthState.user?.uid;
  useEffect(() => {
    if (!auth || !firestore || !signedInUid) return;
    return onSnapshot(
      doc(firestore, 'users', signedInUid),
      (snapshot) => {
        if (snapshot.data()?.role === 'revoked') void signOut(auth);
      },
      () => { /* an unreadable profile is handled elsewhere */ },
    );
  }, [auth, firestore, signedInUid]);

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
      refreshUserRole,
    };
  }, [firebaseApp, firestore, auth, functions, storage, userAuthState, refreshUserRole]);

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
    refreshUserRole: context.refreshUserRole,
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