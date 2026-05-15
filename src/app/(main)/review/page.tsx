
'use client';

import { useMemo, useState, useEffect } from 'react';
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
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import { collection, collectionGroup, doc } from 'firebase/firestore';

export default function ReviewerDashboardPage() {
  const { firestore, user } = useFirebase();
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'discussion'>('all');
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
    user?.email === 'hellow@meritedapp.com';

  const applicantsQuery = useMemoFirebase(() => {
    if (!firestore || !isAuthorizedToReview) return null;
    return collection(firestore, 'users');
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

  const processedData = useMemo(() => {
    if (!applicants || !allReviews || !user || !mounted || !isAuthorizedToReview) return [];

    const myReviews = allReviews.filter(r => r.reviewerId === user.uid);

    let data = applicants.filter(u => u.role === 'Applicant').map(app => {
      const review = myReviews.find(r => r.applicationId === app.id);
      return {
        ...app,
        reviewStatus: review ? review.status : 'Not Started',
        score: review ? review.totalWeightedScore : null,
        needsDiscussion: review ? review.markForDiscussion : false,
        randomSortKey: randomSortKeys[app.id] || 0,
      };
    });

    if (sortByRandom) {
      data.sort((a, b) => a.randomSortKey - b.randomSortKey);
    }

    if (filter === 'pending') data = data.filter(d => d.reviewStatus !== 'Submitted');
    if (filter === 'completed') data = data.filter(d => d.reviewStatus === 'Submitted');
    if (filter === 'discussion') data = data.filter(d => d.needsDiscussion);

    return data;
  }, [applicants, allReviews, user, filter, sortByRandom, mounted, randomSortKeys, isAuthorizedToReview]);

  const stats = useMemo(() => {
    const total = processedData.length;
    const completed = processedData.filter(d => d.reviewStatus === 'Submitted').length;
    const pending = total - completed;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    return { total, completed, pending, progress };
  }, [processedData]);

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
          <p className="text-muted-foreground italic">Mitigating bias through randomized evaluation.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={sortByRandom ? 'secondary' : 'outline'} onClick={() => setSortByRandom(!sortByRandom)} size="sm">
            <ArrowUpDown className="h-4 w-4 mr-2" /> Randomize Order
          </Button>
          <Button variant={filter === 'discussion' ? 'secondary' : 'outline'} onClick={() => setFilter('discussion')} size="sm">
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
        <Button variant={filter === 'all' ? 'secondary' : 'ghost'} onClick={() => setFilter('all')}>All Assignments</Button>
        <Button variant={filter === 'pending' ? 'secondary' : 'ghost'} onClick={() => setFilter('pending')}>🆕 Not Started</Button>
        <Button variant={filter === 'completed' ? 'secondary' : 'ghost'} onClick={() => setFilter('completed')}>✅ Submitted</Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Current Score</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedData.map((app) => (
              <TableRow key={app.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold flex items-center gap-2">
                      {app.isBlind ? `Applicant ${app.id.substring(0, 6)}` : app.name}
                      {app.needsDiscussion && <MessageSquare className="h-3 w-3 text-amber-600" />}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase">{app.school}</span>
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
    </div>
  );
}
