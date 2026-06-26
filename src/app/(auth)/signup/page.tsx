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
      // We await this to catch specific auth errors like email-already-in-use
      await initiateEmailSignUp(auth, email, password);
      
      toast({
        title: 'Success',
        description: 'Creating your profile...',
      });
      
    } catch (error: any) {
      // Do not use console.error here as it triggers the dev overlay for common user errors
      let message = 'An unexpected error occurred during signup.';
      if (error.code === 'auth/email-already-in-use') {
        message = 'This email is already registered. Please try logging in instead.';
      } else if (error.code === 'auth/weak-password') {
        message = 'The password is too weak. Please use at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'The email address is badly formatted.';
      }
      
      toast({
        variant: 'destructive',
        title: 'Signup Failed',
        description: message,
      });
      setIsSigningUp(false);
    }
  };

  useEffect(() => {
    if (!auth || !firestore) return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && isSigningUp) {
        try {
          // Set display name in Auth
          await updateProfile(user, { displayName: name });

          const isSuperAdmin = user.email === 'peyton.vandenbemden@gmail.com';
          const isReviewerAccount = user.email === 'reviewer@test.com';
          
          let role = 'Applicant';
          let schoolId = 'default-school';

          if (isSuperAdmin) {
            role = 'Admin';
            schoolId = 'scholarship-hib4j';
          } else if (isReviewerAccount) {
            role = 'Reviewer';
            schoolId = 'scholarship-hib4j';
          }

          // Create the user document in Firestore
          const userRef = doc(firestore, 'users', user.uid);
          await setDoc(userRef, {
            id: user.uid,
            name: name,
            email: user.email,
            role: role,
            schoolId: schoolId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true });

          // If super admin email, also grant roles_admin privileges
          if (isSuperAdmin) {
            await setDoc(doc(firestore, 'roles_admin', user.uid), {
              id: user.uid,
              role: 'Admin',
              grantedAt: serverTimestamp()
            });
          }

          // If reviewer test account, ensure registration in reviewers collection
          if (isReviewerAccount) {
            await setDoc(doc(firestore, 'reviewers', user.uid), {
              id: user.uid,
              schoolId: schoolId,
              role: 'Reviewer',
              assignedDate: serverTimestamp()
            });
          }

          toast({
            title: role + ' account created!',
            description: 'Welcome to your dashboard.',
          });

          if (role === 'Admin') router.push('/admin');
          else if (role === 'Reviewer') router.push('/reviewer/dashboard');
          else router.push('/dashboard/profile');

        } catch (err: any) {
          // Internal system error - can be logged but handle gracefully for UI
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
          <CardDescription>
            Start your scholarship journey today.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input 
              id="name" 
              placeholder="Jane Doe" 
              required 
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSigningUp}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="m@example.com" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSigningUp}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input 
                id="password" 
                type={showPassword ? "text" : "password"} 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSigningUp}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">
                  {showPassword ? "Hide password" : "Show password"}
                </span>
              </button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isSigningUp}>
            {isSigningUp ? 'Creating Account...' : 'Create Account'}
          </Button>
          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}
