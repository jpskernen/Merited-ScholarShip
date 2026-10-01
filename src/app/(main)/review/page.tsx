
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
import { collection, collectionGroup, doc, query, where, getDocs } from 'firebase/firestore';

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
  const { firestore, user } = useFirebase();
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
    if (!firestore || !user) return null;
    return query(collection(firestore, 'programs'), where('reviewerIds', 'array-contains', user.uid));
  }, [firestore, user]);

  const { data: programs, isLoading: isProgramsLoading } = useCollection(programsQuery);

  const assignedScholarshipIds = useMemo(
    () => (programs || []).map(p => p.id).filter(Boolean),
    [programs],
  );

  // 2. Get the applications submitted to the scholarships this reviewer is
  //    assigned to. The queue is now one row per APPLICATION, not per student:
  //    a student who applied to two of this reviewer's scholarships must be
  //    evaluated twice, against each scholarship's own rubric. Keying the queue
  //    by student also meant the scoring page had to guess which scholarship it
  //    was scoring, and it guessed with programs[0].
  const applicationsQuery = useMemoFirebase(() => {
    if (!firestore || assignedScholarshipIds.length === 0) return null;
    // Firestore caps 'in' at 30 values and rejects an empty array.
    return query(
      collection(firestore, 'applications'),
      where('scholarshipId', 'in', assignedScholarshipIds.slice(0, 30)),
    );
  }, [firestore, assignedScholarshipIds]);

  const { data: assignedApplications, isLoading: isAppsLoading } = useCollection(applicationsQuery);

  // 3. Get all reviews by this reviewer
  const myReviewsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collectionGroup(firestore, 'reviews');
  }, [firestore, user]);

  const { data: allReviews, isLoading: isReviewsLoading } = useCollection(myReviewsQuery);

  const randomSortKeys = useMemo(() => {
    if (!assignedApplications || !mounted) return {};
    const keys: Record<string, number> = {};
    assignedApplications.forEach(application => {
      keys[application.id] = Math.random();
    });
    return keys;
  }, [assignedApplications, mounted]);

  const assignments = useMemo(() => {
    if (!assignedApplications || !allReviews || !user || !mounted || !programs) return [];

    const myReviews = allReviews.filter(r => r.reviewerId === user.uid);
    const programsById = new Map(programs.map(p => [p.id, p]));

    return assignedApplications
      // Drafts aren't ready to be judged, and decided applications are closed.
      .filter((application: any) => application.status === 'Submitted' || application.status === 'In Review')
      .map((application: any) => {
        const review = myReviews.find(r => r.applicationId === application.id);
        return {
          ...application,
          scholarshipName: application.scholarshipName || programsById.get(application.scholarshipId)?.name || 'Scholarship',
          reviewStatus: review ? review.status : 'Not Started',
          score: review ? review.totalScore : null,
          needsDiscussion: review ? review.markForDiscussion : false,
          randomSortKey: randomSortKeys[application.id] || 0,
        };
      });
  }, [assignedApplications, allReviews, user, mounted, randomSortKeys, programs]);

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

    if (filter === 'pending') data = data.filter(d => d.reviewStatus !== 'Submitted');
    if (filter === 'completed') data = data.filter(d => d.reviewStatus === 'Submitted');
    if (filter === 'discussion') data = data.filter(d => d.needsDiscussion);

    return data;
  }, [assignments, filter, sortByRandom]);

  const stats = useMemo(() => {
    const total = assignments.length;
    const completed = assignments.filter(d => d.reviewStatus === 'Submitted').length;
    const pending = total - completed;
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
            <MessageSquare className="h-4 w-4 mr-2" /> Panel Discussion
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
                      <Badge variant={app.reviewStatus === 'Submitted' ? 'default' : 'secondary'}>
                        {app.reviewStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {app.score !== null ? (
                        <span className="font-mono font-bold text-primary">{app.score.toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">--</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/review/applications/${app.id}`}>
                          {app.reviewStatus === 'Submitted' ? 'View' : 'Evaluate'} <ArrowRight className="h-4 w-4 ml-2" />
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
          <p className="text-lg font-bold text-muted-foreground">No Assignments</p>
          <p className="text-sm text-muted-foreground max-w-sm text-center mt-1">
            You are not currently assigned to any active scholarship committee programs.
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
