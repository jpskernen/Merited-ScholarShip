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
import { useAuth, initiateEmailSignUp, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff } from 'lucide-react';
import { onAuthStateChanged, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { sendWelcomeEmail } from '@/app/lib/notifications';

export default function SignupPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
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
          const role = user.email === 'peyton.vandenbemden@gmail.com' ? 'admin' : 'applicant';
          
          await setDoc(doc(firestore, 'users', user.uid), {
            id: user.uid,
            name,
            email: user.email,
            role,
            schoolId: 'scholarship-hib4j',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true });

          if (role === 'admin') {
            await setDoc(doc(firestore, 'roles_admin', user.uid), { id: user.uid, role: 'admin', grantedAt: serverTimestamp() });
          }

          // Trigger Welcome Email
          await sendWelcomeEmail(user.email!, name);

          toast({ title: "Account Created", description: "Welcome to Merited." });
          router.push(role === 'admin' ? '/admin' : '/dashboard');
        } catch (err) {
          // The Auth account already exists at this point, so swallowing this
          // silently leaves the applicant staring at an unchanged form while
          // their email is now taken.
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
  }, [auth, firestore, name, router, isSigningUp, toast]);

  return (
    <form onSubmit={handleSignup}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Create an Account</CardTitle>
          <CardDescription>Start your scholarship journey today.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <Button type="submit" className="w-full" disabled={isSigningUp}>{isSigningUp ? 'Creating Account...' : 'Create Account'}</Button>
          <div className="text-center text-sm text-muted-foreground">Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Log in</Link></div>
        </CardFooter>
      </Card>
    </form>
  );
}
