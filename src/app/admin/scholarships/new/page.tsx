
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ScholarshipSchema, type Scholarship } from '@/types/scholarship';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, Loader2, Plus, Trash2, Calculator, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

export default function NewScholarshipPage() {
  const { firestore } = useFirebase();
  const { userData } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const organizationId = userData?.organizationId || userData?.schoolId || 'scholarship-hib4j';

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
  const totalWeight = currentRubric.reduce((acc, curr) => acc + (Number(curr.weight) || 0), 0);

  const onSubmit = async (data: Scholarship) => {
    if (!firestore) return;
    if (totalWeight !== 100) {
      toast({ title: "Invalid Rubric", description: `Total weight must be 100%. Currently ${totalWeight}%`, variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const scholarshipData = {
        ...data,
        organizationId: organizationId,
        schoolId: organizationId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // 1. Legacy save
      const docRef = await addDoc(collection(firestore, 'programs'), scholarshipData);

      // 2. Hierarchical save
      await setDoc(doc(firestore, 'organizations', organizationId, 'scholarships', docRef.id), scholarshipData);

      toast({ title: "Scholarship Published", description: "Program is now live for applicants." });
      router.push('/admin/scholarships');
    } catch (error) {
      toast({ title: "Error", description: "Failed to create program.", variant: "destructive" });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <ChevronLeft className="mr-2 h-4 w-4" /> Back to List
      </Button>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pb-20">
        <Card>
          <CardHeader>
            <CardTitle>Global Program Details</CardTitle>
            <CardDescription>Visible to all potential candidates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Program Title</Label>
              <Input id="name" {...register('name')} placeholder="e.g. Merit Scholars 2024" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Award Amount</Label>
                <Input id="amount" {...register('amount')} placeholder="$5,000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline Description</Label>
                <Input id="deadline" {...register('deadline')} placeholder="June 30th" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Full Description</Label>
              <Textarea id="description" {...register('description')} rows={4} placeholder="Eligibility and selection criteria..." />
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
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 space-y-2">
                    <Label className="text-[10px] font-black uppercase">Criterion Label</Label>
                    <Input {...register(`rubric.${index}.label`)} placeholder="Academic Achievement" />
                  </div>
                  <div className="w-24 space-y-2">
                    <Label className="text-[10px] font-black uppercase">Weight (%)</Label>
                    <Input type="number" {...register(`rubric.${index}.weight`, { valueAsNumber: true })} />
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

        <Button type="submit" className="w-full h-14 font-black uppercase tracking-widest" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create Scholarship Program
        </Button>
      </form>
    </div>
  );
}
