'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, initiateEmailSignUp, useFirestore, useFirebase } from '@/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Building2, Eye, EyeOff, Loader2, Search } from 'lucide-react';
import { onAuthStateChanged, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { completeSignup } from './actions';
import { getPublicOrganization, getPublicOrganizations } from '@/app/org-actions';
import type { PublicOrganization } from '@/lib/org-server';

function SignupForm() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { refreshUserRole } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);


  const requestedOrgId = searchParams.get('org');
  const [requestedOrg, setRequestedOrg] = useState<PublicOrganization | null>(null);
  const [isOrgLoading, setIsOrgLoading] = useState(!!requestedOrgId);

  useEffect(() => {
    if (!requestedOrgId) {
      setRequestedOrg(null);
      setIsOrgLoading(false);
      return;
    }
    let cancelled = false;
    setIsOrgLoading(true);
    getPublicOrganization(requestedOrgId).then((org) => {
      if (!cancelled) {
        setRequestedOrg(org);
        setIsOrgLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [requestedOrgId]);

  // No ?org= in the URL (the student landed on /signup directly, not from an
  // organization's page) — let them pick one here instead of silently
  // defaulting them into NEXT_PUBLIC_DEFAULT_ORG_ID.
  const [orgChoices, setOrgChoices] = useState<PublicOrganization[]>([]);
  const [isOrgListLoading, setIsOrgListLoading] = useState(!requestedOrgId);
  const [orgSearch, setOrgSearch] = useState('');
  const [pickedOrgId, setPickedOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (requestedOrgId) return;
    let cancelled = false;
    getPublicOrganizations().then((orgs) => {
      if (!cancelled) {
        setOrgChoices(orgs);
        setIsOrgListLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [requestedOrgId]);

  const filteredOrgChoices = useMemo(() => {
    const term = orgSearch.trim().toLowerCase();
    if (!term) return orgChoices;
    return orgChoices.filter((org) => org.name.toLowerCase().includes(term));
  }, [orgChoices, orgSearch]);

  // The org id completeSignup actually uses: the one carried in the URL, or
  // the one the student picked from the inline directory below.
  const effectiveOrgId = requestedOrgId || pickedOrgId;
  // Only block submission on a missing pick when there is something to pick
  // from — an empty directory falls back to the default organization, same
  // as an invalid/missing ?org= always has.
  const needsOrgPick = !requestedOrgId && !isOrgListLoading && orgChoices.length > 0 && !pickedOrgId;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore || needsOrgPick) return;
    setIsSigningUp(true);
    try {
      await initiateEmailSignUp(auth, email, password);
    } catch (error: any) {
      // Firebase's raw messages ("Firebase: Error (auth/email-already-in-use).")
      // are codes, not something an applicant can act on.
      let description = 'Something went wrong creating your account. Please try again.';
      switch (error.code) {
        case 'auth/email-already-in-use':
          description = 'An account already exists with this email. Try logging in instead, or reset your password if you have forgotten it.';
          break;
        case 'auth/invalid-email':
          description = 'That email address does not look right. Please check it and try again.';
          break;
        case 'auth/weak-password':
          description = 'Please choose a longer password — at least 6 characters.';
          break;
        case 'auth/operation-not-allowed':
          description = 'Sign-ups are not available right now. Please contact support.';
          break;
        case 'auth/too-many-requests':
          description = 'Too many attempts. Please wait a few minutes and try again.';
          break;
        case 'auth/network-request-failed':
          description = 'We could not reach the server. Please check your connection and try again.';
          break;
      }
      toast({ variant: 'destructive', title: "Signup Failed", description });
      setIsSigningUp(false);
    }
  };

  useEffect(() => {
    if (!auth || !firestore) return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && isSigningUp) {
        try {
          await updateProfile(user, { displayName: name });
          // Role and organization are not written here: the rules refuse
          // them from the browser, and completeSignup sets them on the server.
          // Signup only ever creates applicants. Admins and reviewers join
          // through an invitation (src/lib/invites-server.ts).
          await setDoc(doc(firestore, 'users', user.uid), {
            name,
            email: user.email,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true });

        
          const completed = await completeSignup(await user.getIdToken(), effectiveOrgId);
          if (!completed.success) throw new Error(completed.error);
          await refreshUserRole();

          toast({ title: "Account Created", description: "Welcome to Merited." });
          router.push('/dashboard');
        } catch (err) {
         
          console.error('Failed to finish account setup', err);
          toast({
            variant: 'destructive',
            title: 'Almost there',
            description: 'Your login was created, but we could not finish setting up your profile. Please try logging in — if that fails, contact support.',
          });
          setIsSigningUp(false);
        }
      }
    });
    return () => unsubscribe();
  }, [auth, firestore, name, router, isSigningUp, toast, effectiveOrgId]);

  return (
    <form onSubmit={handleSignup}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Create an Account</CardTitle>
          {requestedOrgId && !isOrgLoading && requestedOrg ? (
            <CardDescription>Joining <strong>{requestedOrg.name}</strong> on Merited.</CardDescription>
          ) : requestedOrgId && !isOrgLoading && !requestedOrg ? (
            <CardDescription className="text-amber-600">
              That organization's link looks out of date, so you'll be signed up on Merited's default programs instead.
            </CardDescription>
          ) : (
            <CardDescription>Start your scholarship journey today.</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!requestedOrgId && !isOrgListLoading && orgChoices.length > 0 && (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <Label className="flex items-center gap-1.5 text-sm font-bold">
                <Building2 className="h-4 w-4 text-primary" /> Which organization are you joining?
              </Label>
              {pickedOrgId ? (
                <div className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-sm">
                  <span className="font-medium">{orgChoices.find((o) => o.id === pickedOrgId)?.name}</span>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => setPickedOrgId(null)}
                    disabled={isSigningUp}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={orgSearch}
                      onChange={(e) => setOrgSearch(e.target.value)}
                      placeholder="Search organizations..."
                      className="h-9 pl-8 text-sm"
                      disabled={isSigningUp}
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-md border bg-background">
                    {filteredOrgChoices.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No matches.</p>
                    ) : (
                      filteredOrgChoices.map((org) => (
                        <button
                          key={org.id}
                          type="button"
                          className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-muted/50"
                          onClick={() => setPickedOrgId(org.id)}
                          disabled={isSigningUp}
                        >
                          {org.name}
                        </button>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Don&apos;t see yours? <Link href="/organizations" className="text-primary hover:underline">Browse all organizations</Link>.
                  </p>
                </>
              )}
            </div>
          )}
          <div className="space-y-2"><Label htmlFor="name">Full Name</Label><Input id="name" required value={name} onChange={(e) => setName(e.target.value)} disabled={isSigningUp} /></div>
          <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={isSigningUp} /></div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input id="password" type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} disabled={isSigningUp} />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isSigningUp || isOrgLoading || needsOrgPick}>
            {isSigningUp ? 'Creating Account...' : needsOrgPick ? 'Pick an Organization to Continue' : 'Create Account'}
          </Button>
          <div className="text-center text-sm text-muted-foreground">Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Log in</Link></div>
        </CardFooter>
      </Card>
    </form>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <SignupForm />
    </Suspense>
  );
}
