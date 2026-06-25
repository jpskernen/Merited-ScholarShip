'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case 'Awarded':
      return 'default';
    case 'In Review':
    case 'Submitted':
      return 'secondary';
    case 'Not Awarded':
      return 'destructive';
    default:
      return 'outline';
  }
};

function ApplicationsPageContent() {
  const { firestore, user } = useFirebase();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filter = searchParams.get('status') || 'all';

  const applicationsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, `users/${user.uid}/applications`));
  }, [user, firestore]);

  const { data: allApplications, isLoading } = useCollection(applicationsQuery);

  const applications = (allApplications || []).filter(app => {
    if (filter === 'all') return true;
    return app.status?.toLowerCase() === filter.toLowerCase();
  });

  if (isLoading || !mounted) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">Loading applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">My Applications</h1>
        <p className="text-muted-foreground">
          Track the status of all your scholarship applications.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scholarship</TableHead>
              <TableHead>Date Submitted</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((app: any) => (
              <TableRow key={app.id}>
                <TableCell className="font-medium">{app.scholarshipName || 'N/A'}</TableCell>
                <TableCell>
                  {app.submissionDate && mounted
                    ? new Date(app.submissionDate).toLocaleDateString() 
                    : 'N/A'}
                </TableCell>
                <TableCell className="text-center">
                  <Badge 
                    variant={getStatusVariant(app.status)} 
                    className={app.status === 'Awarded' ? 'bg-green-500/20 text-green-400 border-green-500/30' : ''}
                  >
                    {app.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
       {applications.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {filter === 'all' 
              ? "You haven't submitted any applications yet." 
              : `No applications found matching status "${filter}".`}
          </div>
        )}
    </div>
  );
}

export default function ApplicationsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <ApplicationsPageContent />
    </Suspense>
  );
}
