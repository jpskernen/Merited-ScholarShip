'use client';

import { useState, useMemo, useEffect, use } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText, 
  UserCircle, 
  Sparkles, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  Calculator, 
  Lock, 
  Ban,
  Save,
  MessageSquare,
  ShieldAlert,
  GraduationCap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { orgIdOf } from '@/lib/org';
import type { Applicant } from '@/types/applicant';
import type { Scholarship } from '@/types/scholarship';
import { useToast } from '@/hooks/use-toast';
import { analyzeScholarshipFit, type AnalyzeFitOutput } from '@/ai/flows/analyze-scholarship-fit';
import { markApplicationInReview } from '../../actions';
import { NEUTRAL_SCORE, criterionKey, weightedTotal, withNeutralDefaults } from '@/lib/rubric';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ApplicationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const applicationId = resolvedParams.id;
  const router = useRouter();
  const { toast } = useToast();
  const { firestore, user: reviewer, userData } = useFirebase();
  const orgId = orgIdOf(userData);
  
  // The route id is an application, not a student. That distinction is the
  // whole fix: a student may hold several applications and each is judged
  // separately, against its own scholarship's rubric.
  const [applicationRecord, setApplicationRecord] = useState<any | null>(null);
  const [activeScholarship, setActiveScholarship] = useState<Scholarship | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  useEffect(() => {
    if (!firestore || !applicationId) return;
    let cancelled = false;

    setIsLoading(true);
    setIsAccessDenied(false);

    (async () => {
      try {
        const snapshot = await getDoc(doc(firestore, 'applications', applicationId));
        const record: any = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;

        // The rubric comes from the scholarship this application was submitted
        // to. It used to be programs[0] — the first entry in whatever the
        // reviewer happened to be assigned to — so two reviewers could score
        // the same application against two different scholarships' criteria.
        let program: Scholarship | null = null;
        if (record?.scholarshipId) {
          const programSnapshot = await getDoc(doc(firestore, 'programs', record.scholarshipId));
          program = programSnapshot.exists()
            ? ({ id: programSnapshot.id, ...programSnapshot.data() } as unknown as Scholarship)
            : null;
        }

        if (cancelled) return;
        setApplicationRecord(record);
        setActiveScholarship(program);
      } catch (error: any) {
        if (cancelled) return;
        console.error('Could not open this application:', error.message);
        setIsAccessDenied(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [firestore, applicationId]);

  const profileSnapshot = applicationRecord?.profileSnapshot as Record<string, any> | undefined;

  const promptResponses: { promptId: string; title: string; answer: string }[] =
    applicationRecord?.promptResponses || [];

  const essayForAnalysis = promptResponses.length > 0
    ? promptResponses.map((response) => `${response.title}\n${response.answer}`).join('\n\n')
    : (applicationRecord?.essay || '');

  const application = useMemo(() => {
    if (!applicationRecord) return null;
    return {
      ...applicationRecord,
      gpa: profileSnapshot?.gpa,
      major: profileSnapshot?.major,
      school: profileSnapshot?.school,
      interests: profileSnapshot?.interests,
    } as Applicant;
  }, [applicationRecord, profileSnapshot]);

  // This reviewer's own review of this application, if they've already filed one.
  const myReviewRef = useMemoFirebase(() => {
    if (!firestore || !applicationId || !reviewer) return null;
    return doc(firestore, 'applications', applicationId, 'reviews', reviewer.uid);
  }, [firestore, applicationId, reviewer]);

  const { data: myReview } = useDoc(myReviewRef);

  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [recommendation, setRecommendation] = useState<string>('');
  const [markForDiscussion, setMarkForDiscussion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AnalyzeFitOutput | null>(null);
  const [nextApplicationId, setNextApplicationId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const hasAlreadyReviewed = useMemo(() => {
    return myReview?.status === 'Submitted';
  }, [myReview]);

  const isAssigned = !!reviewer
    && !!activeScholarship
    && (activeScholarship.reviewerIds || []).includes(reviewer.uid);
  const hasRubric = !!activeScholarship?.rubric && activeScholarship.rubric.length > 0;
  const applicationStatus: string | undefined = applicationRecord?.status;
  const isDraft = !applicationStatus || applicationStatus === 'Draft';
  const isDecided = applicationStatus === 'Awarded' || applicationStatus === 'Not Awarded';
  const canScore = isAssigned && hasRubric && !isDraft && !isDecided && !hasAlreadyReviewed;

  useEffect(() => {
    const rubric = activeScholarship?.rubric;
    if (!rubric || rubric.length === 0) return;
    setScores((current) => {
      const filled = withNeutralDefaults(rubric, current);
      return Object.keys(filled).length === Object.keys(current).length ? current : filled;
    });
  }, [activeScholarship, myReview]);

  // Restore what this reviewer actually submitted.
  useEffect(() => {
    if (!myReview) return;

    const restored: Record<string, number> = {};
    (myReview.criteriaScores || []).forEach((entry: any) => {
      if (entry?.criteriaId) restored[entry.criteriaId] = entry.score;
    });
    if (Object.keys(restored).length > 0) setScores(restored);

    setComment(myReview.notes || '');
    setRecommendation(myReview.recommendation || '');
    setMarkForDiscussion(!!myReview.markForDiscussion);
    setAiAnalysis(myReview.aiAnalysis ?? null);
  }, [myReview]);

  const totalWeightedScore = useMemo(
    () => weightedTotal(activeScholarship?.rubric, scores),
    [scores, activeScholarship],
  );

  // A finalised review shows the score that was actually recorded, not one
  // recomputed from today's rubric weights — otherwise editing a programme's
  // weights later would silently restate past evaluations, and this page would
  // disagree with the score shown in the reviewer queue and the admin board.
  const displayScore = hasAlreadyReviewed && typeof myReview?.totalScore === 'number'
    ? myReview.totalScore
    : totalWeightedScore;

  const scorePercentage = (displayScore / 10) * 100;

  const buildReviewData = (status: 'Draft' | 'Submitted') => ({
    reviewerId: reviewer!.uid,
    reviewerName: reviewer!.displayName || 'Anonymous Reviewer',
    applicationId: applicationId,
    organizationId: applicationRecord?.organizationId ?? null,
    studentId: applicationRecord?.studentId ?? null,
    scholarshipId: applicationRecord?.scholarshipId ?? null,
    updatedAt: serverTimestamp(),
    criteriaScores: (activeScholarship?.rubric || []).map((criterion) => ({
      criteriaId: criterionKey(criterion),
      score: scores[criterionKey(criterion)] ?? NEUTRAL_SCORE,
    })),
    totalScore: totalWeightedScore,
    notes: comment,
    recommendation,
    markForDiscussion,
    aiAnalysis,
    status,
    ...(status === 'Submitted' ? { submittedAt: serverTimestamp() } : {}),
  });

  // Must live in the 'reviews' subcollection: both the reviewer dashboard and
  // the admin committee board read reviews via a collection-group query, so a
  // scores[] array on the applicant doc is invisible to them.
  const myReviewDoc = () => doc(firestore!, 'applications', applicationId, 'reviews', reviewer!.uid);

  const handleSaveDraft = async () => {
    if (!firestore || !reviewer || !applicationId || !canScore) return;

    setIsSavingDraft(true);
    setSubmitError(null);
    try {
      await setDoc(myReviewDoc(), buildReviewData('Draft'), { merge: true });
      toast({
        title: 'Progress saved',
        description: 'Your scores are kept as a draft. Nothing has been sent to the committee yet.',
      });
    } catch (error: any) {
      setSubmitError(error?.code === 'permission-denied'
        ? 'This draft could not be saved. The application may have been decided, or your assignment to this scholarship may have changed. Please reload the page.'
        : (error.message || 'Could not save your progress.'));
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!firestore || !reviewer || !applicationId || !canScore) return;

    if (!recommendation) {
      setSubmitError("Please provide a recommendation.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await setDoc(myReviewDoc(), buildReviewData('Submitted'), { merge: true });

      toast({
        title: "Review Submitted",
        description: "Evaluation finalized and stored.",
      });

      try {
        const marked = await markApplicationInReview(await reviewer.getIdToken(), applicationId);
        if (marked.success && marked.changed) {
          setApplicationRecord((current: any) => (current ? { ...current, status: 'In Review' } : current));
        } else if (!marked.success) {
          console.error('Could not move the application to In Review:', marked.error);
        }
      } catch (error: any) {
        console.error('Could not move the application to In Review:', error.message);
      }
      
      // Stay on this page so the reviewer sees the evaluation they just saved
      // (the myReview listener re-renders it locked). Jumping straight to the
      // next candidate looked like the same page with the scores wiped, so
      // the next candidate is only offered as a button. Looking it up gets its
      // own error handling: the evaluation is already stored, and a failure
      // here must not be reported as "Could not save review".
      try {
        setNextApplicationId(await findNextUnreviewedApplication());
      } catch (error: any) {
        console.error('Could not determine the next application to review:', error.message);
      }
    } catch (error: any) {
      setSubmitError(error?.code === 'permission-denied'
        ? 'This evaluation can no longer be saved. The application may have been decided, or your assignment to this scholarship may have changed. Please reload the page.'
        : (error.message || 'Could not save review.'));
    } finally { setIsSubmitting(false); }
  };

  /**
   * Returns the next submitted applicant this reviewer hasn't scored yet.
   *
   * "Already reviewed by me" is checked by reading each candidate's own review
   * document directly. The obvious alternative — one collection-group query on
   * reviews filtered by reviewerId — requires a COLLECTION_GROUP_ASC index that
   * doesn't exist, and it failed at exactly the wrong moment: right after a
   * review was saved. A handful of direct gets needs no index at all.
   */
  const findNextUnreviewedApplication = async (): Promise<string | null> => {
    if (!firestore || !reviewer || !orgId) return null;

    // Firestore rejects an empty array for 'in', so skip the lookup entirely
    // when this reviewer isn't assigned to any scholarship yet.
    const assignedSnap = await getDocs(query(
      collection(firestore, 'programs'),
      where('organizationId', '==', orgId),
      where('reviewerIds', 'array-contains', reviewer.uid),
    ));
    const assignedScholarshipIds = assignedSnap.docs.map(d => d.id);
    if (assignedScholarshipIds.length === 0) return null;

    const perScholarship = await Promise.all(
      assignedScholarshipIds.map((scholarshipId) => getDocs(query(
        collection(firestore, 'applications'),
        where('scholarshipId', '==', scholarshipId),
        where('status', 'in', ['Submitted', 'In Review']),
        limit(200),
      ))),
    );

    const candidates = perScholarship
      .flatMap((snapshot) => snapshot.docs)
      .filter(d => d.id !== applicationId)
      .map(d => d.id);

    const reviewed = await Promise.all(
      candidates.map(id => getDoc(doc(firestore, 'applications', id, 'reviews', reviewer.uid))
        .then(snap => snap.exists() && snap.data()?.status !== 'Draft')
        .catch(() => true)) // treat an unreadable review as "skip this one"
    );

    return candidates.find((_, i) => !reviewed[i]) ?? null;
  };

  const runAiAnalysis = async () => {
    if (!application || !activeScholarship || !reviewer || !canScore) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeScholarshipFit(await reviewer.getIdToken(), {
        applicantData: {
          gpa: typeof application.gpa === 'number' ? application.gpa : 0,
          major: application.major || '',
          essay: essayForAnalysis,
          activities: application.activities || '',
          interests: application.interests || '',
        },
        scholarshipCriteria: activeScholarship.description,
      });
      setAiAnalysis(result);
    } catch (error) {
      toast({ title: "Analysis Failed", variant: "destructive" });
    } finally { setIsAnalyzing(false); }
  };

  if (isLoading) {
    return <div className="flex h-[80vh] items-center justify-center animate-pulse text-muted-foreground">Syncing evaluation workspace...</div>;
  }

  const noAccess = (title: string, explanation: string) => (
    <div className="flex flex-col items-center justify-center h-[70vh] gap-4 text-center">
      <Ban className="h-10 w-10 text-muted-foreground opacity-40" />
      <div className="space-y-1">
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground max-w-md">{explanation}</p>
      </div>
      <Button onClick={() => router.push('/review')}>Back to my queue</Button>
    </div>
  );

  if (isAccessDenied || !application) {
    return noAccess(
      'This application is not available to you',
      'It may not exist, or you may not be on the review panel for its scholarship. If you think you should be reviewing it, ask your administrator to assign you.',
    );
  }

  if (!isAssigned) {
    return noAccess(
      'You are not assigned to this scholarship',
      'Only reviewers on this scholarship\'s panel can open its applications. Your administrator assigns panels on the scholarship page.',
    );
  }

  if (isDraft) {
    return noAccess(
      'This application has not been submitted',
      'The student is still working on it. It will appear in your queue once they submit it.',
    );
  }

  // Derived from the student, so the same candidate reads consistently across
  // their separate applications.
  const anonymousIdentifier = `Applicant ${String(applicationRecord?.studentId || applicationId).substring(0, 6).toUpperCase()}`;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {anonymousIdentifier}
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                <ShieldAlert className="h-3 w-3 mr-1" /> Blind Review
              </Badge>
              {hasAlreadyReviewed && <Badge className="bg-green-600">Finalized</Badge>}
              {isDecided && <Badge variant="secondary">Decision made</Badge>}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Button variant="outline" size="sm" onClick={runAiAnalysis} disabled={isAnalyzing || !canScore}>
            {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2 text-primary" />}
            AI Fit Assessment
          </Button>
          <div className="text-right">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Weighted Score</p>
            <p className="text-2xl font-black text-primary">{displayScore.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/10</span></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 flex-1 min-h-0">
        <div className="lg:col-span-7 flex flex-col min-h-0">
          <ScrollArea className="flex-1 rounded-xl border bg-card p-6 shadow-sm">
            <div className="space-y-8">
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <UserCircle className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Candidate Profile</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {/* A student can reach submission without a GPA on record,
                      so never assume it's a number here. */}
                  <div><Label className="text-muted-foreground">GPA</Label><p className="font-bold">{typeof application.gpa === 'number' ? application.gpa.toFixed(2) : '—'}</p></div>
                  <div><Label className="text-muted-foreground">Intended Major</Label><p className="font-bold">{application.major || '—'}</p></div>
                  <div className="col-span-2">
                     <Label className="text-muted-foreground flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> Program</Label>
                     <p className="font-medium text-primary">{activeScholarship?.name || 'Assigned Program'}</p>
                  </div>
                  {profileSnapshot?.capturedAt ? (
                    <p className="col-span-2 text-[11px] text-muted-foreground italic">
                      Profile as submitted on {new Date(profileSnapshot.capturedAt).toLocaleDateString()}. Later edits by the student do not change it.
                    </p>
                  ) : (
                    <p className="col-span-2 text-[11px] text-muted-foreground italic">
                      This application was submitted before the academic details were recorded with it, so they are not shown here.
                    </p>
                  )}
                </div>
              </section>
              <Separator />
              <section>
                <h4 className="font-semibold text-sm mb-2 uppercase tracking-tight">Activities & Leadership</h4>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{application.activities || 'Not provided.'}</p>
              </section>
              {promptResponses.length > 0 ? (
                promptResponses.map((response) => (
                  <section key={response.promptId}>
                    <h4 className="font-semibold text-sm mb-2 uppercase tracking-tight">{response.title}</h4>
                    <div className="p-4 rounded-lg bg-muted/20 border text-sm leading-relaxed whitespace-pre-wrap">
                      {response.answer || 'No answer provided.'}
                    </div>
                  </section>
                ))
              ) : (
                <section>
                  <h4 className="font-semibold text-sm mb-2 uppercase tracking-tight">Personal Statement</h4>
                  <div className="p-4 rounded-lg bg-muted/20 border text-sm leading-relaxed whitespace-pre-wrap">
                    {application.essay || "No text essay provided."}
                  </div>
                </section>
              )}
              <Separator />
              <section>
                <h3 className="text-lg font-semibold mb-4">Supporting Evidence</h3>
                <div className="grid grid-cols-2 gap-2">
                  {application.essays?.map((essay, i) => {
                    const title = promptResponses.find((response) => response.promptId === essay.promptId)?.title
                      || (activeScholarship?.prompts || []).find((prompt: any) => prompt.id === essay.promptId)?.title;
                    return (
                      <Button key={i} variant="outline" className="justify-start" asChild>
                        <Link href={essay.fileUrl} target="_blank">
                          <FileText className="h-4 w-4 mr-2" /> {title || 'Essay'}: {essay.fileName}
                        </Link>
                      </Button>
                    );
                  })}
                  {[1, 2].map((i) => {
                    const url = (application as any)?.[`recommendationLetter${i}`];
                    if (!url) return null;
                    const name = (application as any)?.[`recommenderName${i}`];
                    return (
                      <Button key={`rec-pdf-${i}`} variant="outline" className="justify-start" asChild><Link href={url} target="_blank"><FileText className="h-4 w-4 mr-2" /> Recommendation Letter {i}{name ? ` — ${name}` : ''}</Link></Button>
                    );
                  })}
                </div>

                {[1, 2].map((i) => {
                  const text = (application as any)?.[`recommendationLetterText${i}`];
                  if (!text) return null;
                  const name = (application as any)?.[`recommenderName${i}`];
                  const title = (application as any)?.[`recommenderTitle${i}`];
                  return (
                    <div key={`rec-text-${i}`} className="mt-4">
                      <h4 className="font-semibold text-sm mb-2 uppercase tracking-tight">
                        Recommendation Letter {i}{name ? ` — ${name}` : ''}{title ? `, ${title}` : ''}
                      </h4>
                      <div className="p-4 rounded-lg bg-muted/20 border text-sm leading-relaxed whitespace-pre-wrap">{text}</div>
                    </div>
                  );
                })}

                {!(application.essays && application.essays.length > 0)
                  && ![1, 2].some((i) => (application as any)?.[`recommendationLetter${i}`] || (application as any)?.[`recommendationLetterText${i}`]) && (
                  <p className="text-sm text-muted-foreground italic">No supporting documents or recommendation letters submitted yet.</p>
                )}
              </section>
            </div>
          </ScrollArea>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6 min-h-0">
          <Card className={`flex flex-col min-h-0 shadow-lg ${hasAlreadyReviewed ? 'border-green-200' : 'border-primary/20'}`}>
            <CardHeader className="bg-primary/5 border-b py-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg flex items-center gap-2"><Calculator className="h-5 w-5" /> Score Rubric</CardTitle>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                  {(activeScholarship?.rubric || []).length} criteria
                </span>
              </div>
              <Progress value={scorePercentage} className="h-1.5 mt-2" />
            </CardHeader>
            
            <CardContent className="flex-1 overflow-y-auto space-y-6 p-6">
              {submitError && (
                // Same inline-icon layout as the login error: the base Alert
                // pins its icon 16px down, which sat below the text with py-2.
                <Alert variant="destructive" className="flex items-center gap-2 py-2 [&>svg]:static [&>svg]:shrink-0 [&>svg~*]:pl-0 [&>svg+div]:translate-y-0">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{submitError}</AlertDescription>
                </Alert>
              )}

              {aiAnalysis && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-black uppercase text-primary flex items-center gap-1.5">AI Merit Analysis</h4>
                    <Badge variant="secondary" className="font-mono">{aiAnalysis.fitScore}% Match</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground italic leading-relaxed mb-2">"{aiAnalysis.justification}"</p>
                </div>
              )}

              {!hasRubric && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                  <span className="font-bold">No scoring rubric yet.</span> This scholarship has no criteria to score
                  against, so an evaluation cannot be filed. Ask your administrator to add the rubric on the
                  scholarship.
                </div>
              )}

              {activeScholarship?.rubric?.map((item) => {
                const itemKey = criterionKey(item);
                return (
                  <div key={itemKey} className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <div className="flex flex-col">
                        <Label className="text-sm font-bold">{item.label}</Label>
                        <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Weight: {item.weight}%</span>
                      </div>
                      <Badge variant="outline" className="font-mono text-primary border-primary/30">{scores[itemKey] ?? NEUTRAL_SCORE} / 10</Badge>
                    </div>
                    <Slider
                      value={[scores[itemKey] ?? NEUTRAL_SCORE]} max={10} min={1} step={1}
                      onValueChange={(val) => canScore && setScores({ ...scores, [itemKey]: val[0] })}
                      disabled={!canScore}
                    />
                  </div>
                );
              })}
              
              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-black uppercase tracking-tight block">Final Recommendation</Label>
                <Select value={recommendation} onValueChange={(val) => canScore && setRecommendation(val)} disabled={!canScore}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select outcome..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Recommend">Highly Recommend</SelectItem>
                    <SelectItem value="Do Not Recommend">Do Not Recommend</SelectItem>
                    <SelectItem value="Undecided">Undecided / Needs Discussion</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Committee Notes</Label>
                  <Label className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                    Flag for discussion
                    <Switch checked={markForDiscussion} onCheckedChange={setMarkForDiscussion} disabled={!canScore} />
                  </Label>
                </div>
                <Textarea 
                  placeholder="Rationale for scores and recommendation..." 
                  className="min-h-[100px] text-sm" 
                  value={comment} 
                  onChange={(e) => setComment(e.target.value)} 
                  disabled={!canScore}
                />
              </div>
            </CardContent>
            
            <CardFooter className="bg-muted/10 border-t p-6 gap-3">
              {!hasRubric && !hasAlreadyReviewed ? (
                <div className="w-full flex flex-col gap-3">
                  <div className="flex items-center justify-center py-2 text-xs text-muted-foreground italic gap-2 bg-muted/50 rounded-md text-center">
                    <Lock className="h-3 w-3 shrink-0" /> This scholarship has no rubric yet, so it cannot be scored.
                  </div>
                  <Button variant="secondary" className="w-full" onClick={() => router.push('/review')}>
                    Back to Queue <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ) : isDecided && !hasAlreadyReviewed ? (
                <div className="w-full flex flex-col gap-3">
                  <div className="flex items-center justify-center py-2 text-xs text-muted-foreground italic gap-2 bg-muted/50 rounded-md text-center">
                    <Lock className="h-3 w-3 shrink-0" /> A decision has been made on this application, so it can no longer be scored.
                  </div>
                  <Button variant="secondary" className="w-full" onClick={() => router.push('/review')}>
                    Back to Queue <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ) : !hasAlreadyReviewed ? (
                <div className="w-full flex flex-col gap-3">
                  <Button className="w-full font-bold h-12 text-lg" onClick={handleSubmitReview} disabled={isSubmitting || isSavingDraft}>
                    {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                    {isSubmitting ? 'Submitting...' : 'Submit Evaluation'}
                  </Button>
                  <Button variant="outline" className="w-full" onClick={handleSaveDraft} disabled={isSubmitting || isSavingDraft}>
                    {isSavingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isSavingDraft ? 'Saving...' : 'Save progress'}
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Submitting is final. Saving keeps your scores here for later and sends nothing to the committee.
                  </p>
                </div>
              ) : (
                <div className="w-full flex flex-col gap-3">
                  <div className="flex items-center justify-center py-2 text-xs text-muted-foreground italic gap-2 bg-muted/50 rounded-md">
                     <Lock className="h-3 w-3" /> Assessment Finalized
                  </div>
                  {nextApplicationId && (
                    <Button className="w-full font-bold" onClick={() => router.push(`/review/applications/${nextApplicationId}`)}>
                      Review Next Applicant <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="secondary" className="w-full" onClick={() => router.push('/review')}>
                    Back to Queue <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
