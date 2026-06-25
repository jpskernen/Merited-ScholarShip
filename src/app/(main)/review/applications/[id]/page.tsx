
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
  GraduationCap
} from 'lucide-react';
import { notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useFirebase, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, collection, query, where } from 'firebase/firestore';
import type { Applicant } from '@/types/applicant';
import type { Scholarship } from '@/types/scholarship';
import { useToast } from '@/hooks/use-toast';
import { analyzeScholarshipFit, type AnalyzeFitOutput } from '@/ai/flows/analyze-scholarship-fit';

export default function ApplicationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const applicationId = resolvedParams.id;
  const router = useRouter();
  const { toast } = useToast();
  const { firestore, user: reviewer } = useFirebase();
  
  const applicantRef = useMemoFirebase(() => {
    if (!firestore || !applicationId) return null;
    return doc(firestore, 'users', applicationId);
  }, [firestore, applicationId]);

  const { data: application, isLoading } = useDoc<Applicant>(applicantRef);

  // Fetch all assigned programs for this reviewer to find the relevant scholarship
  const programsQuery = useMemoFirebase(() => {
    if (!firestore || !reviewer || !application) return null;
    return query(collection(firestore, 'programs'), where('reviewerIds', 'array-contains', reviewer.uid));
  }, [firestore, reviewer, application]);

  const { data: programs, isLoading: isProgramsLoading } = useCollection<Scholarship>(programsQuery);

  const activeScholarship = programs?.[0]; // In MVP, assume first assigned program

  const reviewRef = useMemoFirebase(() => {
    if (!firestore || !reviewer || !applicationId) return null;
    return doc(firestore, 'applications', applicationId, 'reviews', reviewer.uid);
  }, [firestore, reviewer, applicationId]);

  const { data: existingReview, isLoading: isReviewLoading } = useDoc(reviewRef);

  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [recommendation, setRecommendation] = useState<string>('');
  const [markForDiscussion, setMarkForDiscussion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AnalyzeFitOutput | null>(null);

  const isReadOnly = existingReview?.status === 'Submitted';

  useEffect(() => {
    if (existingReview) {
      if (existingReview.scores) setScores(existingReview.scores);
      if (existingReview.comment) setComment(existingReview.comment);
      if (existingReview.aiAnalysis) setAiAnalysis(existingReview.aiAnalysis);
      if (existingReview.markForDiscussion) setMarkForDiscussion(existingReview.markForDiscussion);
      if (existingReview.recommendation) setRecommendation(existingReview.recommendation);
    }
  }, [existingReview]);

  // Handle dynamic rubric loading
  useEffect(() => {
    if (activeScholarship?.rubric && Object.keys(scores).length === 0 && !existingReview) {
      const initialScores: Record<string, number> = {};
      activeScholarship.rubric.forEach(r => {
        initialScores[r.criterion] = 5; // Default middle
      });
      setScores(initialScores);
    }
  }, [activeScholarship, scores, existingReview]);

  const totalWeightedScore = useMemo(() => {
    if (!activeScholarship?.rubric) return 0;
    let total = 0;
    activeScholarship.rubric.forEach(r => {
      const score = scores[r.criterion] || 0;
      total += (score * (r.weight / 100));
    });
    return total;
  }, [scores, activeScholarship]);

  const scorePercentage = (totalWeightedScore / 10) * 100;

  const handleSubmitReview = async (isDraft: boolean = false) => {
    if (!firestore || !reviewer || !applicationId || (isReadOnly && !isDraft)) return;
    
    if (!isDraft && !recommendation) {
      toast({ title: "Incomplete", description: "Please provide a recommendation.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      const reviewDocRef = doc(firestore, 'applications', applicationId, 'reviews', reviewer.uid);
      await setDoc(reviewDocRef, {
        applicationId: applicationId,
        reviewerId: reviewer.uid,
        reviewerName: reviewer.displayName || 'Reviewer',
        scholarshipId: activeScholarship?.id || 'unknown',
        scores,
        totalWeightedScore,
        comment,
        recommendation,
        markForDiscussion,
        aiAnalysis,
        status: isDraft ? 'In Progress' : 'Submitted',
        date: new Date().toISOString(),
      }, { merge: true });

      toast({
        title: isDraft ? "Draft Saved" : "Review Submitted",
        description: isDraft ? "You can continue this later." : "Evaluation finalized.",
      });
      
      if (!isDraft) router.push('/review');
    } catch (error) {
      toast({ title: "Error", variant: "destructive", description: "Could not save review." });
    } finally { setIsSubmitting(false); }
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

  if (isLoading || isReviewLoading || isProgramsLoading) {
    return <div className="flex h-[80vh] items-center justify-center animate-pulse text-muted-foreground">Syncing evaluation workspace...</div>;
  }

  if (!application) notFound();

  const anonymousIdentifier = `Applicant ${applicationId.substring(0, 6).toUpperCase()}`;

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
              {isReadOnly && <Badge className="bg-green-600">Finalized</Badge>}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Button variant="outline" size="sm" onClick={runAiAnalysis} disabled={isAnalyzing || isReadOnly}>
            {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2 text-primary" />}
            AI Fit Assessment
          </Button>
          <div className="text-right">
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
                  <div className="col-span-2">
                     <Label className="text-muted-foreground flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> Program</Label>
                     <p className="font-medium text-primary">{activeScholarship?.name || 'Assigned Program'}</p>
                  </div>
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
                  {application.essay || "No text essay provided."}
                </div>
              </section>
              <Separator />
              <section>
                <h3 className="text-lg font-semibold mb-4">Supporting Evidence</h3>
                <div className="grid grid-cols-2 gap-2">
                  {application.transcripts && <Button variant="outline" className="justify-start" asChild><Link href={application.transcripts as string} target="_blank"><FileText className="h-4 w-4 mr-2" /> Academic Transcript</Link></Button>}
                  {application.resume && <Button variant="outline" className="justify-start" asChild><Link href={application.resume as string} target="_blank"><FileText className="h-4 w-4 mr-2" /> Student Resume</Link></Button>}
                  {application.essays?.map((essay, i) => (
                    <Button key={i} variant="outline" className="justify-start" asChild><Link href={essay.fileUrl} target="_blank"><FileText className="h-4 w-4 mr-2" /> Essay: {essay.fileName}</Link></Button>
                  ))}
                </div>
              </section>
            </div>
          </ScrollArea>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6 min-h-0">
          <Card className={`flex flex-col min-h-0 shadow-lg ${isReadOnly ? 'border-green-200' : 'border-primary/20'}`}>
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
              {aiAnalysis && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-black uppercase text-primary flex items-center gap-1.5">AI Merit Analysis</h4>
                    <Badge variant="secondary" className="font-mono">{aiAnalysis.fitScore}% Match</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground italic leading-relaxed mb-2">"{aiAnalysis.justification}"</p>
                </div>
              )}

              {activeScholarship?.rubric?.map((item) => (
                <div key={item.criterion} className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <div className="flex flex-col">
                      <Label className="text-sm font-bold">{item.criterion}</Label>
                      <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Weight: {item.weight}%</span>
                    </div>
                    <Badge variant="outline" className="font-mono text-primary border-primary/30">{scores[item.criterion] || 0} / 10</Badge>
                  </div>
                  <Slider 
                    value={[scores[item.criterion] || 5]} max={10} min={1} step={1} 
                    onValueChange={(val) => !isReadOnly && setScores({ ...scores, [item.criterion]: val[0] })}
                    disabled={isReadOnly}
                  />
                </div>
              ))}
              
              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-black uppercase tracking-tight block">Final Recommendation</Label>
                <Select value={recommendation} onValueChange={(val) => !isReadOnly && setRecommendation(val)} disabled={isReadOnly}>
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
                  <Switch checked={markForDiscussion} onCheckedChange={setMarkForDiscussion} disabled={isReadOnly} />
                </div>
                <Textarea 
                  placeholder="Rationale for scores and recommendation..." 
                  className="min-h-[100px] text-sm" 
                  value={comment} 
                  onChange={(e) => setComment(e.target.value)} 
                  disabled={isReadOnly}
                />
              </div>
            </CardContent>
            
            <CardFooter className="bg-muted/10 border-t p-6 gap-3">
              {!isReadOnly ? (
                <>
                  <Button variant="outline" className="flex-1" onClick={() => handleSubmitReview(true)} disabled={isSubmitting}>Save Draft</Button>
                  <Button className="flex-1 font-bold" onClick={() => handleSubmitReview(false)} disabled={isSubmitting}>Submit Review</Button>
                </>
              ) : (
                <div className="w-full flex flex-col gap-3">
                  <div className="flex items-center justify-center py-2 text-xs text-muted-foreground italic gap-2 bg-muted/50 rounded-md">
                     <Lock className="h-3 w-3" /> Assessment Finalized
                  </div>
                  <Button variant="secondary" className="w-full" onClick={() => router.push('/review')}>
                    Next in Queue <ChevronRight className="ml-2 h-4 w-4" />
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
