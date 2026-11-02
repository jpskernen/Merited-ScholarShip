'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppLogo } from '@/components/shared/AppLogo';

// The public site footer, shared by the landing page and the Terms/Privacy
// pages. The year is rendered after mount to avoid a hydration mismatch.
export function SiteFooter() {
  const [year, setYear] = useState('');
  useEffect(() => {
    setYear(String(new Date().getFullYear()));
  }, []);

  return (
    <footer className="border-t bg-card">
      <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-4 py-10 sm:flex-row md:px-6">
        <div className="flex flex-col items-center sm:items-start gap-2">
          <AppLogo />
          <p className="text-xs text-muted-foreground">
            Empowering students through academic opportunities.
          </p>
        </div>
        <p className="text-sm text-muted-foreground order-last sm:order-none">
          &copy; {year} ScholarShip. All rights reserved.
        </p>
        <div className="flex flex-wrap justify-center gap-6 sm:justify-end">
          <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
