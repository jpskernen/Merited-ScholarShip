
import { z } from 'zod';

export const ScholarshipSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Scholarship name is required.'),
  amount: z.string().min(1, 'Amount is required.'),
  deadline: z.string().min(1, 'Deadline description is required (e.g., May 1st).'),
  tags: z.string().transform(val => val.split(',').map(s => s.trim()).filter(s => s !== '')).or(z.array(z.string())),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  schoolId: z.string().optional(),
});

export type Scholarship = z.infer<typeof ScholarshipSchema>;
