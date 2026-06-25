
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

  // 2. Get all submitted applicants
  const applicantsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'Applicant'), where('status', '==', 'Submitted'));
  }, [firestore]);
  
  const { data: allApplicants, isLoading: isAppsLoading } = useCollection(applicantsQuery);

  // 3. Get all reviews by this reviewer
  const myReviewsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collectionGroup(firestore, 'reviews');
  }, [firestore, user]);
  
  const { data: allReviews, isLoading: isReviewsLoading } = useCollection(myReviewsQuery);

  const randomSortKeys = useMemo(() => {
    if (!allApplicants || !mounted) return {};
    const keys: Record<string, number> = {};
    allApplicants.forEach(app => {
      keys[app.id] = Math.random();
    });
    return keys;
  }, [allApplicants, mounted]);

  const assignments = useMemo(() => {
    if (!allApplicants || !allReviews || !user || !mounted || !programs) return [];

    const myReviews = allReviews.filter(r => r.reviewerId === user.uid);
    
    // In current MVP, if a user is in assigned programs, they should see applicants
    // Ideally applicants would be linked to programs. For now, filter applicants 
    // by organization/schoolId matching the programs assigned.
    const assignedSchoolIds = new Set(programs.map(p => p.schoolId));

    return allApplicants
      .filter(app => assignedSchoolIds.has(app.schoolId))
      .map(app => {
        const review = myReviews.find(r => r.applicationId === app.id);
        return {
          ...app,
          reviewStatus: review ? review.status : 'Not Started',
          score: review ? review.totalWeightedScore : null,
          needsDiscussion: review ? review.markForDiscussion : false,
          randomSortKey: randomSortKeys[app.id] || 0,
        };
      });
  }, [allApplicants, allReviews, user, mounted, randomSortKeys, programs]);

  const processedData = useMemo(() => {
    let data = [...assignments];

    if (sortByRandom) {
      data.sort((a, b) => a.randomSortKey - b.randomSortKey);
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
                          Applicant {app.id.substring(0, 6).toUpperCase()}
                          {app.needsDiscussion && <MessageSquare className="h-3 w-3 text-amber-600" />}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                          <Clock className="h-2 w-2" /> Submitted: {app.submissionDate ? new Date(app.submissionDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
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
