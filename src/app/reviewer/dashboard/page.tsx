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
  UserCheck,
  CheckCircle2,
  FileEdit,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, collectionGroup } from 'firebase/firestore';

function ReviewerDashboardContent() {
  const { firestore, user } = useFirebase();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filter = searchParams.get('status') || 'all';

  // 1. Query applications assigned to this reviewer
  const assignedApplicantsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'users'), 
      where('role', 'in', ['student', 'Applicant']),
      where('status', 'in', ['Submitted', 'In Review']),
      where('reviewerIds', 'array-contains', user.uid)
    );
  }, [firestore, user]);

  const { data: assignments, isLoading: isAssignmentsLoading } = useCollection(assignedApplicantsQuery);

  // 2. Query all reviews made by this specific reviewer
  const myReviewsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collectionGroup(firestore, 'reviews'), where('reviewerId', '==', user.uid));
  }, [firestore, user]);

  const { data: myReviews, isLoading: isReviewsLoading } = useCollection(myReviewsQuery);

  const processedAssignments = useMemo(() => {
    if (!assignments || !myReviews) return [];

    return assignments.map(app => {
      // Find the specific review for this applicant by this reviewer
      // Note: The review ID should be the reviewer's UID based on our new setDoc pattern
      const review = myReviews.find(r => r.id === user?.uid || r.id === `${app.id}_${user?.uid}`);
      
      let evalStatus = 'Not Started';
      if (review?.status === 'Submitted') evalStatus = 'Evaluated';
      else if (review?.status === 'Draft') evalStatus = 'Draft';

      return {
        ...app,
        evalStatus,
        isFlagged: review?.markForDiscussion || false,
        lastUpdated: review?.updatedAt?.seconds ? new Date(review.updatedAt.seconds * 1000) : null
      };
    });
  }, [assignments, myReviews, user?.uid]);

  const filteredAssignments = useMemo(() => {
    if (filter === 'all') return processedAssignments;
    return processedAssignments.filter(app => {
      if (filter === 'pending') return app.evalStatus !== 'Evaluated';
      if (filter === 'completed') return app.evalStatus === 'Evaluated';
      if (filter === 'flagged') return app.isFlagged;
      return true;
    });
  }, [processedAssignments, filter]);

  const stats = useMemo(() => {
    const total = processedAssignments.length;
    const completed = processedAssignments.filter(a => a.evalStatus === 'Evaluated').length;
    const drafts = processedAssignments.filter(a => a.evalStatus === 'Draft').length;
    const flagged = processedAssignments.filter(a => a.isFlagged).length;
    return { total, completed, drafts, flagged };
  }, [processedAssignments]);

  if (isAssignmentsLoading || isReviewsLoading || !mounted) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse font-medium">Syncing Evaluation Queue...</p>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <UserCheck className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assigned</span>
                <span className="text-2xl font-black">{stats.total}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Finalized</span>
                <span className="text-2xl font-black text-green-600">{stats.completed}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <FileEdit className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Drafts</span>
                <span className="text-2xl font-black text-amber-600">{stats.drafts}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Flagged</span>
                <span className="text-2xl font-black text-red-600">{stats.flagged}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-4">
        <Button variant={filter === 'all' ? 'secondary' : 'ghost'} size="sm" asChild>
          <Link href="/reviewer/dashboard">All Portfolios</Link>
        </Button>
        <Button variant={filter === 'pending' ? 'secondary' : 'ghost'} size="sm" asChild>
          <Link href="/reviewer/dashboard?status=pending">🆕 To Do</Link>
        </Button>
        <Button variant={filter === 'completed' ? 'secondary' : 'ghost'} size="sm" asChild>
          <Link href="/reviewer/dashboard?status=completed">✅ Finished</Link>
        </Button>
        <Button variant={filter === 'flagged' ? 'secondary' : 'ghost'} size="sm" asChild className="text-red-500 hover:text-red-600">
          <Link href="/reviewer/dashboard?status=flagged">🚩 Revisit Required</Link>
        </Button>
      </div>

      {filteredAssignments.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-bold">Candidate Identifier</TableHead>
                <TableHead className="font-bold">Last Activity</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="text-right font-bold">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments.map((app) => (
                <TableRow key={app.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold flex items-center gap-2">
                        Applicant {app.id.substring(0, 6).toUpperCase()}
                        {app.isFlagged && <Badge variant="destructive" className="h-5 text-[9px] uppercase">Revisit</Badge>}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1 mt-1">
                        <Clock className="h-2 w-2" /> Submitted: {app.submissionDate ? new Date(app.submissionDate).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground font-medium">
                      {app.lastUpdated ? app.lastUpdated.toLocaleString() : '---'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={app.evalStatus === 'Evaluated' ? 'default' : app.evalStatus === 'Draft' ? 'secondary' : 'outline'}
                      className={app.evalStatus === 'Draft' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : ''}
                    >
                      {app.evalStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant={app.evalStatus === 'Not Started' ? 'default' : 'outline'} size="sm" asChild className="font-bold">
                      <Link href={`/reviewer/applications/${app.id}`}>
                        {app.evalStatus === 'Not Started' ? 'Begin Review' : app.evalStatus === 'Draft' ? 'Resume' : 'View/Edit'} 
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 bg-muted/10 rounded-2xl border-2 border-dashed">
          <Inbox className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <p className="text-lg font-bold text-muted-foreground">Queue Empty</p>
          <p className="text-sm text-muted-foreground max-w-sm text-center mt-1">
            No portfolios currently match your active filters.
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
