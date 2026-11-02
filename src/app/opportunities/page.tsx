'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, ArrowRight, ArrowLeft, Loader2, Search } from 'lucide-react';
import { SiteHeader } from '@/components/shared/SiteHeader';
import { SiteFooter } from '@/components/shared/SiteFooter';
import { useUser } from '@/firebase';
import { getAllPublicScholarships, type PublicScholarshipWithOrg } from '@/app/org-actions';
import { formatDeadline } from '@/lib/deadline';

// Every open scholarship across all organizations, reached from the landing
// page's "View All Opportunities" button. The landing page shows only the
// first few; this lists them all with the same tag filtering.
const PAGE_SIZE = 12;

export default function OpportunitiesPage() {
  const { user, role } = useUser();
  const [mounted, setMounted] = useState(false);
  const [scholarships, setScholarships] = useState<PublicScholarshipWithOrg[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let cancelled = false;
    getAllPublicScholarships().then((list) => {
      if (!cancelled) {
        setScholarships(list);
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const dashboardLink = useMemo(() => {
    if (!user) return '/login';
    const r = role?.toLowerCase();
    if (r === 'admin') return '/admin';
    if (r === 'reviewer') return '/review';
    return '/dashboard';
  }, [user, role]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    scholarships.forEach((s) => Array.isArray(s.tags) && s.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [scholarships]);

  const filtered = useMemo(() => {
    if (!selectedTag) return scholarships;
    return scholarships.filter((s) => Array.isArray(s.tags) && s.tags.includes(selectedTag));
  }, [scholarships, selectedTag]);

  // Reset the page back to the first batch whenever the filter changes, so
  // switching tags doesn't leave an unexpectedly long list expanded.
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [selectedTag]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const toggleTag = (tag: string) => setSelectedTag((current) => (current === tag ? null : tag));

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background text-foreground font-sans">
      <SiteHeader />

      <main className="flex-1">
        <section className="border-b bg-secondary/10 py-10 md:py-20">
          <div className="container mx-auto px-4 md:px-6">
            <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
              <Link href="/"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Home</Link>
            </Button>
            <div className="text-center">
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight">All Opportunities</h1>
              <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
                Browse every open scholarship across all organizations on ScholarShip.
              </p>
            </div>
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 md:px-6">
            {allTags.length > 0 && (
              <div className="mb-8 -mx-4 flex flex-nowrap gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 sm:pb-0">
                <Badge
                  variant={selectedTag === null ? 'default' : 'outline'}
                  className="shrink-0 cursor-pointer whitespace-nowrap text-[10px] uppercase tracking-widest px-3 py-1.5 sm:px-2 sm:py-0.5 font-bold"
                  onClick={() => setSelectedTag(null)}
                >
                  All
                </Badge>
                {allTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTag === tag ? 'default' : 'outline'}
                    className="shrink-0 cursor-pointer whitespace-nowrap text-[10px] uppercase tracking-widest px-3 py-1.5 sm:px-2 sm:py-0.5 font-bold"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
              </div>
            ) : scholarships.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-2xl border-2 border-dashed">
                <Search className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                <p className="text-lg font-bold text-muted-foreground">No Open Programs</p>
                <p className="text-sm text-muted-foreground max-w-sm text-center mt-1">
                  There are no scholarship programs accepting applications right now. New awards are
                  posted here as they open — create an account to be ready when they do.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-2xl border-2 border-dashed">
                <Search className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                <p className="text-lg font-bold text-muted-foreground">No Matches for &ldquo;{selectedTag}&rdquo;</p>
                <Button variant="link" onClick={() => setSelectedTag(null)} className="mt-1">Clear filter</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {visible.map((scholarship) => (
                  <Card key={scholarship.id} className="flex flex-col border-primary/10 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                    <CardHeader>
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <Link
                            href={`/org/${encodeURIComponent(scholarship.organizationId)}`}
                            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary"
                          >
                            <Building2 className="h-3 w-3" /> {scholarship.organizationName}
                          </Link>
                          <CardTitle className="text-xl leading-tight mt-1">{scholarship.name}</CardTitle>
                        </div>
                        <Badge variant="secondary" className="whitespace-nowrap bg-primary/10 text-primary border-none">{scholarship.amount}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-3 leading-relaxed">
                        {scholarship.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(scholarship.tags) && scholarship.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant={selectedTag === tag ? 'default' : 'outline'}
                            className="cursor-pointer text-[10px] uppercase tracking-widest px-2 py-0 font-bold"
                            onClick={() => toggleTag(tag)}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between items-center border-t pt-4">
                      <div className="text-xs text-muted-foreground">
                        <p className="font-black text-foreground uppercase tracking-tighter">Deadline</p>
                        <p>{formatDeadline(scholarship.deadline)}</p>
                      </div>
                      <Button asChild size="sm" variant="ghost" className="text-primary font-bold hover:bg-primary/5">
                        <Link href={mounted && user ? dashboardLink : `/signup?org=${encodeURIComponent(scholarship.organizationId)}`}>
                          Apply <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}

            {!isLoading && hasMore && (
              <div className="mt-12 text-center">
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full font-bold px-10"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                >
                  Load More
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">
                  Showing {visible.length} of {filtered.length}
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
