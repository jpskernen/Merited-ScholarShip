
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
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
import { ChevronLeft, Loader2, Plus, Trash2, Calculator, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { orgIdOf } from '@/lib/org';
import { saveScholarship } from '@/app/admin/scholarship-actions';
import { rubricWeightTotal, validateRubric } from '@/lib/rubric';

export default function NewScholarshipPage() {
  const { user, userData } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const organizationId = orgIdOf(userData);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<Scholarship>({
    resolver: zodResolver(ScholarshipSchema),
    defaultValues: {
      tags: 'Academics, Merit',
      prompts: [{ id: 'prompt-1', title: 'Personal Statement' }],
      rubric: [
        { id: "academic", label: "Academic Achievement", description: "Consider GPA and course difficulty", weight: 30 },
        { id: "essay", label: "Essay Quality", description: "Evaluate clarity and authenticity", weight: 25 },
        { id: "financial", label: "Financial Need", description: "Based on submitted financial information", weight: 20 },
        { id: "community", label: "Community Service", description: "Volunteer work and extracurriculars", weight: 15 },
        { id: "recommendation", label: "Recommendation Strength", description: "Quality of recommendation letters", weight: 10 }
      ]
    }
  });

  const { fields: rubricFields, append: appendRubric, remove: removeRubric } = useFieldArray({
    control,
    name: "rubric"
  });

  const { fields: promptFields, append: appendPrompt, remove: removePrompt } = useFieldArray({
    control,
    name: "prompts"
  });

  const currentRubric = watch('rubric') || [];
  const totalWeight = rubricWeightTotal(currentRubric as any);

  const onSubmit = async (data: Scholarship) => {
    if (!user) return;
    if (!organizationId) {
      toast({ title: "No organization", description: "Your account is not linked to an organization, so the scholarship cannot be created.", variant: "destructive" });
      return;
    }

    const rubricCheck = validateRubric(data.rubric as any);
    if (!rubricCheck.ok) {
      toast({ title: 'Invalid Rubric', description: rubricCheck.error, variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await saveScholarship(await user.getIdToken(), {
        name: data.name,
        amount: data.amount,
        deadline: data.deadline,
        description: data.description,
        tags: data.tags as any,
        rubric: data.rubric as any,
        prompts: data.prompts,
      });

      if (!result.success) {
        toast({ title: 'Could not create the program', description: result.error, variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }

      toast({ title: "Scholarship Published", description: "Program is now live for applicants." });
      router.push('/admin/scholarships');
    } catch (error) {
      toast({ title: "Error", description: "Failed to create program.", variant: "destructive" });
      setIsSubmitting(false);
    }
  };

  // Without this, a failed validation did nothing at all: no toast, and the
  // field errors were never rendered, so the button simply looked broken.
  const onInvalid = () => {
    toast({ title: 'Please fix the highlighted fields', variant: 'destructive' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <ChevronLeft className="mr-2 h-4 w-4" /> Back to List
      </Button>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-8 pb-20">
        <Card>
          <CardHeader>
            <CardTitle>Global Program Details</CardTitle>
            <CardDescription>Visible to all potential candidates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Program Title</Label>
              <Input id="name" {...register('name')} placeholder="e.g. Merit Scholars 2024" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Award Amount</Label>
                <Input id="amount" {...register('amount')} placeholder="$5,000" />
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
              <Input id="tags" {...register('tags')} placeholder="Academics, Merit" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Full Description</Label>
              <Textarea id="description" {...register('description')} rows={4} placeholder="Eligibility and selection criteria..." />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-muted/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Narrative Prompts</CardTitle>
            <CardDescription>Specify what applicants should write about.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {promptFields.map((field, index) => (
              <div key={field.id} className="flex gap-4 items-start">
                <div className="flex-1 space-y-2">
                  <Input {...register(`prompts.${index}.title`)} placeholder="Prompt Title (e.g. Why Merit?)" />
                  {errors.prompts?.[index]?.title && <p className="text-xs text-destructive">{errors.prompts[index]?.title?.message}</p>}
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removePrompt(index)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => appendPrompt({ id: `p-${Date.now()}`, title: '' })}>
              <Plus className="h-4 w-4 mr-2" /> Add Prompt
            </Button>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Committee Rubric</CardTitle>
            <CardDescription>Weights must total exactly 100%.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {rubricFields.map((field, index) => (
              <div key={field.id} className="flex flex-col gap-4 p-4 border rounded-lg bg-background mb-4">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2 sm:flex-nowrap">
                  <div className="w-full min-w-0 space-y-2 sm:w-auto sm:flex-1">
                    <Label className="text-[10px] font-black uppercase">Criterion Label</Label>
                    <Input {...register(`rubric.${index}.label`)} placeholder="Academic Achievement" />
                    {errors.rubric?.[index]?.label && <p className="text-xs text-destructive">{errors.rubric[index]?.label?.message}</p>}
                  </div>
                  <div className="w-24 flex-1 space-y-2 sm:flex-none">
                    <Label className="text-[10px] font-black uppercase">Weight (%)</Label>
                    <Input type="number" {...register(`rubric.${index}.weight`, { valueAsNumber: true })} />
                    {errors.rubric?.[index]?.weight && <p className="text-xs text-destructive">Enter 0–100.</p>}
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeRubric(index)} className="mt-6 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Description (Reviewer Hint)</Label>
                  <Input {...register(`rubric.${index}.description`)} placeholder="Consider GPA and course difficulty..." />
                </div>
              </div>
            ))}
            <div className="flex justify-between items-center pt-4 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => appendRubric({ id: `r-${Date.now()}`, label: '', weight: 0, description: '' })}>Add Criterion</Button>
              <Badge variant={totalWeight === 100 ? "default" : "destructive"} className="text-lg px-4 font-mono">{totalWeight}%</Badge>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full h-auto min-h-14 whitespace-normal px-4 py-3 font-black uppercase tracking-wider sm:tracking-widest" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create Scholarship Program
        </Button>
      </form>
    </div>
  );
}



