import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, FileCheck, Users, Clock } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const stats = [
    {
      title: 'Total Scholarships',
      value: '28',
      icon: <Award className="h-6 w-6 text-primary" />,
      link: '#',
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
      link: '#',
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
          Manage scholarships, applicants, and reviewers.
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
                className="text-xs text-muted-foreground hover:text-primary"
              >
                {stat.linkLabel}
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Add more sections like Recent Activity, etc. */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Activity feed coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}
