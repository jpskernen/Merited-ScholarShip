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
import { ArrowRight, Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Scholarship } from '@/types/scholarship';
import { orgIdOf } from '@/lib/org';
import { useMemo } from 'react';

export default function ScholarshipsPage() {
  const { firestore, user, userData } = useFirebase();
  const orgId = orgIdOf(userData);

  // Students see only their own organization's scholarships (docs/07 D7).
  const scholarshipsQuery = useMemoFirebase(() => {
    if (!firestore || !orgId) return null;
    return query(collection(firestore, 'programs'), where('organizationId', '==', orgId));
  }, [firestore, orgId]);

  const { data: dbScholarships, isLoading } = useCollection<Scholarship>(scholarshipsQuery);

  // A student can hold one application per scholarship, so each card shows the
  // state of *its own* application rather than a single global portfolio status.
  const myApplicationsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'applications'), where('studentId', '==', user.uid));
  }, [firestore, user]);

  const { data: myApplications } = useCollection(myApplicationsQuery);

  const applicationByScholarship = useMemo(() => {
    const map: Record<string, any> = {};
    (myApplications || []).forEach((application: any) => {
      map[application.scholarshipId] = application;
    });
    return map;
  }, [myApplications]);

  // No static fallback. When `programs` is empty the student sees the empty
  // state at the bottom of this file instead of the bundled sample data.
  // Showing the samples was worse than showing nothing: their ids
  // (academic-excellence, stem-innovation, …) match no Firestore document, so
  // Apply opened an application against a scholarship that does not exist.
  const scholarships = dbScholarships ?? [];

  // Programs the student can still act on come first: anything not applied to,
  // then drafts waiting to be finished, then applications already submitted.
  // Buried behind two "View Application" cards, an open opportunity reads as if
  // there were nothing left to apply for.
  const sortedScholarships = useMemo(() => {
    const rankOf = (scholarship: { id: string }) => {
      const application = applicationByScholarship[scholarship.id];
      if (!application) return 0;
      return application.status === 'Draft' ? 1 : 2;
    };

    // Array.prototype.sort is stable, so programs within a group keep the
    // order Firestore returned them in.
    return [...scholarships].sort((a, b) => rankOf(a) - rankOf(b));
  }, [scholarships, applicationByScholarship]);

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

      {scholarships.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sortedScholarships.map((scholarship) => (
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
                {(() => {
                  const application = applicationByScholarship[scholarship.id];
                  const isSubmitted = application && application.status !== 'Draft';
                  return (
                    <Button asChild size="sm" variant={isSubmitted ? 'outline' : 'default'} className="font-bold">
                      <Link href={`/dashboard/profile?scholarshipId=${encodeURIComponent(scholarship.id)}`}>
                        {isSubmitted ? 'View Application' : application ? 'Continue' : 'Apply'}
                        <ArrowRight className="ml-2 h-3 w-3" />
                      </Link>
                    </Button>
                  );
                })()}
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-2xl border-2 border-dashed">
          <Search className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <p className="text-lg font-bold text-muted-foreground">No Open Opportunities</p>
          <p className="text-sm text-muted-foreground max-w-sm text-center mt-1">
            New scholarship opportunities are posted periodically. Check back soon!
          </p>
        </div>
      )}
    </div>
  );
}
