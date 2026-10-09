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
  ShieldAlert,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  ChevronRight
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
  
  const applicantRef = useMemoFirebase(() => {
    if (!firestore || !applicationId) return null;
    return doc(firestore, 'users', applicationId);
  }, [firestore, applicationId]);

  const { data: application, isLoading: isAppLoading } = useDoc<Applicant>(applicantRef);

  const myReviewRef = useMemoFirebase(() => {
    if (!firestore || !applicationId || !reviewer) return null;
    return doc(firestore, 'users', applicationId, 'reviews', reviewer.uid);
  }, [firestore, applicationId, reviewer]);

  const { data: myReview, isLoading: isReviewLoading } = useDoc<any>(myReviewRef);

  const programsQuery = useMemoFirebase(() => {
    if (!firestore || !reviewer) return null;
    return query(collection(firestore, 'programs'), where('reviewerIds', 'array-contains', reviewer.uid), limit(1));
  }, [firestore, reviewer]);

  const { data: programs, isLoading: isProgramsLoading } = useCollection<Scholarship>(programsQuery);
  const activeScholarship = programs?.[0]; 

  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [recommendation, setRecommendation] = useState<string>('');
  const [markForDiscussion, setMarkForDiscussion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AnalyzeFitOutput | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const handleSaveReview = async (status: 'Draft' | 'Submitted') => {
    if (!firestore || !reviewer || !applicationId) return;
    if (status === 'Submitted' && !recommendation) {
      setSubmitError("Please provide a final recommendation before submitting.");
      return;
    }

    if (status === 'Submitted') setIsSubmitting(true);
    else setIsSaving(true);
    
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

      await setDoc(doc(firestore, 'users', applicationId, 'reviews', reviewer.uid), reviewData, { merge: true });
      toast({ title: status === 'Submitted' ? "Evaluation Finalized" : "Draft Saved" });
      if (status === 'Submitted') router.push('/review');
    } catch (error: any) {
      setSubmitError(error.message);
    } finally { 
      setIsSubmitting(false); 
      setIsSaving(false);
    }
  };

  const runAiAnalysis = async () => {
    if (!application || !activeScholarship || !reviewer) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeScholarshipFit(await reviewer.getIdToken(), {
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
    return <div className="flex h-[80vh] items-center justify-center animate-pulse text-muted-foreground font-medium">Loading Portfolio...</div>;
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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {anonymousIdentifier}
            <Badge variant="secondary" className="bg-primary/10 text-primary"><ShieldAlert className="h-3 w-3 mr-1" /> Blind Review</Badge>
            {isFinalized && <Badge className="bg-green-600 text-white border-none">Finalized</Badge>}
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={runAiAnalysis} disabled={isAnalyzing || isFinalized}>
          {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2 text-primary" />}
          AI Analysis
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 flex-1 min-h-0">
        <div className="lg:col-span-7 flex flex-col min-h-0">
          <ScrollArea className="flex-1 rounded-xl border bg-card p-6 shadow-sm">
            <div className="space-y-8">
              <section>
                <h3 className="text-lg font-semibold mb-4">Candidate Profile</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><Label className="text-muted-foreground">GPA</Label><p className="font-bold">{application.gpa.toFixed(2)}</p></div>
                  <div><Label className="text-muted-foreground">Intended Major</Label><p className="font-bold">{application.major}</p></div>
                </div>
              </section>
              <Separator />
              <section>
                <h4 className="font-semibold text-sm mb-2 uppercase">Activities</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{application.activities}</p>
              </section>
              <section>
                <h4 className="font-semibold text-sm mb-2 uppercase">Personal Statement</h4>
                <div className="p-4 rounded-lg bg-muted/20 border text-sm leading-relaxed whitespace-pre-wrap">
                  {application.essay || application.qualificationStatement || "No text provided."}
                </div>
              </section>
              <Separator />
              <section>
                <h3 className="text-lg font-semibold mb-4">Evidence</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {application.resume && <Button variant="outline" className="justify-start h-auto py-3 px-4" asChild><Link href={application.resume as string} target="_blank"><FileText className="h-4 w-4 mr-3" /> Student Resume</Link></Button>}
                  {application.recommendationLetter1 && <Button variant="outline" className="justify-start h-auto py-3 px-4" asChild><Link href={application.recommendationLetter1 as string} target="_blank"><CheckCircle2 className="h-4 w-4 mr-3 text-green-600" /> Endorsement #1</Link></Button>}
                  {application.recommendationLetter2 && <Button variant="outline" className="justify-start h-auto py-3 px-4" asChild><Link href={application.recommendationLetter2 as string} target="_blank"><CheckCircle2 className="h-4 w-4 mr-3 text-green-600" /> Endorsement #2</Link></Button>}
                </div>
              </section>
              {(application.recommendationLetterText1 || application.recommendationLetterText2) && (
                <>
                  <Separator />
                  <section className="space-y-4">
                    <h3 className="text-lg font-semibold">Endorsement Text</h3>
                    {application.recommendationLetterText1 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2 uppercase">Endorsement #1</h4>
                        <div className="p-4 rounded-lg bg-muted/20 border text-sm leading-relaxed whitespace-pre-wrap">{application.recommendationLetterText1}</div>
                      </div>
                    )}
                    {application.recommendationLetterText2 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2 uppercase">Endorsement #2</h4>
                        <div className="p-4 rounded-lg bg-muted/20 border text-sm leading-relaxed whitespace-pre-wrap">{application.recommendationLetterText2}</div>
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6 min-h-0">
          <Card className={`flex flex-col min-h-0 shadow-lg ${isFinalized ? 'border-green-200' : 'border-primary/20'}`}>
            <CardHeader className="bg-primary/5 border-b py-4">
              <CardTitle className="text-lg flex items-center gap-2"><Calculator className="h-5 w-5" /> Evaluation</CardTitle>
              <Progress value={scorePercentage} className="h-1.5 mt-2" />
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-6 p-6">
              {aiAnalysis && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <h4 className="text-[10px] font-black uppercase text-primary mb-1">AI Merit Logic</h4>
                  <p className="text-xs text-muted-foreground italic">"{aiAnalysis.justification}"</p>
                </div>
              )}
              {activeScholarship?.rubric?.map((item) => {
                const itemKey = item.id || item.label;
                return (
                  <div key={itemKey} className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <Label className="text-sm font-bold">{item.label}</Label>
                      <Badge variant="outline" className="font-mono text-primary">{scores[itemKey] || 0} / 10</Badge>
                    </div>
                    <Slider 
                      value={[scores[itemKey] || 5]} max={10} min={1} step={1} 
                      onValueChange={(val) => !isFinalized && setScores({ ...scores, [itemKey]: val[0] })}
                      disabled={isFinalized}
                    />
                  </div>
                );
              })}
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-black uppercase tracking-tight">Outcome</Label>
                <Select value={recommendation} onValueChange={(val) => !isFinalized && setRecommendation(val)} disabled={isFinalized}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Recommend">Recommend</SelectItem>
                    <SelectItem value="Do Not Recommend">Do Not Recommend</SelectItem>
                    <SelectItem value="Undecided">Undecided</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="font-bold">Notes</Label>
                <Textarea 
                  placeholder="Reviewer rationale..." 
                  className="min-h-[100px] text-sm" 
                  value={comment} 
                  onChange={(e) => setComment(e.target.value)} 
                  disabled={isFinalized}
                />
              </div>
            </CardContent>
            <CardFooter className="bg-muted/10 border-t p-6">
              {!isFinalized ? (
                <div className="grid grid-cols-2 gap-3 w-full">
                  <Button variant="outline" className="font-bold" onClick={() => handleSaveReview('Draft')} disabled={isSaving || isSubmitting}>Save Draft</Button>
                  <Button className="font-bold" onClick={() => handleSaveReview('Submitted')} disabled={isSaving || isSubmitting}>Finalize</Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full font-bold" onClick={() => router.push('/review')}>Back to Queue</Button>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
