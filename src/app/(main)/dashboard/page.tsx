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
import { ArrowRight, FileText, Search, User, Clock, Users, ShieldCheck, Loader2 } from 'lucide-react';
import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, query, where } from 'firebase/firestore';
import type { Applicant } from '@/types/applicant';
import { useToast } from '@/hooks/use-toast';
import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Award } from 'lucide-react';

export default function DashboardPage() {
  const { user, firestore } = useFirebase();
  const { toast } = useToast();
  const [isElevating, setIsElevating] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: profile, isLoading } = useDoc<Applicant>(userDocRef);

  const myApplicationsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'applications'), where('studentId', '==', user.uid));
  }, [user, firestore]);

  const { data: myApplications } = useCollection(myApplicationsQuery);

  const programsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'programs');
  }, [firestore]);

  const { data: programs } = useCollection(programsQuery);

  // Every card below used to be derived from profile-field completeness or
  // hardcoded, so a student could be awarded and still be told "Pending
  // Review". These read the real per-application records instead.
  const summary = useMemo(() => {
    const all = myApplications || [];
    const countOf = (status: string) => all.filter((a: any) => a.status === status).length;
    return {
      total: all.length,
      drafts: countOf('Draft'),
      submitted: countOf('Submitted') + countOf('In Review'),
      awarded: all.filter((a: any) => a.status === 'Awarded'),
      notAwarded: countOf('Not Awarded'),
    };
  }, [myApplications]);

  const firstName = (user?.displayName || '').trim().split(' ')[0];

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

      {summary.awarded.length > 0 && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-green-600">
              <Award className="h-5 w-5" />
              {`Congratulations${firstName ? `, ${firstName}` : ''}! `}
              {summary.awarded.length === 1
                ? 'You’ve won a scholarship.'
                : `You’ve won ${summary.awarded.length} scholarships.`}
            </CardTitle>
            <CardDescription>
              {summary.awarded.length === 1
                ? 'The selection committee has chosen you for this award. We’ll email you with the next steps — keep an eye on your inbox.'
                : 'The selection committee has chosen you for these awards. We’ll email you with the next steps — keep an eye on your inbox.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {summary.awarded.length === 1 ? 'Your award:' : 'Your awards:'}
            </p>
            <div className="flex flex-wrap gap-2">
              {summary.awarded.map((application: any) => (
                <Badge key={application.id} className="bg-green-600 text-white border-none py-1.5 px-3 font-bold">
                  {application.scholarshipName || 'Scholarship'}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* flex-col + flex-1 on the content pushes every footer button to the
          bottom, so the three buttons line up despite uneven card content. */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              <span>My Applications</span>
            </CardTitle>
            <CardDescription>
              {summary.total === 0
                ? 'You have not applied to any scholarships yet.'
                : `${summary.total} application${summary.total === 1 ? '' : 's'} in total.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Drafts</span><span className="font-bold">{summary.drafts}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Awaiting decision</span><span className="font-bold">{summary.submitted}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Awarded</span><span className="font-bold text-green-600">{summary.awarded.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Not awarded</span><span className="font-bold">{summary.notAwarded}</span></div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" asChild className="w-full">
              <Link href="/dashboard/applications">
                View My Applications <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="h-5 w-5 text-primary" />
              <span>Available Scholarships</span>
            </CardTitle>
            <CardDescription>
              Programs you can apply to right now.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
             <div className="flex items-baseline gap-2">
               <span className="text-4xl font-bold">{programs?.length ?? 0}</span>
               <span className="text-sm text-muted-foreground">Programs</span>
             </div>
             <p className="mt-2 text-xs text-muted-foreground">You can apply to as many as you qualify for.</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" asChild className="w-full">
              <Link href="/dashboard/scholarships">
                Explore Programs <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              <span>Latest Status</span>
            </CardTitle>
            <CardDescription>
              Updates from the selection committee.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-2">
            {summary.total === 0 ? (
              <div className="rounded-md bg-muted/50 p-3 text-sm font-medium">No applications yet</div>
            ) : (
              (myApplications || []).slice(0, 3).map((application: any) => (
                <div key={application.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 p-3">
                  <span className="text-xs font-medium truncate">{application.scholarshipName || 'Scholarship'}</span>
                  <Badge variant="outline" className={
                    application.status === 'Awarded' ? 'bg-green-600 text-white border-none text-[10px] font-bold' :
                    application.status === 'Not Awarded' ? 'bg-red-50 text-red-700 border-red-200 text-[10px] font-bold' :
                    'text-[10px] font-bold'
                  }>
                    {application.status}
                  </Badge>
                </div>
              ))
            )}
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