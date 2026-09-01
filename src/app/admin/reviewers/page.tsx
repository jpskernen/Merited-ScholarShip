
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Mail, UserPlus, Trash2, Copy, Check, Sparkles, Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateInvitationEmail } from '@/ai/flows/generate-invitation-email';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from '@/components/ui/separator';

function generatePassword(length = 10) {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let retVal = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  return retVal;
}

export default function ManageReviewersPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatingEmailFor, setGeneratingEmailFor] = useState<string | null>(null);
  const [aiEmail, setAiEmail] = useState<{ subject: string; body: string } | null>(null);

  const invitesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'invites');
  }, [firestore]);

  const { data: invites, isLoading } = useCollection(invitesQuery);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !email) return;
    setIsInviting(true);

    const tempPassword = generatePassword();

    try {
      const docRef = await addDoc(collection(firestore, 'invites'), {
        email,
        tempPassword,
        status: 'Pending',
        emailSent: false,
        createdAt: serverTimestamp(),
        schoolId: 'default-school'
      });

      toast({
        title: "Invite Generated",
        description: `A reviewer account has been prepared for ${email}.`,
      });

      // Automatically generate and simulate sending the email
      await handleSendInvitationEmail({ id: docRef.id, email, tempPassword });

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

  const handleSendInvitationEmail = async (invite: { id: string, email: string, tempPassword: string }) => {
    setGeneratingEmailFor(invite.id);
    try {
      const link = `${window.location.origin}/reviewer/invite/${invite.id}`;
      const result = await generateInvitationEmail({
        recipientEmail: invite.email,
        role: 'Reviewer',
        temporaryPassword: invite.tempPassword,
        onboardingLink: link,
      });

      // Simulate sending the email
      console.log(`%c[Email Service] Sending to: ${invite.email}`, 'color: #3b82f6; font-weight: bold');
      console.log(`Subject: ${result.subject}\n\n${result.body}`);

      if (firestore) {
        // Record the email in the outbox
        await addDoc(collection(firestore, 'sent_emails'), {
          recipient: invite.email,
          subject: result.subject,
          body: result.body,
          type: 'Reviewer Invitation',
          sentAt: serverTimestamp()
        });

        await updateDoc(doc(firestore, 'invites', invite.id), {
          emailSent: true,
          lastEmailSentAt: serverTimestamp()
        });
      }

      toast({
        title: "Invitation Sent (Simulated)",
        description: `An onboarding email record has been created for ${invite.email}.`,
      });
      
      setAiEmail(result);
    } catch (err) {
      toast({
        title: "AI Email Failed",
        description: "Invite created but failed to generate/send email automatically.",
        variant: "destructive"
      });
    } finally {
      setGeneratingEmailFor(null);
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
        <p className="text-muted-foreground">Invite committee members and automatically dispatch credentials.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite New Reviewer</CardTitle>
          <CardDescription>A temporary password and invitation email will be automatically generated.</CardDescription>
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
              {isInviting ? 'Generating...' : 'Create Invite'}
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
                   <div className="flex flex-col">
                    <span className="font-medium">{invite.email}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{invite.tempPassword}</span>
                  </div>
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
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => handleSendInvitationEmail(invite)} title="View/Resend Invitation">
                        {generatingEmailFor === invite.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-primary" />}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Invitation Email Draft</DialogTitle>
                        <DialogDescription>
                          Content automatically drafted by AI and dispatched to the reviewer.
                        </DialogDescription>
                      </DialogHeader>
                      {aiEmail ? (
                        <div className="space-y-4 pt-4">
                          <div className="rounded-md bg-muted p-4">
                            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Subject</p>
                            <p className="font-semibold">{aiEmail.subject}</p>
                            <Separator className="my-3" />
                            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Body</p>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{aiEmail.body}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => {
                              navigator.clipboard.writeText(`Subject: ${aiEmail.subject}\n\n${aiEmail.body}`);
                              toast({ title: "Copied", description: "Email draft copied to clipboard." });
                            }}>
                              <Copy className="h-4 w-4 mr-2" /> Copy Content
                            </Button>
                            <Button className="flex-1" onClick={() => handleSendInvitationEmail(invite)}>
                              <Send className="h-4 w-4 mr-2" /> Resend Now
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-32 items-center justify-center">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                  
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
