
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
import { FileUp } from 'lucide-react';

export default function ProfilePage() {
  return (
    <div className="space-y-8">
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
              <CardDescription>This information will be used to match you with scholarships.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" defaultValue="Jane Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue="jane.doe@example.com" disabled />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="gpa">GPA</Label>
                  <Input id="gpa" type="number" step="0.1" placeholder="e.g., 3.8" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="major">Intended Major</Label>
                  <Input id="major" placeholder="e.g., Computer Science" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="interests">Interests & Hobbies</Label>
                <Textarea id="interests" placeholder="e.g., Coding, volunteering, hiking" />
                <p className="text-xs text-muted-foreground">Separate interests with commas.</p>
              </div>
               <div className="space-y-2">
                <Label htmlFor="essay">Personal Essay</Label>
                <Textarea id="essay" rows={8} placeholder="Tell us about yourself, your goals, and your achievements..." />
              </div>
              <div className="flex justify-end">
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>My Documents</CardTitle>
               <CardDescription>Upload your required documents here.</CardDescription>
            </CardContent>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="transcripts">Transcripts</Label>
                <div className="flex items-center gap-2">
                  <Input id="transcripts" type="file" accept=".pdf,.doc,.docx" />
                  <Button variant="outline" size="icon"><FileUp className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">Upload your academic transcripts (PDF, DOC, DOCX).</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="resume">Resume/CV</Label>
                <div className="flex items-center gap-2">
                  <Input id="resume" type="file" accept=".pdf,.doc,.docx" />
                  <Button variant="outline" size="icon"><FileUp className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-green-600">resume.pdf uploaded.</p>
              </div>
               <div className="space-y-2">
                <Label htmlFor="essayFile">Personal Essay Document</Label>
                <div className="flex items-center gap-2">
                  <Input id="essayFile" type="file" accept=".pdf,.doc,.docx" />
                   <Button variant="outline" size="icon"><FileUp className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">Upload your personal essay document (PDF, DOC, DOCX).</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
