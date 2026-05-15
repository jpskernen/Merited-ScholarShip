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
import { useAuth, initiateEmailSignIn, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function LoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Synchronized Redirection Logic
  useEffect(() => {
    if (!auth || !firestore) return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && isSigningIn) {
        try {
          // Check roles to determine redirect
          const [adminDoc, userDoc] = await Promise.all([
            getDoc(doc(firestore, 'roles_admin', user.uid)),
            getDoc(doc(firestore, 'users', user.uid))
          ]);
          
          const isAdmin = adminDoc.exists() || user.email === 'peyton.vandenbemden@gmail.com';
          const userData = userDoc.exists() ? userDoc.data() : null;
          const isReviewer = userData?.role === 'Reviewer';

          if (isAdmin) {
            router.push('/admin');
          } else if (isReviewer) {
            router.push('/review');
          } else {
            router.push('/dashboard');
          }
        } catch (error) {
          // Fallback to default dashboard on any lookup error
          router.push('/dashboard');
        }
      }
    });
    return () => unsubscribe();
  }, [auth, firestore, isSigningIn, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setIsSigningIn(true);
    try {
      await initiateEmailSignIn(auth, email, password);
      toast({
        title: 'Authenticating...',
        description: 'Verifying your credentials and access level.',
      });
    } catch (error: any) {
      let message = 'Please check your credentials and try again.';
      if (
        error.code === 'auth/user-not-found' || 
        error.code === 'auth/wrong-password' || 
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/invalid-email'
      ) {
        message = 'Invalid email or password.';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many failed login attempts. Please try again later.';
      }
      
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: message,
      });
      setIsSigningIn(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>
            Enter your email below to log in to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSigningIn}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" size="sm" className="text-sm font-medium text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSigningIn}
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
          <Button type="submit" className="w-full" disabled={isSigningIn}>
            {isSigningIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSigningIn ? 'Verifying Access...' : 'Log in'}
          </Button>
          <div className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}
