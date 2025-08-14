import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import scholarships from '@/data/scholarships.json';

export default function ScholarshipsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Find Scholarships</h1>
        <p className="text-muted-foreground">
          Browse and apply for scholarships that match your profile.
        </p>
      </div>

      <Alert className="bg-primary/10 border-primary">
         <Sparkles className="h-4 w-4" />
        <AlertTitle className="font-bold">Get AI Recommendations!</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>
            Let our AI match you with scholarships based on your profile, resume, and essays.
          </span>
          <Button variant="default">
            Generate My Matches <Sparkles className="ml-2 h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {scholarships.map((scholarship) => (
          <Card key={scholarship.id} className="flex flex-col">
            <CardHeader>
              <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{scholarship.name}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="whitespace-nowrap">{scholarship.amount}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-sm text-muted-foreground mb-4">{scholarship.description}</p>
              <div className="flex flex-wrap gap-2">
                {scholarship.tags.map(tag => <Badge key={tag} variant="outline">{tag}</Badge>)}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                <p>Deadline: {scholarship.deadline}</p>
              </div>
              <Button asChild size="sm">
                <Link href="#">
                  Apply <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
