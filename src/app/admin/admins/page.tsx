
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { UserPlus, Trash2, Copy, Check, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ManageAdminsPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const invitesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'admin_invites');
  }, [firestore]);

  const { data: invites, isLoading } = useCollection(invitesQuery);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !email) return;
    setIsInviting(true);

    try {
      await addDoc(collection(firestore, 'admin_invites'), {
        email,
        status: 'Pending',
        createdAt: serverTimestamp(),
        schoolId: 'default-school'
      });

      toast({
        title: "Admin Invite Created",
        description: `A secure onboarding link has been generated for ${email}.`,
      });
      setEmail('');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create administrator invitation.",
        variant: "destructive"
      });
    } finally {
      setIsInviting(false);
    }
  };

  const copyInviteLink = (id: string) => {
    const link = `${window.location.origin}/admin/invite/${id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copied", description: "Admin onboarding link copied." });
  };

  const deleteInvite = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'admin_invites', id));
      toast({ title: "Deleted", description: "Invitation revoked." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to revoke invitation.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Manage Administrators</h1>
        <p className="text-muted-foreground flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          Assign system-wide privileges to committee chairs or sponsors.
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader>
          <CardTitle>Invite New Administrator</CardTitle>
          <CardDescription>
            Administrators have full access to manage scholarships, applicants, and other users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="email" className="sr-only">Work Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="chair@organization.org" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={isInviting} className="bg-amber-600 hover:bg-amber-700">
              <UserPlus className="mr-2 h-4 w-4" />
              {isInviting ? 'Generating...' : 'Invite Administrator'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email Address</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead className="text-right">Manage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10">Loading active invites...</TableCell></TableRow>
            ) : invites?.map((invite) => (
              <TableRow key={invite.id}>
                <TableCell className="font-semibold">{invite.email}</TableCell>
                <TableCell>
                  <Badge variant={invite.status === 'Accepted' ? 'default' : 'outline'} className={invite.status === 'Accepted' ? 'bg-green-600' : ''}>
                    {invite.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {invite.createdAt?.seconds ? new Date(invite.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                </TableCell>
                <TableCell className="text-right flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyInviteLink(invite.id)} title="Copy Onboarding Link">
                    {copiedId === invite.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteInvite(invite.id)} title="Revoke Invitation">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
