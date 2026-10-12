'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, ShieldAlert, UserMinus, Wrench } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { listStaff, removeStaffAccess, repairStaffAccount, type StaffKind, type StaffMember } from '@/app/admin/staff-actions';

export function StaffAccessCard({ kind }: { kind: StaffKind }) {
  const { user } = useFirebase();
  const { toast } = useToast();

  const [members, setMembers] = useState<StaffMember[] | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const noun = kind === 'admin' ? 'administrator' : 'reviewer';

  const refresh = useCallback(async () => {
    if (!user) return;
    const result = await listStaff(await user.getIdToken(), kind);
    if (result.success) setMembers(result.members);
    else {
      setMembers([]);
      toast({ title: 'Could not load the list', description: result.error, variant: 'destructive' });
    }
  }, [user, kind, toast]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleRemove = async (member: StaffMember) => {
    if (!user) return;
    setBusyUid(member.uid);
    try {
      const result = await removeStaffAccess(await user.getIdToken(), kind, member.uid);
      if (!result.success) {
        toast({ title: 'Access not removed', description: result.error, variant: 'destructive' });
        return;
      }
      toast({
        title: 'Access removed',
        description: result.panels
          ? `${member.name || member.email} can no longer sign in as a ${noun}, and was taken off ${result.panels} committee${result.panels === 1 ? '' : 's'}.`
          : `${member.name || member.email} can no longer sign in as a ${noun}.`,
      });
      await refresh();
    } finally {
      setBusyUid(null);
    }
  };

  const handleRepair = async (member: StaffMember) => {
    if (!user) return;
    setBusyUid(member.uid);
    try {
      const result = await repairStaffAccount(await user.getIdToken(), kind, member.uid);
      if (!result.success) {
        toast({ title: 'Could not repair the account', description: result.error, variant: 'destructive' });
        return;
      }
      toast({
        title: 'Account repaired',
        description: `${member.name || member.email} will have their access the next time they sign in.`,
      });
      await refresh();
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active {kind === 'admin' ? 'administrators' : 'reviewers'}</CardTitle>
        <CardDescription>
          People who can sign in as {kind === 'admin' ? 'an administrator' : 'a reviewer'} today. Removing access takes
          effect immediately; evaluations they have already filed are kept.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Access</TableHead>
              {kind === 'reviewer' && <TableHead>Committees</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members === null ? (
              <TableRow>
                <TableCell colSpan={kind === 'reviewer' ? 5 : 4} className="text-center py-10">
                  <Loader2 className="h-4 w-4 animate-spin inline" />
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={kind === 'reviewer' ? 5 : 4} className="text-center py-10 text-sm text-muted-foreground italic">
                  Nobody has accepted {kind === 'admin' ? 'an administrator' : 'a reviewer'} invitation yet.
                </TableCell>
              </TableRow>
            ) : members.map((member) => {
              const isSelf = !!user && member.uid === user.uid;
              return (
              <TableRow key={member.uid}>
                <TableCell className="font-medium">
                  {member.name || '—'}
                  {isSelf && <Badge variant="outline" className="ml-2 text-[10px] font-bold">You</Badge>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{member.email || '—'}</TableCell>
                <TableCell>
                  {member.claimsOk ? (
                    <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50 gap-1">
                      <ShieldAlert className="h-3 w-3" /> Sign-in not linked
                    </Badge>
                  )}
                </TableCell>
                {kind === 'reviewer' && (
                  <TableCell className="text-sm">{member.panels}</TableCell>
                )}
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {!member.claimsOk && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRepair(member)}
                        disabled={busyUid === member.uid}
                        title="Re-link this account's sign-in to its role"
                      >
                        {busyUid === member.uid ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                        <span className="ml-2">Repair</span>
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyUid === member.uid || isSelf}
                          title={isSelf ? 'You cannot remove your own access' : `Remove ${noun} access`}
                        >
                          <UserMinus className={`h-4 w-4 ${isSelf ? 'text-muted-foreground' : 'text-destructive'}`} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove access for {member.name || member.email}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            They will no longer be able to sign in as {kind === 'admin' ? 'an administrator' : 'a reviewer'}
                            {kind === 'reviewer' && member.panels > 0
                              ? `, and will be taken off ${member.panels} scholarship committee${member.panels === 1 ? '' : 's'}`
                              : ''}
                            . Evaluations they have already filed stay on record. Their account itself is not deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className={buttonVariants({ variant: 'destructive' })}
                            onClick={() => handleRemove(member)}
                          >
                            Remove access
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {members?.some((member) => !member.claimsOk) && (
          <p className="text-xs text-muted-foreground p-4 border-t">
            <strong>Sign-in not linked</strong> means the account was given this role before sign-in roles were
            recorded on the login itself. They can sign in but will see nothing until the account is repaired.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
