// src/types/scholarship.ts
import { z } from 'zod';

export const ScholarshipSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Scholarship name is required.'),
  amount: z.string().min(1, 'Amount is required.'),
  deadline: z.string().refine((val) => /^\d{4}-\d{2}-\d{2}$/.test(val), {
    message: "Deadline must be in YYYY-MM-DD format.",
  }),
  tags: z.array(z.string()),
  description: z.string().min(1, 'Description is required.'),
});

export type Scholarship = z.infer<typeof ScholarshipSchema>;
