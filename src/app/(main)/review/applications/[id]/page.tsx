
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { FileText, UserCircle, CheckCircle, XCircle } from 'lucide-react';
import { getApplicant } from '@/lib/applicants';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function ApplicationReviewPage({ params }: { params: { id: string } }) {
  const application = await getApplicant(params.id);

  if (!application) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Review Application: {application.id}</h1>
        <p className="text-muted-foreground">
          Applicant: <span className="font-semibold">{application.isBlind ? 'Name Hidden for Review' : application.name}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserCircle className="h-5 w-5" /> Applicant Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="font-semibold">Name:</span> {application.isBlind ? 'Hidden' : application.name}</div>
                    <div><span className="font-semibold">GPA:</span> {application.gpa}</div>
                    <div><span className="font-semibold">Major:</span> {application.major}</div>
                    <div><span className="font-semibold">High School:</span> {application.school}</div>
                    <div><span className="font-semibold">SAT/ACT Score:</span> {application.satActScore || 'Not Provided'}</div>
                </div>
                <Separator/>
                 <div>
                    <h4 className="font-semibold mb-2">College Choices</h4>
                    <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex items-center justify-between">
                            <span>1st Choice: {application.firstChoiceSchool || 'N/A'}</span>
                            {application.firstChoiceAccepted ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                        </div>
                        <div className="flex items-center justify-between">
                            <span>2nd Choice: {application.secondChoiceSchool || 'N/A'}</span>
                            {application.secondChoiceAccepted ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                        </div>
                         <div className="flex items-center justify-between">
                            <span>3rd Choice: {application.thirdChoiceSchool || 'N/A'}</span>
                            {application.thirdChoiceAccepted ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                        </div>
                         <div className="flex items-center justify-between">
                            <span>4th Choice: {application.fourthChoiceSchool || 'N/A'}</span>
                            {application.fourthChoiceAccepted ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                        </div>
                         <div className="flex items-center justify-between">
                            <span>5th Choice: {application.fifthChoiceSchool || 'N/A'}</span>
                            {application.fifthChoiceAccepted ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                        </div>
                    </div>
                </div>
                <Separator/>
                <h4 className="font-semibold">Personal Essay</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{application.essay}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Documents</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
                {application.resume && (
                  <Button variant="secondary" asChild>
                    <Link href={application.resume} target="_blank" rel="noopener noreferrer">View Resume</Link>
                  </Button>
                )}
                {application.transcripts && (
                  <Button variant="secondary" asChild>
                     <Link href={application.transcripts} target="_blank" rel="noopener noreferrer">View Transcripts</Link>
                  </Button>
                )}
                {application.acceptanceLetter && (
                  <Button variant="secondary" asChild>
                     <Link href={application.acceptanceLetter} target="_blank" rel="noopener noreferrer">View Acceptance Letter</Link>
                  </Button>
                )}
            </CardContent>
          </Card>

        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Scoring Matrix</CardTitle>
              <CardDescription>Use the sliders to score the applicant from 1 (OK) to 5 (Exceptional).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label htmlFor="score-gpa">Weighted GPA: 3</Label>
                <Slider id="score-gpa" defaultValue={[3]} max={5} min={1} step={1} />
              </div>
              <div className="space-y-4">
                <Label htmlFor="score-extracurriculars">Extra-Curriculars: 4</Label>
                <Slider id="score-extracurriculars" defaultValue={[4]} max={5} min={1} step={1} />
              </div>
               <div className="space-y-4">
                <Label htmlFor="score-volunteerism">Volunteerism: 5</Label>
                <Slider id="score-volunteerism" defaultValue={[5]} max={5} min={1} step={1} />
              </div>
               <div className="space-y-4">
                <Label htmlFor="score-leadership">Leadership: 4</Label>
                <Slider id="score-leadership" defaultValue={[4]} max={5} min={1} step={1} />
              </div>
              <div className="space-y-4">
                <Label htmlFor="score-major">College Major / Area of Study: 3</Label>
                <Slider id="score-major" defaultValue={[3]} max={5} min={1} step={1} />
              </div>
               <div className="space-y-4">
                <Label htmlFor="score-other">Other: 3</Label>
                <Slider id="score-other" defaultValue={[3]} max={5} min={1} step={1} />
              </div>
              <Separator />
               <div className="space-y-2">
                <Label htmlFor="comments">Reviewer Comments</Label>
                <Textarea id="comments" rows={6} placeholder="Provide your overall assessment..." />
              </div>
              <Button className="w-full bg-accent hover:bg-accent/90">Submit Review</Button>
            </CardContent>
          </Card>
          
          <Card>
             <CardHeader>
              <CardTitle>Collaboration</CardTitle>
              <CardDescription>Comments from other reviewers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
                <div className="p-3 bg-secondary rounded-lg">
                    <p className="font-semibold">Dr. Emily Carter</p>
                    <p className="text-muted-foreground">"Impressive technical skills and a clear passion for community impact. A strong candidate."</p>
                </div>
                <div className="p-3 bg-secondary rounded-lg">
                    <p className="font-semibold">Prof. Ben Adams</p>
                    <p className="text-muted-foreground">"The essay is well-written, though it could benefit from more specific examples of challenges faced. Overall, very promising."</p>
                </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
