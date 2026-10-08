'use client';

import { useMemo, use, useState, useEffect } from 'react';
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
import { doc, collectionGroup, query, where, collection, onSnapshot } from 'firebase/firestore';
import type { Applicant } from '@/types/applicant';
import { Alert, AlertDescription } from '@/components/ui/alert';






export default function AdminApplicantDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ application?: string }>;
}) {
  const { id: applicantId } = use(params);
  // The Committee board has one row per application, so its Detail View link
  // names the application it was opened from. Without it this page pooled
  // every application's reviews, and a scholarship nobody had reviewed showed
  // another scholarship's evaluation and consensus score.
  const { application: selectedApplicationId } = use(searchParams);
  const router = useRouter();
  const { firestore } = useFirebase();
  
  const applicantRef = useMemoFirebase(() => {
    if (!firestore || !applicantId) return null;
    return doc(firestore, 'users', applicantId);
  }, [firestore, applicantId]);

  const { data: applicant, isLoading: isAppLoading } = useDoc<Applicant>(applicantRef);

  // The review portal files evaluations under the application they score
  // (applications/{id}/reviews). This page used to read users/{uid}/reviews,
  // which only ever holds reviews from the pre-migration reviewer screen, so
  // every evaluation submitted since looked like it had never arrived.
  const applicationsQuery = useMemoFirebase(() => {
    if (!firestore || !applicantId) return null;
    return query(collection(firestore, 'applications'), where('studentId', '==', applicantId));
  }, [firestore, applicantId]);

  const { data: applications } = useCollection<any>(applicationsQuery);

  const [allReviews, setAllReviews] = useState<any[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(true);

  useEffect(() => {
    if (!firestore) return;
    // A collection group query, because the parent id is what attributes a
    // review to an application and a plain subcollection read cannot see it.
    const unsubscribe = onSnapshot(
      collectionGroup(firestore, 'reviews'),

      
      (snapshot) => {
        setAllReviews(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data(), parentId: d.ref.parent.parent?.id }))
        );
        console.log('Reviews listener initialized for applicantId',snapshot)
        setIsReviewsLoading(false);
      },
     

      (error) => {
        console.error('Reviews listener failed:', error.message);
        setIsReviewsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [firestore]);


   

  const reviews = useMemo(() => {
    const scholarshipFor: Record<string, string> = {};
    (applications || []).forEach((application: any) => {
      scholarshipFor[application.id] = application.scholarshipName || 'Scholarship';
    });

    return allReviews
      .filter((review) =>
        selectedApplicationId
          ? review.parentId === selectedApplicationId
          // Reviews filed by the legacy screen hang off the student rather than an
          // application, so those are matched on applicantId and stay visible.
          : review.parentId === applicantId || review.parentId in scholarshipFor
      )
      .map((review) => ({ ...review, scholarshipName: scholarshipFor[review.parentId] }));
  }, [allReviews, applications, applicantId, selectedApplicationId]);

  const selectedApplication = useMemo(
    () => (selectedApplicationId ? (applications || []).find((a: any) => a.id === selectedApplicationId) : null),
    [applications, selectedApplicationId]
  );

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
                {selectedApplication?.status ?? applicant.status}
              </Badge>
            </h1>
            {selectedApplication && (
              <p className="text-sm font-semibold">{selectedApplication.scholarshipName || 'Scholarship'}</p>
            )}
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
                  {applicant.recommendationLetter2 && <Button variant="outline" className="justify-start h-auto py-3 border-green-200 bg-green-50" asChild><Link href={applicant.recommendationLetter2 as string} target="_blank"><ShieldCheck className="h-4 w-4 mr-2 text-green-600" /> Endorsement #2</Link></Button>}
                </div>
              </div>

              {(applicant.recommendationLetterText1 || applicant.recommendationLetterText2) && (
                <div className="space-y-4">
                  <Label className="text-xs font-black uppercase tracking-tight">Endorsement Text</Label>
                  {applicant.recommendationLetterText1 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Endorsement #1</Label>
                      <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{applicant.recommendationLetterText1}</p>
                    </div>
                  )}
                  {applicant.recommendationLetterText2 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Endorsement #2</Label>
                      <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{applicant.recommendationLetterText2}</p>
                    </div>
                  )}
                </div>
              )}
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
                          {/* A student can hold an application per scholarship,
                              so a score means nothing without naming the one it
                              was given against. */}
                          {review.scholarshipName && (
                            <p className="text-[11px] text-muted-foreground">{review.scholarshipName}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black text-primary">{(review.totalScore || 0).toFixed(2)}</p>
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