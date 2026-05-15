
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
import { ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Scholarship } from '@/types/scholarship';

export default function ScholarshipsPage() {
  const { firestore } = useFirebase();

  const scholarshipsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'programs');
  }, [firestore]);

  const { data: scholarships, isLoading } = useCollection<Scholarship>(scholarshipsQuery);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Find Scholarships</h1>
        <p className="text-muted-foreground">
          Browse and apply for scholarships that match your profile.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {scholarships?.map((scholarship) => (
          <Card key={scholarship.id} className="flex flex-col border-primary/10 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                  <div className="max-w-[70%]">
                    <CardTitle className="text-lg">{scholarship.name}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="whitespace-nowrap">{scholarship.amount}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{scholarship.description}</p>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(scholarship.tags) && scholarship.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center border-t pt-4">
              <div className="text-xs text-muted-foreground">
                <p className="font-medium">Deadline</p>
                <p>{scholarship.deadline}</p>
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

      {(!scholarships || scholarships.length === 0) && (
        <div className="text-center py-20 bg-muted/10 rounded-xl border-2 border-dashed">
          <p className="text-muted-foreground">Check back soon! New scholarships are added periodically.</p>
        </div>
      )}
    </div>
  );
}
