'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, FileText, Search, User, CheckCircle, Clock, Users, ShieldCheck, Loader2 } from 'lucide-react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { Applicant } from '@/types/applicant';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export default function DashboardPage() {
  const { user, firestore } = useFirebase();
  const { toast } = useToast();
  const [isElevating, setIsElevating] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: profile, isLoading } = useDoc<Applicant>(userDocRef);

  // Calculate completion percentage based on core fields
  const calculateProgress = (data: Applicant | null) => {
    if (!data) return 0;
    const fields: (keyof Applicant)[] = ['name', 'address', 'gpa', 'major', 'school', 'essay', 'qualificationStatement', 'recommendationLetter1'];
    const completedFields = fields.filter(field => !!data[field]);
    return Math.round((completedFields.length / fields.length) * 100);
  };

  const progress = calculateProgress(profile);

  const isPeyton = user?.email === 'peyton.vandenbemden@gmail.com';
  const isAlreadyAdmin = profile?.role === 'Admin' || profile?.role === 'Sponsor';

  const handleElevate = async () => {
    if (!user || !firestore) return;
    setIsElevating(true);
    try {
      // Update primary user profile
      await setDoc(doc(firestore, 'users', user.uid), { 
        role: 'Admin',
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // Grant system-level privileges
      await setDoc(doc(firestore, 'roles_admin', user.uid), {
        id: user.uid,
        role: 'Admin',
        grantedAt: serverTimestamp()
      });

      toast({
        title: "Elevation Successful",
        description: "Your account now has administrator privileges. Please refresh to access the Admin Panel.",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Elevation Failed",
        description: "Could not grant privileges. Please try again or check console.",
        variant: "destructive",
      });
    } finally {
      setIsElevating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Applicant Dashboard</h1>
        <p className="text-muted-foreground">
          Hello {user?.displayName || 'Student'}, manage your scholarship application and track your status here.
        </p>
      </div>

      {isPeyton && !isAlreadyAdmin && (
        <Card className="border-amber-500 bg-amber-50/5 shadow-lg">
          <CardHeader>
            <CardTitle className="text-amber-600 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Authorized System Elevation
            </CardTitle>
            <CardDescription>
              Your account email is recognized. Click below to activate administrative privileges.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <Button 
               onClick={handleElevate} 
               disabled={isElevating}
               className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
             >
               {isElevating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
               {isElevating ? 'Granting Privileges...' : 'Elevate to System Admin'}
             </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className={progress === 100 ? 'border-green-500/50 bg-green-500/5' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              <span>Application Progress</span>
            </CardTitle>
            <CardDescription>
              {progress === 100 ? 'Your profile is ready for review!' : 'Complete your form to be eligible for awards.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>{progress}% Complete</span>
              {progress === 100 && <CheckCircle className="h-4 w-4 text-green-500" />}
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
          <CardFooter>
            <Button variant={progress === 100 ? 'outline' : 'default'} asChild className="w-full">
              <Link href="/dashboard/profile">
                {progress === 100 ? 'View Application' : 'Continue Application'} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="h-5 w-5 text-primary" />
              <span>Available Scholarships</span>
            </CardTitle>
            <CardDescription>
              New opportunities matching your academic profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <div className="flex items-baseline gap-2">
               <span className="text-4xl font-bold">22</span>
               <span className="text-sm text-muted-foreground">Programs</span>
             </div>
             <p className="mt-2 text-xs text-muted-foreground">Deadlines are approaching soon.</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" asChild className="w-full">
              <Link href="/dashboard/scholarships">
                Explore Programs <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              <span>Submission Status</span>
            </CardTitle>
            <CardDescription>
              Real-time updates from the selection committee.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-muted/50 p-3 text-sm font-medium">
              {progress < 50 ? 'Incomplete' : progress < 100 ? 'Draft Saved' : 'Pending Review'}
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" asChild className="w-full">
              <Link href="/dashboard/applications">
                Detailed Status <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Next Steps</CardTitle>
          <CardDescription>Items required before the application deadline.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
           <div className="flex items-start gap-3 rounded-lg border p-4">
             <div className="rounded-full bg-primary/10 p-2"><FileText className="h-4 w-4 text-primary" /></div>
             <div>
               <p className="font-semibold">Narrative Essays</p>
               <p className="text-xs text-muted-foreground">Draft your personal statement early.</p>
             </div>
           </div>
           <div className="flex items-start gap-3 rounded-lg border p-4">
             <div className="rounded-full bg-primary/10 p-2"><Users className="h-4 w-4 text-primary" /></div>
             <div>
               <p className="font-semibold">Recommendations</p>
               <p className="text-xs text-muted-foreground">Ask two teachers for letters early.</p>
             </div>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}