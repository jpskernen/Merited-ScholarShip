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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  ArrowRight, 
  Loader2,
  Lock,
  Clock,
  Inbox,
  UserCheck,
  CheckCircle2,
  FileEdit,
  AlertCircle,
  ChevronRight,
  GraduationCap
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, getDocs } from 'firebase/firestore';

function ReviewerDashboardContent() {
  const { firestore, user, userData, isUserLoading } = useFirebase();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [selectedScholarshipId, setSelectedScholarshipId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const organizationId = userData?.organizationId || userData?.schoolId;

  // 1. Fetch Assigned Scholarships (Specific Query)
  const scholarshipsQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId || !user) return null;
    return query(
      collection(firestore, 'programs'),
      where('organizationId', '==', organizationId),
      where('reviewerIds', 'array-contains', user.uid)
    );
  }, [firestore, organizationId, user]);

  const { data: scholarships, isLoading: isScholarshipsLoading } = useCollection(scholarshipsQuery);

  useEffect(() => {
    if (scholarships && scholarships.length > 0 && !selectedScholarshipId) {
      setSelectedScholarshipId(scholarships[0].id);
    }
  }, [scholarships, selectedScholarshipId]);

  // 2. Fetch Applications for the Selected Scholarship (Hierarchical Query)
  const applicationsQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId || !selectedScholarshipId) return null;
    return query(
      collection(firestore, 'organizations', organizationId, 'scholarships', selectedScholarshipId, 'applications'),
      where('status', 'in', ['Submitted', 'submitted'])
    );
  }, [firestore, organizationId, selectedScholarshipId]);

  const { data: applications, isLoading: isAppsLoading } = useCollection(applicationsQuery);

  if (isUserLoading || isScholarshipsLoading || !mounted) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse font-medium">Syncing Command Center...</p>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Profile Incomplete</h2>
        <p className="text-muted-foreground">Your account is not associated with an organization.</p>
      </div>
    );
  }

  const activeScholarship = scholarships?.find(s => s.id === selectedScholarshipId);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Reviewer Command Center</h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/5 px-2 py-0.5 text-[10px] font-black uppercase">
            Org: {organizationId}
          </Badge>
          <p className="text-sm text-muted-foreground">
            Secure, specific access to assigned portfolios.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Sidebar: Programs */}
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Assigned Programs</CardTitle>
              <CardDescription>Select a scholarship to view assignments.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {scholarships?.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedScholarshipId(s.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between group ${
                    selectedScholarshipId === s.id 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'hover:bg-muted border-transparent'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold truncate max-w-[180px]">{s.name}</span>
                    <span className={`text-[10px] uppercase font-black tracking-tighter ${selectedScholarshipId === s.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {s.amount} • {s.deadline}
                    </span>
                  </div>
                  <ChevronRight className={`h-4 w-4 transition-transform ${selectedScholarshipId === s.id ? 'translate-x-1' : 'opacity-0'}`} />
                </button>
              ))}
              {(!scholarships || scholarships.length === 0) && (
                <p className="text-xs text-muted-foreground italic p-4 text-center">No active assignments found.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main: Applicants */}
        <div className="lg:col-span-8 space-y-4">
          {selectedScholarshipId ? (
            <Card className="border-primary/10">
              <CardHeader className="bg-muted/30 border-b">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-primary" /> 
                      {activeScholarship?.name || 'Review Queue'}
                    </CardTitle>
                    <CardDescription>Targeted application stream for this program.</CardDescription>
                  </div>
                  <Badge className="bg-green-600">{applications?.length || 0} Pending</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isAppsLoading ? (
                  <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
                ) : applications && applications.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Candidate</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right pr-6">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applications.map((app) => (
                        <TableRow key={app.id}>
                          <TableCell className="pl-6">
                            <span className="font-bold">Applicant {app.id.substring(0, 6).toUpperCase()}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">Ready for Review</Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/reviewer/applications/${app.id}`}>
                                Evaluate <ArrowRight className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-20">
                    <Inbox className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium text-muted-foreground">The queue for this scholarship is empty.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl bg-muted/10 p-20 text-center">
               <div className="space-y-2">
                  <Lock className="h-8 w-8 text-muted-foreground mx-auto opacity-20" />
                  <p className="text-muted-foreground font-medium">Select a program to begin evaluating portfolios.</p>
               </div>
            </div>
          )}
        </div>
      </div>
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
