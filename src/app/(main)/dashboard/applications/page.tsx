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
import { useCollection, useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, FileText, ExternalLink, Clock, CheckCircle, FileEdit } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const getStatusVariant = (status?: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (!status) return 'outline';
  
  const s = status.toLowerCase();
  switch (s) {
    case 'awarded':
      return 'default';
    case 'in review':
    case 'submitted':
      return 'secondary';
    case 'not awarded':
      return 'destructive';
    case 'draft':
      return 'outline';
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

  // 1. Fetch main portfolio status
  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: mainProfile, isLoading: isProfileLoading } = useDoc(userDocRef);

  // 2. Fetch history subcollection
  const applicationsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, `users/${user.uid}/applications`));
  }, [user, firestore]);

  const { data: historyApplications, isLoading: isHistoryLoading } = useCollection(applicationsQuery);

  const applications = useMemo(() => {
    if (!mounted) return [];
    const apps = historyApplications ? [...historyApplications] : [];
    
    // Add the current active portfolio if it's not already in history (e.g. if it's a draft)
    if (mainProfile && (mainProfile.status === 'Draft' || mainProfile.status === 'draft')) {
      const exists = apps.some(a => a.status?.toLowerCase() === 'draft');
      if (!exists) {
        apps.unshift({
          id: 'current-draft',
          scholarshipName: 'General Scholarship Portfolio',
          status: 'Draft',
          submissionDate: mainProfile.updatedAt || new Date().toISOString(),
        });
      }
    }

    if (filter === 'all') return apps;
    return apps.filter(app => app.status?.toLowerCase() === filter.toLowerCase());
  }, [historyApplications, mainProfile, filter, mounted]);

  if (isProfileLoading || isHistoryLoading || !mounted) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse font-medium">Syncing Application Status...</p>
      </div>
    );
  }

  const formatDate = (dateValue: any) => {
    if (!dateValue) return 'N/A';
    try {
      if (typeof dateValue === 'object' && dateValue.seconds) {
        return new Date(dateValue.seconds * 1000).toLocaleDateString();
      }
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString();
    } catch (e) {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Submission Tracking</h1>
        <p className="text-muted-foreground">
          Real-time updates on your scholarship portfolio and committee reviews.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-bold">Portfolio / Program</TableHead>
              <TableHead className="font-bold">Last Update</TableHead>
              <TableHead className="text-center font-bold">Status</TableHead>
              <TableHead className="text-right font-bold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((app: any) => (
              <TableRow key={app.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-semibold">
                  <div className="flex items-center gap-2">
                    {app.status?.toLowerCase() === 'submitted' ? <CheckCircle className="h-4 w-4 text-green-500" /> : <FileEdit className="h-4 w-4 text-primary opacity-40" />}
                    {app.scholarshipName || 'General Portfolio'}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(app.submissionDate)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge 
                    variant={getStatusVariant(app.status)} 
                    className={cn(
                      "font-bold px-3",
                      app.status?.toLowerCase() === 'awarded' ? 'bg-green-600 text-white' : 
                      app.status?.toLowerCase() === 'draft' ? 'border-primary/20 text-primary bg-primary/5' : ''
                    )}
                  >
                    {app.status || 'Pending'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" asChild className="font-bold">
                    <Link href="/dashboard/profile">
                      {app.status?.toLowerCase() === 'draft' ? 'Continue' : 'View Details'} <ExternalLink className="ml-2 h-3 w-3" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {applications.length === 0 && (
          <div className="text-center py-24 bg-muted/5">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
              <Clock className="h-6 w-6 text-muted-foreground opacity-20" />
            </div>
            <p className="text-muted-foreground font-medium italic">
              {filter === 'all' 
                ? "Your submission history is currently empty." 
                : `No records found with status "${filter}".`}
            </p>
            <Button variant="default" className="mt-6 px-8 rounded-full" asChild>
              <Link href="/dashboard/scholarships">Start My Application</Link>
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
