
'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ScholarshipSchema, type Scholarship } from '@/types/scholarship';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, Loader2 } from 'lucide-react';

export default function EditScholarshipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const docRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'programs', id);
  }, [firestore, id]);

  const { data: scholarship, isLoading } = useDoc<Scholarship>(docRef);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<Scholarship>({
    resolver: zodResolver(ScholarshipSchema),
  });

  useEffect(() => {
    if (scholarship) {
      reset({
        ...scholarship,
        tags: Array.isArray(scholarship.tags) ? scholarship.tags.join(', ') : scholarship.tags,
      });
    }
  }, [scholarship, reset]);

  const onSubmit = async (data: Scholarship) => {
    if (!firestore || !id) return;
    setIsSubmitting(true);

    try {
      await updateDoc(doc(firestore, 'programs', id), {
        ...data,
        updatedAt: serverTimestamp(),
      });

      toast({ title: "Scholarship Updated", description: "Changes have been saved successfully." });
      router.push('/admin/scholarships');
    } catch (error) {
      toast({ title: "Error", description: "Failed to update scholarship program.", variant: "destructive" });
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <ChevronLeft className="mr-2 h-4 w-4" /> Back to List
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Edit Scholarship</CardTitle>
          <CardDescription>
            Update the program details. Applicants will see these changes immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Scholarship Name</Label>
              <Input id="name" {...register('name')} placeholder="e.g. Academic Excellence Award" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Award Amount</Label>
                <Input id="amount" {...register('amount')} placeholder="e.g. $5,000" />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline Description</Label>
                <Input id="deadline" {...register('deadline')} placeholder="e.g. May 1st" />
                {errors.deadline && <p className="text-xs text-destructive">{errors.deadline.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input id="tags" {...register('tags')} placeholder="Academics, STEM, Leadership" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Full Description</Label>
              <Textarea 
                id="description" 
                {...register('description')} 
                placeholder="Provide eligibility criteria and award details..."
                rows={6}
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? 'Saving Changes...' : 'Update Scholarship'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
