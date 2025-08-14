
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getApplicants } from '@/lib/applicants';

export default async function ReviewerDashboardPage() {
    const assignedApplications = await getApplicants();

    // Mock status for demonstration purposes
    const applicationsWithStatus = assignedApplications.map((app, index) => ({
      ...app,
      status: index % 2 === 0 ? 'Pending Review' : 'Completed',
      assignedDate: `2024-09-0${index + 1}`
    }));

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'Completed': return 'default';
            case 'Pending Review': return 'secondary';
            default: return 'outline';
        }
    }
    
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Reviewer Dashboard</h1>
        <p className="text-muted-foreground">
          Here are the applications assigned to you for review.
        </p>
      </div>

       <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Applicant ID</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Assigned Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applicationsWithStatus.map((app) => (
              <TableRow key={app.id}>
                <TableCell className="font-medium">{app.isBlind ? `Applicant ${app.id}` : app.name}</TableCell>
                <TableCell>{app.school}</TableCell>
                <TableCell>{app.assignedDate}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(app.status)} className={app.status === 'Completed' ? 'bg-accent text-accent-foreground' : ''}>{app.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/review/applications/${app.id}`}>
                      {app.status === 'Completed' ? 'View Review' : 'Start Review'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {assignedApplications.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            You have no applications to review.
          </div>
      )}
    </div>
  );
}
