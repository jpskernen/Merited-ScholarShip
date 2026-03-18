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
  Award,
  FileSearch,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser, useDoc, useMemoFirebase, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useEffect } from 'react';

const applicantNav = [
  { href: '/dashboard', label: 'My Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/profile', label: 'Scholarship Form', icon: User },
  { href: '/dashboard/applications', label: 'My Status', icon: FileText },
  { href: '/dashboard/scholarships', label: 'Opportunities', icon: Search },
];

const reviewerNav = [
  { href: '/review', label: 'Review Center', icon: LayoutDashboard },
  { href: '/review?status=pending', label: 'New Assignments', icon: FileSearch },
  { href: '/review?status=completed', label: 'Finalized Scores', icon: Award },
];

const adminNav = [
  { href: '/admin', label: 'Admin Panel', icon: LayoutDashboard },
  { href: '/admin/applicants', label: 'All Candidates', icon: Users },
  { href: '/admin/scholarships', label: 'Programs', icon: Award },
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
  
  const isAdmin = role === 'admin' || !!adminRole;
  const isReviewer = role === 'reviewer' || !!reviewerProfile;
  const isApplicant = !isAdmin && !isReviewer;

  useEffect(() => {
    if (!isUserLoading && !isAdminRoleLoading && !isReviewerRoleLoading) {
      if (!user) {
        if (isDashboardPath || isAdminPath || isReviewerPath) {
          router.push('/login');
        }
      } else {
        // Strict Role Separation Redirection
        if (isAdminPath && !isAdmin) {
           router.push('/dashboard');
        }
        if (isReviewerPath && !isReviewer && !isAdmin) {
           router.push('/dashboard');
        }
        // Prevent Reviewers from seeing Applicant Dashboard to avoid confusion
        if (isDashboardPath && isReviewer && !isAdmin) {
          router.push('/review');
        }
      }
    }
  }, [user, isUserLoading, isAdminRoleLoading, isReviewerRoleLoading, isAdmin, isReviewer, isAdminPath, isReviewerPath, isDashboardPath, router]);

  const isActive = (href: string) => pathname === href;
  
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
        <div className="animate-pulse text-muted-foreground">Verifying access...</div>
      </div>
    );
  }
  
  if (!user && shouldShowLayout) return null;

  // Final rendering guard
  if (isAdminPath && !isAdmin) return null;
  if (isReviewerPath && !isReviewer && !isAdmin) return null;
  if (isDashboardPath && isReviewer && !isAdmin) return null;

  if (!shouldShowLayout) return <>{children}</>;

  let navGroupLabel = 'Applicant';
  if (isAdmin) navGroupLabel = 'Admin';
  else if (isReviewer) navGroupLabel = 'Committee';

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarHeader>
            <div className="px-4 py-2">
               <AppLogo />
            </div>
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarGroup>
              <SidebarGroupLabel className="px-2 text-[10px] font-black uppercase tracking-widest opacity-50">
                {navGroupLabel} Portal
              </SidebarGroupLabel>
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
