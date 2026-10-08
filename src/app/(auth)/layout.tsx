import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AppLogo } from '@/components/shared/AppLogo';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // bg-background, not bg-gray-50: the theme is dark, so the logo (the only
  // link back home) rendered white-on-white and was invisible.
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <div className="mb-8 flex justify-center">
          <AppLogo />
        </div>
        {children}
      </div>
    </div>
  );
}
