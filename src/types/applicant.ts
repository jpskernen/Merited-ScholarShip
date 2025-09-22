// src/types/applicant.ts
import { z } from 'zod';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_FILE_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export const ApplicantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Full name is required.'),
  email: z.string().email('Invalid email address.'),
  gpa: z.number().min(0).max(5.0, 'GPA must be between 0 and 5.0.'),
  major: z.string().min(1, 'Intended major is required.'),
  school: z.string().min(1, "School is required."),
  interests: z.string().min(1, 'Please list at least one interest.'),
  activities: z.string().min(1, 'Please list at least one activity.'),
  essay: z.string().min(50, 'Essay must be at least 50 characters long.'),
  transcripts: z.any()
    .refine((files) => !files || (files?.[0]?.size <= MAX_FILE_SIZE), `Max file size is 5MB.`)
    .refine(
      (files) => !files || ACCEPTED_FILE_TYPES.includes(files?.[0]?.type),
      ".pdf, .doc, and .docx files are accepted."
    ).or(z.string()).optional(),
  resume: z.any()
    .refine((files) => !files || (files?.[0]?.size <= MAX_FILE_SIZE), `Max file size is 5MB.`)
    .refine(
      (files) => !files || ACCEPTED_FILE_TYPES.includes(files?.[0]?.type),
      ".pdf, .doc, and .docx files are accepted."
    ).or(z.string()).optional(),
  isBlind: z.boolean().optional(),
  firstChoiceSchool: z.string().optional(),
  firstChoiceAccepted: z.boolean().optional(),
  secondChoiceSchool: z.string().optional(),
  secondChoiceAccepted: z.boolean().optional(),
  thirdChoiceSchool: z.string().optional(),
  thirdChoiceAccepted: z.boolean().optional(),
  fourthChoiceSchool: z.string().optional(),
  fourthChoiceAccepted: z.boolean().optional(),
  fifthChoiceSchool: z.string().optional(),
  fifthChoiceAccepted: z.boolean().optional(),
  acceptanceLetter: z.any()
    .refine((files) => !files || (files?.[0]?.size <= MAX_FILE_SIZE), `Max file size is 5MB.`)
    .refine(
      (files) => !files || ACCEPTED_FILE_TYPES.includes(files?.[0]?.type),
      ".pdf, .doc, and .docx files are accepted."
    ).or(z.string()).optional(),
});

export type Applicant = z.infer<typeof ApplicantSchema>;
