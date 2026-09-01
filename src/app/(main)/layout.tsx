
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
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  User,
  FileText,
  Search,
  Users,
  Award,
  FileSearch,
  ShieldCheck,
  Loader2,
  History,
  FlaskConical,
  Settings
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { useEffect, useState, Suspense } from 'react';

const applicantNav = [
  { href: '/dashboard', label: 'My Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/profile', label: 'Scholarship Form', icon: User },
  { href: '/dashboard/applications', label: 'My Status', icon: FileText },
  { href: '/dashboard/scholarships', label: 'Opportunities', icon: Search },
];

const reviewerNav = [
  { href: '/reviewer/dashboard', label: 'Review Center', icon: LayoutDashboard },
];

const adminNav = [
  { href: '/admin', label: 'Admin Panel', icon: LayoutDashboard },
  { href: '/admin/applicants', label: 'Committee Results', icon: Users },
  { href: '/admin/reviewers', label: 'Manage Reviewers', icon: Award },
  { href: '/admin/scholarships', label: 'Programs', icon: Award },
  { href: '/admin/audit-log', label: 'Audit Log', icon: History },
  { href: '/admin/test-utils', label: 'Dev Utils', icon: FlaskConical },
];

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, isUserLoading } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Access Control Enforcement
  useEffect(() => {
    if (mounted && !isUserLoading) {
      if (!user) {
        if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin') || pathname.startsWith('/reviewer') || pathname === '/settings') {
          router.push('/login');
        }
        return;
      }

      // Allow access to the shared settings page for everyone
      if (pathname === '/settings') return;

      const isAdmin = role?.toLowerCase() === 'admin';
      const isReviewer = role?.toLowerCase() === 'reviewer';
      const isApplicant = role?.toLowerCase() === 'applicant';

      if (isReviewer) {
        if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
          router.push('/reviewer/dashboard');
        }
      } 
      else if (isAdmin) {
        if (pathname === '/dashboard') {
          router.push('/admin');
        }
      }
      else if (isApplicant) {
        if (pathname.startsWith('/admin') || pathname.startsWith('/reviewer')) {
          router.push('/dashboard');
        }
      }
    }
  }, [mounted, user, role, isUserLoading, pathname, router]);

  const isActive = (href: string) => {
    return pathname === href || (href !== '/dashboard' && href !== '/admin' && href !== '/reviewer/dashboard' && pathname.startsWith(href));
  };
  
  const getNavItems = () => {
    const normalizedRole = role?.toLowerCase();
    if (normalizedRole === 'admin') return adminNav;
    if (normalizedRole === 'reviewer') return reviewerNav;
    return applicantNav;
  };

  const currentNav = getNavItems();
  const isSettingsActive = pathname === '/settings';
  const shouldShowLayout = pathname.startsWith('/dashboard') || pathname.startsWith('/admin') || pathname.startsWith('/reviewer') || pathname === '/settings';

  if (!mounted || isUserLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="animate-pulse text-sm font-medium text-muted-foreground">Syncing Secure Session...</p>
        </div>
      </div>
    );
  }
  
  if (!user && shouldShowLayout) return null;
  if (!shouldShowLayout) return <>{children}</>;

  const getPortalLabel = () => {
    const normalizedRole = role?.toLowerCase();
    if (normalizedRole === 'admin') return 'Sponsor/Admin';
    if (normalizedRole === 'reviewer') return 'Committee';
    return 'Applicant';
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarHeader>
            <div className="px-4 py-4">
               <AppLogo />
            </div>
          </SidebarHeader>
          <SidebarContent className="px-2">
            <SidebarGroup>
              <SidebarGroupLabel className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">
                {getPortalLabel()} Portal
              </SidebarGroupLabel>
              <SidebarMenu>
                {currentNav.map((item) => (
                  <SidebarMenuItem key={item.href + item.label}>
                    <Link href={item.href} className="w-full">
                       <SidebarMenuButton isActive={isActive(item.href)} tooltip={item.label}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                ))}
                <Separator className="my-2" />
                <SidebarMenuItem>
                  <Link href="/settings" className="w-full">
                    <SidebarMenuButton isActive={isSettingsActive} tooltip="Account Settings">
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <div className="mt-auto p-4">
             {role?.toLowerCase() === 'admin' && (
               <Badge variant="outline" className="w-full justify-center gap-1.5 py-1 text-[10px] font-bold tracking-tight">
                 <ShieldCheck className="h-3 w-3" /> System Admin Verified
               </Badge>
             )}
          </div>
        </Sidebar>

        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur-md sm:justify-end">
            <div className="sm:hidden">
              <SidebarTrigger />
            </div>
            <UserNav />
          </header>
          <div className="container mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <DashboardLayoutContent>
        {children}
      </DashboardLayoutContent>
    </Suspense>
  );
}
