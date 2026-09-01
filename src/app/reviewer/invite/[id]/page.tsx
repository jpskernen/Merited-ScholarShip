'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, initiateEmailSignUp, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ShieldCheck, Loader2, Eye, EyeOff, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateProfile } from 'firebase/auth';

export default function ReviewerOnboardingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: inviteId } = use(params);
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inviteRef = useMemoFirebase(() => {
    if (!firestore || !inviteId) return null;
    return doc(firestore, 'invites', inviteId);
  }, [firestore, inviteId]);

  const { data: invite, isLoading: isInviteLoading } = useDoc(inviteRef);

  useEffect(() => {
    if (!isInviteLoading && !invite) {
      toast({ title: "Invalid Link", description: "This invitation is no longer valid.", variant: "destructive" });
      router.push('/');
    } else if (invite?.tempPassword) {
      setPassword(invite.tempPassword);
    }
  }, [invite, isInviteLoading, router, toast]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore || !invite) return;
    setIsSubmitting(true);

    try {
      const userCredential = await initiateEmailSignUp(auth, invite.email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: name });

      // Create Reviewer User Document
      await setDoc(doc(firestore, 'users', user.uid), {
        id: user.uid,
        name,
        email: invite.email,
        role: 'Reviewer',
        schoolId: invite.schoolId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Register in Reviewers collection
      await setDoc(doc(firestore, 'reviewers', user.uid), {
        id: user.uid,
        schoolId: invite.schoolId,
        role: 'Reviewer',
        assignedDate: serverTimestamp()
      });

      // Mark invite as Accepted
      await updateDoc(doc(firestore, 'invites', inviteId), {
        status: 'Accepted'
      });

      toast({ title: "Welcome!", description: "Account created. Redirecting to Review Center..." });
      router.push('/review');
    } catch (error: any) {
      toast({ title: "Signup Failed", description: error.message, variant: "destructive" });
      setIsSubmitting(false);
    }
  };

  if (isInviteLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <form onSubmit={handleSignup}>
          <Card className="border-primary/20 shadow-xl">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2 text-primary">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-xs font-black uppercase tracking-widest">Committee Invitation</span>
              </div>
              <CardTitle className="text-2xl">Finalize Reviewer Account</CardTitle>
              <CardDescription>
                Activating credentials for <strong>{invite?.email}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input 
                  id="name" 
                  required 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Temporary Password</Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
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
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                  <Key className="h-3 w-3" /> Use the password sent in your invitation email.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full font-bold" disabled={isSubmitting}>
                {isSubmitting ? 'Finalizing...' : 'Join Committee'}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  );
}
