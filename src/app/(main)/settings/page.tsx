'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser, useFirebase, useAuth, useFirestore, useCollection, useMemoFirebase, initiatePasswordReset } from '@/firebase';
import {
  updateProfile,
  sendEmailVerification,
  verifyBeforeUpdateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { collection, doc, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { ShieldCheck, ShieldAlert, Key, Mail, User as UserIcon, Loader2, Building2, Clock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { orgIdOf } from '@/lib/org';
import { getPublicOrganizations } from '@/app/org-actions';
import type { PublicOrganization } from '@/lib/org-server';
import { requestOrgSwitch } from '../dashboard/org-switch-actions';

// Firebase's raw messages ("Firebase: Error (auth/wrong-password).") aren't
// something a student can act on.
function describeAuthError(err: any): string {
  switch (err?.code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Your current password is incorrect.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/requires-recent-login':
      return 'For your security, please log out and back in, then try again.';
    case 'auth/email-already-in-use':
      return 'Another account already uses that email address.';
    case 'auth/invalid-email':
      return 'That email address does not look right.';
    case 'auth/weak-password':
      return 'Please choose a longer password — at least 6 characters.';
    case 'auth/network-request-failed':
      return 'We could not reach the server. Please check your connection and try again.';
    default:
      return err?.message || 'Something went wrong. Please try again.';
  }
}

type OrgSwitchRequestRow = { id: string; requestedOrgName: string; status: string; createdAt?: { toDate?: () => Date } };

function SwitchOrganizationCard() {
  const { user, userData } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const currentOrgId = orgIdOf(userData);

  const [orgs, setOrgs] = useState<PublicOrganization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getPublicOrganizations().then(setOrgs);
  }, []);

  const otherOrgs = useMemo(() => orgs.filter((o) => o.id !== currentOrgId), [orgs, currentOrgId]);

  const pendingQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'orgSwitchRequests'),
      where('studentId', '==', user.uid),
      where('status', '==', 'pending'),
    );
  }, [firestore, user]);
  const { data: pendingRequests } = useCollection<OrgSwitchRequestRow>(pendingQuery);
  const pending = pendingRequests?.[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedOrgId) return;
    setIsSubmitting(true);
    try {
      const result = await requestOrgSwitch(await user.getIdToken(), selectedOrgId, reason);
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Could Not Submit Request', description: result.error });
        return;
      }
      toast({ title: 'Request Sent', description: "A platform administrator will review your request to switch organizations." });
      setSelectedOrgId('');
      setReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Organization
        </CardTitle>
        <CardDescription className="text-xs">
          Your account is linked to one organization. Signed up with the wrong one? Request a switch here.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {pending ? (
          <Alert className="bg-amber-50 border-amber-200 py-2.5">
            <Clock className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm text-amber-700">
              Your request to switch to <strong>{pending.requestedOrgName}</strong> is pending review by a platform administrator.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId} disabled={isSubmitting}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={otherOrgs.length === 0 ? 'No other organizations available' : 'Select an organization'} />
                </SelectTrigger>
                <SelectContent>
                  {otherOrgs.map((org) => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" variant="outline" size="sm" className="h-9 font-bold border-primary/20 hover:bg-primary/5" disabled={isSubmitting || !selectedOrgId}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Request Switch'}
              </Button>
            </div>
            <Textarea
              id="switch-reason"
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              maxLength={500}
              rows={2}
              className="text-sm"
            />
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { user, role } = useUser();
  const { refreshUserRole } = useFirebase();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  // --- Name -----------------------------------------------------------
  const [name, setName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  useEffect(() => { setName(user?.displayName || ''); }, [user?.displayName]);

  const handleNameSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.currentUser || !firestore || !name.trim()) return;
    setIsSavingName(true);
    try {
      await updateProfile(auth.currentUser, { displayName: name.trim() });
      await setDoc(doc(firestore, 'users', auth.currentUser.uid), {
        name: name.trim(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      // The greeting and avatar read displayName from this same context, so
      // without this they'd keep showing the old name until a full reload.
      await refreshUserRole();
      toast({ title: 'Name Updated', description: 'Your name has been updated everywhere it appears.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Could Not Update Name', description: describeAuthError(err) });
    } finally {
      setIsSavingName(false);
    }
  };

  // --- Email verification ----------------------------------------------
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const handleSendVerification = async () => {
    if (!auth?.currentUser) return;
    setIsSendingVerification(true);
    try {
      await sendEmailVerification(auth.currentUser);
      toast({ title: 'Verification Email Sent', description: 'Check your inbox and click the link to verify your email.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Could Not Send Verification', description: describeAuthError(err) });
    } finally {
      setIsSendingVerification(false);
    }
  };

  // --- Change email -------------------------------------------------
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.currentUser || !user?.email || !newEmail.trim() || !emailPassword) return;
    setIsChangingEmail(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, emailPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await verifyBeforeUpdateEmail(auth.currentUser, newEmail.trim());
      toast({
        title: 'Verification Sent',
        description: `Check ${newEmail.trim()} for a link to confirm the change. Your login email stays the same until you confirm it.`,
      });
      setNewEmail('');
      setEmailPassword('');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Could Not Change Email', description: describeAuthError(err) });
    } finally {
      setIsChangingEmail(false);
    }
  };

  // --- Change password ------------------------------------------------
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.currentUser || !user?.email) return;
    if (newPassword.length < 6) {
      toast({ variant: 'destructive', title: 'Password Too Short', description: 'Please choose a longer password — at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Passwords Do Not Match', description: 'Re-enter the new password the same way twice.' });
      return;
    }
    setIsChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      toast({ title: 'Password Updated', description: 'Your password has been changed.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Could Not Change Password', description: describeAuthError(err) });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!auth || !user?.email) return;
    setIsSendingReset(true);
    try {
      await initiatePasswordReset(auth, user.email);
      toast({ title: 'Recovery Email Sent', description: 'A secure link to change your password has been sent to your inbox.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: describeAuthError(err) });
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="space-y-5 py-6">
      <div>
        <h1 className="text-2xl font-bold">Account Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile, credentials and security preferences.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 items-start">
      <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-primary" />
            Profile
          </CardTitle>
        </CardHeader>
        <form onSubmit={handleNameSave}>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <div className="grid gap-1.5">
                <Label htmlFor="name" className="text-[11px] font-bold uppercase text-muted-foreground">Full Name</Label>
                <Input id="name" className="h-9" value={name} onChange={(e) => setName(e.target.value)} disabled={isSavingName} required />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Role</Label>
                <Input value={role || 'Applicant'} readOnly className="h-9 bg-muted font-semibold capitalize sm:w-32" />
              </div>
              <Button type="submit" size="sm" className="h-9 font-bold" disabled={isSavingName || !name.trim() || name.trim() === (user?.displayName || '')}>
                {isSavingName ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="flex flex-wrap items-center gap-2">
              <Input value={user?.email || ''} readOnly className="h-9 bg-muted font-medium flex-1 min-w-[10rem]" />
              {user?.emailVerified ? (
                <Badge variant="outline" className="flex items-center gap-1 px-2 bg-green-50 text-green-700 border-green-200 shrink-0">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="flex items-center gap-1 px-2 bg-amber-50 text-amber-700 border-amber-200 shrink-0">
                  <ShieldAlert className="h-3 w-3" /> Not Verified
                </Badge>
              )}
              {!user?.emailVerified && (
                <Button type="button" variant="outline" size="sm" onClick={handleSendVerification} disabled={isSendingVerification} className="h-9 font-bold shrink-0">
                  {isSendingVerification ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Verify'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <form onSubmit={handlePasswordChange} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input className="h-9 sm:col-span-2" type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={isChangingPassword} />
                <Input className="h-9" type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isChangingPassword} />
                <Input className="h-9" type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isChangingPassword} />
              </div>
              <Button type="submit" size="sm" className="h-9 font-bold" disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}>
                {isChangingPassword ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Update Password
              </Button>
            </form>

            <div className="flex flex-wrap items-center gap-2 pt-3 border-t text-xs text-muted-foreground">
              <span>Forgotten your current password?</span>
              <Button type="button" variant="link" size="sm" onClick={handlePasswordReset} disabled={isSendingReset} className="h-auto p-0 font-bold">
                {isSendingReset ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                Email me a reset link
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {(!role || role.toLowerCase() === 'applicant') && <SwitchOrganizationCard />}
    </div>
  );
}
