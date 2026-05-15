
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
import { FileText, CheckCircle, Heart, Search, ArrowRight, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useCollection, initializeFirebase, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Scholarship } from '@/types/scholarship';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  
  // For landing page where hooks like useFirebase might not be ready, 
  // we initialize manually or handle null
  const [services, setServices] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    const s = initializeFirebase();
    setServices(s);
  }, []);

  const scholarshipsQuery = useMemoFirebase(() => {
    if (!services?.firestore) return null;
    return collection(services.firestore, 'programs');
  }, [services]);

  const { data: scholarships, isLoading } = useCollection<Scholarship>(scholarshipsQuery);

  const features = [
    {
      icon: <Search className="h-10 w-10 text-primary" />,
      title: 'View Scholarship Opportunities',
      description:
        'Browse and learn about the available scholarships.',
      href: '#scholarships'
    },
    {
      icon: <FileText className="h-10 w-10 text-primary" />,
      title: 'Apply for a Scholarship',
      description:
        'Easily upload your transcripts, resumes, and essays to a single platform.',
      href: '/signup'
    },
    {
      icon: <CheckCircle className="h-10 w-10 text-primary" />,
      title: 'Track Your Progress',
      description:
        'Stay updated with notifications and track your application status in real-time.',
      href: '/login'
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <AppLogo />
          <nav className="flex items-center space-x-4">
            <Button variant="ghost" asChild>
              <Link href="/login">Log In</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Sign Up</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="bg-secondary/50 py-20 md:py-32">
          <div className="container mx-auto px-4 text-center md:px-6">
            <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl text-foreground">
              Scholarship Applications Open
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground md:text-xl">
              Start your journey today. Prepare by requesting letters of recommendation, gathering your official transcripts, and reviewing our current opportunities.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="#scholarships">Browse Scholarships</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/signup">Create Account</Link>
              </Button>
            </div>
          </div>
        </section>

        <section id="scholarships" className="py-20 md:py-24 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                Available Scholarships
              </h2>
              <p className="mt-2 text-muted-foreground">
                Sign up to view all opportunities and start your application.
              </p>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {scholarships?.slice(0, 6).map((scholarship) => (
                  <Card key={scholarship.id} className="flex flex-col border-primary/10 shadow-sm transition-all hover:-translate-y-1">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="max-w-[70%]">
                          <CardTitle className="text-xl">{scholarship.name}</CardTitle>
                        </div>
                        <Badge variant="secondary" className="whitespace-nowrap">{scholarship.amount}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{scholarship.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(scholarship.tags) && scholarship.tags.map(tag => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between items-center border-t pt-4">
                      <div className="text-xs text-muted-foreground">
                        <p className="font-semibold">Deadline</p>
                        <p>{scholarship.deadline}</p>
                      </div>
                      <Button asChild size="sm">
                        <Link href="/signup">
                          Apply Now <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}

            {!isLoading && (!scholarships || scholarships.length === 0) && (
              <div className="text-center py-20 bg-muted/5 border-2 border-dashed rounded-2xl">
                <p className="text-muted-foreground italic">New scholarship opportunities are being posted soon.</p>
              </div>
            )}

            <div className="mt-12 text-center">
              <Button variant="outline" size="lg" asChild>
                <Link href="/signup">View All Scholarships</Link>
              </Button>
            </div>
          </div>
        </section>

        <section id="features" className="py-20 md:py-24 bg-secondary/30">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                Scholarship Application Guide
              </h2>
              <p className="mt-2 text-muted-foreground">
                Scholarships open annually. Our committee reviews every application thoroughly to ensure fair and merit-based awards for students.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <Link key={index} href={feature.href} className="block">
                  <Card className="transform transition-transform hover:scale-105 hover:shadow-lg h-full cursor-pointer">
                    <CardHeader className="items-center">
                      {feature.icon}
                    </CardHeader>
                    <CardContent className="text-center">
                      <h3 className="text-lg font-semibold">{feature.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
        
        <section id="donate" className="bg-background py-20 md:py-24">
            <div className="container mx-auto px-4 text-center md:px-6">
                 <Heart className="h-12 w-12 text-primary mx-auto mb-4" />
                <h2 className="text-3xl font-bold tracking-tight text-foreground">
                    Fund a Scholarship
                </h2>
                <p className="mx-auto mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
                    Our foundation is committed to supporting students in their post-secondary journeys. By providing named scholarships, we help bridge the financial gap and empower the next generation of leaders.
                </p>
                <div className="mt-8">
                    <Button size="lg" asChild>
                        <Link href="/signup">
                            Inquire Now
                        </Link>
                    </Button>
                </div>
            </div>
        </section>
      </main>

      <footer className="border-t bg-card">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row md:px-6">
          <AppLogo />
          <p className="text-sm text-muted-foreground">
            &copy; {mounted ? new Date().getFullYear() : ''} ScholarShip. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-4 sm:justify-end">
            <Link href="#" className="text-sm text-muted-foreground hover:text-primary">
              Terms
            </Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-primary">
              Privacy
            </Link>
            <Link href="/review/login" className="text-sm text-red-600 hover:underline">
              Reviewers
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
