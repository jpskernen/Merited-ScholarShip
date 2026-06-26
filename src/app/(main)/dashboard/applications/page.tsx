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
import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, FileText, ExternalLink } from 'lucide-react';
import Link from 'next/link';

const getStatusVariant = (status?: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (!status) return 'outline';
  
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

  const applications = useMemo(() => {
    const apps = allApplications || [];
    if (filter === 'all') return apps;
    return apps.filter(app => app.status?.toLowerCase() === filter.toLowerCase());
  }, [allApplications, filter]);

  if (isLoading || !mounted) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">Syncing applications...</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateValue: any) => {
    if (!dateValue) return 'N/A';
    try {
      // Handle both ISO strings and Firestore Timestamps
      const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue.toDate?.() || new Date(dateValue);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString();
    } catch (e) {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Application Status</h1>
        <p className="text-muted-foreground">
          Track your progress and view updates from the selection committee.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-bold">Scholarship Program</TableHead>
              <TableHead className="font-bold">Date Submitted</TableHead>
              <TableHead className="text-center font-bold">Status</TableHead>
              <TableHead className="text-right font-bold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((app: any) => (
              <TableRow key={app.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary opacity-40" />
                  {app.scholarshipName || 'General Portfolio'}
                </TableCell>
                <TableCell>
                  {formatDate(app.submissionDate)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge 
                    variant={getStatusVariant(app.status)} 
                    className={app.status === 'Awarded' ? 'bg-green-500/20 text-green-600 border-green-500/30 font-bold' : ''}
                  >
                    {app.status || 'Pending'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/dashboard/profile">
                      View Application <ExternalLink className="ml-2 h-3 w-3" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {applications.length === 0 && (
          <div className="text-center py-20 bg-muted/5">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">
              {filter === 'all' 
                ? "You haven't submitted any applications yet." 
                : `No applications found with status "${filter}".`}
            </p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/dashboard/scholarships">Browse Opportunities</Link>
            </Button>
          </div>
        )}
      </div>
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
