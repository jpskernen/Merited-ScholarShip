
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Award, FileCheck, Users, Clock, Mail, ExternalLink, Loader2, FileText, CheckCircle, Search, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirebase, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, limit, where, onSnapshot } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';

export default function AdminDashboardPage() {
  const { firestore } = useFirebase();
  const { userData } = useUser();
  
  // Multi-tenant Org ID (SaaS School ID)
  const orgId = userData?.schoolId || 'default-school';

  const [counts, setCounts] = useState({
    total: 0,
    submitted: 0,
    underReview: 0,
    awarded: 0
  });

  useEffect(() => {
    if (!firestore || !orgId) return;

    const applicantsRef = collection(firestore, 'users');
    
    // Listener for Total Applications in this Org
    const qTotal = query(
      applicantsRef, 
      where('role', '==', 'Applicant'), 
      where('schoolId', '==', orgId)
    );
    const unsubscribeTotal = onSnapshot(qTotal, (snapshot) => {
      setCounts(prev => ({ ...prev, total: snapshot.size }));
    });

    // Listener for 'Submitted'
    const qSubmitted = query(
      applicantsRef, 
      where('role', '==', 'Applicant'), 
      where('schoolId', '==', orgId), 
      where('status', '==', 'Submitted')
    );
    const unsubscribeSubmitted = onSnapshot(qSubmitted, (snapshot) => {
      setCounts(prev => ({ ...prev, submitted: snapshot.size }));
    });

    // Listener for 'Under Review' (mapped to 'In Review' in our schema)
    const qReview = query(
      applicantsRef, 
      where('role', '==', 'Applicant'), 
      where('schoolId', '==', orgId), 
      where('status', '==', 'In Review')
    );
    const unsubscribeReview = onSnapshot(qReview, (snapshot) => {
      setCounts(prev => ({ ...prev, underReview: snapshot.size }));
    });

    // Listener for 'Awarded'
    const qAwarded = query(
      applicantsRef, 
      where('role', '==', 'Applicant'), 
      where('schoolId', '==', orgId), 
      where('status', '==', 'Awarded')
    );
    const unsubscribeAwarded = onSnapshot(qAwarded, (snapshot) => {
      setCounts(prev => ({ ...prev, awarded: snapshot.size }));
    });

    // Unsubscribe on unmount to prevent leaks
    return () => {
      unsubscribeTotal();
      unsubscribeSubmitted();
      unsubscribeReview();
      unsubscribeAwarded();
    };
  }, [firestore, orgId]);

  const outboxQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sent_emails'), orderBy('sentAt', 'desc'), limit(5));
  }, [firestore]);

  const { data: recentEmails, isLoading: isOutboxLoading } = useCollection(outboxQuery);

  const stats = [
    {
      title: 'Total Applications',
      value: counts.total.toString(),
      icon: <FileText className="h-6 w-6 text-primary" />,
      link: '/admin/applicants',
      linkLabel: 'View All',
    },
    {
      title: 'Submitted',
      value: counts.submitted.toString(),
      icon: <ClipboardList className="h-6 w-6 text-blue-500" />,
      link: '/admin/applicants',
      linkLabel: 'Process Queue',
    },
    {
      title: 'Under Review',
      value: counts.underReview.toString(),
      icon: <Clock className="h-6 w-6 text-amber-500" />,
      link: '/admin/applicants',
      linkLabel: 'Committee Progress',
    },
    {
      title: 'Awarded',
      value: counts.awarded.toString(),
      icon: <CheckCircle className="h-6 w-6 text-green-500" />,
      link: '/admin/applicants',
      linkLabel: 'View Recipients',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center gap-2">
           <Badge variant="outline" className="bg-primary/5 text-[10px] font-black uppercase tracking-widest px-2 py-0.5">
             Org: {orgId}
           </Badge>
           <p className="text-muted-foreground text-sm">
             Real-time monitoring of scholarship cycles and committee results.
           </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-primary/10 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-tight text-muted-foreground">{stat.title}</CardTitle>
              {stat.icon}
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{stat.value}</div>
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
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              System Outbox (Simulated)
            </CardTitle>
            <CardDescription>Records of AI-generated invitation emails and notifications.</CardDescription>
          </CardHeader>
          <CardContent>
            {isOutboxLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : recentEmails && recentEmails.length > 0 ? (
              <div className="space-y-4">
                {recentEmails.map((email: any) => (
                  <div key={email.id} className="flex items-start justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <p className="text-sm font-bold">{email.recipient}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{email.subject}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {email.sentAt && new Date(email.sentAt.seconds * 1000).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                      {email.type}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-6">No emails sent yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Committee Analytics</CardTitle>
            <CardDescription>High-level overview of review coverage and score distribution.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Portfolio Completion</span>
                <span className="font-bold">88%</span>
              </div>
              <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[88%]" />
              </div>
              <p className="text-xs text-muted-foreground italic">
                Committees are currently processing the spring award cycle.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
