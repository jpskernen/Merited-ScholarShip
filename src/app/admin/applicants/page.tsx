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
  ChevronRight,
  Download,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { useFirebase, useUser } from '@/firebase';
import { collection, doc, updateDoc, collectionGroup, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AdminApplicantsPage() {
  const { firestore } = useFirebase();
  const { userData, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [applications, setApplications] = useState<any[]>([]);
  const [allReviews, setAllReviews] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const schoolId = userData?.schoolId || 'scholarship-hib4j';

  // Real-time listener for Applicants
  useEffect(() => {
    if (!firestore || isUserLoading) return;

    setIsDataLoading(true);
    
    const q = query(
      collection(firestore, 'users'),
      where('role', '==', 'Applicant'),
      where('schoolId', '==', schoolId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setApplications(docs.filter((app: any) => app.status !== 'Draft'));
      setIsDataLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setIsDataLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, schoolId, isUserLoading]);

  // Real-time listener for all Reviews
  useEffect(() => {
    if (!firestore || isUserLoading) return;

    const q = collectionGroup(firestore, 'reviews');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), applicationId: doc.ref.parent.parent?.id }));
      setAllReviews(docs);
    });

    return () => unsubscribe();
  }, [firestore, isUserLoading]);

  const tableData = useMemo(() => {
    let data = applications.map(applicant => {
      const applicantReviews = allReviews.filter(r => r.applicationId === applicant.id);
      const reviewCount = applicantReviews.length;
      
      const totalScore = applicantReviews.reduce((acc, r) => acc + (r.totalScore || 0), 0);
      const averageScore = reviewCount > 0 ? totalScore / reviewCount : 0;
      
      const scores = applicantReviews.map(r => r.totalScore || 0);
      const hasOutlier = scores.length >= 2 && scores.some(s => Math.abs(s - averageScore) > 1.5);

      return {
        ...applicant,
        averageScore,
        reviewCount,
        hasOutlier,
        needsDiscussion: applicantReviews.some(r => r.markForDiscussion),
      };
    });

    if (statusFilter !== 'all') {
      data = data.filter(item => item.status === statusFilter);
    }

    return data;
  }, [applications, allReviews, statusFilter]);

  const handleExportCSV = () => {
    if (!tableData.length) {
      toast({ title: "No Data", description: "There are no applications to export.", variant: "destructive" });
      return;
    }

    const exportData = tableData.map(row => ({
      'Candidate ID': row.id,
      'Name': row.name || 'Anonymous',
      'Email': row.email,
      'GPA': row.gpa?.toFixed(2) || 'N/A',
      'Status': row.status,
      'Review Count': row.reviewCount,
      'Avg Score': row.averageScore.toFixed(2),
      'Shortlisted': row.isShortlisted ? 'Yes' : 'No',
      'Submitted At': row.submissionDate ? new Date(row.submissionDate).toLocaleString() : 'N/A'
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `applicants-export-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "Export Started", description: "Your CSV file is being generated." });
  };

  const handleToggleShortlist = async (id: string, current: boolean) => {
    if (!firestore) return;
    try {
      const docRef = doc(firestore, 'users', id);
      await updateDoc(docRef, { isShortlisted: !current });
      toast({ title: current ? "Removed from Shortlist" : "Added to Shortlist" });
    } catch (err) {
      toast({ title: "Update Failed", variant: "destructive" });
    }
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
    setBulkError(null);
    try {
      const promises = selectedIds.map(id => 
        updateDoc(doc(firestore, 'users', id), {
          status: bulkStatus,
          updatedAt: serverTimestamp()
        })
      );
      await Promise.all(promises);
      toast({ 
        title: "Bulk Status Updated", 
        description: `Updated ${selectedIds.length} applicant(s) to ${bulkStatus}.` 
      });
      setSelectedIds([]);
      setBulkStatus('');
    } catch (err: any) {
      setBulkError(err.message || "Failed to update applicants.");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  if (isUserLoading || isDataLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse font-medium">Syncing committee records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Committee Review Board</h1>
          <p className="text-muted-foreground">
            Manage institutional applicants and evaluate committee scoring distribution.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status Filter" />
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
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="p-4 bg-primary/5 border-2 border-primary/20 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-4">
            <Badge className="px-3 py-1 font-bold">{selectedIds.length} Selected</Badge>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="w-[220px] bg-background">
                <SelectValue placeholder="Change status to..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="In Review">Move to Review</SelectItem>
                <SelectItem value="Awarded">Grant Award</SelectItem>
                <SelectItem value="Not Awarded">Deny Application</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>Cancel</Button>
            <Button size="sm" onClick={handleBulkUpdate} disabled={!bulkStatus || isBulkUpdating}>
              {isBulkUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Apply to Selection
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox 
                  checked={selectedIds.length === tableData.length && tableData.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Candidate Identifier</TableHead>
              <TableHead>Reviews</TableHead>
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
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold flex items-center gap-2">
                      Applicant {row.id.substring(0, 6).toUpperCase()}
                      <EyeOff className="h-3 w-3 opacity-30" />
                    </span>
                    <Badge variant="outline" className="w-fit text-[9px] mt-1 uppercase font-black tracking-tight">
                      {row.status}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-mono px-3">{row.reviewCount}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-primary">{row.averageScore.toFixed(2)}</span>
                    <BarChart3 className="h-4 w-4 text-muted-foreground opacity-40" />
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
                      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
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
                      <Link href={`/reviewer/applications/${row.id}`}>
                        Review <ExternalLink className="ml-2 h-3 w-3" />
                      </Link>
                    </Button>
                    <Button 
                      variant={row.isShortlisted ? 'destructive' : 'secondary'} 
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
        
        {tableData.length === 0 && (
          <div className="text-center py-24 bg-muted/5">
             <Users className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-20" />
             <p className="text-muted-foreground font-medium italic">No applicants found matching the current criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
