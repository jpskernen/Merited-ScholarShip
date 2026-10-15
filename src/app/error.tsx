'use client';

import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppLogo } from '@/components/shared/AppLogo';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4 text-center">
      <AppLogo />
      <div className="space-y-3">
        <TriangleAlert className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold sm:text-3xl">Something went wrong</h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          This page could not be loaded. The item you were looking for may have been removed, or you may not have
          access to it.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
