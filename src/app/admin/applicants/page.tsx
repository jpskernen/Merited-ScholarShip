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
  Download,
  ExternalLink
} from 'lucide-react';
import { useFirebase, useUser } from '@/firebase';
import { collection, doc, updateDoc, collectionGroup, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import { sendStatusUpdate } from '@/app/lib/notifications';

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

  const schoolId = userData?.schoolId || 'scholarship-hib4j';

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
    });

    return () => unsubscribe();
  }, [firestore, schoolId, isUserLoading]);

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

  const handleBulkUpdate = async () => {
    if (!firestore || !bulkStatus || selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const promises = selectedIds.map(async id => {
        const applicant = applications.find(a => a.id === id);
        await updateDoc(doc(firestore, 'users', id), {
          status: bulkStatus,
          updatedAt: serverTimestamp()
        });

        // Trigger notification
        if (applicant?.email) {
          await sendStatusUpdate(applicant.email, applicant.name || 'Student', bulkStatus);
        }
      });
      
      await Promise.all(promises);
      toast({ title: "Bulk Status Updated", description: "All applicants notified via email." });
      setSelectedIds([]);
      setBulkStatus('');
    } catch (err: any) {
      toast({ title: "Update Failed", variant: "destructive" });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleExportCSV = () => {
    const csv = Papa.unparse(tableData.map(row => ({
      'ID': row.id,
      'Name': row.name,
      'GPA': row.gpa,
      'Status': row.status,
      'Avg Score': row.averageScore.toFixed(2)
    })));
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `merited-export-${Date.now()}.csv`;
    link.click();
  };

  if (isUserLoading || isDataLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Committee Review Board</h1>
          <p className="text-muted-foreground">Aggregate scoring and decision workflow.</p>
        </div>
        <Button variant="outline" onClick={handleExportCSV}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
      </div>

      {selectedIds.length > 0 && (
        <Card className="p-4 bg-primary/5 border-primary/20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Badge>{selectedIds.length} Selected</Badge>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Decision..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Awarded">Grant Award</SelectItem>
                <SelectItem value="Not Awarded">Deny Application</SelectItem>
                <SelectItem value="In Review">Move to Panel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleBulkUpdate} disabled={!bulkStatus || isBulkUpdating}>
            {isBulkUpdating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Finalize Selections
          </Button>
        </Card>
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead><Checkbox checked={selectedIds.length === tableData.length} onCheckedChange={() => setSelectedIds(selectedIds.length === tableData.length ? [] : tableData.map(d => d.id))} /></TableHead>
              <TableHead>Candidate</TableHead>
              <TableHead>Avg Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableData.map((row) => (
              <TableRow key={row.id}>
                <TableCell><Checkbox checked={selectedIds.includes(row.id)} onCheckedChange={() => setSelectedIds(prev => prev.includes(row.id) ? prev.filter(i => i !== row.id) : [...prev, row.id])} /></TableCell>
                <TableCell className="font-bold">Applicant {row.id.substring(0,6).toUpperCase()}</TableCell>
                <TableCell className="text-lg font-black text-primary">{row.averageScore.toFixed(2)}</TableCell>
                <TableCell><Badge variant="outline">{row.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild><Link href={`/reviewer/applications/${row.id}`}>Review <ExternalLink className="ml-2 h-3 w-3" /></Link></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
