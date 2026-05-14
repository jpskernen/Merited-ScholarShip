
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
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function ReviewerLoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setIsSigningIn(true);
    try {
      initiateEmailSignIn(auth, email, password);
      toast({
        title: 'Verifying Credentials',
        description: 'Authenticating for secure portal access.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.message || 'An unexpected error occurred.',
      });
      setIsSigningIn(false);
    }
  };

  useEffect(() => {
    if (!auth || !firestore) return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && isSigningIn) {
        try {
          // Check roles to determine redirect
          const adminDoc = await getDoc(doc(firestore, 'roles_admin', user.uid));
          const userDoc = await getDoc(doc(firestore, 'users', user.uid));
          
          const isAdmin = adminDoc.exists() && (adminDoc.data().role === 'Admin' || adminDoc.data().role === 'Sponsor');
          const isReviewer = userDoc.exists() && userDoc.data().role === 'Reviewer';

          if (isAdmin) {
            router.push('/admin');
          } else if (isReviewer) {
            router.push('/review');
          } else {
            router.push('/dashboard');
          }
        } catch (err) {
          console.error("Redirection error:", err);
          router.push('/dashboard');
        }
      }
    });
    return () => unsubscribe();
  }, [auth, firestore, isSigningIn, router]);

  return (
    <form onSubmit={handleLogin}>
      <Card className="border-primary/20 shadow-xl">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-black uppercase tracking-widest">Secure Access</span>
          </div>
          <CardTitle className="text-2xl">Reviewer Portal</CardTitle>
          <CardDescription>
            Enter your credentials to access the scholarship committee workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Work Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="reviewer@organization.org" 
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
                Forgot?
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
              </button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full font-bold" disabled={isSigningIn}>
            {isSigningIn ? 'Authenticating...' : 'Secure Login'}
          </Button>
          <div className="text-center text-xs text-muted-foreground">
            Student applicant?{' '}
            <Link href="/login" className="font-bold text-primary hover:underline">
              Applicant Gateway
            </Link>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}
