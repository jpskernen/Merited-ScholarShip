'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ScholarshipSchema, type Scholarship } from '@/types/scholarship';
import { Button } from '@/components/ui/button';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, Loader2, Users, Check, Plus, Trash2, Calculator, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { notifyReviewAssignment } from '@/app/admin/notify-actions';
import { saveScholarship, isRubricLocked } from '@/app/admin/scholarship-actions';
import { rubricWeightTotal, validateRubric } from '@/lib/rubric';
import { orgIdOf } from '@/lib/org';

export default function EditScholarshipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { firestore, user, userData } = useFirebase();
  const organizationId = orgIdOf(userData);
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const docRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'programs', id);
  }, [firestore, id]);

  const { data: scholarship, isLoading } = useDoc<Scholarship>(docRef);

  // Reviewers of this organization only. Role values are lowercase since
  // scripts/backfill-claims.js (the legacy spelling was 'Reviewer'). Two
  // equality filters need no composite index.
  const reviewersQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId) return null;
    return query(
      collection(firestore, 'users'),
      where('role', '==', 'reviewer'),
      where('organizationId', '==', organizationId),
    );
  }, [firestore, organizationId]);

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
  const totalWeight = rubricWeightTotal(rubricFields as any);

  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    let cancelled = false;
    (async () => {
      const result = await isRubricLocked(await user.getIdToken(), id);
      if (cancelled) return;
      if (result.success) setIsLocked(result.locked);
    })();
    return () => { cancelled = true; };
  }, [user, id]);

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

 
  const notifyNewReviewers = async (reviewerIds: string[]) => {
    const result = { sent: 0, simulated: 0, failed: 0 };
    if (!user) return { ...result, failed: reviewerIds.length };
    const idToken = await user.getIdToken();

    for (const uid of reviewerIds) {
      try {
        // The server reads the reviewer's address and the scholarship name
        // itself, and checks the assignment was saved.
        const sendResult = await notifyReviewAssignment(idToken, id, uid);
        if (!sendResult.success) result.failed += 1;
        else if (sendResult.method === 'Gmail SMTP') result.sent += 1;
        else result.simulated += 1;
      } catch {
        result.failed += 1;
      }
    }

    return result;
  };

  const describeSaveResult = ({ sent, simulated, failed }: { sent: number; simulated: number; failed: number }) => {
    const parts = ['Program details and committee assignments saved.'];
    if (sent) parts.push(`${sent} new reviewer${sent === 1 ? ' was' : 's were'} notified by email.`);
    if (simulated) parts.push(`${simulated} notification${simulated === 1 ? '' : 's'} could not be delivered — Gmail SMTP is not configured.`);
    if (failed) parts.push(`${failed} notification${failed === 1 ? '' : 's'} failed to send.`);
    return parts.join(' ');
  };

  const onSubmit = async (data: Scholarship) => {
    if (!user || !id) return;

    const rubricCheck = validateRubric(data.rubric as any);
    if (!rubricCheck.ok) {
      toast({ title: 'Invalid Rubric', description: rubricCheck.error, variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);

    // Compared before the write, so a save that only edits the rubric does not
    // re-notify a committee that was already assigned.
    const previousReviewerIds = scholarship?.reviewerIds || [];
    const newlyAssignedIds = (data.reviewerIds || []).filter(
      (uid) => !previousReviewerIds.includes(uid)
    );

    try {
      const result = await saveScholarship(await user.getIdToken(), {
        id,
        name: data.name,
        amount: data.amount,
        deadline: data.deadline,
        description: data.description,
        tags: data.tags as any,
        reviewerIds: data.reviewerIds || [],
        rubric: data.rubric as any,
      });

      if (!result.success) {
        toast({ title: 'Could not save', description: result.error, variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }

      const notified = await notifyNewReviewers(newlyAssignedIds);

      toast({
        title: "Scholarship Updated",
        description: describeSaveResult(notified),
      });
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
        <ChevronLeft className="mr-2 h-4 w-4" /> Back to Programs
      </Button>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pb-20">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Program Profile</CardTitle>
            <CardDescription>
              External program details visible to all potential applicants.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Scholarship Name</Label>
              <Input id="name" {...register('name')} placeholder="e.g. STEM Innovation Grant" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Award Amount</Label>
                <Input id="amount" {...register('amount')} placeholder="e.g. $5,000" />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline</Label>
                <Controller
                  name="deadline"
                  control={control}
                  render={({ field }) => (
                    <DatePickerField id="deadline" value={field.value} onChange={field.onChange} />
                  )}
                />
                {errors.deadline && <p className="text-xs text-destructive">{errors.deadline.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Focus Area Tags (Comma Separated)</Label>
              <Input id="tags" {...register('tags')} placeholder="Academic, Merit, First-Gen" />
            </div >

            <div className="space-y-2">
              <Label htmlFor="description">Full Program Description</Label>
              <Textarea 
                id="description" 
                {...register('description')} 
                placeholder="Detail eligibility, expectations, and selection timeline..."
                rows={6}
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-muted/30 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Evaluation Rubric
            </CardTitle>
            <CardDescription>
              Define scoring criteria. Total weight must equal 100%.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLocked && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
                <Lock className="h-4 w-4 mt-0.5 shrink-0 text-amber-700" />
                <p className="text-amber-900">
                  <span className="font-bold">Scoring has started.</span> Evaluations have already been filed against
                  these criteria and weights, so they can no longer be changed — changing them would restate scores
                  that are already on record. The rest of the programme details can still be edited.
                </p>
              </div>
            )}
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-4 animate-in slide-in-from-left-2">
                  <div className="flex-1 space-y-2">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Criterion</Label>
                    <Input {...register(`rubric.${index}.label`)} placeholder="e.g. Leadership Potential" disabled={isLocked} />
                  </div>
                  <div className="w-24 space-y-2">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Weight (%)</Label>
                    <Input type="number" {...register(`rubric.${index}.weight`, { valueAsNumber: true })} disabled={isLocked} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive hover:bg-destructive/10" disabled={isLocked}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {!isLocked && (
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => append({ id: `criterion-${Date.now()}`, label: '', weight: 0 })}>
                <Plus className="h-4 w-4 mr-2" /> Add Criteria
              </Button>
            )}

            <Separator className="my-4" />
            
            <div className="flex justify-between items-center px-2">
              <span className="text-sm font-bold">Total Weighted distribution</span>
              <Badge variant={totalWeight === 100 ? "default" : "destructive"} className="text-lg py-1 px-4 font-mono">
                {totalWeight}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Committee Assignments
            </CardTitle>
            <CardDescription>
              Select authorized reviewers for this specific scholarship cycle.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             {isReviewersLoading ? (
               <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
             ) : reviewers && reviewers.length > 0 ? (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 {reviewers.map((reviewer: any) => {
                   const isSelected = selectedReviewerIds.includes(reviewer.id);
                   return (
                     <div 
                       key={reviewer.id} 
                       onClick={() => toggleReviewer(reviewer.id)}
                       className={cn(
                         "flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all",
                         isSelected 
                           ? "bg-primary text-primary-foreground border-primary shadow-inner" 
                           : "bg-background border-transparent hover:border-primary/30"
                       )}
                     >
                       <div className="flex flex-col">
                         <span className="text-sm font-black">{reviewer.name || 'Committee Member'}</span>
                         <span className={cn("text-[10px] font-mono", isSelected ? "text-primary-foreground/70" : "text-muted-foreground")}>{reviewer.email}</span>
                       </div>
                       {isSelected ? <Check className="h-5 w-5" /> : <div className="h-5 w-5 rounded-full border-2 border-dashed border-muted-foreground/30" />}
                     </div>
                   );
                 })}
               </div>
             ) : (
               <div className="text-center py-10 border-2 border-dashed rounded-xl bg-muted/20">
                 <p className="text-sm text-muted-foreground font-medium">No registered reviewers found. Invite committee members from the Manage Reviewers tab.</p>
               </div>
             )}
          </CardContent>
        </Card>

        <Button type="submit" className="w-full h-14 text-lg font-black uppercase tracking-widest shadow-xl" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : null}
          {isSubmitting ? 'Syncing...' : 'Save & Distribute to Committee'}
        </Button>
      </form>
    </div>
  );
}
