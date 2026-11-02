'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AppLogo } from '@/components/shared/AppLogo';
import { LayoutDashboard } from 'lucide-react';
import { useUser } from '@/firebase';

// The public site header, shared by the landing page and the Terms/Privacy
// pages so they all carry the same auth-aware navigation.
export function SiteHeader() {
  const [mounted, setMounted] = useState(false);
  const { user, role, isUserLoading } = useUser();

  useEffect(() => {
    setMounted(true);
  }, []);

  const dashboardLink = useMemo(() => {
    if (!user) return '/login';
    const r = role?.toLowerCase();
    if (r === 'admin') return '/admin';
    if (r === 'reviewer') return '/review';
    return '/dashboard';
  }, [user, role]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <AppLogo />
        <nav className="flex items-center space-x-1 sm:space-x-4">
          {mounted && !isUserLoading && user ? (
            <Button asChild variant="outline" className="font-bold">
              <Link href={dashboardLink}><LayoutDashboard className="mr-2 h-4 w-4" /> My Portal</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild className="hidden sm:inline-flex">
                <Link href="/organizations">Browse Organizations</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/login">Log In</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
