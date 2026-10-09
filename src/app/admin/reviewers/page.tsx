
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, deleteDoc, doc, query, where } from 'firebase/firestore';
import { UserPlus, Copy, Check, Loader2, Send } from 'lucide-react';
import { RevokeInviteButton } from '@/components/shared/RevokeInviteButton';
import { useToast } from '@/hooks/use-toast';
import { orgIdOf } from '@/lib/org';
import { createInvite, resendInvite } from '@/app/admin/invite-actions';

// Invitations carry no password and are not written by AI (docs/07 §5.3): the
// server creates the invite and emails a fixed message with the link, and the
// reviewer chooses their own password when they open it.
export default function ManageReviewersPage() {
  const { firestore, user, userData } = useFirebase();
  const { toast } = useToast();
  // Must match the org that programs/applicants live under, otherwise the
  // onboarded reviewer's schoolId never lines up with anything they can review.
  const organizationId = orgIdOf(userData);
  const [email, setEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingFor, setSendingFor] = useState<string | null>(null);

  const invitesQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId) return null;
    return query(collection(firestore, 'invites'), where('organizationId', '==', organizationId));
  }, [firestore, organizationId]);

  const { data: invites, isLoading } = useCollection(invitesQuery);

  const reportEmail = (address: string, result: { emailSent: boolean; method: string | null }) => {
    if (result.emailSent && result.method === 'Gmail SMTP') {
      toast({ title: "Invitation Sent", description: `An invitation email was sent to ${address}.` });
    } else if (result.emailSent) {
      toast({ title: "Invitation Logged (Not Delivered)", description: `Gmail SMTP isn't configured, so no real email was delivered to ${address}. Copy the link instead.` });
    } else {
      toast({ title: "Email Send Failed", description: `The invitation was created, but the email to ${address} failed. Copy the link instead.`, variant: "destructive" });
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !email) return;
    if (!organizationId) {
      toast({ variant: 'destructive', title: 'No organization', description: 'Your account is not linked to an organization, so the invite cannot be created.' });
      return;
    }
    setIsInviting(true);
    try {
      const result = await createInvite(await user.getIdToken(), 'reviewer', email);
      if (!result.success) {
        toast({ title: "Could Not Create Invitation", description: result.error, variant: "destructive" });
        return;
      }
      reportEmail(email, result);
      setEmail('');
    } finally {
      setIsInviting(false);
    }
  };

  const handleResend = async (invite: { id: string; email: string }) => {
    if (!user) return;
    setSendingFor(invite.id);
    try {
      const result = await resendInvite(await user.getIdToken(), 'reviewer', invite.id);
      if (!result.success) {
        toast({ title: "Could Not Resend", description: result.error, variant: "destructive" });
        return;
      }
      reportEmail(invite.email, result);
    } finally {
      setSendingFor(null);
    }
  };

  const copyInviteLink = (id: string) => {
    const link = `${window.location.origin}/reviewer/invite/${id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copied", description: "Invite link copied to clipboard." });
  };

  const deleteInvite = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'invites', id));
      toast({ title: "Deleted", description: "Invitation revoked." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete invitation.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Manage Reviewers</h1>
        <p className="text-muted-foreground">Invite committee members to review applications for your organization.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite New Reviewer</CardTitle>
          <CardDescription>The reviewer receives an email with a personal link, valid for 14 days, to set their own password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="email" className="sr-only">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="reviewer@example.org"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={isInviting}>
              <UserPlus className="mr-2 h-4 w-4" />
              {isInviting ? 'Sending...' : 'Send Invite'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email Address</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10">Loading invites...</TableCell></TableRow>
            ) : invites?.map((invite) => (
              <TableRow key={invite.id}>
                <TableCell>
                  <span className="font-medium">{invite.email}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={invite.status === 'Accepted' ? 'default' : 'secondary'}>
                    {invite.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {invite.emailSent ? (
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 font-bold">Sent</Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Pending</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right flex justify-end gap-2">
                  {invite.status === 'Pending' && (
                    <Button variant="outline" size="sm" onClick={() => handleResend(invite)} title="Resend invitation email" disabled={sendingFor === invite.id}>
                      {sendingFor === invite.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-primary" />}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => copyInviteLink(invite.id)} title="Copy invite link">
                    {copiedId === invite.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <RevokeInviteButton email={invite.email} onConfirm={() => deleteInvite(invite.id)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
