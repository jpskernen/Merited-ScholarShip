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
import { Card, CardContent } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Eye,
  AlertTriangle, 
  Users, 
  BarChart3, 
  MessageSquare,
  Star,
  Loader2,
  Filter,
  CheckCircle2,
  Download,
  ExternalLink,
  ClipboardList
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
      where('role', '==', 'applicant'),
      where('schoolId', '==', schoolId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setApplications(docs.filter((app: any) => app.status?.toLowerCase() !== 'draft'));
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
      data = data.filter(item => item.status?.toLowerCase() === statusFilter.toLowerCase());
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
      'Avg Score': row.averageScore.toFixed(2),
      'Reviews': row.reviewCount
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Committee Review Board</h1>
          <p className="text-muted-foreground">Aggregate scoring and decision workflow oversight.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
          <Button variant={statusFilter === 'all' ? 'default' : 'outline'} onClick={() => setStatusFilter('all')}>All</Button>
          <Button variant={statusFilter === 'submitted' ? 'default' : 'outline'} onClick={() => setStatusFilter('submitted')}>Pending</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-primary/60">Total Active</p>
                <p className="text-3xl font-black">{tableData.length}</p>
              </div>
              <ClipboardList className="h-8 w-8 text-primary opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-amber-600/60">Discussion Required</p>
                <p className="text-3xl font-black">{tableData.filter(d => d.needsDiscussion).length}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-amber-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-green-600/60">Highly Scored (8+)</p>
                <p className="text-3xl font-black">{tableData.filter(d => d.averageScore >= 8).length}</p>
              </div>
              <Star className="h-8 w-8 text-green-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedIds.length > 0 && (
        <Card className="p-4 bg-primary/5 border-primary/20 flex items-center justify-between gap-4 animate-in slide-in-from-top-4">
          <div className="flex items-center gap-4">
            <Badge className="h-8 px-4 font-bold">{selectedIds.length} Selected</Badge>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="w-[200px] h-10"><SelectValue placeholder="Institutional Decision..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Awarded">Grant Award</SelectItem>
                <SelectItem value="Not Awarded">Deny Application</SelectItem>
                <SelectItem value="In Review">Move to Panel Discussion</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleBulkUpdate} disabled={!bulkStatus || isBulkUpdating} className="h-10 font-bold">
            {isBulkUpdating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Finalize Selections
          </Button>
        </Card>
      )}

      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-12"><Checkbox checked={selectedIds.length === tableData.length && tableData.length > 0} onCheckedChange={() => setSelectedIds(selectedIds.length === tableData.length ? [] : tableData.map(d => d.id))} /></TableHead>
              <TableHead>Candidate Identifier</TableHead>
              <TableHead>Avg Score</TableHead>
              <TableHead>Review Density</TableHead>
              <TableHead>Current Status</TableHead>
              <TableHead className="text-right pr-6">Management</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableData.map((row) => (
              <TableRow key={row.id} className="hover:bg-muted/10 transition-colors">
                <TableCell><Checkbox checked={selectedIds.includes(row.id)} onCheckedChange={() => setSelectedIds(prev => prev.includes(row.id) ? prev.filter(i => i !== row.id) : [...prev, row.id])} /></TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold">Applicant {row.id.substring(0,6).toUpperCase()}</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">{row.name || 'Anonymous'} • {row.school || 'Texas Institution'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-lg font-black", row.averageScore >= 8 ? "text-green-600" : row.averageScore >= 6 ? "text-primary" : "text-amber-600")}>
                      {row.averageScore.toFixed(2)}
                    </span>
                    {row.hasOutlier && <Badge variant="outline" className="text-[8px] bg-red-50 text-red-600 border-red-200">High Variance</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">{row.reviewCount} Reviews</span>
                    {row.needsDiscussion && <MessageSquare className="h-3 w-3 text-amber-600 animate-pulse" />}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn(
                    "font-bold uppercase tracking-widest text-[10px]",
                    row.status === 'Awarded' ? 'bg-green-50 text-green-700 border-green-200' : 
                    row.status === 'In Review' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''
                  )}>
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right pr-6">
                  <Button variant="ghost" size="sm" asChild className="font-bold hover:bg-primary/5">
                    <Link href={`/admin/applicants/${row.id}`}>
                      Detail View <ExternalLink className="ml-2 h-3 w-3" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {tableData.length === 0 && (
          <div className="py-20 text-center flex flex-col items-center gap-2">
            <Users className="h-10 w-10 text-muted-foreground opacity-20" />
            <p className="text-muted-foreground italic">No applications found matching the current criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}