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
  History,
  MessageSquare,
  ShieldAlert,
  GraduationCap,
  CheckCircle2,
  Trophy,
  AlertCircle
} from 'lucide-react';
import { notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useFirebase, useMemoFirebase, useCollection } from '@/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, limit } from 'firebase/firestore';
import type { Applicant } from '@/types/applicant';
import type { Scholarship } from '@/types/scholarship';
import { useToast } from '@/hooks/use-toast';
import { analyzeScholarshipFit, type AnalyzeFitOutput } from '@/ai/flows/analyze-scholarship-fit';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ApplicationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const applicationId = resolvedParams.id;
  const router = useRouter();
  const { toast } = useToast();
  const { firestore, user: reviewer } = useFirebase();
  
  // The route id is an application, not a student. That distinction is the
  // whole fix: a student may hold several applications and each is judged
  // separately, against its own scholarship's rubric.
  const applicationRef = useMemoFirebase(() => {
    if (!firestore || !applicationId) return null;
    return doc(firestore, 'applications', applicationId);
  }, [firestore, applicationId]);

  const { data: applicationRecord, isLoading: isApplicationLoading } = useDoc<any>(applicationRef);

  // Shared profile details (GPA, major) still live on the student document.
  const studentRef = useMemoFirebase(() => {
    if (!firestore || !applicationRecord?.studentId) return null;
    return doc(firestore, 'users', applicationRecord.studentId);
  }, [firestore, applicationRecord?.studentId]);

  const { data: studentProfile, isLoading: isStudentLoading } = useDoc<Applicant>(studentRef);

  const application = useMemo(
    () => (applicationRecord ? { ...(studentProfile || {}), ...applicationRecord } as Applicant : null),
    [studentProfile, applicationRecord],
  );

  // The student document can only be requested once the application has loaded
  // and revealed its studentId, so there is a render in between where the
  // application is present but the shared profile fields (GPA, major) are not.
  // Without the second clause the page rendered in that gap and crashed on
  // application.gpa.toFixed().
  const isLoading =
    isApplicationLoading ||
    isStudentLoading ||
    (!!applicationRecord?.studentId && !studentProfile);

  // The rubric comes from the scholarship this application was submitted to.
  // It used to be programs[0] — the first entry in whatever the reviewer
  // happened to be assigned to — so two reviewers could score the same
  // application against two different scholarships' criteria.
  const programRef = useMemoFirebase(() => {
    if (!firestore || !applicationRecord?.scholarshipId) return null;
    return doc(firestore, 'programs', applicationRecord.scholarshipId);
  }, [firestore, applicationRecord?.scholarshipId]);

  const { data: activeScholarship, isLoading: isProgramsLoading } = useDoc<Scholarship>(programRef);

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AnalyzeFitOutput | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const hasAlreadyReviewed = useMemo(() => {
    return myReview?.status === 'Submitted';
  }, [myReview]);

  // Seed the neutral midpoint only for an evaluation that hasn't been filed
  // yet. Doing it unconditionally is what made a finalised review display as a
  // flat 5/10 on every criterion with no recommendation selected: the controls
  // are disabled once submitted, so those defaults were frozen on screen and
  // read as the reviewer's actual scores.
  useEffect(() => {
    if (myReview) return;
    if (activeScholarship?.rubric && Object.keys(scores).length === 0) {
      const initialScores: Record<string, number> = {};
      activeScholarship.rubric.forEach(r => {
        initialScores[r.id || r.label] = 5;
      });
      setScores(initialScores);
    }
  }, [activeScholarship, scores, myReview]);

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

  const totalWeightedScore = useMemo(() => {
    if (!activeScholarship?.rubric) return 0;
    let total = 0;
    activeScholarship.rubric.forEach(r => {
      const score = scores[r.id || r.label] || 0;
      total += (score * (r.weight / 100));
    });
    return Number(total.toFixed(2));
  }, [scores, activeScholarship]);

  // A finalised review shows the score that was actually recorded, not one
  // recomputed from today's rubric weights — otherwise editing a programme's
  // weights later would silently restate past evaluations, and this page would
  // disagree with the score shown in the reviewer queue and the admin board.
  const displayScore = hasAlreadyReviewed && typeof myReview?.totalScore === 'number'
    ? myReview.totalScore
    : totalWeightedScore;

  const scorePercentage = (displayScore / 10) * 100;

  const handleSubmitReview = async () => {
    if (!firestore || !reviewer || !applicationId || hasAlreadyReviewed) return;
    
    if (!recommendation) {
      setSubmitError("Please provide a recommendation.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const criteriaScores = Object.entries(scores).map(([criteriaId, score]) => ({
        criteriaId,
        score
      }));

      const reviewData = {
        reviewerId: reviewer.uid,
        reviewerName: reviewer.displayName || 'Anonymous Reviewer',
        applicationId: applicationId,
        studentId: applicationRecord?.studentId ?? null,
        scholarshipId: applicationRecord?.scholarshipId ?? null,
        updatedAt: serverTimestamp(),
        submittedAt: serverTimestamp(),
        criteriaScores,
        totalScore: totalWeightedScore,
        notes: comment,
        recommendation,
        markForDiscussion,
        aiAnalysis,
        status: 'Submitted',
      };

      // Must live in the 'reviews' subcollection: both the reviewer dashboard
      // and the admin committee board read reviews via a collection-group
      // query, so a scores[] array on the applicant doc is invisible to them.
      await setDoc(doc(firestore, 'applications', applicationId, 'reviews', reviewer.uid), reviewData, { merge: true });

      toast({
        title: "Review Submitted",
        description: "Evaluation finalized and stored.",
      });
      
      // The evaluation is saved at this point. Advancing to the next candidate
      // is a convenience on top of that, so it gets its own error handling —
      // previously anything that went wrong here was reported as
      // "Could not save review", telling a reviewer their submitted evaluation
      // had failed when it was already safely stored.
      let nextId: string | null = null;
      try {
        nextId = await findNextUnreviewedApplication();
      } catch (error: any) {
        console.error('Could not determine the next application to review:', error.message);
      }

      if (nextId) {
        router.push(`/review/applications/${nextId}`);
      } else {
        setIsFinished(true);
      }
    } catch (error: any) {
      setSubmitError(error.message || "Could not save review.");
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
    if (!firestore || !reviewer) return null;

    // Firestore rejects an empty array for 'in', so skip the lookup entirely
    // when this reviewer isn't assigned to any scholarship yet.
    const assignedSnap = await getDocs(query(
      collection(firestore, 'programs'),
      where('reviewerIds', 'array-contains', reviewer.uid),
    ));
    const assignedScholarshipIds = assignedSnap.docs.map(d => d.id);
    if (assignedScholarshipIds.length === 0) return null;

    const nextSnap = await getDocs(query(
      collection(firestore, 'applications'),
      where('scholarshipId', 'in', assignedScholarshipIds.slice(0, 30)),
      limit(30)
    ));

    const candidates = nextSnap.docs
      .filter(d => d.id !== applicationId)
      .filter(d => ['Submitted', 'In Review'].includes(d.data().status))
      .map(d => d.id);

    const reviewed = await Promise.all(
      candidates.map(id => getDoc(doc(firestore, 'applications', id, 'reviews', reviewer.uid))
        .then(snap => snap.exists())
        .catch(() => true)) // treat an unreadable review as "skip this one"
    );

    return candidates.find((_, i) => !reviewed[i]) ?? null;
  };

  const runAiAnalysis = async () => {
    if (!application || !activeScholarship) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeScholarshipFit({
        applicantData: {
          gpa: typeof application.gpa === 'number' ? application.gpa : 0,
          major: application.major || '',
          essay: application.essay || '',
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

  if (isLoading || isProgramsLoading) {
    return <div className="flex h-[80vh] items-center justify-center animate-pulse text-muted-foreground">Syncing evaluation workspace...</div>;
  }

  if (isFinished) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center space-y-6 text-center">
        <div className="bg-primary/10 p-6 rounded-full">
          <Trophy className="h-16 w-16 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black">All Portfolios Evaluated</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            You&apos;ve reviewed all assigned applications for the current cycle. Great work!
          </p>
        </div>
        <Button asChild size="lg" className="rounded-full px-10">
          <Link href="/review">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  if (!application) notFound();

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
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Button variant="outline" size="sm" onClick={runAiAnalysis} disabled={isAnalyzing || hasAlreadyReviewed}>
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
                </div>
              </section>
              <Separator />
              <section>
                <h4 className="font-semibold text-sm mb-2 uppercase tracking-tight">Activities & Leadership</h4>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{application.activities || 'Not provided.'}</p>
              </section>
              <section>
                <h4 className="font-semibold text-sm mb-2 uppercase tracking-tight">Personal Statement</h4>
                <div className="p-4 rounded-lg bg-muted/20 border text-sm leading-relaxed whitespace-pre-wrap">
                  {application.essay || "No text essay provided."}
                </div>
              </section>
              <Separator />
              <section>
                <h3 className="text-lg font-semibold mb-4">Supporting Evidence</h3>
                <div className="grid grid-cols-2 gap-2">
                  {application.resume && <Button variant="outline" className="justify-start" asChild><Link href={application.resume as string} target="_blank"><FileText className="h-4 w-4 mr-2" /> Student Resume</Link></Button>}
                  {application.essays?.map((essay, i) => (
                    <Button key={i} variant="outline" className="justify-start" asChild><Link href={essay.fileUrl} target="_blank"><FileText className="h-4 w-4 mr-2" /> Essay: {essay.fileName}</Link></Button>
                  ))}
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

                {!application.resume
                  && !(application.essays && application.essays.length > 0)
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
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Committee Panel</span>
                </div>
              </div>
              <Progress value={scorePercentage} className="h-1.5 mt-2" />
            </CardHeader>
            
            <CardContent className="flex-1 overflow-y-auto space-y-6 p-6">
              {submitError && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{submitError}</AlertDescription>
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

              {activeScholarship?.rubric?.map((item) => {
                const itemKey = item.id || item.label;
                return (
                  <div key={itemKey} className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <div className="flex flex-col">
                        <Label className="text-sm font-bold">{item.label}</Label>
                        <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Weight: {item.weight}%</span>
                      </div>
                      <Badge variant="outline" className="font-mono text-primary border-primary/30">{scores[itemKey] || 0} / 10</Badge>
                    </div>
                    <Slider
                      value={[scores[itemKey] || 5]} max={10} min={1} step={1}
                      onValueChange={(val) => !hasAlreadyReviewed && setScores({ ...scores, [itemKey]: val[0] })}
                      disabled={hasAlreadyReviewed}
                    />
                  </div>
                );
              })}
              
              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-black uppercase tracking-tight block">Final Recommendation</Label>
                <Select value={recommendation} onValueChange={(val) => !hasAlreadyReviewed && setRecommendation(val)} disabled={hasAlreadyReviewed}>
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
                  <Switch checked={markForDiscussion} onCheckedChange={setMarkForDiscussion} disabled={hasAlreadyReviewed} />
                </div>
                <Textarea 
                  placeholder="Rationale for scores and recommendation..." 
                  className="min-h-[100px] text-sm" 
                  value={comment} 
                  onChange={(e) => setComment(e.target.value)} 
                  disabled={hasAlreadyReviewed}
                />
              </div>
            </CardContent>
            
            <CardFooter className="bg-muted/10 border-t p-6 gap-3">
              {!hasAlreadyReviewed ? (
                <Button className="w-full font-bold h-12 text-lg" onClick={handleSubmitReview} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                  {isSubmitting ? 'Submitting...' : 'Submit Evaluation'}
                </Button>
              ) : (
                <div className="w-full flex flex-col gap-3">
                  <div className="flex items-center justify-center py-2 text-xs text-muted-foreground italic gap-2 bg-muted/50 rounded-md">
                     <Lock className="h-3 w-3" /> Assessment Finalized
                  </div>
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
