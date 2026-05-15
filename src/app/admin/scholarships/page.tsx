
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Trash2, Edit, Loader2 } from 'lucide-react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Scholarship } from '@/types/scholarship';

export default function AdminScholarshipsPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const scholarshipsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'programs');
  }, [firestore]);

  const { data: scholarships, isLoading } = useCollection<Scholarship>(scholarshipsQuery);

  const handleDelete = async (id: string) => {
    if (!firestore || !id) return;
    if (!confirm('Are you sure you want to delete this scholarship?')) return;

    try {
      await deleteDoc(doc(firestore, 'programs', id));
      toast({ title: "Deleted", description: "Scholarship removed successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete scholarship.", variant: "destructive" });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Scholarships</h1>
          <p className="text-muted-foreground">
            Add, edit, or remove scholarship listings for your institution.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/scholarships/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Scholarship
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
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
                <TableCell>{scholarship.deadline}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/scholarships/edit/${scholarship.id}`}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(scholarship.id!)}>
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
    </div>
  );
}
