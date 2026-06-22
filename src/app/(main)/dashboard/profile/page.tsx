
'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Applicant, ApplicantSchema } from '@/types/applicant';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { saveApplicantData } from './actions';
import { useEffect, useState, useRef } from 'react';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { CheckCircle, Send, Save } from 'lucide-react';

export default function ProfilePage() {
  const { toast } = useToast();
  const { user, isUserLoading, firestore } = useFirebase();
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: applicantData, isLoading: isApplicantDataLoading } = useDoc<Applicant>(userDocRef);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
    watch,
  } = useForm<Applicant>({
    resolver: zodResolver(ApplicantSchema),
    defaultValues: {
      name: '',
      email: '',
      secondaryEmail: '',
      address: '',
      gpa: 0,
      major: '',
      school: '',
      interests: '',
      activities: '',
      essay: '',
      qualificationStatement: '',
      firstChoiceSchool: '',
      firstChoiceAccepted: false,
    }
  });
  
  useEffect(() => {
    if (user && !isUserLoading) {
      if (!applicantData?.email) setValue('email', user.email || '');
      if (!applicantData?.name) setValue('name', user.displayName || '');
    }
    if (applicantData) {
        reset(applicantData);
    }
  }, [user, applicantData, isUserLoading, setValue, reset]);


  const onSave = async (submit: boolean = false) => {
    if (!user) {
        toast({ title: 'Error', description: 'You must be logged in to save your profile.', variant: 'destructive' });
        return;
    }
    if (!formRef.current) return;

    if (submit) setIsSubmitting(true);
    else setIsSaving(true);
    
    const formData = new FormData(formRef.current);

    try {
      const result = await saveApplicantData(user.uid, formData, submit);
      if (result.success) {
        toast({
            title: submit ? 'Application Submitted!' : 'Draft Saved',
            description: submit 
              ? 'Your scholarship portfolio has been sent to the committee.' 
              : 'Your progress has been saved securely.',
        });
      } else {
        throw new Error(result.error || 'Failed to process application.');
      }
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'There was an error processing your application.';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
      setIsSubmitting(false);
    }
  };
  
  if (isUserLoading || isApplicantDataLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-pulse text-muted-foreground font-medium">Loading Application Profile...</div>
      </div>
    );
  }

  const isAlreadySubmitted = applicantData?.status === 'Submitted' || applicantData?.status === 'In Review';

  return (
    <form ref={formRef} className="space-y-8" noValidate>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scholarship Application</h1>
          <p className="text-muted-foreground">
            {isAlreadySubmitted 
              ? 'Your application is finalized and under review.' 
              : 'Complete your profile to apply for active scholarship opportunities.'}
          </p>
        </div>
        {isAlreadySubmitted && (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-500 rounded-full text-sm font-bold border border-green-500/20">
            <CheckCircle className="h-4 w-4" /> Finalized & Submitted
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Contact & Personal Details</CardTitle>
              <CardDescription>
                Basic information required for all scholarship programs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" {...register('name')} disabled={isAlreadySubmitted} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Primary Email</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    readOnly
                  />
                   {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondaryEmail">Secondary Email (Optional)</Label>
                  <Input
                    id="secondaryEmail"
                    type="email"
                    {...register('secondaryEmail')}
                    placeholder="Personal or parent email"
                    disabled={isAlreadySubmitted}
                  />
                   {errors.secondaryEmail && <p className="text-xs text-destructive">{errors.secondaryEmail.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Physical Address</Label>
                <Textarea 
                  id="address" 
                  {...register('address')} 
                  placeholder="Street Address, City, State, ZIP"
                  className="min-h-[80px]"
                  disabled={isAlreadySubmitted}
                />
                {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Academic Profile</CardTitle>
              <CardDescription>
                Your school record and extracurricular achievements.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="gpa">GPA</Label>
                  <Input
                    id="gpa"
                    type="number"
                    step="0.01"
                    {...register('gpa')}
                    disabled={isAlreadySubmitted}
                  />
                   {errors.gpa && <p className="text-xs text-destructive">{errors.gpa.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="major">Intended Major</Label>
                  <Input id="major" {...register('major')} disabled={isAlreadySubmitted} />
                  {errors.major && <p className="text-xs text-destructive">{errors.major.message}</p>}
                </div>
              </div>
               <div className="space-y-2">
                <Label htmlFor="school">Current High School</Label>
                <Input id="school" {...register('school')} disabled={isAlreadySubmitted} />
                {errors.school && <p className="text-xs text-destructive">{errors.school.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="activities">Activities & Leadership</Label>
                <Textarea id="activities" {...register('activities')} placeholder="Clubs, sports, volunteering..." disabled={isAlreadySubmitted} />
                {errors.activities && <p className="text-xs text-destructive">{errors.activities.message}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Application Essays</CardTitle>
              <CardDescription>
                Demonstrate your qualifications and shared values.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="qualificationStatement">Why are you qualified for this scholarship?</Label>
                <Textarea
                  id="qualificationStatement"
                  {...register('qualificationStatement')}
                  rows={6}
                  placeholder="Explain how you meet specific criteria and why the committee should select you..."
                  disabled={isAlreadySubmitted}
                />
                 {errors.qualificationStatement && <p className="text-xs text-destructive">{errors.qualificationStatement.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="essay">Personal Statement / General Essay</Label>
                <Textarea
                  id="essay"
                  {...register('essay')}
                  rows={10}
                  placeholder="Tell us about your background, achievements, and future goals..."
                  disabled={isAlreadySubmitted}
                />
                 {errors.essay && <p className="text-xs text-destructive">{errors.essay.message}</p>}
              </div>
            </CardContent>
          </Card>

          {!isAlreadySubmitted && (
            <div className="flex flex-col sm:flex-row gap-4 justify-end">
              <Button type="button" variant="outline" size="lg" onClick={() => onSave(false)} disabled={isSaving || isSubmitting}>
                <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button type="button" size="lg" className="bg-primary hover:bg-primary/90 font-bold" onClick={() => onSave(true)} disabled={isSaving || isSubmitting}>
                <Send className="mr-2 h-4 w-4" /> {isSubmitting ? 'Submitting...' : 'Finalize & Submit Application'}
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-8">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Supporting Documents</CardTitle>
              <CardDescription>
                Upload required PDF or Word documents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="transcripts">Official Transcripts</Label>
                <Input id="transcripts" type="file" accept=".pdf,.doc,.docx" {...register('transcripts')} disabled={isAlreadySubmitted} />
                {applicantData?.transcripts && <p className="text-[10px] text-muted-foreground">Current: <a href={applicantData.transcripts as string} target="_blank" className="underline">View Transcript</a></p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="resume">Resume / CV</Label>
                <Input id="resume" type="file" accept=".pdf,.doc,.docx" {...register('resume')} disabled={isAlreadySubmitted} />
                {applicantData?.resume && <p className="text-[10px] text-muted-foreground">Current: <a href={applicantData.resume as string} target="_blank" className="underline">View Resume</a></p>}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="recommendationLetter1">Letter of Recommendation #1</Label>
                <Input id="recommendationLetter1" type="file" accept=".pdf,.doc,.docx" {...register('recommendationLetter1')} disabled={isAlreadySubmitted} />
                {applicantData?.recommendationLetter1 && <p className="text-[10px] text-muted-foreground">Current: <a href={applicantData.recommendationLetter1 as string} target="_blank" className="underline">View Letter 1</a></p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="recommendationLetter2">Letter of Recommendation #2</Label>
                <Input id="recommendationLetter2" type="file" accept=".pdf,.doc,.docx" {...register('recommendationLetter2')} disabled={isAlreadySubmitted} />
                {applicantData?.recommendationLetter2 && <p className="text-[10px] text-muted-foreground">Current: <a href={applicantData.recommendationLetter2 as string} target="_blank" className="underline">View Letter 2</a></p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
