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
import { 
  FileText, 
  UserCircle, 
  CheckCircle, 
  ExternalLink, 
  GraduationCap, 
  Trophy, 
  MessageSquare,
  ChevronLeft,
  Calculator,
  Lock,
  EyeOff
} from 'lucide-react';
import { notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import type { Applicant } from '@/types/applicant';
import { useToast } from '@/hooks/use-toast';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Determine if the review should be read-only
  const isReadOnly = !!existingReview;

  // Sync state with existing review if it exists
  useEffect(() => {
    if (existingReview) {
      if (existingReview.scores) setScores(existingReview.scores);
      if (existingReview.comment) setComment(existingReview.comment);
    }
  }, [existingReview]);

  // Auto-calculate totals
  const totalScore = useMemo(() => {
    return Object.values(scores).reduce((acc, curr) => acc + curr, 0);
  }, [scores]);

  const maxPossibleScore = Object.keys(scores).length * 5;
  const scorePercentage = (totalScore / maxPossibleScore) * 100;

  if (isLoading || isReviewLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-lg">Loading application data...</div>
      </div>
    );
  }

  if (!application) {
    notFound();
  }

  const handleSubmitReview = async () => {
    if (!firestore || !reviewer || !params.id || isReadOnly) return;
    setIsSubmitting(true);

    try {
      const reviewDocRef = doc(firestore, 'applications', params.id, 'reviews', reviewer.uid);
      
      await setDoc(reviewDocRef, {
        reviewerId: reviewer.uid,
        reviewerName: reviewer.displayName || 'Anonymous Reviewer',
        scores,
        totalScore,
        comment,
        date: new Date().toISOString(),
      }, { merge: true });

      toast({
        title: "Evaluation Submitted",
        description: `Scores saved for ${application.isBlind ? 'Applicant ' + params.id.substring(0, 6) : application.name}.`,
      });
      
      router.push('/review');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit review. Please check permissions.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const criteria = [
    { key: 'gpa', label: 'Academic Excellence', desc: 'Strength of transcripts and GPA.' },
    { key: 'extracurriculars', label: 'Involvement', desc: 'Depth of participation in activities.' },
    { key: 'volunteerism', label: 'Community Service', desc: 'Impact and consistency of volunteering.' },
    { key: 'leadership', label: 'Leadership', desc: 'Roles held and initiatives taken.' },
    { key: 'major', label: 'Major Alignment', desc: 'Fit for the intended field of study.' },
    { key: 'other', label: 'Overall Impression', desc: 'The "X-factor" and essay quality.' },
  ];

  const displayName = application.isBlind 
    ? `Applicant ${params.id.substring(0, 6)}` 
    : application.name;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Reviewing: {displayName}
              {application.isBlind && (
                <Badge variant="outline" className="ml-2 border-primary/30 bg-primary/5">
                  <EyeOff className="h-3 w-3 mr-1" /> Blind Review
                </Badge>
              )}
              {isReadOnly && (
                <Badge variant="secondary" className="ml-2 bg-green-500/10 text-green-600 border-green-200">
                  <Lock className="h-3 w-3 mr-1" /> Submitted
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">Application Reference: {params.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Candidate GPA</p>
              <p className="text-xl font-bold text-primary">{application.gpa.toFixed(2)}</p>
            </div>
            <Separator orientation="vertical" className="h-10 mx-2" />
            <Badge variant="secondary" className="px-4 py-1.5 text-sm">{application.major}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 flex-1 min-h-0">
        {/* Left Column: Applicant Data */}
        <div className="lg:col-span-7 flex flex-col min-h-0">
          <ScrollArea className="flex-1 rounded-xl border bg-card p-6 shadow-sm">
            <div className="space-y-8">
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <UserCircle className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Profile Summary</h3>
                </div>
                <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Candidate Identity</Label>
                    <p className="font-medium">{application.isBlind ? '[REDACTED FOR ANONYMITY]' : application.name}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">High School</Label>
                    <p className="font-medium">{application.school}</p>
                  </div>
                </div>
              </section>

              <Separator />

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">University Choices</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { school: application.firstChoiceSchool, accepted: application.firstChoiceAccepted, rank: '1st' },
                    { school: application.secondChoiceSchool, accepted: application.secondChoiceAccepted, rank: '2nd' },
                    { school: application.thirdChoiceSchool, accepted: application.thirdChoiceAccepted, rank: '3rd' },
                  ].filter(c => c.school).map((choice, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground font-bold uppercase">{choice.rank} Choice</span>
                        <span className="text-sm font-semibold">{choice.school}</span>
                      </div>
                      {choice.accepted && (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" /> Accepted
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <Separator />

              <section className="space-y-6">
                 <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Trophy className="h-4 w-4" /> Activities & Accomplishments
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {application.activities}
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-2">Personal Statement</h4>
                  <div className="p-5 rounded-lg bg-muted/10 border text-sm leading-relaxed whitespace-pre-wrap italic text-muted-foreground">
                    "{application.essay}"
                  </div>
                </div>
              </section>

              <Separator />

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Supporting Documentation</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: 'Transcript', url: application.transcripts },
                    { label: 'Resume', url: application.resume },
                    { label: 'Acceptance Letter', url: application.acceptanceLetter },
                  ].filter(doc => doc.url).map((doc, i) => (
                    <Button key={i} variant="outline" className="justify-between" asChild>
                      <Link href={doc.url as string} target="_blank" rel="noopener noreferrer">
                        <span className="truncate">{doc.label}</span>
                        <ExternalLink className="h-4 w-4 ml-2 opacity-50" />
                      </Link>
                    </Button>
                  ))}
                </div>
              </section>
            </div>
          </ScrollArea>
        </div>

        {/* Right Column: Scoring Workspace */}
        <div className="lg:col-span-5 flex flex-col gap-6 min-h-0">
          <Card className={`flex flex-col min-h-0 shadow-lg ${isReadOnly ? 'border-green-200 opacity-95' : 'border-primary/20'}`}>
            <CardHeader className={`${isReadOnly ? 'bg-green-500/5' : 'bg-primary/5'} border-b py-4`}>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calculator className="h-5 w-5" /> Scoring Rubric
                  </CardTitle>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Live Total</p>
                  <p className="text-2xl font-black text-primary">{totalScore}<span className="text-sm text-muted-foreground font-normal"> / {maxPossibleScore}</span></p>
                </div>
              </div>
              <Progress value={scorePercentage} className="h-1.5 mt-2" />
            </CardHeader>
            
            <CardContent className="flex-1 overflow-y-auto space-y-7 p-6">
              {criteria.map((item) => (
                <div key={item.key} className="space-y-3">
                  <div className="flex justify-between items-baseline">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold">{item.label}</Label>
                      <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                    </div>
                    <Badge variant="outline" className="text-sm font-mono bg-background">
                      {(scores as any)[item.key]} / 5
                    </Badge>
                  </div>
                  <Slider 
                    value={[(scores as any)[item.key]]} 
                    max={5} 
                    min={1} 
                    step={1} 
                    onValueChange={(val) => !isReadOnly && setScores({ ...scores, [item.key]: val[0] })}
                    className={isReadOnly ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
                    disabled={isReadOnly}
                  />
                </div>
              ))}
              
              <Separator />

              <div className="space-y-3 pb-4">
                <Label htmlFor="comments" className="font-bold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Final Recommendation
                </Label>
                <Textarea 
                  id="comments" 
                  placeholder={isReadOnly ? "" : "Provide context for your scoring..."}
                  className="min-h-[100px] bg-muted/5 resize-none text-sm"
                  value={comment}
                  onChange={(e) => !isReadOnly && setComment(e.target.value)}
                  disabled={isReadOnly}
                  readOnly={isReadOnly}
                />
              </div>
            </CardContent>
            
            <CardFooter className="bg-muted/10 border-t p-6">
              {isReadOnly ? (
                <div className="w-full flex items-center justify-center py-2 text-sm text-muted-foreground italic gap-2 bg-muted/50 rounded-md">
                   <Lock className="h-4 w-4" /> This review is final and cannot be edited.
                </div>
              ) : (
                <Button 
                  className="w-full h-12 text-lg font-bold transition-all hover:scale-[1.02]" 
                  onClick={handleSubmitReview}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Recording Evaluation...' : 'Submit Final Score'}
                </Button>
              )}
            </CardFooter>
          </Card>

          <Card className="bg-accent/5 border-dashed">
            <CardContent className="pt-6">
               <div className="flex gap-4 items-start text-sm">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Calculator className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold">Reviewer Tip</p>
                    <p className="text-muted-foreground text-xs italic">
                      "Totals are auto-calculated. Aim for consistency across all assigned candidates to ensure a fair selection process."
                    </p>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
