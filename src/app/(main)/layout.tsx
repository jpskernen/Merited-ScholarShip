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
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getFirestore } from 'firebase/firestore';
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
];

const reviewerNav = [
  { href: '/review', label: 'Review Dashboard', icon: LayoutDashboard },
];


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isUserLoading, firestore } = useUser();
  
  const isAdminPath = pathname.startsWith('/admin');
  const isReviewerPath = pathname.startsWith('/review');
  const isDashboardPath = pathname.startsWith('/dashboard');

  const userRoleRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'roles_admin', user.uid);
  }, [firestore, user]);
  const { data: adminRole, isLoading: isRoleLoading } = useDoc(userRoleRef);
  
  const isReviewer = false; // Add logic for reviewer role if needed
  const isAdmin = !!adminRole;

  useEffect(() => {
    if (!isUserLoading && !user) {
      // If not loading and no user, redirect to login
      if (isDashboardPath || isAdminPath || isReviewerPath) {
        router.push('/login');
      }
    }
  }, [user, isUserLoading, isDashboardPath, isAdminPath, isReviewerPath, router]);

  const isActive = (href: string) => {
    return pathname === href;
  };
  
  const getNavItems = () => {
    if (isAdmin) return adminNav;
    if (isReviewer) return reviewerNav;
    return applicantNav; // Default to applicant
  };

  const currentNav = getNavItems();
  
  const shouldShowLayout = isDashboardPath || isAdminPath || isReviewerPath;

  if (isUserLoading || isRoleLoading) {
    return <div>Loading...</div>; // Or a proper loading skeleton
  }
  
  if (!user && shouldShowLayout) {
     return null; // Don't render anything while redirecting
  }

  if (!shouldShowLayout) {
    return <>{children}</>;
  }

  let navGroupLabel = 'Applicant';
  if (isAdmin) navGroupLabel = 'Admin';
  if (isReviewer) navGroupLabel = 'Reviewer';

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
                  <SidebarMenuItem key={item.href}>
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
