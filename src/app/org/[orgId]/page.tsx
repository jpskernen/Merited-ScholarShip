'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, use } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AppLogo } from '@/components/shared/AppLogo';
import { ArrowLeft, ArrowRight, Building2, Loader2, Search } from 'lucide-react';
import { getPublicOrganization, getPublicScholarships, type PublicScholarship } from '@/app/org-actions';
import { formatDeadline } from '@/lib/deadline';

export default function OrganizationLandingPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = use(params);

  const [orgName, setOrgName] = useState<string | null>(null);
  const [scholarships, setScholarships] = useState<PublicScholarship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    scholarships.forEach((s) => Array.isArray(s.tags) && s.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [scholarships]);

  const filteredScholarships = useMemo(() => {
    if (!selectedTag) return scholarships;
    return scholarships.filter((s) => Array.isArray(s.tags) && s.tags.includes(selectedTag));
  }, [scholarships, selectedTag]);

  const toggleTag = (tag: string) => setSelectedTag((current) => (current === tag ? null : tag));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const org = await getPublicOrganization(orgId);
      if (cancelled) return;
      if (!org) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }
      setOrgName(org.name);
      const list = await getPublicScholarships(orgId);
      if (cancelled) return;
      setScholarships(list);
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-30" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground opacity-30" />
        <h1 className="text-2xl font-bold">This organization isn't available</h1>
        <p className="max-w-md text-muted-foreground">
          The link may be mistyped, or the organization may no longer be active. If you received this link from a
          school or sponsor, check with them for the current one.
        </p>
        <Button asChild variant="outline"><Link href="/">Go to the Merited homepage</Link></Button>
      </div>
    );
  }

  return (
    
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <AppLogo />
          <nav className="flex items-center gap-4">
            <Button variant="ghost" asChild><Link href="/login">Log In</Link></Button>
            <Button asChild><Link href={`/signup?org=${encodeURIComponent(orgId)}`}>Sign Up</Link></Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-16 md:py-20 text-center border-b bg-muted/10">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mb-6 text-left">
              <Link href="/organizations" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> All organizations
              </Link>
            </div>
            <Badge variant="outline" className="mb-4 bg-primary/5 text-primary border-primary/20">{orgName}</Badge>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">Scholarships from {orgName}</h1>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Create a free account to apply, upload your materials and track every application in one place.
            </p>
            <Button size="lg" asChild className="mt-8 rounded-full px-8">
              <Link href={`/signup?org=${encodeURIComponent(orgId)}`}>Create Student Profile</Link>
            </Button>
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-6">
            {allTags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-8">
                <Badge
                  variant={selectedTag === null ? 'default' : 'outline'}
                  className="cursor-pointer text-[10px] uppercase tracking-widest px-2 py-0.5 font-bold"
                  onClick={() => setSelectedTag(null)}
                >
                  All
                </Badge>
                {allTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTag === tag ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px] uppercase tracking-widest px-2 py-0.5 font-bold"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {scholarships.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-2xl border-2 border-dashed">
                <Search className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                <p className="text-lg font-bold text-muted-foreground">No Open Programs</p>
                <p className="text-sm text-muted-foreground max-w-sm text-center mt-1">
                  {orgName} has no scholarship programs accepting applications right now.
                </p>
              </div>
            ) : filteredScholarships.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-2xl border-2 border-dashed">
                <Search className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                <p className="text-lg font-bold text-muted-foreground">No Matches for &ldquo;{selectedTag}&rdquo;</p>
                <Button variant="link" onClick={() => setSelectedTag(null)} className="mt-1">Clear filter</Button>
              </div>
            ) : (

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredScholarships.map((scholarship) => (
                  <Card key={scholarship.id} className="flex flex-col border-primary/10 shadow-sm">
                    <CardHeader>
                      <div className="flex justify-between items-start gap-2">
                        <CardTitle className="text-xl leading-tight flex-1">{scholarship.name}</CardTitle>
                        {scholarship.amount && (
                          <Badge variant="secondary" className="whitespace-nowrap bg-primary/10 text-primary border-none">
                            {scholarship.amount}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-3 leading-relaxed">
                        {scholarship.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {scholarship.tags.map((tag) => (
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
                      <Button asChild size="sm" variant="ghost" className="text-primary font-bold">
                        <Link href={`/signup?org=${encodeURIComponent(orgId)}`}>
                          Apply <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
              
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
