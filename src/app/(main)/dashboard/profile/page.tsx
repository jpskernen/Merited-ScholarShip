
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
import { FileUp } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { saveApplicantData } from './actions';
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

export default function ProfilePage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<Applicant>({
    resolver: zodResolver(ApplicantSchema.partial()),
  });
  
  const firstChoiceAccepted = watch('firstChoiceAccepted');
  const secondChoiceAccepted = watch('secondChoiceAccepted');
  const thirdChoiceAccepted = watch('thirdChoiceAccepted');
  const fourthChoiceAccepted = watch('fourthChoiceAccepted');
  const fifthChoiceAccepted = watch('fifthChoiceAccepted');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, files } = e.target;
    if (files && files.length > 0) {
      setValue(name as keyof Applicant, files[0] as unknown as string);
    }
  };

  const onSubmit = async (data: Applicant) => {
    setIsSaving(true);
    const formData = new FormData();

    // Convert the data object to FormData
    for (const key in data) {
      const value = data[key as keyof Applicant];
       if (value instanceof File) {
        formData.append(key, value);
      } else if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    }
    
    // Add a placeholder for id if it's not present, as our action expects it.
    if (!data.id) {
      formData.append('id', 'temp-id'); // Firestore will generate the real ID.
    }

    try {
      const result = await saveApplicantData(formData);
      if (result.success) {
        toast({
            title: 'Success!',
            description: 'Your profile has been saved successfully.',
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'There was an error saving your profile.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
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
                  <Input id="name" {...register('name')} defaultValue="Jane Doe" />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    defaultValue="jane.doe@example.com"
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
                    step="0.1"
                    {...register('gpa', { valueAsNumber: true })}
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
                    <div className="flex items-center space-x-2">
                        <Switch id="fourthChoiceAccepted" {...register('fourthChoiceAccepted')} onCheckedChange={(checked) => setValue('fourthChoiceAccepted', checked)} />
                        <Label htmlFor="fourthChoiceAccepted">I have been accepted</Label>
                    </div>
                </div>
                 <div className="space-y-4">
                    <Label className="text-base">Other Education / School</Label>
                    <div className="space-y-2">
                        <Label htmlFor="fifthChoiceSchool">School Name</Label>
                        <Input id="fifthChoiceSchool" {...register('fifthChoiceSchool')} placeholder="e.g., Online Program, Certification"/>
                        {errors.fifthChoiceSchool && <p className="text-xs text-destructive">{errors.fifthChoiceSchool.message}</p>}
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="fifthChoiceAccepted" {...register('fifthChoiceAccepted')} onCheckedChange={(checked) => setValue('fifthChoiceAccepted', checked)} />
                        <Label htmlFor="fifthChoiceAccepted">I have been accepted</Label>
                    </div>
                </div>
            </CardContent>
          </Card>
           <div className="flex justify-end">
                <Button type="submit" disabled={isSaving}>
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
                <div className="flex items-center gap-2">
                  <Input id="transcripts" type="file" name="transcripts" accept=".pdf,.doc,.docx" onChange={handleFileChange} />
                  <Button variant="outline" size="icon" type="button">
                    <FileUp className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload your academic transcripts (PDF, DOC, DOCX).
                </p>
                 {errors.transcripts && <p className="text-xs text-destructive">{typeof errors.transcripts.message === 'string' ? errors.transcripts.message : 'Invalid file'}</p>}

              </div>
              <div className="space-y-2">
                <Label htmlFor="resume">Resume/CV</Label>
                <div className="flex items-center gap-2">
                  <Input id="resume" type="file" name="resume" accept=".pdf,.doc,.docx" onChange={handleFileChange} />
                  <Button variant="outline" size="icon" type="button">
                    <FileUp className="h-4 w-4" />
                  </Button>
                </div>
                 {errors.resume && <p className="text-xs text-destructive">{typeof errors.resume.message === 'string' ? errors.resume.message : 'Invalid file'}</p>}
              </div>
               <div className="space-y-2">
                <Label htmlFor="acceptanceLetter">Acceptance Letter</Label>
                <div className="flex items-center gap-2">
                  <Input id="acceptanceLetter" type="file" name="acceptanceLetter" accept=".pdf,.doc,.docx" onChange={handleFileChange} />
                  <Button variant="outline" size="icon" type="button">
                    <FileUp className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  If accepted, upload your letter here.
                </p>
                 {errors.acceptanceLetter && <p className="text-xs text-destructive">{typeof errors.acceptanceLetter.message === 'string' ? errors.acceptanceLetter.message : 'Invalid file'}</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
