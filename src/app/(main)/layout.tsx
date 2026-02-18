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
  User,
  FileText,
  Search,
  Users,
  ClipboardCheck,
  FileSearch,
  Award,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser, useDoc, useMemoFirebase, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useEffect } from 'react';

const applicantNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/profile', label: 'My Profile', icon: User },
  { href: '/dashboard/scholarships', label: 'Scholarships', icon: Search },
  { href: '/dashboard/applications', label: 'My Applications', icon: FileText },
];

const adminNav = [
  { href: '/admin', label: 'Admin Dashboard', icon: LayoutDashboard },
  { href: '/admin/applicants', label: 'All Applicants', icon: Users },
  { href: '/admin/scholarships', label: 'Scholarships', icon: Search },
];

const reviewerNav = [
  { href: '/review', label: 'Review Dashboard', icon: LayoutDashboard },
  { href: '/review?status=pending', label: 'Review New Applications', icon: FileSearch },
  { href: '/review?status=completed', label: 'Completed Scoring', icon: Award },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, isUserLoading } = useUser();
  const firestore = useFirestore();
  
  const isAdminPath = pathname.startsWith('/admin');
  const isReviewerPath = pathname.startsWith('/review');
  const isDashboardPath = pathname.startsWith('/dashboard');

  const adminRoleRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'roles_admin', user.uid);
  }, [firestore, user]);
  
  const reviewerProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'reviewers', user.uid);
  }, [firestore, user]);

  const { data: adminRole, isLoading: isAdminRoleLoading } = useDoc(adminRoleRef);
  const { data: reviewerProfile, isLoading: isReviewerRoleLoading } = useDoc(reviewerProfileRef);
  
  // Use the role from the auth token as the primary source of truth
  const isAdmin = role === 'admin' || !!adminRole;
  const isReviewer = role === 'reviewer' || !!reviewerProfile;

  // Unified redirection logic
  useEffect(() => {
    if (!isUserLoading && !isAdminRoleLoading && !isReviewerRoleLoading) {
      if (!user) {
        if (isDashboardPath || isAdminPath || isReviewerPath) {
          router.push('/login');
        }
      } else {
        // Redirection based on role
        if (isAdminPath && !isAdmin) {
           router.push('/dashboard');
        }
        if (isReviewerPath && !isReviewer && !isAdmin) {
           router.push('/dashboard');
        }
      }
    }
  }, [user, isUserLoading, isAdminRoleLoading, isReviewerRoleLoading, isAdmin, isReviewer, isAdminPath, isReviewerPath, isDashboardPath, router]);

  const isActive = (href: string) => {
    return pathname === href;
  };
  
  const getNavItems = () => {
    if (isAdmin) return adminNav;
    if (isReviewer) return reviewerNav;
    return applicantNav;
  };

  const currentNav = getNavItems();
  const shouldShowLayout = isDashboardPath || isAdminPath || isReviewerPath;

  if (isUserLoading || isAdminRoleLoading || isReviewerRoleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading application...</div>
      </div>
    );
  }
  
  if (!user && shouldShowLayout) {
     return null;
  }

  // Prevent rendering children if unauthorized
  if (isAdminPath && !isAdmin) return null;
  if (isReviewerPath && !isReviewer && !isAdmin) return null;

  if (!shouldShowLayout) {
    return <>{children}</>;
  }

  let navGroupLabel = 'Applicant';
  if (isAdmin) navGroupLabel = 'Admin';
  else if (isReviewer) navGroupLabel = 'Reviewer';

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarHeader>
            <AppLogo />
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarGroup>
              <SidebarGroupLabel>{navGroupLabel}</SidebarGroupLabel>
              <SidebarMenu>
                {currentNav.map((item) => (
                  <SidebarMenuItem key={item.href + item.label}>
                    <Link href={item.href} className="w-full">
                       <SidebarMenuButton isActive={isActive(item.href)}>
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
