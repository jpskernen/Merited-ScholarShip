import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppLogo } from '@/components/shared/AppLogo';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4 text-center">
      <AppLogo />
      <div className="space-y-3">
        <FileQuestion className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">Error 404</p>
        <h1 className="text-2xl font-bold sm:text-3xl">Page not found</h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          The page you are looking for doesn&apos;t exist or may have been moved.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
