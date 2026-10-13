'use client';

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import { AppLogo } from '@/components/shared/AppLogo';
import { UserNav } from '@/components/shared/UserNav';
import {
  LayoutDashboard,
  Users,
  Award,
  UserPlus,
  ShieldCheck,
  Loader2,
  History,
  Building2
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser, useDoc, useMemoFirebase, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

const adminNav = [
  { href: '/admin', label: 'Admin Dashboard', icon: LayoutDashboard },
  { href: '/admin/applicants', label: 'All Applicants', icon: Users },
  { href: '/admin/reviewers', label: 'Manage Reviewers', icon: UserPlus },
  { href: '/admin/admins', label: 'Administrators', icon: ShieldCheck },
  { href: '/admin/scholarships', label: 'Scholarships', icon: Award },
  { href: '/admin/audit-log', label: 'Audit Log', icon: History },
];

// Only for accounts with the platformAdmin claim (docs/07 §3.1).
const platformNav = [
  { href: '/admin/platform', label: 'Organizations', icon: Building2 },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, userData, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [mounted, setMounted] = useState(false);
  const isPublicInvite = pathname.startsWith('/admin/invite/');

  useEffect(() => {
    setMounted(true);
  }, []);

  // role comes from the token's claims (src/firebase/provider.tsx).
  const isAdmin = role?.toLowerCase() === 'admin';

  useEffect(() => {
    if (isPublicInvite) return;
    if (mounted && !isUserLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      if (!isAdmin) {
        router.push('/dashboard');
      }
    }
  }, [mounted, user, isUserLoading, isAdmin, router, isPublicInvite]);

  const isActive = (href: string) => {
    return pathname === href || (href !== '/admin' && pathname.startsWith(href));
  };

  if (isPublicInvite) return <>{children}</>;

  if (!mounted || isUserLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="animate-pulse text-sm font-medium text-muted-foreground">Verifying Administrator Access...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <SidebarProvider>
      {/* See the note in (main)/layout.tsx — without w-full the shell collapses
          to the width of the page content. */}
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarHeader>
            <AppLogo className="p-4" />
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-4 mb-2">System Admin</SidebarGroupLabel>
              <SidebarMenu>
                {[...(userData?.platformAdmin === true ? platformNav : []), ...adminNav].map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <Link href={item.href} className="w-full">
                       <SidebarMenuButton isActive={isActive(item.href)} tooltip={item.label}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-md sm:justify-end">
            <div className="sm:hidden">
              <SidebarTrigger />
            </div>
            <UserNav />
          </header>
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
