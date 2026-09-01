'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { AppLogo } from '@/components/shared/AppLogo';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle, Heart, Search, ArrowRight, Loader2, AlertCircle, LayoutDashboard } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Scholarship } from '@/types/scholarship';
import scholarshipsData from '@/data/scholarships.json';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { firestore, areServicesAvailable } = useFirebase();
  const { user, role, isUserLoading } = useUser();

  useEffect(() => {
    setMounted(true);
  }, []);

  const showConfigWarning = useMemo(() => {
    if (!mounted) return false;
    
    // Only show the warning in development mode, never in production.
    if (process.env.NODE_ENV !== 'production') {
       // Check for required environment variables.
      const requiredVars = [
        process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      ];
      const allVarsPresent = requiredVars.every(v => !!v && !v.includes('your_'));
      if (allVarsPresent && areServicesAvailable) return false;
      return true;
    }
    return false;
  }, [mounted, areServicesAvailable]);

  const scholarshipsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'programs');
  }, [firestore]);

  const { data: dbScholarships, isLoading } = useCollection<Scholarship>(scholarshipsQuery);

  const scholarships = useMemo(() => {
    if (!mounted) return [];
    if (dbScholarships && dbScholarships.length > 0) return dbScholarships;
    return scholarshipsData;
  }, [dbScholarships, mounted]);

  const dashboardLink = useMemo(() => {
    if (!user) return '/login';
    const r = role?.toLowerCase();
    if (r === 'admin') return '/admin';
    if (r === 'reviewer') return '/reviewer/dashboard';
    return '/dashboard';
  }, [user, role]);

  const features = [
    {
      icon: <Search className="h-10 w-10 text-primary" />,
      title: 'View Opportunities',
      description: 'Browse and learn about available scholarships matching your profile.',
      href: '#scholarships'
    },
    {
      icon: <FileText className="h-10 w-10 text-primary" />,
      title: 'Simple Application',
      description: 'Easily upload your transcripts, resumes, and essays to a single secure platform.',
      href: '/signup'
    },
    {
      icon: <CheckCircle className="h-10 w-10 text-primary" />,
      title: 'Real-time Tracking',
      description: 'Stay updated with notifications and track your application status as it moves through review.',
      href: '/login'
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground font-sans">
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <AppLogo />
          <nav className="flex items-center space-x-4">
            {mounted && !isUserLoading && user ? (
              <Button asChild variant="outline" className="font-bold">
                <Link href={dashboardLink}><LayoutDashboard className="mr-2 h-4 w-4" /> My Portal</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/login">Log In</Link>
                </Button>
                <Button asChild>
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {showConfigWarning && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 py-2">
            <div className="container mx-auto px-4 flex items-center gap-2 text-amber-600 text-xs font-medium">
              <AlertCircle className="h-4 w-4" />
              <span>Firebase setup pending in developer workspace. Some cloud features simulated.</span>
            </div>
          </div>
        )}

        <section className="bg-secondary/20 py-20 md:py-32">
          <div className="container mx-auto px-4 text-center md:px-6">
            <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl text-foreground">
              Your Journey to Excellence Starts Here
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
              Apply for scholarships, track your progress, and connect with academic opportunities designed to fuel your future.
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <Button size="lg" asChild className="rounded-full px-8">
                <Link href="#scholarships">Browse Scholarships</Link>
              </Button>
              {mounted && user ? (
                <Button size="lg" variant="outline" asChild className="rounded-full px-8">
                  <Link href={dashboardLink}>Open Dashboard</Link>
                </Button>
              ) : (
                <Button size="lg" variant="outline" asChild className="rounded-full px-8">
                  <Link href="/signup">Create Student Profile</Link>
                </Button>
              )}
            </div>
          </div>
        </section>

        <section id="scholarships" className="py-20 md:py-24 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                Current Scholarship Programs
              </h2>
              <p className="mt-2 text-muted-foreground">
                Explore active awards and institutional program details.
              </p>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {scholarships?.slice(0, 6).map((scholarship) => (
                  <Card key={scholarship.id} className="flex flex-col border-primary/10 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                    <CardHeader>
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-xl leading-tight">{scholarship.name}</CardTitle>
                        </div>
                        <Badge variant="secondary" className="whitespace-nowrap bg-primary/10 text-primary border-none">{scholarship.amount}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-3 leading-relaxed">
                        {scholarship.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(scholarship.tags) && scholarship.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-[10px] uppercase tracking-widest px-2 py-0 font-bold">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between items-center border-t pt-4">
                      <div className="text-xs text-muted-foreground">
                        <p className="font-black text-foreground uppercase tracking-tighter">Deadline</p>
                        <p>{scholarship.deadline}</p>
                      </div>
                      <Button asChild size="sm" variant="ghost" className="text-primary font-bold hover:bg-primary/5">
                        <Link href={mounted && user ? dashboardLink : '/signup'}>
                          Apply <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}

            <div className="mt-12 text-center">
              <Button variant="outline" size="lg" asChild className="rounded-full font-bold px-10">
                <Link href={mounted && user ? dashboardLink : '/signup'}>View All Opportunities</Link>
              </Button>
            </div>
          </div>
        </section>

        <section id="features" className="py-20 md:py-24 bg-secondary/10">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                How it Works
              </h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                Our platform streamlines the connection between ambitious students and the funding they need to succeed.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <Card key={index} className="border-none shadow-none bg-transparent h-full">
                  <CardHeader className="items-center pb-2">
                    <div className="p-3 bg-primary/10 rounded-2xl mb-4">
                      {feature.icon}
                    </div>
                  </CardHeader>
                  <CardContent className="text-center">
                    <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card">
        <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-4 py-10 sm:flex-row md:px-6">
          <div className="flex flex-col items-center sm:items-start gap-2">
            <AppLogo />
            <p className="text-xs text-muted-foreground">
              Empowering students through academic opportunities.
            </p>
          </div>
          <p className="text-sm text-muted-foreground order-last sm:order-none">
            &copy; {mounted ? new Date().getFullYear() : ''} ScholarShip. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-6 sm:justify-end">
            <Link href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Terms
            </Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Privacy
            </Link>
            <Link href="/review/login" className="text-sm font-semibold text-primary hover:underline">
              Committee Portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
