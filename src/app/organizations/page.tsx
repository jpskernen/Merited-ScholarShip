'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AppLogo } from '@/components/shared/AppLogo';
import { ArrowRight, Building2, Loader2, Search } from 'lucide-react';
import { getPublicOrganizations } from '@/app/org-actions';
import type { PublicOrganization } from '@/lib/org-server';

export default function OrganizationsDirectoryPage() {
  const [orgs, setOrgs] = useState<PublicOrganization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    getPublicOrganizations().then((list) => {
      if (!cancelled) {
        setOrgs(list);
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orgs;
    return orgs.filter((org) => org.name.toLowerCase().includes(term));
  }, [orgs, search]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <AppLogo />
          <nav className="flex items-center gap-4">
            <Button variant="ghost" asChild><Link href="/login">Log In</Link></Button>
            <Button asChild><Link href="/signup">Sign Up</Link></Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-16 md:py-20 text-center border-b bg-muted/10">
          <div className="container mx-auto px-4 md:px-6">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">Find Your Organization</h1>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Browse the schools and sponsors running scholarships on Merited, then sign up with the one
              you belong to.
            </p>
            <div className="relative mt-8 max-w-md mx-auto">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search organizations..."
                className="pl-9"
              />
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-6">
            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-2xl border-2 border-dashed">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                <p className="text-lg font-bold text-muted-foreground">
                  {orgs.length === 0 ? 'No Organizations Yet' : 'No Matches'}
                </p>
                <p className="text-sm text-muted-foreground max-w-sm text-center mt-1">
                  {orgs.length === 0
                    ? 'No organizations are accepting sign-ups right now.'
                    : 'Try a different search term.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((org) => (
                  <Card key={org.id} className="flex flex-col border-primary/10 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-primary/10 p-2.5">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-lg leading-tight">{org.name}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <p className="text-sm text-muted-foreground">
                        View open scholarships and sign up as an applicant of {org.name}.
                      </p>
                    </CardContent>
                    <CardFooter className="flex justify-between items-center border-t pt-4">
                      <Button asChild size="sm" variant="ghost" className="text-primary font-bold">
                        <Link href={`/org/${encodeURIComponent(org.id)}`}>
                          View &amp; Apply <ArrowRight className="ml-1 h-4 w-4" />
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
