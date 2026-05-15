
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
import { Mail, UserPlus, Trash2, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ManageReviewersPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const invitesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'invites');
  }, [firestore]);

  const { data: invites, isLoading } = useCollection(invitesQuery);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !email) return;
    setIsInviting(true);

    try {
      await addDoc(collection(firestore, 'invites'), {
        email,
        status: 'Pending',
        createdAt: serverTimestamp(),
        schoolId: 'default-school'
      });

      toast({
        title: "Invite Sent",
        description: `A reviewer invitation has been generated for ${email}.`,
      });
      setEmail('');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create invitation.",
        variant: "destructive"
      });
    } finally {
      setIsInviting(false);
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
        <p className="text-muted-foreground">Invite committee members to evaluate scholarship applications.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite New Reviewer</CardTitle>
          <CardDescription>Generated invite links can be sent manually to reviewers.</CardDescription>
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
              {isInviting ? 'Inviting...' : 'Create Invite'}
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
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10">Loading invites...</TableCell></TableRow>
            ) : invites?.map((invite) => (
              <TableRow key={invite.id}>
                <TableCell className="font-medium">{invite.email}</TableCell>
                <TableCell>
                  <Badge variant={invite.status === 'Accepted' ? 'default' : 'secondary'}>
                    {invite.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {invite.createdAt?.seconds ? new Date(invite.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                </TableCell>
                <TableCell className="text-right flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyInviteLink(invite.id)}>
                    {copiedId === invite.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteInvite(invite.id)}>
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
