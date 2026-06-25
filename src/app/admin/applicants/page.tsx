
'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { Card } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  EyeOff, 
  AlertTriangle, 
  Users, 
  BarChart3, 
  MessageSquare,
  Star,
  Loader2,
  Filter,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { useFirebase, useUser } from '@/firebase';
import { collection, doc, updateDoc, collectionGroup, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

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
  const { userData, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [applications, setApplications] = useState<any[]>([]);
  const [allReviews, setAllReviews] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Bulk actions state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const orgId = userData?.schoolId || 'default-school';

  // 1. Real-time Applicants Listener (Filtered by Org and Status)
  useEffect(() => {
    if (!firestore || !orgId || isUserLoading) return;

    setIsDataLoading(true);
    
    const q = query(
      collection(firestore, 'users'),
      where('role', '==', 'Applicant'),
      where('schoolId', '==', orgId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((app: any) => app.status !== 'Draft' && app.status !== 'draft');
      
      setApplications(docs);
      setIsDataLoading(false);
    }, (error) => {
      console.error("Error listening to applicants:", error);
      setIsDataLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, orgId, isUserLoading]);

  // 2. Real-time Reviews Listener (Collection Group)
  useEffect(() => {
    if (!firestore || isUserLoading) return;

    const q = collectionGroup(firestore, 'reviews');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllReviews(docs);
    });

    return () => unsubscribe();
  }, [firestore, isUserLoading]);

  // 3. Processed Data for the Table
  const tableData = useMemo(() => {
    let data = applications.map(applicant => {
      const applicantReviews = allReviews.filter(r => r.applicationId === applicant.id) || [];
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
      const hasOutlier = scores.length >= 2 && scores.some(s => Math.abs(s - averageScore) > 0.8);

      return {
        ...applicant,
        averageScore,
        reviewCount,
        hasOutlier,
        needsDiscussion: applicantReviews.some(r => r.markForDiscussion),
      };
    });

    if (statusFilter !== 'all') {
      data = data.filter(item => item.status?.toLowerCase() === statusFilter.toLowerCase());
    }

    return data;
  }, [applications, allReviews, statusFilter]);

  const handleToggleShortlist = async (id: string, current: boolean) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'users', id);
    updateDoc(docRef, { isShortlisted: !current });
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === tableData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(tableData.map(app => app.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkUpdate = async () => {
    if (!firestore || !bulkStatus || selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const promises = selectedIds.map(id => 
        updateDoc(doc(firestore, 'users', id), {
          status: bulkStatus,
          updatedAt: serverTimestamp()
        })
      );
      await Promise.all(promises);
      toast({ 
        title: "Status Updated", 
        description: `Successfully updated ${selectedIds.length} candidate(s) to "${bulkStatus}".` 
      });
      setSelectedIds([]);
      setBulkStatus('');
    } catch (err: any) {
      toast({ 
        title: "Update Failed", 
        description: err.message || "Could not complete bulk update.", 
        variant: "destructive" 
      });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  if (isUserLoading || isDataLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Syncing committee results...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Committee Review Board</h1>
          <p className="text-muted-foreground">
            Real-time multi-tenant evaluation analytics and candidate shortlisting.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Submissions</SelectItem>
                <SelectItem value="Submitted">Submitted</SelectItem>
                <SelectItem value="In Review">Under Review</SelectItem>
                <SelectItem value="Awarded">Awarded</SelectItem>
                <SelectItem value="Not Awarded">Not Awarded</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card className="px-4 py-2 bg-primary/5 border-primary/20 flex items-center gap-3">
            <Users className="h-4 w-4 text-primary" />
            <div className="text-sm">
              <span className="font-bold text-primary">{tableData.length}</span>
              <span className="text-muted-foreground ml-1">Results</span>
            </div>
          </Card>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-primary/10 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-4">
            <Badge variant="default" className="bg-primary px-3 py-1 font-bold">
              {selectedIds.length} Selected
            </Badge>
            <div className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="w-[200px] h-9 bg-background">
                  <SelectValue placeholder="Change status to..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Submitted">Submitted</SelectItem>
                  <SelectItem value="In Review">Under Review</SelectItem>
                  <SelectItem value="Awarded">Awarded</SelectItem>
                  <SelectItem value="Not Awarded">Not Awarded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>Cancel</Button>
            <Button 
              size="sm" 
              onClick={handleBulkUpdate} 
              disabled={!bulkStatus || isBulkUpdating}
              className="font-bold"
            >
              {isBulkUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Apply Status
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox 
                  checked={selectedIds.length === tableData.length && tableData.length > 0}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="w-[300px]">Candidate Identifier</TableHead>
              <TableHead>Evaluations</TableHead>
              <TableHead>Avg Weighted Score</TableHead>
              <TableHead>Status Indicators</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableData.map((row) => (
              <TableRow key={row.id} className={selectedIds.includes(row.id) ? 'bg-primary/5' : ''}>
                <TableCell>
                  <Checkbox 
                    checked={selectedIds.includes(row.id)}
                    onCheckedChange={() => toggleSelectOne(row.id)}
                    aria-label={`Select applicant ${row.id}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-semibold flex items-center gap-2">
                      Applicant {row.id.substring(0, 6).toUpperCase()}
                      <EyeOff className="h-3 w-3 opacity-30" />
                    </span>
                    <Badge variant="outline" className="w-fit text-[10px] mt-1">
                      {row.status}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-mono">{row.reviewCount}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-primary">{row.averageScore.toFixed(2)}</span>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {row.hasOutlier && (
                      <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-200">
                        <AlertTriangle className="h-3 w-3 mr-1" /> High Variance
                      </Badge>
                    )}
                    {row.needsDiscussion && (
                      <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-200">
                        <MessageSquare className="h-3 w-3 mr-1" /> Panel Discussion
                      </Badge>
                    )}
                    {row.isShortlisted && (
                      <Badge className="bg-green-600">
                        <Star className="h-3 w-3 mr-1" /> Shortlist
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/review/applications/${row.id}`}>Review</Link>
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
      
      {tableData.length === 0 && (
        <div className="text-center py-20 bg-muted/5 rounded-lg border-2 border-dashed">
          <p className="text-muted-foreground italic">No applications found matching the current criteria.</p>
        </div>
      )}
    </div>
  );
}
