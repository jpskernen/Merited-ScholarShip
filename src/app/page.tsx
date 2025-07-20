import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AppLogo } from '@/components/shared/AppLogo';
import { GraduationCap, FileText, Target, Users, CheckCircle } from 'lucide-react';

export default function Home() {
  const features = [
    {
      icon: <FileText className="h-10 w-10 text-primary" />,
      title: 'Simplified Applications',
      description:
        'Easily upload your transcripts, resumes, and essays to a single platform.',
    },
    {
      icon: <Target className="h-10 w-10 text-primary" />,
      title: 'Intelligent Matching',
      description:
        'Our AI-powered tool matches your profile to the most relevant scholarship opportunities.',
    },
    {
      icon: <Users className="h-10 w-10 text-primary" />,
      title: 'Seamless Review Process',
      description:
        'A dedicated portal for reviewers to score applications and collaborate.',
    },
    {
      icon: <CheckCircle className="h-10 w-10 text-primary" />,
      title: 'Track Your Progress',
      description:
        'Stay updated with notifications and track your application status in real-time.',
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
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
            <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
              Your Future Starts Here.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground md:text-xl">
              ScholarShip is the easiest way to find and apply for scholarships.
              Focus on your dreams, we'll handle the applications.
            </p>
            <div className="mt-8">
              <Button size="lg" asChild>
                <Link href="/signup">Get Started for Free</Link>
              </Button>
            </div>
          </div>
        </section>

        <section id="features" className="py-20 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold">Why Choose ScholarShip?</h2>
              <p className="mt-2 text-muted-foreground">
                Everything you need for your scholarship journey.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
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
      </main>

      <footer className="border-t bg-gray-100">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row md:px-6">
          <AppLogo />
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} ScholarShip. All rights reserved.
          </p>
          <div className="flex space-x-4">
            <Link href="#" className="text-sm text-muted-foreground hover:text-primary">
              Terms of Service
            </Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-primary">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
