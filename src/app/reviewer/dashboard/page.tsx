'use client';

import { useMemo, useState, useEffect, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ArrowRight, 
  MessageSquare,
  Loader2,
  Lock,
  Clock,
  Inbox,
  UserCheck
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

function ReviewerDashboardContent() {
  const { firestore, user } = useFirebase();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filter = searchParams.get('status') || 'all';

  // Query applications assigned to this reviewer
  const assignedApplicantsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'users'), 
      where('role', 'in', ['student', 'Applicant']),
      where('status', '==', 'Submitted'),
      where('reviewerIds', 'array-contains', user.uid)
    );
  }, [firestore, user]);

  const { data: assignments, isLoading } = useCollection(assignedApplicantsQuery);

  const filteredAssignments = useMemo(() => {
    if (!assignments) return [];
    if (filter === 'all') return assignments;
    return assignments.filter(app => {
      if (filter === 'pending') return !app.scores?.some((s: any) => s.reviewerId === user?.uid);
      if (filter === 'completed') return app.scores?.some((s: any) => s.reviewerId === user?.uid);
      return true;
    });
  }, [assignments, filter, user?.uid]);

  if (isLoading || !mounted) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse font-medium">Syncing Assigned Portfolios...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Reviewer Command Center</h1>
          <p className="text-muted-foreground italic flex items-center gap-2">
            <Lock className="h-4 w-4" /> Secure access to assigned candidate portfolios only.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <UserCheck className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-muted-foreground uppercase">Assigned to Me</span>
                <span className="text-2xl font-black">{assignments?.length || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 border-b pb-4">
        <Button variant={filter === 'all' ? 'secondary' : 'ghost'} asChild>
          <Link href="/reviewer/dashboard">All Portfolios</Link>
        </Button>
        <Button variant={filter === 'pending' ? 'secondary' : 'ghost'} asChild>
          <Link href="/reviewer/dashboard?status=pending">🆕 To Evaluate</Link>
        </Button>
        <Button variant={filter === 'completed' ? 'secondary' : 'ghost'} asChild>
          <Link href="/reviewer/dashboard?status=completed">✅ Completed</Link>
        </Button>
      </div>

      {filteredAssignments.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate Identifier</TableHead>
                <TableHead>Submission Status</TableHead>
                <TableHead>My Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments.map((app) => {
                const myReview = app.scores?.find((s: any) => s.reviewerId === user?.uid);
                return (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold flex items-center gap-2">
                          Applicant {app.id.substring(0, 6).toUpperCase()}
                          {myReview?.markForDiscussion && <MessageSquare className="h-3 w-3 text-amber-600" />}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                          <Clock className="h-2 w-2" /> Submitted: {app.submissionDate ? new Date(app.submissionDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{app.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={myReview ? 'default' : 'secondary'}>
                        {myReview ? 'Evaluated' : 'Not Started'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/reviewer/applications/${app.id}`}>
                          {myReview ? 'View Score' : 'Evaluate'} <ArrowRight className="h-4 w-4 ml-2" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-2xl border-2 border-dashed">
          <Inbox className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <p className="text-lg font-bold text-muted-foreground">No Assignments Found</p>
          <p className="text-sm text-muted-foreground max-w-sm text-center mt-1">
            You do not have any candidate portfolios currently assigned to you for review.
          </p>
        </div>
      )}
    </div>
  );
}

export default function ReviewerDashboardPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <ReviewerDashboardContent />
    </Suspense>
  );
}