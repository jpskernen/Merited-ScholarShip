import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AppLogo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2", className)}>
      <GraduationCap className="h-6 w-6 text-primary" />
      <span className="text-xl font-bold">ScholarShip</span>
    </Link>
  );
}
