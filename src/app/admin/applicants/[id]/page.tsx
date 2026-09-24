'use client';

import { useMemo, use, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  UserCircle, 
  Loader2, 
  ChevronLeft, 
  ShieldCheck,
  MessageSquare,
  GraduationCap,
  History,
  Activity,
  Award,
  AlertCircle,
  ExternalLink,
  ClipboardCheck,
  Star
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useFirebase, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collectionGroup, query, where, collection } from 'firebase/firestore';
import type { Applicant } from '@/types/applicant';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export default function AdminApplicantDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: applicantId } = use(params);
  const router = useRouter();
  const { firestore } = useFirebase();
  
  const applicantRef = useMemoFirebase(() => {
    if (!firestore || !applicantId) return null;
    return doc(firestore, 'users', applicantId);
  }, [firestore, applicantId]);

  const { data: applicant, isLoading: isAppLoading } = useDoc<Applicant>(applicantRef);

  const reviewsQuery = useMemoFirebase(() => {
    if (!firestore || !applicantId) return null;
    return query(collection(firestore, 'users', applicantId, 'reviews'));
  }, [firestore, applicantId]);

  const { data: reviews, isLoading: isReviewsLoading } = useCollection<any>(reviewsQuery);

  const stats = useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    const total = reviews.reduce((acc, r) => acc + (r.totalScore || 0), 0);
    const avg = total / reviews.length;
    return { avg, count: reviews.length };
  }, [reviews]);

  if (isAppLoading || isReviewsLoading) {
    return <div className="flex h-[80vh] items-center justify-center font-medium text-muted-foreground">Syncing Submission Audit...</div>;
  }

  if (!applicant) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h2 className="text-xl font-bold">Record Not Found</h2>
        <Button onClick={() => router.back()}>Return to Board</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              {applicant.name}
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 uppercase text-[10px] tracking-widest font-black">
                {applicant.status}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">{applicant.email} • ID: {applicantId.substring(0, 8).toUpperCase()}</p>
          </div>
        </div>
        <div className="flex gap-4">
           {stats && (
             <div className="text-right border-r pr-6">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Committee Consensus</p>
                <p className="text-3xl font-black text-primary">{stats.avg.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/10</span></p>
             </div>
           )}
           <div className="text-right">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">GPA</p>
              <p className="text-3xl font-black">{applicant.gpa.toFixed(2)}</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-8">
          <Card>
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="text-lg flex items-center gap-2"><UserCircle className="h-5 w-5" /> Submission Portfolio</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Institutional Context</Label>
                  <p className="font-bold flex items-center gap-1.5"><GraduationCap className="h-4 w-4 text-primary" /> {applicant.school}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Academic Focus</Label>
                  <p className="font-bold">{applicant.major}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase tracking-tight">Personal Narrative</Label>
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{applicant.essay}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase tracking-tight">Qualification Summary</Label>
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{applicant.qualificationStatement}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-xs font-black uppercase tracking-tight">Evidence & Documentation</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {applicant.resume && <Button variant="outline" className="justify-start h-auto py-3" asChild><Link href={applicant.resume as string} target="_blank"><FileText className="h-4 w-4 mr-2" /> Student Resume</Link></Button>}
                  {applicant.recommendationLetter1 && <Button variant="outline" className="justify-start h-auto py-3 border-green-200 bg-green-50" asChild><Link href={applicant.recommendationLetter1 as string} target="_blank"><ShieldCheck className="h-4 w-4 mr-2 text-green-600" /> Endorsement #1</Link></Button>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <Card className="border-primary/20 shadow-md">
            <CardHeader className="bg-primary/5 border-b">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg flex items-center gap-2"><ClipboardCheck className="h-5 w-5" /> Committee Audit</CardTitle>
                <Badge variant="secondary" className="font-bold">{reviews?.length || 0} Evaluated</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[600px]">
                <div className="divide-y">
                  {reviews?.map((review) => (
                    <div key={review.id} className="p-6 space-y-4 hover:bg-muted/10 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                          <p className="font-black text-sm">{review.reviewerName}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-medium">{review.recommendation}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black text-primary">{review.totalScore.toFixed(2)}</p>
                        </div>
                      </div>

                      {review.notes && (
                        <div className="p-3 rounded-lg bg-muted/30 border text-xs italic leading-relaxed">
                          "{review.notes}"
                        </div>
                      )}
                    </div>
                  ))}
                  {(!reviews || reviews.length === 0) && (
                    <div className="p-12 text-center space-y-2">
                      <History className="h-8 w-8 text-muted-foreground mx-auto opacity-20" />
                      <p className="text-sm text-muted-foreground italic">No committee evaluations have been submitted yet.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}