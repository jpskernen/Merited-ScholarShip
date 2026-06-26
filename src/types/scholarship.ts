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
    id: z.string(),
    label: z.string().min(1, 'Label required'),
    description: z.string().optional(),
    weight: z.number().min(0).max(100),
  })).optional().default([
    { id: "academic", label: "Academic Achievement", description: "Consider GPA and course difficulty", weight: 30 },
    { id: "essay", label: "Essay Quality", description: "Evaluate clarity and authenticity", weight: 25 },
    { id: "financial", label: "Financial Need", description: "Based on submitted financial information", weight: 20 },
    { id: "community", label: "Community Service", description: "Volunteer work and extracurriculars", weight: 15 },
    { id: "recommendation", label: "Recommendation Strength", description: "Quality of recommendation letters", weight: 10 }
  ]),
});

export type Scholarship = z.infer<typeof ScholarshipSchema>;
