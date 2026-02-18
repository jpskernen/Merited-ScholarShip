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
import { ArrowRight, EyeOff, Search } from 'lucide-react';
import { getApplicants } from '@/lib/applicants';

export default async function ReviewerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
    const { status: statusFilter } = await searchParams;
    const assignedApplications = await getApplicants();

    // Mock status logic for demonstration
    // In a real app, this would be based on the existence of a review doc for this application/reviewer
    const applicationsWithStatus = assignedApplications.map((app, index) => ({
      ...app,
      status: index % 2 === 0 ? 'Pending Review' : 'Completed',
      assignedDate: `2024-09-0${index + 1}`
    }));

    // Filter based on navigation selection
    const filteredApplications = applicationsWithStatus.filter(app => {
      if (!statusFilter) return true;
      if (statusFilter === 'pending') return app.status === 'Pending Review';
      if (statusFilter === 'completed') return app.status === 'Completed';
      return true;
    });

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'Completed': return 'default';
            case 'Pending Review': return 'secondary';
            default: return 'outline';
        }
    }

    const title = statusFilter === 'pending' 
      ? 'Review New Applications' 
      : statusFilter === 'completed' 
      ? 'Completed Scoring' 
      : 'Review Dashboard';
    
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground">
          {statusFilter === 'pending' 
            ? 'Evaluation required for these candidates.' 
            : statusFilter === 'completed' 
            ? 'View your final scores and comments here.' 
            : 'Overview of all applications assigned to you.'}
        </p>
      </div>

       <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Applicant Name/ID</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Assigned Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredApplications.map((app) => {
              const displayName = app.isBlind 
                ? `Applicant ${app.id.substring(0, 6)}` 
                : app.name;

              return (
                <TableRow key={app.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {displayName}
                      {app.isBlind && (
                        <Badge variant="outline" className="text-[10px] h-4 border-primary/20 text-primary/70">
                          <EyeOff className="h-2 w-2 mr-1" /> Blind
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{app.school}</TableCell>
                  <TableCell>{app.assignedDate}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(app.status)} className={app.status === 'Completed' ? 'bg-accent text-accent-foreground' : ''}>{app.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/review/applications/${app.id}`}>
                        {app.status === 'Completed' ? 'View Score' : 'Score Application'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {filteredApplications.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-4 opacity-20" />
            <p>No applications found matching this category.</p>
          </div>
      )}
    </div>
  );
}
