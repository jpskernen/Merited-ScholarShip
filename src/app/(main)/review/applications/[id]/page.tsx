
'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { 
  FileText, 
  UserCircle, 
  Sparkles, 
  Loader2, 
  ChevronLeft, 
  Calculator, 
  Lock, 
  History,
  MessageSquare
} from 'lucide-react';
import { notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import type { Applicant } from '@/types/applicant';
import { useToast } from '@/hooks/use-toast';
import { analyzeScholarshipFit, type AnalyzeFitOutput } from '@/ai/flows/analyze-scholarship-fit';
import scholarshipsData from '@/data/scholarships.json';

// Rubric Weights (Total = 1.0)
const RUBRIC_WEIGHTS = {
  gpa: 0.25,
  extracurriculars: 0.15,
  volunteerism: 0.15,
  leadership: 0.15,
  major: 0.10,
  other: 0.20
};

export default function ApplicationReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const { firestore, user: reviewer } = useFirebase();
  
  const applicantRef = useMemoFirebase(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'users', params.id);
  }, [firestore, params.id]);

  const { data: application, isLoading } = useDoc<Applicant>(applicantRef);

  const reviewRef = useMemoFirebase(() => {
    if (!firestore || !reviewer || !params.id) return null;
    return doc(firestore, 'applications', params.id, 'reviews', reviewer.uid);
  }, [firestore, reviewer, params.id]);

  const { data: existingReview, isLoading: isReviewLoading } = useDoc(reviewRef);

  const [scores, setScores] = useState({
    gpa: 3,
    extracurriculars: 3,
    volunteerism: 3,
    leadership: 3,
    major: 3,
    other: 3
  });
  
  const [comment, setComment] = useState('');
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
    }
  }, [existingReview]);

  const totalWeightedScore = useMemo(() => {
    return (
      (scores.gpa * RUBRIC_WEIGHTS.gpa) +
      (scores.extracurriculars * RUBRIC_WEIGHTS.extracurriculars) +
      (scores.volunteerism * RUBRIC_WEIGHTS.volunteerism) +
      (scores.leadership * RUBRIC_WEIGHTS.leadership) +
      (scores.major * RUBRIC_WEIGHTS.major) +
      (scores.other * RUBRIC_WEIGHTS.other)
    );
  }, [scores]);

  const scorePercentage = (totalWeightedScore / 5) * 100;

  const handleSubmitReview = async (isDraft: boolean = false) => {
    if (!firestore || !reviewer || !params.id || (isReadOnly && !isDraft)) return;
    setIsSubmitting(true);

    try {
      const reviewDocRef = doc(firestore, 'applications', params.id, 'reviews', reviewer.uid);
      await setDoc(reviewDocRef, {
        applicationId: params.id,
        reviewerId: reviewer.uid,
        reviewerName: reviewer.displayName || 'Reviewer',
        scores,
        totalWeightedScore,
        comment,
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
    if (!application) return;
    setIsAnalyzing(true);
    try {
      const defaultCriteria = scholarshipsData[0]?.description || "General excellence.";
      const result = await analyzeScholarshipFit({
        applicantData: {
          gpa: application.gpa,
          major: application.major,
          essay: application.essay,
          activities: application.activities,
          interests: application.interests,
        },
        scholarshipCriteria: defaultCriteria,
      });
      setAiAnalysis(result);
    } catch (error) {
      toast({ title: "Analysis Failed", variant: "destructive" });
    } finally { setIsAnalyzing(false); }
  };

  if (isLoading || isReviewLoading) {
    return <div className="flex h-[80vh] items-center justify-center animate-pulse">Loading Application...</div>;
  }

  if (!application) notFound();

  const criteria = [
    { key: 'gpa', label: 'Academic Excellence', weight: '25%', desc: 'Transcripts & GPA quality.' },
    { key: 'extracurriculars', label: 'Involvement', weight: '15%', desc: 'Participation depth.' },
    { key: 'volunteerism', label: 'Community Service', weight: '15%', desc: 'Consistency & impact.' },
    { key: 'leadership', label: 'Leadership', weight: '15%', desc: 'Roles & initiative.' },
    { key: 'major', label: 'Major Alignment', weight: '10%', desc: 'Fit for field of study.' },
    { key: 'other', label: 'Overall Impression', weight: '20%', desc: 'Essay & X-factor.' },
  ];

  const displayName = application.isBlind ? `Applicant ${params.id.substring(0, 6)}` : application.name;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {displayName}
              {application.isBlind && <Badge variant="outline">Blind Review</Badge>}
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
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Weighted Total</p>
            <p className="text-2xl font-black text-primary">{totalWeightedScore.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/5</span></p>
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
                  {!application.isBlind && <div><Label className="text-muted-foreground">School</Label><p className="font-bold">{application.school}</p></div>}
                </div>
              </section>
              <Separator />
              <section>
                <h4 className="font-semibold text-sm mb-2">Activities & Leadership</h4>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{application.activities}</p>
              </section>
              <section>
                <h4 className="font-semibold text-sm mb-2">Personal Statement</h4>
                <div className="p-4 rounded-lg bg-muted/20 border text-sm leading-relaxed whitespace-pre-wrap">
                  {application.essay}
                </div>
              </section>
              <Separator />
              <section>
                <h3 className="text-lg font-semibold mb-4">Uploaded Documents</h3>
                <div className="grid grid-cols-2 gap-2">
                  {application.transcripts && <Button variant="outline" className="justify-start" asChild><Link href={application.transcripts as string} target="_blank"><FileText className="h-4 w-4 mr-2" /> Transcript</Link></Button>}
                  {application.resume && <Button variant="outline" className="justify-start" asChild><Link href={application.resume as string} target="_blank"><FileText className="h-4 w-4 mr-2" /> Resume</Link></Button>}
                </div>
              </section>
            </div>
          </ScrollArea>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6 min-h-0">
          <Card className={`flex flex-col min-h-0 shadow-lg ${isReadOnly ? 'border-green-200' : 'border-primary/20'}`}>
            <CardHeader className="bg-primary/5 border-b py-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg flex items-center gap-2"><Calculator className="h-5 w-5" /> Scoring Rubric</CardTitle>
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Persistence Enabled</span>
                </div>
              </div>
              <Progress value={scorePercentage} className="h-1.5 mt-2" />
            </CardHeader>
            
            <CardContent className="flex-1 overflow-y-auto space-y-6 p-6">
              {aiAnalysis && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-bold uppercase text-primary flex items-center gap-1.5">AI Fit Analysis</h4>
                    <Badge variant="secondary" className="font-mono">{aiAnalysis.fitScore}% Match</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground italic leading-relaxed mb-2">"{aiAnalysis.justification}"</p>
                </div>
              )}

              {criteria.map((item) => (
                <div key={item.key} className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <div>
                      <Label className="text-sm font-bold">{item.label}</Label>
                      <span className="text-[10px] font-bold text-primary ml-2 bg-primary/10 px-1 rounded">Weight: {item.weight}</span>
                    </div>
                    <Badge variant="outline" className="font-mono">{(scores as any)[item.key]} / 5</Badge>
                  </div>
                  <Slider 
                    value={[(scores as any)[item.key]]} max={5} min={1} step={1} 
                    onValueChange={(val) => !isReadOnly && setScores({ ...scores, [item.key]: val[0] })}
                    disabled={isReadOnly}
                  />
                  <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                </div>
              ))}
              
              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Discuss with Committee</Label>
                  <Switch checked={markForDiscussion} onCheckedChange={setMarkForDiscussion} disabled={isReadOnly} />
                </div>
                <Textarea 
                  placeholder="Reviewer rationale and notes..." 
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
                  <Button variant="outline" className="flex-1" onClick={() => handleSubmitReview(true)} disabled={isSubmitting}>Save Progress</Button>
                  <Button className="flex-1 font-bold" onClick={() => handleSubmitReview(false)} disabled={isSubmitting}>Submit Evaluation</Button>
                </>
              ) : (
                <div className="w-full flex items-center justify-center py-2 text-xs text-muted-foreground italic gap-2 bg-muted/50 rounded-md">
                   <Lock className="h-3 w-3" /> Evaluation Finalized
                </div>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
