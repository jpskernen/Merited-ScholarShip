
'use client';

import { useMemo, useRef, useState, useEffect, Suspense } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ArrowRight, 
  ArrowUpDown,
  MessageSquare,
  Loader2,
  Lock,
  Clock,
  Inbox
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCollection, useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import { collection, collectionGroup, doc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { orgIdOf } from '@/lib/org';

/**
 * submissionDate is an ISO string on records written by the application form,
 * but older records carry a Firestore timestamp. Anything unparseable sorts
 * last rather than throwing off the whole queue.
 */
function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value === 'object' && typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function ReviewerDashboardContent() {
  const { firestore, user, userData } = useFirebase();
  const orgId = orgIdOf(userData);
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const filter = searchParams.get('status') || 'all';
  const [sortByRandom, setSortByRandom] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Get all programs where this reviewer is assigned
  const programsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !orgId) return null;
    return query(
      collection(firestore, 'programs'),
      where('organizationId', '==', orgId),
      where('reviewerIds', 'array-contains', user.uid),
    );
  }, [firestore, user, orgId]);

  const { data: programs, isLoading: isProgramsLoading } = useCollection(programsQuery);

  const assignedScholarshipIds = useMemo(
    () => (programs || []).map(p => p.id).filter(Boolean),
    [programs],
  );

  const [assignedApplications, setAssignedApplications] = useState<any[]>([]);
  const [isAppsLoading, setIsAppsLoading] = useState(true);

  const assignedKey = assignedScholarshipIds.join(',');

  useEffect(() => {
    if (!firestore) return;
    const scholarshipIds = assignedKey ? assignedKey.split(',') : [];
    if (scholarshipIds.length === 0) {
      setAssignedApplications([]);
      setIsAppsLoading(isProgramsLoading);
      return;
    }

    setIsAppsLoading(true);
    const byScholarship = new Map<string, any[]>();
    const unsubscribes = scholarshipIds.map((scholarshipId) =>
      onSnapshot(
        query(
          collection(firestore, 'applications'),
          where('scholarshipId', '==', scholarshipId),
          where('status', 'in', ['Submitted', 'In Review', 'Awarded', 'Not Awarded']),
        ),
        (snapshot) => {
          byScholarship.set(scholarshipId, snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
          setAssignedApplications(Array.from(byScholarship.values()).flat());
          setIsAppsLoading(false);
        },
        (error) => {
          console.error('Assignments listener failed:', error.message);
          setIsAppsLoading(false);
        },
      ),
    );

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [firestore, assignedKey, isProgramsLoading]);

  // 3. Get all reviews by this reviewer. The rules let a reviewer read only
  //    their own reviews, so the filter is required, not an optimization.
  const myReviewsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collectionGroup(firestore, 'reviews'), where('reviewerId', '==', user.uid));
  }, [firestore, user]);

  const { data: allReviews, isLoading: isReviewsLoading } = useCollection(myReviewsQuery);

  const randomSortKeys = useRef<Record<string, number>>({});
  assignedApplications.forEach((application: any) => {
    if (randomSortKeys.current[application.id] === undefined) {
      randomSortKeys.current[application.id] = Math.random();
    }
  });

  const assignments = useMemo(() => {
    if (!assignedApplications || !allReviews || !user || !mounted || !programs) return [];

    const myReviews = allReviews.filter(r => r.reviewerId === user.uid);
    const programsById = new Map(programs.map(p => [p.id, p]));
    const isFiled = (review: any) => !!review && review.status !== 'Draft';

    return assignedApplications
      .filter((application: any) => {
        if (application.status === 'Submitted' || application.status === 'In Review') return true;
        return isFiled(myReviews.find((r) => r.applicationId === application.id));
      })
      .map((application: any) => {
        const review = myReviews.find(r => r.applicationId === application.id);
        return {
          ...application,
          scholarshipName: application.scholarshipName || programsById.get(application.scholarshipId)?.name || 'Scholarship',
          isClosed: application.status === 'Awarded' || application.status === 'Not Awarded',
          reviewStatus: review ? (review.status || 'Submitted') : 'Not Started',
          hasFiled: isFiled(review),
          score: isFiled(review) ? review.totalScore : null,
          needsDiscussion: review ? review.markForDiscussion : false,
          randomSortKey: randomSortKeys.current[application.id] || 0,
        };
      });
  }, [assignedApplications, allReviews, user, mounted, programs]);

  const processedData = useMemo(() => {
    let data = [...assignments];

    if (sortByRandom) {
      // Randomised order is a deliberate bias control, so it wins over recency.
      data.sort((a, b) => a.randomSortKey - b.randomSortKey);
    } else {
      // Otherwise newest submission first. Firestore returns documents in key
      // order, which put the most recently submitted applicant at the bottom of
      // the queue.
      data.sort((a, b) => toMillis(b.submissionDate) - toMillis(a.submissionDate));
    }

    if (filter === 'pending') data = data.filter(d => !d.hasFiled && !d.isClosed);
    if (filter === 'completed') data = data.filter(d => d.hasFiled);
    if (filter === 'discussion') data = data.filter(d => d.needsDiscussion);

    return data;
  }, [assignments, filter, sortByRandom]);

  const stats = useMemo(() => {
    const total = assignments.length;
    const completed = assignments.filter(d => d.hasFiled).length;
    const pending = assignments.filter(d => !d.hasFiled && !d.isClosed).length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    return { total, completed, pending, progress };
  }, [assignments]);

  const navigateFilter = (newFilter: string) => {
    if (newFilter === 'all') {
      router.push('/review');
    } else {
      router.push(`/review?status=${newFilter}`);
    }
  };

  if (isAppsLoading || isReviewsLoading || isProgramsLoading || !mounted) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Syncing Assignments...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Reviewer Command Center</h1>
          <p className="text-muted-foreground italic flex items-center gap-2">
            <Lock className="h-4 w-4" /> Anonymous blind review protocol active. Assigned portfolios only.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={sortByRandom ? 'secondary' : 'outline'} onClick={() => setSortByRandom(!sortByRandom)} size="sm">
            <ArrowUpDown className="h-4 w-4 mr-2" /> Randomize Order
          </Button>
          <Button variant={filter === 'discussion' ? 'secondary' : 'outline'} onClick={() => navigateFilter('discussion')} size="sm">
            <MessageSquare className="h-4 w-4 mr-2" /> Flagged by me
          </Button>
        </div>
      </div>

      {assignments.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-primary uppercase">Assigned</span>
                  <span className="text-2xl font-black">{stats.total}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-500/5 border-green-500/20">
              <CardContent className="pt-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-green-600 uppercase">Submitted</span>
                  <span className="text-2xl font-black">{stats.completed}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardContent className="pt-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-amber-600 uppercase">Pending</span>
                  <span className="text-2xl font-black">{stats.pending}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardContent className="pt-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Completion</span>
                  <div className="flex items-center gap-3 mt-1">
                    <Progress value={stats.progress} className="h-2" />
                    <span className="text-xs font-black">{Math.round(stats.progress)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2 border-b pb-4">
            <Button variant={filter === 'all' ? 'secondary' : 'ghost'} onClick={() => navigateFilter('all')}>All Assignments</Button>
            <Button variant={filter === 'pending' ? 'secondary' : 'ghost'} onClick={() => navigateFilter('pending')}>🆕 Not Started</Button>
            <Button variant={filter === 'completed' ? 'secondary' : 'ghost'} onClick={() => navigateFilter('completed')}>✅ Submitted</Button>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate Identifier</TableHead>
                  <TableHead>Scholarship</TableHead>
                  <TableHead>Eval Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedData.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold flex items-center gap-2">
                          {/* Identified by student, so the same candidate reads
                              consistently across their separate applications. */}
                          Applicant {String(app.studentId || app.id).substring(0, 6).toUpperCase()}
                          {app.needsDiscussion && <MessageSquare className="h-3 w-3 text-amber-600" />}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                          <Clock className="h-2 w-2" /> Submitted: {toMillis(app.submissionDate) ? new Date(toMillis(app.submissionDate)).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium">{app.scholarshipName}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={app.hasFiled ? 'default' : 'secondary'}>
                          {app.reviewStatus === 'Draft' ? 'Draft saved' : app.reviewStatus}
                        </Badge>
                        {app.isClosed && (
                          <Badge variant="outline" className="text-[10px]">Decision made</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {typeof app.score === 'number' ? (
                        <span className="font-mono font-bold text-primary">{app.score.toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">--</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/review/applications/${app.id}`}>
                          {app.hasFiled || app.isClosed ? 'View' : app.reviewStatus === 'Draft' ? 'Continue' : 'Evaluate'}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {processedData.length === 0 && (
            <div className="text-center py-12 text-muted-foreground italic">
              No assignments found matching this filter.
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-2xl border-2 border-dashed">
          <Inbox className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <p className="text-lg font-bold text-muted-foreground">
            {!orgId ? 'Account not set up' : assignedScholarshipIds.length === 0 ? 'No assignments yet' : 'Nothing to review yet'}
          </p>
          <p className="text-sm text-muted-foreground max-w-sm text-center mt-1">
            {!orgId
              ? 'Your account is not linked to an organization yet, so there is nothing to show. Ask your administrator to check your invitation.'
              : assignedScholarshipIds.length === 0
                ? 'You have not been assigned to a scholarship committee yet. Your administrator assigns reviewers on each scholarship.'
                : 'You are on the committee, but none of your scholarships has a submitted application waiting. They will appear here as students submit.'}
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
