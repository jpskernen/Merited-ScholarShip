
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
  rubric: z.array(z.object({
    criterion: z.string().min(1, 'Criterion name required'),
    weight: z.number().min(0).max(100),
  })).optional().default([
    { criterion: 'Academic Excellence', weight: 25 },
    { criterion: 'Involvement', weight: 15 },
    { criterion: 'Community Service', weight: 15 },
    { criterion: 'Leadership', weight: 15 },
    { criterion: 'Major Alignment', weight: 10 },
    { criterion: 'Overall Impression', weight: 20 }
  ]),
});

export type Scholarship = z.infer<typeof ScholarshipSchema>;
