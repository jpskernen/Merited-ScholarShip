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
import { ArrowRight, FileText, Search, User } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Welcome back, Jane!</h1>
        <p className="text-muted-foreground">
          Here&apos;s a summary of your scholarship journey.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <span>Profile Completion</span>
            </CardTitle>
            <CardDescription>
              Complete your profile to get better scholarship matches.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">75% Complete</span>
              <Progress value={75} className="w-2/3" />
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" asChild>
              <Link href="/dashboard/profile">
                Update Profile <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="bg-primary/10 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <span>Find Scholarships</span>
            </CardTitle>
            <CardDescription>
              Explore new scholarship opportunities tailored for you.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <p className="text-4xl font-bold">12</p>
             <p className="text-sm text-muted-foreground">New scholarships match your profile!</p>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link href="/dashboard/scholarships">
                View Scholarships <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span>Active Applications</span>
            </CardTitle>
            <CardDescription>
              Keep track of the status of your applications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">3</p>
            <p className="text-sm text-muted-foreground">Applications submitted</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" asChild>
              <Link href="/dashboard/applications">
                View Applications <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
