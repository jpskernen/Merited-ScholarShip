// src/app/admin/scholarships/page.tsx
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
import { Badge } from '@/components/ui/badge';
import scholarships from '@/data/scholarships.json';
import { PlusCircle, Trash2, Edit } from 'lucide-react';

export default function AdminScholarshipsPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Scholarships</h1>
          <p className="text-muted-foreground">
            Add, edit, or remove scholarship listings.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/scholarships/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Scholarship
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scholarship Name</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scholarships.map((scholarship) => (
              <TableRow key={scholarship.id}>
                <TableCell className="font-medium">{scholarship.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{scholarship.amount}</Badge>
                </TableCell>
                <TableCell>{scholarship.deadline}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/scholarships/edit/${scholarship.id}`}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Link>
                  </Button>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
       {scholarships.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No scholarships have been added yet.
          </div>
        )}
    </div>
  );
}
