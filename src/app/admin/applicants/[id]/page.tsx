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
import { orgIdOf } from '@/lib/org';
import type { Applicant } from '@/types/applicant';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { recordDecisions, type Decision } from '@/app/admin/decision-actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';






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
  const { firestore, user, userData } = useFirebase();
  const { toast } = useToast();
  const orgId = orgIdOf(userData);
  
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
    if (!firestore || !applicantId || !orgId) return null;
    return query(
      collection(firestore, 'applications'),
      where('organizationId', '==', orgId),
      where('studentId', '==', applicantId),
    );
  }, [firestore, applicantId, orgId]);

  const { data: applications, isLoading: isApplicationsLoading } = useCollection<any>(applicationsQuery);

  const sortedApplications = useMemo(
    () => (applications || [])
      .filter((a: any) => a.status && a.status !== 'Draft')
      .sort((a: any, b: any) =>
        String(b.submissionDate || '').localeCompare(String(a.submissionDate || ''))),
    [applications],
  );

  const application = useMemo(
    () => sortedApplications.find((a: any) => a.id === selectedApplicationId) || sortedApplications[0] || null,
    [sortedApplications, selectedApplicationId],
  );

  const profile = (application?.profileSnapshot as Record<string, any> | undefined) || applicant || {};


  const programRef = useMemoFirebase(() => {
    if (!firestore || !application?.scholarshipId) return null;
    return doc(firestore, 'programs', application.scholarshipId);
  }, [firestore, application?.scholarshipId]);
  const { data: program } = useDoc<any>(programRef);
  const scholarshipPrompts: any[] = program?.prompts || [];

  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null);
  const [isDeciding, setIsDeciding] = useState(false);

  const [allReviews, setAllReviews] = useState<any[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !orgId) return;
    // A collection group query, because the parent id is what attributes a
    // review to an application and a plain subcollection read cannot see it.
    const unsubscribe = onSnapshot(
      query(collectionGroup(firestore, 'reviews'), where('organizationId', '==', orgId)),

      
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
  }, [firestore, orgId]);


   

  const reviews = useMemo(() => {
    const scholarshipFor: Record<string, string> = {};
    (applications || []).forEach((application: any) => {
      scholarshipFor[application.id] = application.scholarshipName || 'Scholarship';
    });

    return allReviews
      .filter((review) => review.status !== 'Draft')
      .filter((review) => application
        ? review.parentId === application.id
        // Reviews filed by the legacy screen hang off the student rather than an
        // application, so those are matched on applicantId and stay visible.
        : review.parentId === applicantId)
      .map((review) => ({ ...review, scholarshipName: scholarshipFor[review.parentId] }));
  }, [allReviews, applications, applicantId, application]);

  const decide = async (status: Decision) => {
    if (!user || !application) return;
    setPendingDecision(null);
    setIsDeciding(true);
    try {
      const result = await recordDecisions(await user.getIdToken(), {
        status,
        targets: [{ applicationId: application.id, studentId: applicantId }],
      });

      if (!result.success) {
        toast({ title: 'Decision not recorded', description: result.error, variant: 'destructive' });
        return;
      }
      if (result.updated === 0) {
        toast({
          title: 'Nothing changed',
          description: result.skipped[0]?.reason
            ? `This application was left unchanged — ${result.skipped[0].reason}.`
            : 'This application was left unchanged.',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: `Marked ${status}`,
        description: result.emailsSent
          ? 'The applicant has been emailed.'
          : result.emailsFailed
            ? 'The decision is saved, but the notification email could not be sent.'
            : 'The decision is saved. The applicant had already been emailed about it.',
      });
    } catch (error) {
      toast({ title: 'Decision not recorded', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setIsDeciding(false);
    }
  };

  const stats = useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    const total = reviews.reduce((acc, r) => acc + (r.totalScore || 0), 0);
    const avg = total / reviews.length;
    return { avg, count: reviews.length };
  }, [reviews]);

  if (isAppLoading || isReviewsLoading || isApplicationsLoading) {
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-2 sm:gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="shrink-0">
            <ChevronLeft className="h-4 w-4 mr-1 sm:mr-2" /> Back
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold flex flex-wrap items-center gap-2 [overflow-wrap:anywhere]">
              {applicant.name}
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 uppercase text-[10px] tracking-widest font-black">
                {application?.status ?? applicant.status}
              </Badge>
            </h1>
            {application && (
              <p className="text-sm font-semibold">{application.scholarshipName || 'Scholarship'}</p>
            )}
            <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{applicant.email} • ID: {applicantId.substring(0, 8).toUpperCase()}</p>
            {sortedApplications.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {sortedApplications.map((entry: any) => (
                  <Button
                    key={entry.id}
                    size="sm"
                    variant={entry.id === application?.id ? 'default' : 'outline'}
                    className="h-7 text-xs"
                    asChild
                  >
                    <Link href={`/admin/applicants/${applicantId}?application=${encodeURIComponent(entry.id)}`}>
                      {entry.scholarshipName || 'Scholarship'}
                    </Link>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
           {application && (
             <div className="flex w-full gap-2 sm:w-auto">
               <Button
                 size="sm"
                 className="flex-1 bg-green-600 hover:bg-green-700 sm:flex-none"
                 disabled={isDeciding || application.status === 'Awarded'}
                 onClick={() => setPendingDecision('Awarded')}
               >
                 {isDeciding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Award className="h-4 w-4 mr-2" />}
                 Award
               </Button>
               <Button
                 size="sm"
                 variant="outline"
                 className="flex-1 sm:flex-none"
                 disabled={isDeciding || application.status === 'Not Awarded'}
                 onClick={() => setPendingDecision('Not Awarded')}
               >
                 Decline
               </Button>
             </div>
           )}
           {stats && (
             <div className="border-r pr-4 text-left sm:pr-6 sm:text-right">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Committee Consensus</p>
                <p className="text-3xl font-black text-primary">{stats.avg.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/10</span></p>
             </div>
           )}
           <div className="text-right">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">GPA</p>
              <p className="text-3xl font-black">{typeof profile.gpa === 'number' ? profile.gpa.toFixed(2) : '—'}</p>
           </div>
        </div>
      </div>

      <AlertDialog open={!!pendingDecision} onOpenChange={(open) => !open && setPendingDecision(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDecision === 'Awarded' ? 'Award this application?' : 'Decline this application?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {applicant.name}'s application to {application?.scholarshipName || 'this scholarship'} will be set to{' '}
              <strong>{pendingDecision}</strong>, and they will be emailed once. Their other applications are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingDecision && decide(pendingDecision)}>
              {pendingDecision === 'Awarded' ? 'Award' : 'Decline'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7 space-y-8">
          <Card>
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="text-lg flex items-center gap-2"><UserCircle className="h-5 w-5" /> Submission Portfolio</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-8">
              {!application ? (
                <p className="text-sm text-muted-foreground italic">
                  This student has no submitted application, so there is nothing to show here.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Institutional Context</Label>
                      <p className="font-bold flex items-center gap-1.5"><GraduationCap className="h-4 w-4 text-primary" /> {profile.school || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Academic Focus</Label>
                      <p className="font-bold">{profile.major || '—'}</p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Academic Interests</Label>
                      <p className="font-bold">{profile.interests || '—'}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-1.5">
                    <Label className="text-xs font-black uppercase tracking-tight">Qualification Summary</Label>
                    <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{application.qualificationStatement || 'Not provided.'}</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-black uppercase tracking-tight">Activities & Leadership</Label>
                    <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{application.activities || 'Not provided.'}</p>
                  </div>

                  <div className="space-y-6">
                    {scholarshipPrompts.length > 0 ? (
                      scholarshipPrompts.map((prompt) => {
                        const response = (application.promptResponses as any[] || []).find((r) => r.promptId === prompt.id);
                        const essayFile = (application.essays as any[] || []).find((e) => e.promptId === prompt.id);
                        return (
                          <div key={prompt.id} className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-tight">{prompt.title}</Label>
                            {response?.answer ? (
                              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{response.answer}</p>
                            ) : essayFile ? (
                              <Button variant="outline" className="justify-start h-auto py-3" asChild>
                                <Link href={essayFile.fileUrl} target="_blank"><FileText className="h-4 w-4 mr-2" /> {essayFile.fileName}</Link>
                              </Button>
                            ) : (
                              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">Not provided.</p>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-black uppercase tracking-tight">Personal Narrative</Label>
                        <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{application.essay || 'Not provided.'}</p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <Label className="text-xs font-black uppercase tracking-tight">Evidence & Documentation</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {application.resume && <Button variant="outline" className="justify-start h-auto py-3" asChild><Link href={application.resume as string} target="_blank"><FileText className="h-4 w-4 mr-2" /> Student Resume</Link></Button>}
                      {((application.essays as any[]) || [])
                        .filter((essay) => !scholarshipPrompts.some((p) => p.id === essay.promptId))
                        .map((essay, i) => (
                          <Button key={`essay-${i}`} variant="outline" className="justify-start h-auto py-3" asChild>
                            <Link href={essay.fileUrl} target="_blank"><FileText className="h-4 w-4 mr-2" /> {essay.fileName}</Link>
                          </Button>
                        ))}
                      {[1, 2].map((i) => {
                        const url = application[`recommendationLetter${i}`];
                        if (!url) return null;
                        const name = application[`recommenderName${i}`];
                        return (
                          <Button key={`letter-${i}`} variant="outline" className="justify-start h-auto py-3 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300 dark:hover:bg-green-900 dark:hover:text-green-200" asChild>
                            <Link href={url as string} target="_blank">
                              <ShieldCheck className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" /> Endorsement #{i}{name ? ` — ${name}` : ''}
                            </Link>
                          </Button>
                        );
                      })}
                    </div>
                    {!application.resume && ![1, 2].some((i) => application[`recommendationLetter${i}`]) && (
                      <p className="text-sm text-muted-foreground italic">No documents uploaded for this application.</p>
                    )}
                  </div>

                  {[1, 2].some((i) => application[`recommendationLetterText${i}`]) && (
                    <div className="space-y-4">
                      <Label className="text-xs font-black uppercase tracking-tight">Endorsement Text</Label>
                      {[1, 2].map((i) => {
                        const text = application[`recommendationLetterText${i}`];
                        if (!text) return null;
                        const name = application[`recommenderName${i}`];
                        return (
                          <div key={`letter-text-${i}`} className="space-y-1.5">
                            <Label className="text-xs font-bold text-muted-foreground">Endorsement #{i}{name ? ` — ${name}` : ''}</Label>
                            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{text}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 lg:col-span-5 space-y-6">
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
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">{review.recommendation}</p>
                            {/* The decision is made on this page, so the reviewer
                                who asked for a discussion has to be named here,
                                not only counted on the applicants list. */}
                            {review.markForDiscussion && (
                              <Badge variant="outline" className="gap-1 text-[8px] bg-amber-50 text-amber-700 border-amber-200">
                                <MessageSquare className="h-2.5 w-2.5" /> Flagged for discussion
                              </Badge>
                            )}
                          </div>
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