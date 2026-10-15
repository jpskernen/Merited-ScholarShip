'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Award, FileCheck, Users, Clock, Mail, ExternalLink, Loader2, FileText, CheckCircle, Search, ClipboardList, Activity, ShieldCheck, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirebase, useMemoFirebase, useUser } from '@/firebase';
import { collection, collectionGroup, query, orderBy, limit, where, getCountFromServer, getAggregateFromServer, count, average } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect, useMemo } from 'react';
import { getSystemHealth } from './actions';
import { orgIdOf } from '@/lib/org';

export default function AdminDashboardPage() {
  const { firestore } = useFirebase();
  const { user, userData } = useUser();
  

  const orgId = orgIdOf(userData);

 
  const [applications, setApplications] = useState<{ drafts: number; submitted: number; underReview: number; awarded: number; declined: number } | null>(null);
  const [reviews, setReviews] = useState<{ reviewCount: number; averageScore: number | null } | null>(null);

  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [healthError, setHealthError] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function checkHealth() {
      try {
        setSystemHealth(await getSystemHealth(await user!.getIdToken()));
        setHealthError(false);
      } catch {
    
        setSystemHealth(null);
        setHealthError(true);
      }
    }
    checkHealth();
  }, [user]);

  useEffect(() => {
    if (!firestore || !orgId) {
      setApplications(null);
      setReviews(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const applicationsRef = collection(firestore, 'applications');
        const countStatus = async (status: string) =>
          (await getCountFromServer(query(applicationsRef, where('organizationId', '==', orgId), where('status', '==', status)))).data().count;
        const [drafts, submitted, underReview, awarded, declined] = await Promise.all(
          ['Draft', 'Submitted', 'In Review', 'Awarded', 'Not Awarded'].map(countStatus),
        );

        const filedQuery = query(collectionGroup(firestore, 'reviews'), where('organizationId', '==', orgId), where('status', '==', 'Submitted'));
        let reviewStats: { reviewCount: number; averageScore: number | null };
        try {
          const filed = await getAggregateFromServer(filedQuery, { reviewCount: count(), averageScore: average('totalScore') });
          reviewStats = { reviewCount: filed.data().reviewCount, averageScore: filed.data().averageScore };
        } catch {
          const filed = await getCountFromServer(filedQuery);
          reviewStats = { reviewCount: filed.data().count, averageScore: null };
        }

        if (cancelled) return;
        setApplications({ drafts, submitted, underReview, awarded, declined });
        setReviews(reviewStats);
      } catch (error: any) {
        console.error('Dashboard counts failed:', error?.message);
        if (!cancelled) {
          setApplications({ drafts: 0, submitted: 0, underReview: 0, awarded: 0, declined: 0 });
          setReviews({ reviewCount: 0, averageScore: null });
        }
      }
    };

    load();
    const refresh = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(refresh); };
  }, [firestore, orgId]);

  const counts = useMemo(() => {
    const c = applications || { drafts: 0, submitted: 0, underReview: 0, awarded: 0, declined: 0 };
    return {
      total: c.submitted + c.underReview + c.awarded + c.declined,
      drafts: c.drafts,
      submitted: c.submitted,
      underReview: c.underReview,
      awarded: c.awarded,
      declined: c.declined,
    };
  }, [applications]);

  const committee = useMemo(() => {
    const decidable = counts.total;
    const awaiting = counts.submitted;
    const covered = decidable - awaiting;
    const average = reviews?.averageScore;
    return {
      reviewCount: reviews?.reviewCount ?? 0,
      averageScore: typeof average === 'number' ? Number(average.toFixed(2)) : null,
      covered,
      coverage: decidable ? Math.round((covered / decidable) * 100) : null,
      awaiting,
    };
  }, [counts, reviews]);

  const isLoadingCounts = orgId ? applications === null : false;

  // Outbox entries carry no organizationId yet, so the rules let only the
  // platform admin read them.
  const isPlatformAdmin = userData?.platformAdmin === true;
  const outboxQuery = useMemoFirebase(() => {
    if (!firestore || !isPlatformAdmin) return null;
    return query(collection(firestore, 'sent_emails'), orderBy('sentAt', 'desc'), limit(5));
  }, [firestore, isPlatformAdmin]);

  const { data: recentEmails, isLoading: isOutboxLoading } = useCollection(outboxQuery);


  const activityQuery = useMemoFirebase(() => {
    if (!firestore || isPlatformAdmin || !orgId) return null;
    return query(
      collection(firestore, 'auditLog'),
      where('organizationId', '==', orgId),
      orderBy('timestamp', 'desc'),
      limit(5),
    );
  }, [firestore, isPlatformAdmin, orgId]);

  const { data: recentActivity, isLoading: isActivityLoading } = useCollection(activityQuery);


  const stats = [
    {
      title: 'Applications Received',
      value: counts.total.toString(),
      note: counts.drafts ? `${counts.drafts} draft${counts.drafts === 1 ? '' : 's'} not yet submitted` : null,
      icon: <FileText className="h-6 w-6 text-primary" />,
      link: '/admin/applicants',
      linkLabel: 'View All',
    },
    {
      title: 'Submitted',
      value: counts.submitted.toString(),
      note: 'Waiting for a first evaluation',
      icon: <ClipboardList className="h-6 w-6 text-blue-500" />,
      link: '/admin/applicants?status=submitted',
      linkLabel: 'Process Queue',
    },
    {
      title: 'Under Review',
      value: counts.underReview.toString(),
      note: 'At least one evaluation filed',
      icon: <Clock className="h-6 w-6 text-amber-500" />,
      link: '/admin/applicants?status=in%20review',
      linkLabel: 'Committee Progress',
    },
    {
      title: 'Awarded',
      value: counts.awarded.toString(),
      note: counts.declined ? `${counts.declined} declined` : null,
      icon: <CheckCircle className="h-6 w-6 text-green-500" />,
      link: '/admin/applicants?status=awarded',
      linkLabel: 'View Recipients',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center gap-2 flex-wrap">
           <Badge variant="outline" className="bg-primary/5 text-[10px] font-black uppercase tracking-widest px-2 py-0.5">
             {orgId ? `Org: ${orgId}` : isPlatformAdmin ? 'Platform administrator' : 'No organization'}
           </Badge>
           <p className="text-muted-foreground text-sm">
             {orgId
               ? 'Real-time monitoring of scholarship cycles and committee results.'
               : isPlatformAdmin
                 ? 'You are not a member of an organization, so there are no applications to show here.'
                 : 'Your account is not linked to an organization yet, so there is nothing to show.'}
           </p>
        </div>
        {!orgId && isPlatformAdmin && (
          <Link href="/admin/platform" className="text-sm text-primary hover:underline flex items-center gap-1 w-fit">
            Manage organizations <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="min-w-0 border-primary/10 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 p-4 pb-2 sm:items-center sm:p-6 sm:pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-tight text-muted-foreground sm:text-xs">{stat.title}</CardTitle>
              <span className="shrink-0 [&>svg]:h-5 [&>svg]:w-5 sm:[&>svg]:h-6 sm:[&>svg]:w-6">{stat.icon}</span>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="text-3xl font-bold sm:text-4xl">{isLoadingCounts ? '—' : stat.value}</div>
              {stat.note && <p className="text-[11px] text-muted-foreground mt-1">{stat.note}</p>}
              <Link
                href={stat.link}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-2"
              >
                {stat.linkLabel} <ExternalLink className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" />
              System Status
            </CardTitle>
            <CardDescription>Integration health checks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex items-center justify-between py-2 border-b">
               <div className="flex flex-col">
                 <span className="text-sm font-bold">{systemHealth?.email?.provider || 'Email'}</span>
                 <span className="text-[10px] text-muted-foreground">Email Dispatch Service</span>
               </div>
               {healthError ? (
                 <Badge variant="outline" className="text-muted-foreground">Check unavailable</Badge>
               ) : systemHealth?.email?.isConfigured ? (
                 <Badge className="bg-green-600 text-white font-bold">Active</Badge>
               ) : (
                 <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Simulation Mode</Badge>
               )}
             </div>
             <div className="flex items-center justify-between py-2 border-b">
               <div className="flex flex-col">
                 <span className="text-sm font-bold">Sender Email</span>
                 <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{systemHealth?.email?.senderEmail || '—'}</span>
               </div>
               {systemHealth?.email?.senderVerified ? (
                 <CheckCircle className="h-4 w-4 text-green-500" />
               ) : (
                 <AlertCircle className="h-4 w-4 text-amber-500" />
               )}
             </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-primary" />
              {isPlatformAdmin ? 'Recent Notifications' : 'Recent Activity'}
            </CardTitle>
            <CardDescription>
              {isPlatformAdmin ? 'Records of invitations and requests.' : 'The latest entries in your audit log.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isPlatformAdmin ? (
              isOutboxLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : recentEmails && recentEmails.length > 0 ? (
                <div className="space-y-4">
                  {recentEmails.map((email: any) => (
                    <div key={email.id} className="flex items-start justify-between border-b pb-3 last:border-0 last:pb-0">
                      <div className="space-y-1">
                        <p className="text-sm font-bold truncate max-w-[150px]">{email.recipient}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{email.subject}</p>
                        <div className="flex items-center gap-2 mt-1">
                           <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                              {email.deliveryMethod || 'Auto'}
                           </Badge>
                           <span className="text-[9px] text-muted-foreground font-mono">
                              {email.sentAt && new Date(email.sentAt.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                           </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic text-center py-6">No emails sent yet.</p>
              )
            ) : isActivityLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.map((item: any) => (
                  <div key={item.id} className="border-b pb-3 last:border-0 last:pb-0 space-y-1">
                    <p className="text-sm font-bold">{item.action}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">
                      {item.affectedStudent || item.targetId || ''}
                    </p>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      {item.timestamp?.seconds
                        ? new Date(item.timestamp.seconds * 1000).toLocaleString()
                        : ''}
                    </span>
                  </div>
                ))}
                <Link href="/admin/audit-log" className="text-xs text-primary hover:underline flex items-center gap-1">
                  Open the audit log <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-6">
                {orgId ? 'Nothing has happened yet.' : 'No organization, so there is no activity to show.'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Committee Stats</CardTitle>
            <CardDescription>Evaluation coverage, counted from the filed reviews.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Applications evaluated</span>
                <span className="font-bold">{committee.coverage === null ? '—' : `${committee.coverage}%`}</span>
              </div>
              <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full transition-all" style={{ width: `${committee.coverage ?? 0}%` }} />
              </div>
              <p className="text-xs text-muted-foreground italic">
                {committee.coverage === null
                  ? 'No submitted applications yet.'
                  : committee.awaiting > 0
                    ? `${committee.covered} of ${committee.covered + committee.awaiting} have at least one evaluation; ${committee.awaiting} still waiting.`
                    : 'Every submitted application has at least one evaluation.'}
              </p>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                 <div>
                    <p className="text-[10px] font-black uppercase text-muted-foreground">Avg Score</p>
                    <p className="text-lg font-bold">
                      {committee.averageScore === null ? '—' : committee.averageScore.toFixed(2)}
                    </p>
                 </div>
                 <div>
                    <p className="text-[10px] font-black uppercase text-muted-foreground">Reviews</p>
                    <p className="text-lg font-bold">{committee.reviewCount}</p>
                 </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
