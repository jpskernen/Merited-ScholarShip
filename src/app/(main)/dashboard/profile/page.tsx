
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

export default function ProfilePage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<Applicant>({
    resolver: zodResolver(ApplicantSchema),
  });

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
      } else if (typeof value === 'string' || typeof value === 'number') {
        formData.append(key, String(value));
      }
    }
    
    // Add a placeholder for id if it's not present, as our action expects it.
    if (!data.id) {
      formData.append('id', 'temp-id'); // Firestore will generate the real ID.
    }

    try {
      await saveApplicantData(formData);
      toast({
        title: 'Success!',
        description: 'Your profile has been saved successfully.',
      });
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
        <div className="lg:col-span-2">
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
                <Label htmlFor="school">School</Label>
                <Input id="school" {...register('school')} placeholder="e.g., Lake Travis High School" />
                {errors.school && <p className="text-xs text-destructive">{errors.school.message}</p>}
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
              <div className="flex justify-end">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
              </div>
            </CardContent>
          </Card>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
