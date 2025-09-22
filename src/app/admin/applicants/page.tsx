// src/app/(main)/admin/applicants/page.tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getApplicants } from '@/lib/applicants';
import { Badge } from '@/components/ui/badge';
import { EyeOff } from 'lucide-react';

export default async function ApplicantsPage() {
  const applicants = await getApplicants();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">All Applicants</h1>
        <p className="text-muted-foreground">
          Browse and review all submitted applications.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>School</TableHead>
              <TableHead>GPA</TableHead>
              <TableHead>Major</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applicants.map((applicant) => (
              <TableRow key={applicant.id}>
                <TableCell className="font-medium">{applicant.isBlind ? 'Applicant (Hidden)' : applicant.name}</TableCell>                
                <TableCell>{applicant.school}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{applicant.gpa.toFixed(2)}</Badge>
                </TableCell>
                <TableCell>{applicant.major}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/review/applications/${applicant.id}`}>
                      Review Application
                    </Link>
                  </Button>
                   <Button variant="ghost" size="sm">
                    <EyeOff className="h-4 w-4 mr-2" />
                    Make Blind
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
       {applicants.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No applications have been submitted yet.
          </div>
        )}
    </div>
  );
}
