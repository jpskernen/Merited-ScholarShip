
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
import { useDoc, useFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export default function ProfilePage() {
  const { toast } = useToast();
  const { user, isUserLoading, firestore } = useFirebase();
  const [isSaving, setIsSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Fetch existing applicant data
  const userDocRef = user && firestore ? doc(firestore, 'users', user.uid) : null;
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
      gpa: 0,
      major: '',
      school: '',
      interests: '',
      activities: '',
      essay: '',
      firstChoiceSchool: '',
      firstChoiceAccepted: false,
    }
  });
  
  // Pre-fill form with user and applicant data
  useEffect(() => {
    if (user && !isUserLoading) {
      // Basic user info from auth
      if (!applicantData?.email) setValue('email', user.email || '');
      if (!applicantData?.name) setValue('name', user.displayName || '');
    }
    if (applicantData) {
        // Pre-fill the form with data from Firestore
        reset(applicantData);
    }
  }, [user, applicantData, isUserLoading, setValue, reset]);


  const onSubmit = async () => {
    if (!user) {
        toast({ title: 'Error', description: 'You must be logged in to save your profile.', variant: 'destructive' });
        return;
    }
    if (!formRef.current) return;

    setIsSaving(true);
    const formData = new FormData(formRef.current);

    try {
      const result = await saveApplicantData(user.uid, formData);
      if (result.success) {
        toast({
            title: 'Success!',
            description: 'Your profile has been saved successfully.',
        });
      } else {
         console.error('Save failed:', result.error, result.issues);
        throw new Error(result.error || 'Failed to save profile.');
      }
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'There was an error saving your profile.';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  if (isUserLoading || isApplicantDataLoading) {
    return <div>Loading profile...</div>;
  }

  // Watch for file changes to provide feedback (optional)
  const resumeFile = watch('resume');
  const transcriptFile = watch('transcripts');
  const acceptanceLetterFile = watch('acceptanceLetter');

  const getFileLabel = (file: any, existingUrl?: string | File) => {
    if (file instanceof FileList && file.length > 0) return file[0].name;
    if (typeof existingUrl === 'string' && existingUrl) return "File already uploaded";
    return "";
  };


  return (
    <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
      <div>
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="text-muted-foreground">
          Keep your information up to date for the best scholarship matches.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                This information will be used to match you with scholarships.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" {...register('name')} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    readOnly // Email should not be editable
                  />
                   {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="gpa">GPA</Label>
                  <Input
                    id="gpa"
                    type="number"
                    step="0.01"
                    {...register('gpa')}
                    placeholder="e.g., 3.8"
                  />
                   {errors.gpa && <p className="text-xs text-destructive">{errors.gpa.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="major">Intended Major</Label>
                  <Input id="major" {...register('major')} placeholder="e.g., Computer Science" />
                  {errors.major && <p className="text-xs text-destructive">{errors.major.message}</p>}
                </div>
              </div>
               <div className="space-y-2">
                <Label htmlFor="school">High School</Label>
                <Input id="school" {...register('school')} placeholder="e.g., Lake Travis High School" />
                {errors.school && <p className="text-xs text-destructive">{errors.school.message}</p>}
              </div>
              <div className="space-y-2">
                  <Label htmlFor="satActScore">SAT/ACT Score (Optional)</Label>
                  <Input id="satActScore" {...register('satActScore')} placeholder="e.g., 1400 or 32" />
                  {errors.satActScore && <p className="text-xs text-destructive">{errors.satActScore.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="activities">Activities</Label>
                <Textarea id="activities" {...register('activities')} placeholder="e.g., Soccer, Wrestling, NHS" />
                <p className="text-xs text-muted-foreground">Separate activities with commas.</p>
                {errors.activities && <p className="text-xs text-destructive">{errors.activities.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="interests">Interests & Hobbies</Label>
                <Textarea id="interests" {...register('interests')} placeholder="e.g., Coding, volunteering, hiking" />
                <p className="text-xs text-muted-foreground">
                  Separate interests with commas.
                </p>
                {errors.interests && <p className="text-xs text-destructive">{errors.interests.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="essay">Personal Essay</Label>
                <Textarea
                  id="essay"
                  {...register('essay')}
                  rows={8}
                  placeholder="Tell us about yourself, your goals, and your achievements..."
                />
                 {errors.essay && <p className="text-xs text-destructive">{errors.essay.message}</p>}
              </div>
              
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
                <CardTitle>College / University Plans</CardTitle>
                <CardDescription>
                    Let us know your top school choices.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <Label className="text-base">First Choice</Label>
                    <div className="space-y-2">
                        <Label htmlFor="firstChoiceSchool">School Name</Label>
                        <Input id="firstChoiceSchool" {...register('firstChoiceSchool')} placeholder="e.g., University of Texas at Austin"/>
                         {errors.firstChoiceSchool && <p className="text-xs text-destructive">{errors.firstChoiceSchool.message}</p>}
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="firstChoiceAccepted" {...register('firstChoiceAccepted')} onCheckedChange={(checked) => setValue('firstChoiceAccepted', checked)} />
                        <Label htmlFor="firstChoiceAccepted">I have been accepted</Label>
                    </div>
                </div>
                 <div className="space-y-4">
                    <Label className="text-base">Second Choice</Label>
                    <div className="space-y-2">
                        <Label htmlFor="secondChoiceSchool">School Name</Label>
                        <Input id="secondChoiceSchool" {...register('secondChoiceSchool')} placeholder="e.g., Texas A&M University"/>
                        {errors.secondChoiceSchool && <p className="text-xs text-destructive">{errors.secondChoiceSchool.message}</p>}
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="secondChoiceAccepted" {...register('secondChoiceAccepted')} onCheckedChange={(checked) => setValue('secondChoiceAccepted', checked)} />
                        <Label htmlFor="secondChoiceAccepted">I have been accepted</Label>
                    </div>
                </div>
                <Separator />
                 <div className="space-y-4">
                    <Label className="text-base">Third Choice</Label>
                    <div className="space-y-2">
                        <Label htmlFor="thirdChoiceSchool">School Name</Label>
                        <Input id="thirdChoiceSchool" {...register('thirdChoiceSchool')} placeholder="e.g., Texas Tech University"/>
                        {errors.thirdChoiceSchool && <p className="text-xs text-destructive">{errors.thirdChoiceSchool.message}</p>}
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="thirdChoiceAccepted" {...register('thirdChoiceAccepted')} onCheckedChange={(checked) => setValue('thirdChoiceAccepted', checked)} />
                        <Label htmlFor="thirdChoiceAccepted">I have been accepted</Label>
                    </div>
                </div>
                <Separator />
                 <div className="space-y-4">
                    <Label className="text-base">Other Education / School</Label>
                    <div className="space-y-2">
                        <Label htmlFor="fourthChoiceSchool">School Name</Label>
                        <Input id="fourthChoiceSchool" {...register('fourthChoiceSchool')} placeholder="e.g., Community College, Trade School"/>
                        {errors.fourthChoiceSchool && <p className="text-xs text-destructive">{errors.fourthChoiceSchool.message}</p>}
                    </div>
                </div>
                 <div className="space-y-4">
                    <Label className="text-base">Other Education / School</Label>
                    <div className="space-y-2">
                        <Label htmlFor="fifthChoiceSchool">School Name</Label>
                        <Input id="fifthChoiceSchool" {...register('fifthChoiceSchool')} placeholder="e.g., Online Program, Certification"/>
                        {errors.fifthChoiceSchool && <p className="text-xs text-destructive">{errors.fifthChoiceSchool.message}</p>}
                    </div>
                </div>
            </CardContent>
          </Card>
           <div className="flex justify-end">
                <Button type="submit" disabled={isSaving || isUserLoading}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>My Documents</CardTitle>
              <CardDescription>
                Upload your required documents here.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="transcripts">Transcripts</Label>
                <Input 
                  id="transcripts"
                  type="file" 
                  accept=".pdf,.doc,.docx"
                  {...register('transcripts')}
                />
                {applicantData?.transcripts && !errors.transcripts && <p className="text-xs text-muted-foreground">Current file: <a href={applicantData.transcripts as string} target="_blank" rel="noopener noreferrer" className="underline">View Transcript</a></p>}
                {errors.transcripts && <p className="text-xs text-destructive">{errors.transcripts.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="resume">Resume/CV</Label>
                <Input 
                  id="resume"
                  type="file" 
                  accept=".pdf,.doc,.docx" 
                  {...register('resume')}
                />
                 {applicantData?.resume && !errors.resume && <p className="text-xs text-muted-foreground">Current file: <a href={applicantData.resume as string} target="_blank" rel="noopener noreferrer" className="underline">View Resume</a></p>}
                 {errors.resume && <p className="text-xs text-destructive">{errors.resume.message}</p>}
              </div>

               <div className="space-y-2">
                <Label htmlFor="acceptanceLetter">Acceptance Letter</Label>
                 <Input 
                  id="acceptanceLetter"
                  type="file" 
                  accept=".pdf,.doc,.docx" 
                  {...register('acceptanceLetter')}
                />
                <p className="text-xs text-muted-foreground">
                  If accepted, upload your letter here.
                </p>
                 {applicantData?.acceptanceLetter && !errors.acceptanceLetter && <p className="text-xs text-muted-foreground">Current file: <a href={applicantData.acceptanceLetter as string} target="_blank" rel="noopener noreferrer" className="underline">View Letter</a></p>}
                 {errors.acceptanceLetter && <p className="text-xs text-destructive">{errors.acceptanceLetter.message}</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
