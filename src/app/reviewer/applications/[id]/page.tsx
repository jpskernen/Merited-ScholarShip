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
  Calculator, 
  Lock, 
  MessageSquare,
  ShieldAlert,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Save,
  ArrowRight,
  Trophy,
  Info
} from 'lucide-react';
import { notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useFirebase, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, collection, query, where, getDocs, limit, serverTimestamp } from 'firebase/firestore';
import type { Applicant } from '@/types/applicant';
import type { Scholarship } from '@/types/scholarship';
import { useToast } from '@/hooks/use-toast';
import { analyzeScholarshipFit, type AnalyzeFitOutput } from '@/ai/flows/analyze-scholarship-fit';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ReviewerApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const applicationId = resolvedParams.id;
  const router = useRouter();
  const { toast } = useToast();
  const { firestore, user: reviewer } = useFirebase();
  
  const [isFinished, setIsFinished] = useState(false);

  // 1. Fetch Applicant Details
  const applicantRef = useMemoFirebase(() => {
    if (!firestore || !applicationId) return null;
    return doc(firestore, 'users', applicationId);
  }, [firestore, applicationId]);

  const { data: application, isLoading: isAppLoading } = useDoc<Applicant>(applicantRef);

  // 2. Fetch Reviewer's Specific Review for this Applicant
  const myReviewRef = useMemoFirebase(() => {
    if (!firestore || !applicationId || !reviewer) return null;
    return doc(firestore, 'users', applicationId, 'reviews', reviewer.uid);
  }, [firestore, applicationId, reviewer]);

  const { data: myReview, isLoading: isReviewLoading } = useDoc<any>(myReviewRef);

  // 3. Fetch Scholarship Context (to get rubric)
  const programsQuery = useMemoFirebase(() => {
    if (!firestore || !reviewer) return null;
    return query(collection(firestore, 'programs'), where('reviewerIds', 'array-contains', reviewer.uid), limit(1));
  }, [firestore, reviewer]);

  const { data: programs, isLoading: isProgramsLoading } = useCollection<Scholarship>(programsQuery);
  const activeScholarship = programs?.[0]; 

  // Form State
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [recommendation, setRecommendation] = useState<string>('');
  const [markForDiscussion, setMarkForDiscussion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AnalyzeFitOutput | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Sync Form with Existing Review (Draft or Submitted)
  useEffect(() => {
    if (myReview) {
      const loadedScores: Record<string, number> = {};
      myReview.criteriaScores?.forEach((cs: any) => {
        loadedScores[cs.criteriaId] = cs.score;
      });
      setScores(loadedScores);
      setComment(myReview.notes || '');
      setRecommendation(myReview.recommendation || '');
      setMarkForDiscussion(myReview.markForDiscussion || false);
      setAiAnalysis(myReview.aiAnalysis || null);
    } else if (activeScholarship?.rubric && Object.keys(scores).length === 0) {
      const initialScores: Record<string, number> = {};
      activeScholarship.rubric.forEach(r => { initialScores[r.id || r.label] = 5; });
      setScores(initialScores);
    }
  }, [myReview, activeScholarship, scores]);

  const totalWeightedScore = useMemo(() => {
    if (!activeScholarship?.rubric) return 0;
    let total = 0;
    activeScholarship.rubric.forEach(r => {
      const score = scores[r.id || r.label] || 0;
      total += (score * (r.weight / 100));
    });
    return Number(total.toFixed(2));
  }, [scores, activeScholarship]);

  const scorePercentage = (totalWeightedScore / 10) * 100;

  const findAndLoadNextApplication = async () => {
    if (!firestore || !reviewer) return;
    
    const nextQuery = query(
      collection(firestore, 'users'),
      where('role', '==', 'Applicant'),
      where('status', 'in', ['Submitted', 'In Review']),
      where('reviewerIds', 'array-contains', reviewer.uid),
      limit(10)
    );

    const snapshot = await getDocs(nextQuery);
    const nextCandidates = snapshot.docs.filter(doc => doc.id !== applicationId);
    
    if (nextCandidates.length > 0) {
      router.push(`/reviewer/applications/${nextCandidates[0].id}`);
    } else {
      setIsFinished(true);
    }
  };

  const handleSaveReview = async (status: 'Draft' | 'Submitted') => {
    if (!firestore || !reviewer || !applicationId) return;
    
    if (status === 'Submitted' && !recommendation) {
      setSubmitError("Please provide a final recommendation before submitting.");
      return;
    }

    if (status === 'Submitted') setIsSubmitting(true);
    else setIsSaving(true);
    
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
        updatedAt: serverTimestamp(),
        submittedAt: status === 'Submitted' ? serverTimestamp() : null,
        criteriaScores,
        totalScore: totalWeightedScore,
        notes: comment,
        recommendation,
        markForDiscussion,
        aiAnalysis,
        status,
      };

      const reviewDocRef = doc(firestore, 'users', applicationId, 'reviews', reviewer.uid);
      await setDoc(reviewDocRef, reviewData, { merge: true });

      toast({
        title: status === 'Submitted' ? "Evaluation Finalized" : "Draft Saved",
        description: status === 'Submitted' ? "Review locked. Loading next candidate..." : "Progress stored.",
      });
      
      if (status === 'Submitted') {
        await findAndLoadNextApplication();
      }
    } catch (error: any) {
      setSubmitError(error.message || "Could not save review data.");
    } finally { 
      setIsSubmitting(false); 
      setIsSaving(false);
    }
  };

  const runAiAnalysis = async () => {
    if (!application || !activeScholarship) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeScholarshipFit({
        applicantData: {
          gpa: application.gpa,
          major: application.major,
          essay: application.essay || '',
          activities: application.activities,
          interests: application.interests,
        },
        scholarshipCriteria: activeScholarship.description,
      });
      setAiAnalysis(result);
    } catch (error) {
      toast({ title: "Analysis Failed", variant: "destructive" });
    } finally { setIsAnalyzing(false); }
  };

  if (isAppLoading || isReviewLoading || isProgramsLoading) {
    return <div className="flex h-[80vh] items-center justify-center animate-pulse text-muted-foreground font-medium">Loading Portfolio & Workspace...</div>;
  }

  if (isFinished) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center space-y-6 text-center">
        <div className="bg-primary/10 p-8 rounded-full animate-bounce">
          <Trophy className="h-20 w-20 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-black">Queue Cleared</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Excellent work. You have reviewed all assigned portfolios for the current evaluation cycle.
          </p>
        </div>
        <Button asChild size="lg" className="rounded-full px-12 h-14 text-lg font-bold">
          <Link href="/reviewer/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  if (!application) notFound();

  const anonymousIdentifier = `Applicant ${applicationId.substring(0, 6).toUpperCase()}`;
  const isFinalized = myReview?.status === 'Submitted';

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4 mr-2" /> Queue
          </Button>
          <div className="space-y-0.5">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {anonymousIdentifier}
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                <ShieldAlert className="h-3 w-3 mr-1" /> Blind Review
              </Badge>
              {isFinalized && <Badge className="bg-green-600 text-white border-none">Finalized</Badge>}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={runAiAnalysis} disabled={isAnalyzing || isFinalized}>
            {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2 text-primary" />}
            AI Analysis
          </Button>
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Weighted Score</p>
            <p className="text-2xl font-black text-primary">{totalWeightedScore.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/10</span></p>
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
                  <div><Label className="text-muted-foreground">GPA</Label><p className="font-bold">{application.gpa.toFixed(2)}</p></div>
                  <div><Label className="text-muted-foreground">Intended Major</Label><p className="font-bold">{application.major}</p></div>
                </div>
              </section>
              <Separator />
              <section>
                <h4 className="font-semibold text-sm mb-2 uppercase tracking-tight">Activities & Leadership</h4>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{application.activities}</p>
              </section>
              <section>
                <h4 className="font-semibold text-sm mb-2 uppercase tracking-tight">Personal Statement</h4>
                <div className="p-4 rounded-lg bg-muted/20 border text-sm leading-relaxed whitespace-pre-wrap">
                  {application.essay || application.qualificationStatement || "No text response provided."}
                </div>
              </section>
              <Separator />
              <section>
                <h3 className="text-lg font-semibold mb-4">Supporting Evidence</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {application.transcripts && <Button variant="outline" className="justify-start h-auto py-3 px-4" asChild><Link href={application.transcripts as string} target="_blank"><FileText className="h-4 w-4 mr-3 text-primary" /><div className="text-left"><p className="text-xs font-bold">Academic Transcript</p><p className="text-[10px] text-muted-foreground">PDF Document</p></div></Link></Button>}
                  {application.resume && <Button variant="outline" className="justify-start h-auto py-3 px-4" asChild><Link href={application.resume as string} target="_blank"><FileText className="h-4 w-4 mr-3 text-primary" /><div className="text-left"><p className="text-xs font-bold">Student Resume</p><p className="text-[10px] text-muted-foreground">PDF Document</p></div></Link></Button>}
                  {application.recommendationLetter1 && <Button variant="outline" className="justify-start h-auto py-3 px-4 border-green-200 bg-green-50/50" asChild><Link href={application.recommendationLetter1 as string} target="_blank"><CheckCircle2 className="h-4 w-4 mr-3 text-green-600" /><div className="text-left"><p className="text-xs font-bold">Recommendation #1</p><p className="text-[10px] text-muted-foreground">Verified Upload</p></div></Link></Button>}
                  {application.essays?.map((essay, i) => (
                    <Button key={i} variant="outline" className="justify-start h-auto py-3 px-4" asChild><Link href={essay.fileUrl} target="_blank"><FileText className="h-4 w-4 mr-3 text-primary" /><div className="text-left"><p className="text-xs font-bold truncate max-w-[120px]">Essay: {essay.fileName}</p><p className="text-[10px] text-muted-foreground">Attachment</p></div></Link></Button>
                  ))}
                </div>
              </section>
            </div>
          </ScrollArea>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6 min-h-0">
          <Card className={`flex flex-col min-h-0 shadow-lg ${isFinalized ? 'border-green-200' : 'border-primary/20'}`}>
            <CardHeader className="bg-primary/5 border-b py-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg flex items-center gap-2"><Calculator className="h-5 w-5" /> Scoring Rubric</CardTitle>
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
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 animate-in fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-black uppercase text-primary flex items-center gap-1.5">AI Merit Logic</h4>
                    <Badge variant="secondary" className="font-mono">{aiAnalysis.fitScore}% Match</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground italic leading-relaxed">"{aiAnalysis.justification}"</p>
                </div>
              )}

              <div className="space-y-4">
                {(activeScholarship?.rubric || [
                  { id: "academic", label: "Academic Achievement", weight: 30 },
                  { id: "essay", label: "Essay Quality", weight: 25 },
                  { id: "financial", label: "Financial Need", weight: 20 },
                  { id: "community", label: "Community Service", weight: 15 },
                  { id: "recommendation", label: "Recommendation Strength", weight: 10 }
                ]).map((item) => {
                  const itemKey = item.id || item.label;
                  const currentScore = scores[itemKey] || 5;
                  const weightedContribution = (currentScore * (item.weight / 100)).toFixed(2);

                  return (
                    <Card key={itemKey} className="border-muted bg-muted/10">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-bold">{item.label}</Label>
                            {item.description && (
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Info className="h-2 w-2" /> {item.description}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className="font-mono text-primary text-[10px] border-primary/30">
                              {currentScore} / 10
                            </Badge>
                            <p className="text-[9px] font-black text-primary/60 uppercase mt-1">+{weightedContribution} pts</p>
                          </div>
                        </div>
                        <Slider 
                          value={[currentScore]} max={10} min={1} step={1} 
                          onValueChange={(val) => !isFinalized && setScores({ ...scores, [itemKey]: val[0] })}
                          disabled={isFinalized}
                          className="py-2"
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              
              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-black uppercase tracking-tight block">Final Recommendation</Label>
                <Select value={recommendation} onValueChange={(val) => !isFinalized && setRecommendation(val)} disabled={isFinalized}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select outcome..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Recommend">Highly Recommend</SelectItem>
                    <SelectItem value="Do Not Recommend">Do Not Recommend</SelectItem>
                    <SelectItem value="Undecided">Undecided / Discuss</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 font-bold"><MessageSquare className="h-4 w-4" /> Internal Notes</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-red-600">Flag</span>
                    <Switch checked={markForDiscussion} onCheckedChange={setMarkForDiscussion} disabled={isFinalized} />
                  </div>
                </div>
                <Textarea 
                  placeholder="Rationale for scores..." 
                  className="min-h-[120px] text-sm bg-muted/20" 
                  value={comment} 
                  onChange={(e) => setComment(e.target.value)} 
                  disabled={isFinalized}
                />
              </div>
            </CardContent>
            
            <CardFooter className="bg-muted/10 border-t p-6 flex flex-col gap-3">
              {!isFinalized ? (
                <div className="grid grid-cols-2 gap-3 w-full">
                  <Button variant="outline" className="font-bold h-11" onClick={() => handleSaveReview('Draft')} disabled={isSaving || isSubmitting}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Draft
                  </Button>
                  <Button className="font-bold h-11" onClick={() => handleSaveReview('Submitted')} disabled={isSaving || isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Finalize
                  </Button>
                </div>
              ) : (
                <div className="w-full flex flex-col gap-3">
                  <div className="flex items-center justify-center py-2.5 text-xs text-green-700 font-bold gap-2 bg-green-50 rounded-md border border-green-200">
                     <Lock className="h-3 w-3" /> Evaluation Finalized
                  </div>
                  <Button variant="outline" className="w-full h-11 font-bold" onClick={() => router.push('/reviewer/dashboard')}>
                    Back to Queue <ArrowRight className="ml-2 h-4 w-4" />
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
