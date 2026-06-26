'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
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
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        { criterion: 'Academic Excellence', weight: 40 },
        { criterion: 'Leadership', weight: 30 },
        { criterion: 'Community Impact', weight: 30 }
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
      await addDoc(collection(firestore, 'programs'), {
        ...data,
        schoolId: 'scholarship-hib4j',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

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
              <div key={field.id} className="flex gap-4 items-end">
                <div className="flex-1"><Label className="text-[10px] font-black uppercase">Criterion</Label><Input {...register(`rubric.${index}.criterion`)} /></div>
                <div className="w-24"><Label className="text-[10px] font-black uppercase">Weight (%)</Label><Input type="number" {...register(`rubric.${index}.weight`, { valueAsNumber: true })} /></div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeRubric(index)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <div className="flex justify-between items-center pt-4 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => appendRubric({ criterion: '', weight: 0 })}>Add Criterion</Button>
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
