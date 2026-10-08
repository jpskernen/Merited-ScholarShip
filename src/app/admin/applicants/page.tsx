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
import { Input } from '@/components/ui/input';
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
  ClipboardList,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useFirebase, useUser } from '@/firebase';
import { collection, doc, updateDoc, collectionGroup, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import { sendStatusUpdate } from '@/app/lib/notifications';
import { cn } from '@/lib/utils';

export default function AdminApplicantsPage() {
  const { firestore } = useFirebase();
  const { userData, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [applications, setApplications] = useState<any[]>([]);
  const [scholarshipApplications, setScholarshipApplications] = useState<any[]>([]);
  const [allReviews, setAllReviews] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
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


  useEffect(() => {
    if (!firestore || isUserLoading) return;
    const q = query(collection(firestore, 'applications'), where('organizationId', '==', schoolId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => setScholarshipApplications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      (error) => console.error('Applications listener failed:', error.message),
    );
    return () => unsubscribe();
  }, [firestore, schoolId, isUserLoading]);

  const applicationsByStudent = useMemo(() => {
    const map: Record<string, any[]> = {};
    scholarshipApplications.forEach((application: any) => {
      if (!application.studentId) return;
      (map[application.studentId] ||= []).push(application);
    });
    return map;
  }, [scholarshipApplications]);

  // One row per APPLICATION, not per student. A student holding two
  // applications in different states can't be represented by a single row, and
  // trying to do so meant the board carried two competing status columns: the
  // per-application badges and a global users/{uid}.status that matched neither.
  // Awards are granted per scholarship, so the row the admin ticks has to be
  // the thing the award applies to.
  const tableData = useMemo(() => {
    // Reviews are stored under the application they score. Reviews filed before
    // the reviewer migration sit under the student instead, so the key can be
    // either — an application row looks for its own reviews, and a student with
    // no application record still shows the legacy ones.
    const statsFor = (key: string) => {
      const reviews = allReviews.filter(r => r.applicationId === key);
      const reviewCount = reviews.length;
      const totalScore = reviews.reduce((acc, r) => acc + (r.totalScore || 0), 0);
      const averageScore = reviewCount > 0 ? totalScore / reviewCount : 0;
      const scores = reviews.map(r => r.totalScore || 0);
      return {
        averageScore,
        reviewCount,
        hasOutlier: scores.length >= 2 && scores.some(s => Math.abs(s - averageScore) > 1.5),
        needsDiscussion: reviews.some(r => r.markForDiscussion),
      };
    };

    let data = applications.flatMap(applicant => {
      const shared = {
        ...applicant,
        studentId: applicant.id,
      };

      const studentApplications = applicationsByStudent[applicant.id] || [];

      // Students who applied before the applications collection existed have no
      // record yet (it is backfilled the next time they open the portal). Keep
      // them visible on one row driven by their legacy status rather than
      // dropping them off the board entirely — but only when that legacy status
      // is a real submission. A student who has merely signed up has no status
      // at all, and showed up here as "UNKNOWN".
      if (studentApplications.length === 0) {
        const legacyStatus = applicant.status?.toLowerCase();
        if (!legacyStatus || legacyStatus === 'draft') return [];
        return [{
          ...shared,
          ...statsFor(applicant.id),
          rowId: applicant.id,
          applicationId: null,
          scholarshipName: null,
          applicationStatus: applicant.status,
        }];
      }

      // A draft hasn't been submitted, so it isn't the committee's to judge —
      // and left on the board it could be ticked and awarded.
      return studentApplications
        .filter((application: any) => application.status && application.status !== 'Draft')
        .map((application: any) => ({
          ...shared,
          ...statsFor(application.id),
          rowId: application.id,
          applicationId: application.id,
          scholarshipName: application.scholarshipName,
          applicationStatus: application.status,
        }));
    });

    if (statusFilter !== 'all') {
      data = data.filter(item => item.applicationStatus?.toLowerCase() === statusFilter.toLowerCase());
    }

    const term = search.trim().toLowerCase();
    if (term) {
      data = data.filter(item =>
        [item.name, item.school, item.email, item.studentId, item.scholarshipName]
          .some((field: any) => field?.toLowerCase?.().includes(term))
      );
    }

    return data;
  }, [applications, allReviews, statusFilter, applicationsByStudent, search]);

  // Filtering can shrink the list under the current page, so clamp rather than
  // stranding the admin on an empty page with no obvious way back.
  const totalPages = Math.max(1, Math.ceil(tableData.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pagedData = useMemo(
    () => tableData.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [tableData, currentPage, pageSize],
  );

  useEffect(() => { setPage(1); }, [search, statusFilter, pageSize]);

  const allOnPageSelected = pagedData.length > 0 && pagedData.every(row => selectedIds.includes(row.rowId));

  const toggleSelectPage = () => {
    const pageIds = pagedData.map(row => row.rowId);
    setSelectedIds(prev => allOnPageSelected
      ? prev.filter(id => !pageIds.includes(id))
      : Array.from(new Set([...prev, ...pageIds])));
  };

  const handleBulkUpdate = async () => {
    if (!firestore || !bulkStatus || selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const selectedRows = tableData.filter(row => selectedIds.includes(row.rowId));

      const promises = selectedRows.map(async row => {
        if (row.applicationId) {
          // The decision belongs to the application, so awarding one scholarship
          // no longer marks the student as awarded everywhere.
          await updateDoc(doc(firestore, 'applications', row.applicationId), {
            status: bulkStatus,
            updatedAt: serverTimestamp()
          });
        }

        // The reviewer queue and the legacy mirror still read users/{uid}.status,
        // so keep it in step for the application it currently mirrors — and for
        // students who have no application record yet.
        if (!row.applicationId || row.legacyMirrorOf === row.applicationId) {
          await updateDoc(doc(firestore, 'users', row.studentId), {
            status: bulkStatus,
            updatedAt: serverTimestamp()
          });
        }

        if (row.email) {
          await sendStatusUpdate(row.email, row.name || 'Student', bulkStatus);
        }
      });

      await Promise.all(promises);
      toast({ title: "Decisions Recorded", description: `${selectedRows.length} application(s) updated and applicants notified.` });
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
      'Student ID': row.studentId,
      'Name': row.name,
      'Email': row.email || '',
      'School': row.school || '',
      'GPA': row.gpa,
      'Scholarship': row.scholarshipName || '',
      'Status': row.applicationStatus,
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
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, school or scholarship..."
              className="h-10 w-full sm:w-64 pl-9"
            />
          </div>
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
                <p className="text-[10px] font-black uppercase text-primary/60">Applications</p>
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
              <TableHead className="w-12"><Checkbox checked={allOnPageSelected} onCheckedChange={toggleSelectPage} /></TableHead>
              <TableHead>Candidate</TableHead>
              <TableHead>Scholarship</TableHead>
              <TableHead>GPA</TableHead>
              <TableHead>Avg Score</TableHead>
              <TableHead>Reviews</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right pr-6">Management</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>

            {pagedData.map((row) => (
              <TableRow key={row.rowId} className="hover:bg-muted/10 transition-colors">
                <TableCell><Checkbox checked={selectedIds.includes(row.rowId)} onCheckedChange={() => setSelectedIds(prev => prev.includes(row.rowId) ? prev.filter(i => i !== row.rowId) : [...prev, row.rowId])} /></TableCell>
                <TableCell>
                  {/* Admins are meant to see identities, so the name leads here.
                      The "Applicant HNANIF" pseudonym belongs to the reviewer
                      queue, where blind review applies — printing it above the
                      real name and email was pure noise. */}
                  <div className="flex flex-col">
                    <span className="font-bold">{row.name || 'Unnamed applicant'}</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">
                      {row.school || 'Institution not recorded'}
                    </span>
                    {row.email && <span className="text-[10px] text-muted-foreground lowercase">{row.email}</span>}
                  </div>
                </TableCell>
                <TableCell>
                  {row.scholarshipName ? (
                    <span className="text-sm font-medium">{row.scholarshipName}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Not linked to a scholarship</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm font-bold">
                    {typeof row.gpa === 'number' ? row.gpa.toFixed(2) : '—'}
                  </span>
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
                    row.applicationStatus === 'Awarded' ? 'bg-green-50 text-green-700 border-green-200' :
                    row.applicationStatus === 'Not Awarded' ? 'bg-red-50 text-red-700 border-red-200' :
                    row.applicationStatus === 'In Review' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''
                  )}>
                    {row.applicationStatus || 'Unknown'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right pr-6">
                  <Button variant="ghost" size="sm" asChild className="font-bold hover:bg-primary/5">
                    <Link href={`/admin/applicants/${row.studentId}${row.applicationId ? `?application=${encodeURIComponent(row.applicationId)}` : ''}`}>
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

        {tableData.length > 0 && (
          <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-bold text-foreground">{(currentPage - 1) * pageSize + 1}</span>
                –<span className="font-bold text-foreground">{Math.min(currentPage * pageSize, tableData.length)}</span>
                {' '}of <span className="font-bold text-foreground">{tableData.length}</span>
              </p>
              <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[25, 50, 100].map(size => (
                    <SelectItem key={size} value={String(size)}>{size} per page</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              {/* Selections survive paging, so a decision can span pages. */}
              {selectedIds.length > 0 && (
                <span className="text-xs text-muted-foreground mr-2">{selectedIds.length} selected across all pages</span>
              )}
              <Button variant="outline" size="sm" className="h-8"
                onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <span className="text-xs font-bold px-2">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" className="h-8"
                onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>

  );
}