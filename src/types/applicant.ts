// src/types/applicant.ts
import { z } from 'zod';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_FILE_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

const fileSchema = z.instanceof(File)
  .optional()
  .refine((file) => !file || file.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
  .refine(
    (file) => !file || ACCEPTED_FILE_TYPES.includes(file.type),
    ".pdf, .doc, and .docx files are accepted."
  );

export const ApplicantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Full name is required.'),
  email: z.string().email('Invalid email address.'),
  gpa: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().min(0).max(5.0, 'GPA must be between 0 and 5.0.')
  ),
  major: z.string().min(1, 'Intended major is required.'),
  school: z.string().min(1, "School is required."),
  interests: z.string().min(1, 'Please list at least one interest.'),
  activities: z.string().min(1, 'Please list at least one activity.'),
  essay: z.string().min(50, 'Essay must be at least 50 characters long.'),
  transcripts: fileSchema.or(z.string()).optional(),
  resume: fileSchema.or(z.string()).optional(),
  isBlind: z.boolean().optional(),
  firstChoiceSchool: z.string().optional(),
  firstChoiceAccepted: z.boolean().optional(),
  secondChoiceSchool: z.string().optional(),
  secondChoiceAccepted: z.boolean().optional(),
  thirdChoiceSchool: z.string().optional(),
  thirdChoiceAccepted: z.boolean().optional(),
  fourthChoiceSchool: z.string().optional(),
  fifthChoiceSchool: z.string().optional(),
  acceptanceLetter: fileSchema.or(z.string()).optional(),
  satActScore: z.string().optional(),
});

export type Applicant = z.infer<typeof ApplicantSchema>;
