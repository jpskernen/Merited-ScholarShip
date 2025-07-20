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

const assignedApplications = [
    { id: 'APP001', applicantName: 'John Smith', scholarship: 'Future Leaders Scholarship', assignedDate: '2024-09-01', status: 'Pending Review' },
    { id: 'APP005', applicantName: 'Emily White', scholarship: 'Creative Minds Grant', assignedDate: '2024-09-01', status: 'Pending Review' },
    { id: 'APP008', applicantName: 'Michael Brown', scholarship: 'Future Leaders Scholarship', assignedDate: '2024-08-30', status: 'Completed' },
    { id: 'APP012', applicantName: 'Sarah Green', scholarship: 'Community Champion Award', assignedDate: '2024-08-28', status: 'Completed' },
];

export default function ReviewerDashboardPage() {
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
              <TableHead>Applicant Name</TableHead>
              <TableHead>Scholarship</TableHead>
              <TableHead>Assigned Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignedApplications.map((app) => (
              <TableRow key={app.id}>
                <TableCell className="font-medium">{app.applicantName}</TableCell>
                <TableCell>{app.scholarship}</TableCell>
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
