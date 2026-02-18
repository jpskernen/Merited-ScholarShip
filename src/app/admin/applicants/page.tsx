
'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  EyeOff, 
  AlertTriangle, 
  CheckCircle2, 
  Users, 
  BarChart3, 
  MessageSquare,
  Star,
  ArrowUpDown
} from 'lucide-react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, doc, updateDoc, collectionGroup } from 'firebase/firestore';
import Link from 'next/link';

// Rubric Weights (Total = 1.0)
const RUBRIC_WEIGHTS = {
  gpa: 0.25,
  extracurriculars: 0.15,
  volunteerism: 0.15,
  leadership: 0.15,
  major: 0.10,
  other: 0.20
};

export default function AdminApplicantsPage() {
  const { firestore } = useFirebase();
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Fetch all applicants
  const applicantsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);
  const { data: applicants, isLoading: isApplicantsLoading } = useCollection(applicantsQuery);

  // Fetch ALL reviews across ALL applications using collectionGroup
  const reviewsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collectionGroup(firestore, 'reviews');
  }, [firestore]);
  const { data: allReviews, isLoading: isReviewsLoading } = useCollection(allReviewsQuery);

  // Process data for the table
  const tableData = useMemo(() => {
    if (!applicants) return [];

    return applicants.map(applicant => {
      const applicantReviews = allReviews?.filter(r => r.applicationId === applicant.id) || [];
      
      const reviewCount = applicantReviews.length;
      let totalWeightedScore = 0;
      let scores: number[] = [];

      applicantReviews.forEach(review => {
        if (review.scores) {
          const weighted = 
            (review.scores.gpa * RUBRIC_WEIGHTS.gpa) +
            (review.scores.extracurriculars * RUBRIC_WEIGHTS.extracurriculars) +
            (review.scores.volunteerism * RUBRIC_WEIGHTS.volunteerism) +
            (review.scores.leadership * RUBRIC_WEIGHTS.leadership) +
            (review.scores.major * RUBRIC_WEIGHTS.major) +
            (review.scores.other * RUBRIC_WEIGHTS.other);
          
          totalWeightedScore += weighted;
          scores.push(weighted);
        }
      });

      const averageScore = reviewCount > 0 ? totalWeightedScore / reviewCount : 0;
      
      // Outlier Detection (Standard Deviation / Range check)
      const hasOutlier = scores.length >= 2 && scores.some(s => Math.abs(s - averageScore) > 0.8);

      return {
        ...applicant,
        averageScore,
        reviewCount,
        hasOutlier,
        needsDiscussion: applicantReviews.some(r => r.markForDiscussion),
      };
    });
  }, [applicants, allReviews]);

  const handleToggleShortlist = async (id: string, current: boolean) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'users', id);
    await updateDoc(docRef, { isShortlisted: !current });
  };

  if (isApplicantsLoading || isReviewsLoading) {
    return <div className="animate-pulse text-muted-foreground">Analyzing committee data...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Committee Review Panel</h1>
          <p className="text-muted-foreground">
            Aggregated scores, outlier detection, and shortlist management.
          </p>
        </div>
        <div className="flex gap-4">
          <Card className="p-3 bg-primary/5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <div className="text-xs">
                <p className="font-bold text-primary">{tableData.length}</p>
                <p className="text-muted-foreground">Total Candidates</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 bg-green-500/5">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-green-600" />
              <div className="text-xs">
                <p className="font-bold text-green-600">{tableData.filter(d => d.isShortlisted).length}</p>
                <p className="text-muted-foreground">Shortlisted</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Candidate</TableHead>
              <TableHead>Review Count</TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  Avg. Weighted Score <BarChart3 className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead>Status Flags</TableHead>
              <TableHead className="text-right">Decision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableData.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-semibold flex items-center gap-2">
                      {row.name}
                      {row.isBlind && <EyeOff className="h-3 w-3 opacity-30" />}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase">{row.school}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{row.reviewCount}</Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="text-lg font-bold text-primary">
                      {row.averageScore.toFixed(2)}
                      <span className="text-[10px] text-muted-foreground font-normal ml-1">/ 5.00</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {row.hasOutlier && (
                      <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-200">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Outlier
                      </Badge>
                    )}
                    {row.needsDiscussion && (
                      <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-200">
                        <MessageSquare className="h-3 w-3 mr-1" /> Discuss
                      </Badge>
                    )}
                    {row.isShortlisted && (
                      <Badge className="bg-green-600">
                        <Star className="h-3 w-3 mr-1" /> Shortlisted
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/review/applications/${row.id}`}>Analytics</Link>
                    </Button>
                    <Button 
                      variant={row.isShortlisted ? 'destructive' : 'default'} 
                      size="sm"
                      onClick={() => handleToggleShortlist(row.id, row.isShortlisted)}
                    >
                      {row.isShortlisted ? 'Remove' : 'Shortlist'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
