
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button, buttonVariants } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Trash2, Edit, Loader2 } from 'lucide-react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deleteScholarship } from '@/app/admin/scholarship-actions';
import { orgIdOf } from '@/lib/org';
import { formatDeadline } from '@/lib/deadline';
import { useToast } from '@/hooks/use-toast';
import type { Scholarship } from '@/types/scholarship';

export default function AdminScholarshipsPage() {
  const { firestore, user, userData } = useFirebase();
  const { toast } = useToast();
  const orgId = orgIdOf(userData);

  const scholarshipsQuery = useMemoFirebase(() => {
    if (!firestore || !orgId) return null;
    return query(collection(firestore, 'programs'), where('organizationId', '==', orgId));
  }, [firestore, orgId]);

  const { data: scholarships, isLoading } = useCollection<Scholarship>(scholarshipsQuery);

  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [applicationCount, setApplicationCount] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const askToDelete = async (scholarship: Scholarship) => {
    if (!scholarship.id) return;
    setPendingDelete({ id: scholarship.id, name: scholarship.name });
    setApplicationCount(null);
    if (!firestore || !orgId) return;
    try {
      const counted = await getCountFromServer(query(
        collection(firestore, 'applications'),
        where('organizationId', '==', orgId),
        where('scholarshipId', '==', scholarship.id),
      ));
      setApplicationCount(counted.data().count);
    } catch {
      setApplicationCount(null);
    }
  };

  const handleDelete = async () => {
    if (!user || !pendingDelete) return;
    setIsDeleting(true);
    try {
      const result = await deleteScholarship(await user.getIdToken(), pendingDelete.id);
      if (!result.success) {
        toast({ title: "Could not delete", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: "Deleted", description: `"${pendingDelete.name}" was removed.` });
      setPendingDelete(null);
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete scholarship.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Manage Scholarships</h1>
          <p className="text-muted-foreground">
            Add, edit, or remove scholarship listings for your institution.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/admin/scholarships/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Scholarship
          </Link>
        </Button>
      </div>

      {scholarships && scholarships.length > 0 && (
        <div className="space-y-3 md:hidden">
          {scholarships.map((scholarship) => (
            <div key={scholarship.id} className="space-y-3 rounded-lg border bg-card p-4">
              <p className="font-bold [overflow-wrap:anywhere]">{scholarship.name}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <Badge variant="secondary">{scholarship.amount}</Badge>
                <span className="text-muted-foreground">Deadline: {formatDeadline(scholarship.deadline)}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild className="flex-1">
                  <Link href={`/admin/scholarships/edit/${scholarship.id}`}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => askToDelete(scholarship)}>
                  <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scholarship Name</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          
          <TableBody>
            {scholarships?.map((scholarship) => (
              <TableRow key={scholarship.id}>
                <TableCell className="font-medium">{scholarship.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{scholarship.amount}</Badge>
                </TableCell>
                <TableCell>{formatDeadline(scholarship.deadline)}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/scholarships/edit/${scholarship.id}`}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => askToDelete(scholarship)}>
                    <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {(!scholarships || scholarships.length === 0) && (
        <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
          No scholarships have been added yet. Click "Add New Scholarship" to begin.
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open && !isDeleting) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{pendingDelete?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>This removes the scholarship from your organization&apos;s public page and from the applicant list. This cannot be undone.</p>
                {applicationCount !== null && applicationCount > 0 ? (
                  <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <strong>{applicationCount} application{applicationCount === 1 ? '' : 's'}</strong> already {applicationCount === 1 ? 'exists' : 'exist'} for this scholarship.
                    {applicationCount === 1 ? ' It' : ' They'} will be kept on record, but applicants can no longer edit or submit {applicationCount === 1 ? 'it' : 'them'}, and reviewers will lose the scoring rubric.
                  </p>
                ) : applicationCount === 0 ? (
                  <p className="text-sm">Nobody has applied yet, so no applications are affected.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Checking for existing applications&hellip;</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Keep scholarship</AlertDialogCancel>
            <Button
              className={buttonVariants({ variant: 'destructive' })}
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete scholarship
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
