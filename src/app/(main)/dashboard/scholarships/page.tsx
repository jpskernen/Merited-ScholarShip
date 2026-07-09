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
import { useMemo } from 'react';
import scholarshipsData from '@/data/scholarships.json';

export default function ScholarshipsPage() {
  const { firestore } = useFirebase();

  const scholarshipsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'programs');
  }, [firestore]);

  const { data: dbScholarships, isLoading } = useCollection<Scholarship>(scholarshipsQuery);

  const scholarships = useMemo(() => {
    if (dbScholarships && dbScholarships.length > 0) return dbScholarships;
    return scholarshipsData as any[];
  }, [dbScholarships]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Available Opportunities</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Browse institutional programs and track matching criteria for your profile.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {scholarships?.map((scholarship) => (
          <Card key={scholarship.id} className="flex flex-col border-primary/10 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="p-4 md:p-6">
              <div className="flex justify-between items-start">
                  <div className="max-w-[70%]">
                    <CardTitle className="text-base md:text-lg leading-tight">{scholarship.name}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="whitespace-nowrap text-[10px] md:text-xs bg-primary/10 text-primary border-none">{scholarship.amount}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-grow p-4 md:p-6 pt-0 md:pt-0">
              <p className="text-xs md:text-sm text-muted-foreground mb-4 line-clamp-3 leading-relaxed">{scholarship.description}</p>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(scholarship.tags) && scholarship.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest">{tag}</Badge>
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center border-t p-4 md:p-6">
              <div className="text-[10px] md:text-xs text-muted-foreground">
                <p className="font-bold text-foreground">Deadline</p>
                <p>{scholarship.deadline}</p>
              </div>
              <Button asChild size="sm" className="font-bold">
                <Link href="/dashboard/profile">
                  View Form <ArrowRight className="ml-2 h-3 w-3" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {(!scholarships || scholarships.length === 0) && (
        <div className="text-center py-24 bg-muted/5 rounded-xl border-2 border-dashed">
          <p className="text-sm md:text-base text-muted-foreground italic">New scholarship opportunities are posted periodically. Check back soon!</p>
        </div>
      )}
    </div>
  );
}
