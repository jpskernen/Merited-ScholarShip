
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
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser, useDoc, useMemoFirebase, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useEffect, useState, useMemo } from 'react';

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
  { href: '/admin/applicants', label: 'Committee Results', icon: Users },
  { href: '/admin/scholarships', label: 'Programs', icon: Award },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const adminRoleRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'roles_admin', user.uid);
  }, [firestore, user]);
  
  const reviewerProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'reviewers', user.uid);
  }, [firestore, user]);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: adminRole, isLoading: isAdminRoleLoading } = useDoc(adminRoleRef);
  const { data: reviewerProfile, isLoading: isReviewerRoleLoading } = useDoc(reviewerProfileRef);
  const { data: userDoc, isLoading: isUserDocLoading } = useDoc(userDocRef);
  
  const userMetadata = useMemo(() => {
    const role = userDoc?.role || adminRole?.role || (reviewerProfile ? 'Reviewer' : null);
    const isAdmin = role === 'Admin' || role === 'Sponsor' || !!adminRole;
    const isReviewer = role === 'Reviewer' || !!reviewerProfile;
    const isApplicant = role === 'Applicant' || (!isAdmin && !isReviewer);
    
    return { role, isAdmin, isReviewer, isApplicant };
  }, [userDoc, adminRole, reviewerProfile]);

  const isMetadataLoading = isUserLoading || isAdminRoleLoading || isReviewerRoleLoading || isUserDocLoading;

  useEffect(() => {
    if (mounted && !isMetadataLoading) {
      const { isAdmin, isReviewer, isApplicant } = userMetadata;
      
      if (!user) {
        if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin') || pathname.startsWith('/review')) {
          router.push('/login');
        }
        return;
      }

      // Access Control Redirection
      if (pathname.startsWith('/admin') && !userMetadata.isAdmin) {
        router.push(userMetadata.isReviewer ? '/review' : '/dashboard');
      } else if (pathname.startsWith('/review') && !userMetadata.isReviewer && !userMetadata.isAdmin) {
        router.push('/dashboard');
      } else if (pathname.startsWith('/dashboard') && userMetadata.isReviewer && !userMetadata.isAdmin) {
        router.push('/review');
      }
    }
  }, [mounted, user, isMetadataLoading, userMetadata, pathname, router]);

  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
  
  const getNavItems = () => {
    if (userMetadata.isAdmin) return adminNav;
    if (userMetadata.isReviewer) return reviewerNav;
    return applicantNav;
  };

  const currentNav = getNavItems();
  const shouldShowLayout = pathname.startsWith('/dashboard') || pathname.startsWith('/admin') || pathname.startsWith('/review');

  if (!mounted || isMetadataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="animate-pulse text-sm font-medium text-muted-foreground">Syncing Secure Session...</p>
        </div>
      </div>
    );
  }
  
  if (!user && shouldShowLayout) return null;

  // Render guard for unauthorized paths
  if (pathname.startsWith('/admin') && !userMetadata.isAdmin) return null;
  if (pathname.startsWith('/review') && !userMetadata.isReviewer && !userMetadata.isAdmin) return null;
  if (pathname.startsWith('/dashboard') && userMetadata.isReviewer && !userMetadata.isAdmin) return null;

  if (!shouldShowLayout) return <>{children}</>;

  const getPortalLabel = () => {
    if (userMetadata.isAdmin) return 'Sponsor/Admin';
    if (userMetadata.isReviewer) return 'Committee';
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
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <div className="mt-auto p-4">
             {userMetadata.isAdmin && (
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
