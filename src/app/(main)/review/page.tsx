
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
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCollection, useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import { collection, collectionGroup, doc, query, where } from 'firebase/firestore';

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

  const reviewerProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'reviewers', user.uid);
  }, [firestore, user]);

  const adminRoleRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'roles_admin', user.uid);
  }, [firestore, user]);

  const { data: reviewerProfile, isLoading: isReviewerRoleLoading } = useDoc(reviewerProfileRef);
  const { data: adminRole, isLoading: isAdminRoleLoading } = useDoc(adminRoleRef);

  const isAuthorizedToReview = 
    !!reviewerProfile || 
    !!adminRole || 
    user?.email === 'peyton.vandenbemden@gmail.com' || 
    user?.email === 'hello@merited.com' || 
    user?.email === 'hellow@meritedapp.com' ||
    user?.email === 'hello@meritedapp.com';

  const applicantsQuery = useMemoFirebase(() => {
    if (!firestore || !isAuthorizedToReview) return null;
    // Only show applicants who have officially submitted
    return query(collection(firestore, 'users'), where('role', '==', 'Applicant'), where('status', '==', 'Submitted'));
  }, [firestore, isAuthorizedToReview]);
  
  const { data: applicants, isLoading: isAppsLoading } = useCollection(applicantsQuery);

  const myReviewsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !isAuthorizedToReview) return null;
    return collectionGroup(firestore, 'reviews');
  }, [firestore, user, isAuthorizedToReview]);
  
  const { data: allReviews, isLoading: isReviewsLoading } = useCollection(myReviewsQuery);

  const randomSortKeys = useMemo(() => {
    if (!applicants || !mounted) return {};
    const keys: Record<string, number> = {};
    applicants.forEach(app => {
      keys[app.id] = Math.random();
    });
    return keys;
  }, [applicants, mounted]);

  const assignments = useMemo(() => {
    if (!applicants || !allReviews || !user || !mounted || !isAuthorizedToReview) return [];

    const myReviews = allReviews.filter(r => r.reviewerId === user.uid);

    return applicants.map(app => {
      const review = myReviews.find(r => r.applicationId === app.id);
      return {
        ...app,
        reviewStatus: review ? review.status : 'Not Started',
        score: review ? review.totalWeightedScore : null,
        needsDiscussion: review ? review.markForDiscussion : false,
        randomSortKey: randomSortKeys[app.id] || 0,
      };
    });
  }, [applicants, allReviews, user, mounted, randomSortKeys, isAuthorizedToReview]);

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

  if (isReviewerRoleLoading || isAdminRoleLoading || isAppsLoading || isReviewsLoading || !mounted) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Loading Review Assignments...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Reviewer Command Center</h1>
          <p className="text-muted-foreground italic flex items-center gap-2">
            <Lock className="h-4 w-4" /> Anonymous blind review protocol active. Only submitted portfolios shown.
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
