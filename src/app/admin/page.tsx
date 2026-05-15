
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Award, FileCheck, Users, Clock, Mail, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';

export default function AdminDashboardPage() {
  const { firestore } = useFirebase();

  const outboxQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sent_emails'), orderBy('sentAt', 'desc'), limit(5));
  }, [firestore]);

  const { data: recentEmails, isLoading: isOutboxLoading } = useCollection(outboxQuery);

  const stats = [
    {
      title: 'Total Scholarships',
      value: '28',
      icon: <Award className="h-6 w-6 text-primary" />,
      link: '/admin/scholarships',
      linkLabel: 'Manage Scholarships',
    },
    {
      title: 'Pending Applications',
      value: '152',
      icon: <FileCheck className="h-6 w-6 text-yellow-500" />,
      link: '/admin/applicants',
      linkLabel: 'Review Applicants',
    },
    {
      title: 'Active Reviewers',
      value: '12',
      icon: <Users className="h-6 w-6 text-green-500" />,
      link: '/admin/reviewers',
      linkLabel: 'Manage Reviewers',
    },
    {
      title: 'Avg. Review Time',
      value: '3.2 Days',
      icon: <Clock className="h-6 w-6 text-red-500" />,
      link: '#',
      linkLabel: 'View Analytics',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage scholarships, applicants, and system-wide invitations.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              {stat.icon}
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{stat.value}</div>
              <Link
                href={stat.link}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-1"
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
            <CardDescription>Records of AI-generated invitation emails.</CardDescription>
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
                        {new Date(email.sentAt?.seconds * 1000).toLocaleString()}
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
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground italic">Activity feed coming soon...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
