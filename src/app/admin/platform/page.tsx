'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, deleteDoc, doc, query, where } from 'firebase/firestore';
import { Building2, Check, Copy, Loader2, Plus, Send, ShieldAlert, UserPlus } from 'lucide-react';
import { RevokeInviteButton } from '@/components/shared/RevokeInviteButton';
import { useToast } from '@/hooks/use-toast';
import { assignOrgAdmin, createOrganization, resendOrgAdminInvite } from '@/app/admin/platform-actions';

type Org = { id: string; name?: string; status?: string; createdAt?: { toDate?: () => Date } };

function isExpired(invite: any): boolean {
  const expires: Date | undefined = invite.expiresAt?.toDate?.();
  return !!expires && expires.getTime() < Date.now();
}

// Platform Admin console (docs/07 §3.1, runbook 2.1): create organizations and
// give each one its first Org Admin. Everything after that, such as inviting
// reviewers, is done by the Org Admin. The server actions check the
// platformAdmin claim; the Firestore rules let only a platform admin list
// organizations and see every organization's admins.
export default function PlatformOrganizationsPage() {
  const { firestore, user, userData } = useFirebase();
  const { toast } = useToast();
  const isPlatformAdmin = userData?.platformAdmin === true;

  const [newOrgName, setNewOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [inviteOrg, setInviteOrg] = useState<Org | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [sendingFor, setSendingFor] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Queries only run for a platform admin: for anyone else the rules refuse
  // them, and a refused listener is reported as a page error.
  const orgsQuery = useMemoFirebase(() => {
    if (!firestore || !isPlatformAdmin) return null;
    return collection(firestore, 'organizations');
  }, [firestore, isPlatformAdmin]);

  const adminsQuery = useMemoFirebase(() => {
    if (!firestore || !isPlatformAdmin) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'admin'));
  }, [firestore, isPlatformAdmin]);

  const invitesQuery = useMemoFirebase(() => {
    if (!firestore || !isPlatformAdmin) return null;
    return query(collection(firestore, 'admin_invites'), where('status', '==', 'Pending'));
  }, [firestore, isPlatformAdmin]);

  const { data: orgs, isLoading: isOrgsLoading } = useCollection<Org>(orgsQuery);
  const { data: admins } = useCollection<any>(adminsQuery);
  const { data: invites } = useCollection<any>(invitesQuery);

  const sortedOrgs = useMemo(
    () => [...(orgs || [])].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id)),
    [orgs],
  );

  const byOrg = (rows: any[] | null | undefined, orgId: string) =>
    (rows || []).filter((r) => (r.organizationId || r.schoolId) === orgId);

  const reportEmail = (address: string, result: { emailSent: boolean; method: string | null }) => {
    if (result.emailSent && result.method === 'Gmail SMTP') {
      toast({ title: 'Invitation Sent', description: `An invitation email was sent to ${address}.` });
    } else if (result.emailSent) {
      toast({ title: 'Invitation Logged (Not Delivered)', description: `Gmail SMTP isn't configured, so no real email was delivered to ${address}. Copy the link instead.` });
    } else {
      toast({ title: 'Email Send Failed', description: `The invitation was created, but the email to ${address} failed. Copy the link instead.`, variant: 'destructive' });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newOrgName.trim()) return;
    setIsCreating(true);
    try {
      const name = newOrgName.trim();
      const result = await createOrganization(await user.getIdToken(), name);
      if (!result.success) {
        toast({ title: 'Could Not Create Organization', description: result.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Organization Created', description: `${name} (${result.orgId}). Now invite its administrator.` });
      setNewOrgName('');
      // The next step is always the first Org Admin, so go straight to it.
      setAdminEmail('');
      setInviteOrg({ id: result.orgId, name });
    } finally {
      setIsCreating(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inviteOrg || !adminEmail.trim()) return;
    setIsAssigning(true);
    try {
      const email = adminEmail.trim();
      const result = await assignOrgAdmin(await user.getIdToken(), inviteOrg.id, email);
      if (!result.success) {
        toast({ title: 'Could Not Assign Administrator', description: result.error, variant: 'destructive' });
        return;
      }
      if (result.assigned) {
        toast({
          title: 'Administrator Assigned',
          description: `${email} already had an account and is now the administrator of ${inviteOrg.name || inviteOrg.id}. They need to sign out and back in.`,
        });
      } else {
        reportEmail(email, result);
      }
      setInviteOrg(null);
      setAdminEmail('');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleResend = async (invite: { id: string; email: string }) => {
    if (!user) return;
    setSendingFor(invite.id);
    try {
      const result = await resendOrgAdminInvite(await user.getIdToken(), invite.id);
      if (!result.success) {
        toast({ title: 'Could Not Resend', description: result.error, variant: 'destructive' });
        return;
      }
      reportEmail(invite.email, result);
    } finally {
      setSendingFor(null);
    }
  };

  const copyInviteLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/admin/invite/${id}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Copied', description: 'Admin onboarding link copied.' });
  };

  const revokeInvite = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'admin_invites', id));
      toast({ title: 'Deleted', description: 'Invitation revoked.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to revoke invitation.', variant: 'destructive' });
    }
  };

  if (!isPlatformAdmin) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            Platform administrators only
          </CardTitle>
          <CardDescription>
            Organizations are created and assigned by the platform administrator. If you need a new organization, contact them.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Organizations</h1>
        <p className="text-muted-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Create an organization, then invite its administrator. Each organization only sees its own data.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Organization</CardTitle>
          <CardDescription>
            For example a university or foundation. Its ID is made from the name and can&apos;t be changed later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1 space-y-2">
              <Label htmlFor="org-name" className="sr-only">Organization name</Label>
              <Input
                id="org-name"
                placeholder="ABC University"
                required
                minLength={2}
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={isCreating || newOrgName.trim().length < 2}>
              {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {isCreating ? 'Creating...' : 'Create Organization'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Administrators</TableHead>
              <TableHead className="text-right">Manage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isOrgsLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10">Loading organizations...</TableCell></TableRow>
            ) : sortedOrgs.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No organizations yet.</TableCell></TableRow>
            ) : sortedOrgs.map((org) => {
              const orgAdmins = byOrg(admins, org.id);
              const orgInvites = byOrg(invites, org.id);
              return (
                <TableRow key={org.id} className="align-top">
                  <TableCell>
                    <div className="font-semibold">{org.name || org.id}</div>
                    <div className="font-mono text-xs text-muted-foreground">{org.id}</div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={org.status === 'active' ? 'text-green-600 border-green-200 bg-green-50' : 'text-amber-600 border-amber-200 bg-amber-50'}
                    >
                      {org.status || 'unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {org.createdAt?.toDate?.().toLocaleDateString() ?? '—'}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      {orgAdmins.map((admin) => (
                        <div key={admin.id} className="text-sm">
                          {admin.email || admin.name || admin.id}
                        </div>
                      ))}
                      {orgInvites.map((invite) => (
                        <div key={invite.id} className="flex flex-wrap items-center gap-2 text-sm">
                          <span>{invite.email}</span>
                          {isExpired(invite) ? (
                            <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">Invite expired</Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Invited</Badge>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleResend(invite)} title="Resend invitation email" disabled={sendingFor === invite.id}>
                            {sendingFor === invite.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 text-amber-600" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyInviteLink(invite.id)} title="Copy onboarding link">
                            {copiedId === invite.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                          <RevokeInviteButton compact email={invite.email} onConfirm={() => revokeInvite(invite.id)} />
                        </div>
                      ))}
                      {orgAdmins.length === 0 && orgInvites.length === 0 && (
                        <span className="text-sm text-amber-600">No administrator yet</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => { setAdminEmail(''); setInviteOrg(org); }}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Invite Admin
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!inviteOrg} onOpenChange={(open) => { if (!open) setInviteOrg(null); }}>
        <DialogContent>
          <form onSubmit={handleAssign}>
            <DialogHeader>
              <DialogTitle>Invite administrator</DialogTitle>
              <DialogDescription>
                For <span className="font-semibold">{inviteOrg?.name || inviteOrg?.id}</span>. A new person gets an email with a link,
                valid for 14 days, to set their own password. An existing account that isn&apos;t in another organization becomes its administrator straight away.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="admin-email">Work email</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="chair@abc-university.edu"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setInviteOrg(null)}>Cancel</Button>
              <Button type="submit" disabled={isAssigning || !adminEmail.trim()}>
                {isAssigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                {isAssigning ? 'Sending...' : 'Invite Administrator'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
