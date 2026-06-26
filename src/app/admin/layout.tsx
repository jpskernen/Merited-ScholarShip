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
  FlaskConical
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
  { href: '/admin/test-utils', label: 'Dev Utils', icon: FlaskConical },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAdmin = role?.toLowerCase() === 'admin' || user?.email === 'peyton.vandenbemden@gmail.com';

  useEffect(() => {
    if (mounted && !isUserLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      if (!isAdmin) {
        router.push('/dashboard');
      }
    }
  }, [mounted, user, isUserLoading, isAdmin, router]);

  const isActive = (href: string) => {
    return pathname === href || (href !== '/admin' && pathname.startsWith(href));
  };

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
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarHeader>
            <AppLogo className="p-4" />
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-4 mb-2">System Admin</SidebarGroupLabel>
              <SidebarMenu>
                {adminNav.map((item) => (
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

        <main className="flex-1">
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
