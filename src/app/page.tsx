import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { AppLogo } from '@/components/shared/AppLogo';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, FileText, Target, Users, CheckCircle, Heart, Search, ArrowRight, ExternalLink } from 'lucide-react';
import scholarships from '@/data/scholarships.json';

export default function Home() {
  const features = [
    {
      icon: <Search className="h-10 w-10 text-primary" />,
      title: 'View Scholarship Opportunities',
      description:
        'Browse and learn about the available scholarships.',
    },
    {
      icon: <FileText className="h-10 w-10 text-primary" />,
      title: 'Apply for a Scholarship',
      description:
        'Easily upload your transcripts, resumes, and essays to a single platform.',
    },
    {
      icon: <CheckCircle className="h-10 w-10 text-primary" />,
      title: 'Track Your Progress',
      description:
        'Stay updated with notifications and track your application status in real-time.',
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
              Scholarship Applications Open in February 2026.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground md:text-xl">
              Scholarships open in Spring 2026. You can prepare by asking for two letters of recommendation, setting up reminders to obtain your transcripts from your counselor and review potential scholarship now.
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
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {scholarships.slice(0, 6).map((scholarship) => (
                <Card key={scholarship.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl">{scholarship.name}</CardTitle>
                      </div>
                      <Badge variant="secondary" className="whitespace-nowrap">{scholarship.amount}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{scholarship.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {scholarship.tags.map(tag => <Badge key={tag} variant="outline">{tag}</Badge>)}
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between items-center border-t pt-4">
                    <div className="text-xs text-muted-foreground">
                      <p>Deadline: {scholarship.deadline}</p>
                    </div>
                    <Button asChild size="sm">
                      <Link href="/signup">
                        Sign Up to Apply <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
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
                Scholarships open in Spring 2026. You will be alerted if you are selected. Award presentations are in May. Scholarships are sent directly to your school of choice. 
              </p>
            </div>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <Card key={index} className="transform transition-transform hover:scale-105 hover:shadow-lg">
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
                    The Lake Travis Education Foundation is committed to the students of the Lake Travis Independent School District. One of the ways that we support our students is by providing named scholarships that allow us to help them in their post-secondary journeys.
                </p>
                <div className="mt-8">
                    <Button size="lg" asChild>
                        <Link href="https://app.betterunite.com/laketraviseducationfoundation-scholarships" target="_blank" rel="noopener noreferrer">
                            Donate Now
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
            &copy; {new Date().getFullYear()} ScholarShip. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-4 sm:justify-end">
            <Link href="https://www.meritedapp.com/" target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-primary hover:underline">
              Visit Merited App <ExternalLink className="ml-1 h-3 w-3" />
            </Link>
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
