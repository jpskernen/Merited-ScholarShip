'use client';

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
import { ArrowRight } from 'lucide-react';
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
                <Link href="/dashboard/profile">
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
