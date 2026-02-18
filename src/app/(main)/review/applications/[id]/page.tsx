'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  UserCircle, 
  CheckCircle, 
  XCircle, 
  ExternalLink, 
  GraduationCap, 
  Trophy, 
  Users, 
  MessageSquare,
  ChevronLeft
} from 'lucide-react';
import { notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { Applicant } from '@/types/applicant';
import { useToast } from '@/hooks/use-toast';

export default function ApplicationReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const applicationRef = firestore ? doc(firestore, 'users', params.id) : null;
  const { data: application, isLoading } = useDoc<Applicant>(applicationRef);

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

  if (isLoading) {
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
    if (!applicationRef) return;
    setIsSubmitting(true);
    try {
      // In a real app, we'd save this to a 'reviews' collection. 
      // For this MVP, we'll mark the application as reviewed on the user doc.
      await updateDoc(applicationRef, {
        reviewStatus: 'Completed',
        lastReviewedAt: new Date().toISOString(),
        finalReviewComment: comment,
        totalScore: Object.values(scores).reduce((a, b) => a + b, 0)
      });

      toast({
        title: "Review Submitted",
        description: `Your evaluation for ${application.isBlind ? 'Applicant ' + application.id : application.name} has been recorded.`,
      });
      router.push('/review');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit review. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Reviewing: {application.isBlind ? `Applicant ${application.id.substring(0, 6)}` : application.name}
              {application.isBlind && <Badge variant="outline" className="ml-2 font-normal">Blind Review</Badge>}
            </h1>
            <p className="text-sm text-muted-foreground">ID: {application.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
            <Badge variant="secondary" className="px-3 py-1">GPA: {application.gpa.toFixed(2)}</Badge>
            <Badge variant="outline" className="px-3 py-1">{application.major}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 flex-1 min-h-0">
        {/* Left Column: Application Data */}
        <div className="lg:col-span-7 flex flex-col min-h-0 gap-6">
          <ScrollArea className="flex-1 rounded-xl border bg-card p-6 shadow-sm">
            <div className="space-y-8">
              {/* Profile Section */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <UserCircle className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Applicant Profile</h3>
                </div>
                <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="font-medium">{application.isBlind ? 'Redacted' : application.name}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">High School</Label>
                    <p className="font-medium">{application.school}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">GPA</Label>
                    <p className="font-medium">{application.gpa.toFixed(2)}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">SAT/ACT Score</Label>
                    <p className="font-medium">{application.satActScore || 'Not Provided'}</p>
                  </div>
                </div>
              </section>

              <Separator />

              {/* College Plans */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">College Choices</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { school: application.firstChoiceSchool, accepted: application.firstChoiceAccepted, rank: '1st' },
                    { school: application.secondChoiceSchool, accepted: application.secondChoiceAccepted, rank: '2nd' },
                    { school: application.thirdChoiceSchool, accepted: application.thirdChoiceAccepted, rank: '3rd' },
                  ].filter(c => c.school).map((choice, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{choice.rank} Choice</span>
                        <span className="text-sm font-semibold">{choice.school}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {choice.accepted ? (
                          <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" /> Accepted
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
                            <XCircle className="h-3 w-3 mr-1" /> Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <Separator />

              {/* Activities & Essay */}
              <section className="space-y-6">
                 <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Trophy className="h-4 w-4" /> Activities & Interests
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    {application.activities}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {application.interests?.split(',').map(interest => (
                      <Badge key={interest} variant="secondary" className="font-normal">{interest.trim()}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-2">Personal Essay</h4>
                  <div className="p-4 rounded-lg bg-muted/20 border text-sm leading-relaxed whitespace-pre-wrap">
                    {application.essay}
                  </div>
                </div>
              </section>

              <Separator />

              {/* Documents */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Uploaded Documents</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Resume', url: application.resume, icon: <FileText className="h-4 w-4" /> },
                    { label: 'Transcripts', url: application.transcripts, icon: <GraduationCap className="h-4 w-4" /> },
                    { label: 'Acceptance Letter', url: application.acceptanceLetter, icon: <CheckCircle className="h-4 w-4" /> },
                  ].filter(doc => doc.url).map((doc, i) => (
                    <Button key={i} variant="outline" className="justify-start h-12" asChild>
                      <Link href={doc.url as string} target="_blank" rel="noopener noreferrer">
                        {doc.icon}
                        <span className="ml-2 flex-1 text-left truncate">View {doc.label}</span>
                        <ExternalLink className="h-3 w-3 ml-2 text-muted-foreground" />
                      </Link>
                    </Button>
                  ))}
                </div>
              </section>
            </div>
          </ScrollArea>
        </div>

        {/* Right Column: Scoring & Rubric */}
        <div className="lg:col-span-5 flex flex-col gap-6 min-h-0">
          <Card className="flex flex-col min-h-0 border-primary/20 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle>Scoring Matrix</CardTitle>
              <CardDescription>Evaluate the candidate on a scale of 1-5.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-6 px-6">
              {[
                { key: 'gpa', label: 'Weighted GPA', desc: 'Strength of academic performance.' },
                { key: 'extracurriculars', label: 'Extra-Curriculars', desc: 'Depth and breadth of involvement.' },
                { key: 'volunteerism', label: 'Volunteerism', desc: 'Commitment to community service.' },
                { key: 'leadership', label: 'Leadership', desc: 'Evidence of leading teams or initiatives.' },
                { key: 'major', label: 'Major Alignment', desc: 'Passion for their chosen field of study.' },
                { key: 'other', label: 'Other Criteria', desc: 'Subjective overall impression.' },
              ].map((item) => (
                <div key={item.key} className="space-y-3">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <Label className="text-sm font-semibold">{item.label}</Label>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <span className="text-lg font-bold text-primary">{(scores as any)[item.key]}</span>
                  </div>
                  <Slider 
                    value={[(scores as any)[item.key]]} 
                    max={5} 
                    min={1} 
                    step={1} 
                    onValueChange={(val) => setScores({ ...scores, [item.key]: val[0] })}
                  />
                </div>
              ))}
              
              <Separator />

              <div className="space-y-3">
                <Label htmlFor="comments" className="font-semibold">Overall Assessment</Label>
                <Textarea 
                  id="comments" 
                  placeholder="Summarize your recommendation..." 
                  className="min-h-[120px] resize-none"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t p-6">
              <Button 
                className="w-full h-12 text-lg shadow-lg" 
                onClick={handleSubmitReview}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving Review...' : 'Submit Final Evaluation'}
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-muted bg-muted/10">
            <CardHeader className="py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> 
                Reviewer Collaboration
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-4 pb-4">
               <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">EC</div>
                  <div className="flex-1 space-y-1">
                    <p className="font-semibold text-xs">Dr. Emily Carter <span className="text-muted-foreground font-normal ml-2">2 days ago</span></p>
                    <p className="text-muted-foreground italic">"Strong alignment with our STEM scholarship goals. Technical skills are evident."</p>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
