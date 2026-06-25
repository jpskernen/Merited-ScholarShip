
'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, updateDoc, serverTimestamp, collection, query, where } from 'firebase/firestore';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ScholarshipSchema, type Scholarship } from '@/types/scholarship';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, Loader2, Users, Check, X, Plus, Trash2, Calculator } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

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
    control,
  } = useForm<Scholarship>({
    resolver: zodResolver(ScholarshipSchema),
    defaultValues: {
      reviewerIds: [],
      rubric: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "rubric"
  });

  const selectedReviewerIds = watch('reviewerIds') || [];
  const rubricFields = watch('rubric') || [];
  const totalWeight = rubricFields.reduce((acc, curr) => acc + (Number(curr.weight) || 0), 0);

  useEffect(() => {
    if (scholarship) {
      reset({
        ...scholarship,
        tags: Array.isArray(scholarship.tags) ? scholarship.tags.join(', ') : scholarship.tags,
        reviewerIds: scholarship.reviewerIds || [],
        rubric: scholarship.rubric || []
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
    if (totalWeight !== 100) {
      toast({ title: "Invalid Rubric", description: "Total weight must equal 100%. Currently: " + totalWeight + "%", variant: "destructive" });
      return;
    }
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
    <div className="max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <ChevronLeft className="mr-2 h-4 w-4" /> Back to List
      </Button>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pb-20">
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
            </div >

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

        {/* Evaluation Rubric */}
        <Card border-primary/20 bg-muted/30>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Scoring Rubric
            </CardTitle>
            <CardDescription>
              Define the evaluation criteria and their relative importance. Total weight must be 100%.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Criterion Name</Label>
                    <Input {...register(`rubric.${index}.criterion`)} placeholder="e.g. GPA Quality" />
                  </div>
                  <div className="w-24 space-y-2">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Weight (%)</Label>
                    <Input type="number" {...register(`rubric.${index}.weight`, { valueAsNumber: true })} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => append({ criterion: '', weight: 0 })}>
              <Plus className="h-4 w-4 mr-2" /> Add Criterion
            </Button>

            <Separator className="my-4" />
            
            <div className="flex justify-between items-center px-2">
              <span className="text-sm font-bold">Total Rubric Weight</span>
              <Badge variant={totalWeight === 100 ? "default" : "destructive"} className="text-lg py-1 px-4">
                {totalWeight}%
              </Badge>
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
              Select reviewers authorized to evaluate applications for this specific program.
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
                           ? "bg-primary text-primary-foreground border-primary shadow-md" 
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
               </div>
             )}
          </CardContent>
        </Card>

        <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          {isSubmitting ? 'Updating Program...' : 'Save Scholarship & assignments'}
        </Button>
      </form>
    </div>
  );
}
