import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Mock data
const applications = [
  {
    id: 'APP001',
    scholarship: 'Future Leaders Scholarship',
    date: '2024-08-15',
    status: 'In Review',
  },
  {
    id: 'APP002',
    scholarship: 'Creative Minds Grant',
    date: '2024-08-01',
    status: 'Submitted',
  },
  {
    id: 'APP003',
    scholarship: 'Innovators of Tomorrow',
    date: '2024-07-20',
    status: 'Awarded',
  },
  {
    id: 'APP004',
    scholarship: 'Academic Excellence Award',
    date: '2024-06-10',
    status: 'Not Awarded',
  },
];

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'Awarded':
      return 'default'; // Using accent color for success
    case 'In Review':
      return 'secondary';
    case 'Submitted':
      return 'outline';
    case 'Not Awarded':
      return 'destructive';
    default:
      return 'outline';
  }
};

export default function ApplicationsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">My Applications</h1>
        <p className="text-muted-foreground">
          Track the status of all your scholarship applications.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scholarship</TableHead>
              <TableHead>Date Submitted</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((app) => (
              <TableRow key={app.id}>
                <TableCell className="font-medium">{app.scholarship}</TableCell>
                <TableCell>{app.date}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={getStatusVariant(app.status)} className={app.status === 'Awarded' ? 'bg-accent text-accent-foreground' : ''}>
                    {app.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
       {applications.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            You haven&apos;t submitted any applications yet.
          </div>
        )}
    </div>
  );
}
