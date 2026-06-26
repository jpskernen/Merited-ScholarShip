import { z } from 'zod';

export const ScholarshipSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Scholarship name is required.'),
  amount: z.string().min(1, 'Amount is required.'),
  deadline: z.string().min(1, 'Deadline description is required (e.g., May 1st).'),
  tags: z.string().transform(val => val.split(',').map(s => s.trim()).filter(s => s !== '')).or(z.array(z.string())),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  schoolId: z.string().optional(),
  reviewerIds: z.array(z.string()).optional().default([]),
  prompts: z.array(z.object({
    id: z.string(),
    title: z.string().min(1, 'Prompt title required'),
    description: z.string().optional(),
  })).optional().default([
    { id: 'personal-statement', title: 'Personal Statement', description: 'Tell us about your background and goals.' }
  ]),
  rubric: z.array(z.object({
    criterion: z.string().min(1, 'Criterion name required'),
    weight: z.number().min(0).max(100),
  })).optional().default([
    { criterion: 'Academic Excellence', weight: 40 },
    { criterion: 'Leadership', weight: 30 },
    { criterion: 'Community Impact', weight: 30 }
  ]),
});

export type Scholarship = z.infer<typeof ScholarshipSchema>;
