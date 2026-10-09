'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useFirestore, useDoc, useMemoFirebase, useFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { ShieldCheck, Loader2, Eye, EyeOff, UserCog, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { acceptInvite } from '@/app/admin/invite-actions';

export default function AdminOnboardingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: inviteId } = use(params);
  const auth = useAuth();
  const firestore = useFirestore();
  const { refreshUserRole } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inviteRef = useMemoFirebase(() => {
    if (!firestore || !inviteId) return null;
    return doc(firestore, 'admin_invites', inviteId);
  }, [firestore, inviteId]);

  const { data: invite, isLoading: isInviteLoading } = useDoc(inviteRef);

  useEffect(() => {
    if (isInviteLoading) return;
    if (!invite) {
      toast({ title: "Invalid Link", description: "This admin invitation is no longer active.", variant: "destructive" });
      router.push('/');
    } else if (invite.status !== 'Pending') {
      toast({ title: "Invitation Already Used", description: "This invitation has already been accepted. Please sign in." });
      router.push('/login');
    }
  }, [invite, isInviteLoading, router, toast]);

  // Already signed in with the invited email: accept onto the existing account.
  const signedInAsInvitee = !!invite && auth?.currentUser?.email?.toLowerCase() === String(invite.email).toLowerCase();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !invite) return;
    setIsSubmitting(true);

    try {
      // The server creates the account, sets the Org Admin role and marks the
      // invite used (src/lib/invites-server.ts). Nothing role-related is
      // written from the browser.
      const result = signedInAsInvitee
        ? await acceptInvite('admin', inviteId, null, await auth.currentUser!.getIdToken())
        : await acceptInvite('admin', inviteId, { name, password });
      if (!result.success) {
        toast({ title: "Could Not Activate Account", description: result.error, variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      if (!signedInAsInvitee) await signInWithEmailAndPassword(auth, result.email, password);
      // Pick up the new role claims before the admin layout checks them.
      await refreshUserRole();

      toast({ title: "Privileges Granted", description: "Administrator account activated. Redirecting to Panel..." });
      router.push('/admin');
    } catch (error: any) {
      toast({ title: "Setup Failed", description: "Your account was activated, but signing in failed. Please sign in from the login page.", variant: "destructive" });
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
    <div className="flex min-h-screen items-center justify-center bg-amber-50/30 p-4">
      <div className="w-full max-w-md">
        <form onSubmit={handleSignup}>
          <Card className="border-amber-200 shadow-2xl">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2 text-amber-600">
                <UserCog className="h-5 w-5" />
                <span className="text-xs font-black uppercase tracking-widest">Admin Authorization</span>
              </div>
              <CardTitle className="text-2xl">System Setup</CardTitle>
              <CardDescription>
                Activating administrator status for <strong>{invite?.email}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {signedInAsInvitee ? (
              <p className="text-sm text-muted-foreground">
                You are signed in as <strong>{invite?.email}</strong>. Accept to add administrator access to this account.
              </p>
              ) : (<>
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
                <Label htmlFor="password">Choose a Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
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
                  <Key className="h-3 w-3" /> At least 8 characters. You will use it to sign in.
                </p>
              </div>
              </>)}
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full font-bold bg-amber-600 hover:bg-amber-700" disabled={isSubmitting}>
                {isSubmitting ? 'Granting Access...' : 'Finalize Admin Account'}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  );
}
