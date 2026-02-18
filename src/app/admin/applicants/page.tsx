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
import { EyeOff, User } from 'lucide-react';

export default async function ApplicantsPage() {
  const applicants = await getApplicants();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">All Applicants</h1>
        <p className="text-muted-foreground">
          Browse and review all submitted applications. Admins can see full identities regardless of blind settings.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>School</TableHead>
              <TableHead>GPA</TableHead>
              <TableHead>Review Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applicants.map((applicant) => (
              <TableRow key={applicant.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span className="flex items-center gap-2">
                      {applicant.name}
                      {applicant.isBlind && (
                        <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-50">
                          <EyeOff className="h-3 w-3 mr-1" /> Blind Mode
                        </Badge>
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">{applicant.id}</span>
                  </div>
                </TableCell>                
                <TableCell>{applicant.school}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{applicant.gpa.toFixed(2)}</Badge>
                </TableCell>
                <TableCell>
                   <Badge variant="outline" className="text-xs">
                     {applicant.isBlind ? 'Anonymized for Reviewers' : 'Identity Public to Reviewers'}
                   </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/review/applications/${applicant.id}`}>
                      View Application
                    </Link>
                  </Button>
                  {/* Future: Add Toggle Blind Mode client action here */}
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
