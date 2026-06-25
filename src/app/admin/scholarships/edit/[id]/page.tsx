
'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, updateDoc, serverTimestamp, collection, query, where } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ScholarshipSchema, type Scholarship } from '@/types/scholarship';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, Loader2, Users, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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

  // Fetch all available reviewers
  const reviewersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'Reviewer'));
  }, [firestore]);

  const { data: reviewers, isLoading: isReviewersLoading } = useCollection(reviewersQuery);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<Scholarship>({
    resolver: zodResolver(ScholarshipSchema),
    defaultValues: {
      reviewerIds: []
    }
  });

  const selectedReviewerIds = watch('reviewerIds') || [];

  useEffect(() => {
    if (scholarship) {
      reset({
        ...scholarship,
        tags: Array.isArray(scholarship.tags) ? scholarship.tags.join(', ') : scholarship.tags,
        reviewerIds: scholarship.reviewerIds || []
      });
    }
  }, [scholarship, reset]);

  const toggleReviewer = (uid: string) => {
    const current = [...selectedReviewerIds];
    const index = current.indexOf(uid);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(uid);
    }
    setValue('reviewerIds', current, { shouldDirty: true });
  };

  const onSubmit = async (data: Scholarship) => {
    if (!firestore || !id) return;
    setIsSubmitting(true);

    try {
      await updateDoc(doc(firestore, 'programs', id), {
        ...data,
        updatedAt: serverTimestamp(),
      });

      toast({ title: "Scholarship Updated", description: "Changes and committee assignments saved." });
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
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <ChevronLeft className="mr-2 h-4 w-4" /> Back to List
      </Button>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Edit Scholarship Details</CardTitle>
            <CardDescription>
              Update the program details. Applicants will see these changes immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Assign Committee Members
            </CardTitle>
            <CardDescription>
              Select reviewers who are authorized to evaluate applications for this specific program.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             {isReviewersLoading ? (
               <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
             ) : reviewers && reviewers.length > 0 ? (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                 {reviewers.map((reviewer: any) => {
                   const isSelected = selectedReviewerIds.includes(reviewer.id);
                   return (
                     <div 
                       key={reviewer.id} 
                       onClick={() => toggleReviewer(reviewer.id)}
                       className={cn(
                         "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all",
                         isSelected 
                           ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]" 
                           : "bg-background border-border hover:border-primary/50"
                       )}
                     >
                       <div className="flex flex-col">
                         <span className="text-sm font-bold">{reviewer.name || 'Anonymous Reviewer'}</span>
                         <span className={cn("text-[10px]", isSelected ? "text-primary-foreground/70" : "text-muted-foreground")}>{reviewer.email}</span>
                       </div>
                       {isSelected ? <Check className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border border-dashed" />}
                     </div>
                   );
                 })}
               </div>
             ) : (
               <div className="text-center py-6 border-2 border-dashed rounded-lg">
                 <p className="text-sm text-muted-foreground italic">No reviewers found in the system.</p>
                 <Button variant="link" size="sm" asChild className="mt-2">
                    <a href="/admin/reviewers">Invite Committee Members</a>
                 </Button>
               </div>
             )}

             {selectedReviewerIds.length > 0 && (
               <div className="pt-4 border-t border-primary/10">
                 <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-2">Currently Assigned ({selectedReviewerIds.length})</p>
                 <div className="flex flex-wrap gap-2">
                   {selectedReviewerIds.map(id => {
                     const r = reviewers?.find(rev => rev.id === id);
                     return (
                       <Badge key={id} variant="secondary" className="gap-1.5 px-3 py-1 bg-white/10">
                         {r?.name || id.substring(0, 6)}
                         <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={(e) => { e.stopPropagation(); toggleReviewer(id); }} />
                       </Badge>
                     );
                   })}
                 </div>
               </div>
             )}
          </CardContent>
        </Card>

        <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          {isSubmitting ? 'Updating Assignments...' : 'Save Scholarship & Assignments'}
        </Button>
      </form>
    </div>
  );
}
