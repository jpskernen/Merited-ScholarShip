
// src/types/applicant.ts
import { z } from 'zod';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_FILE_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

const fileSchema = z.union([
    z.string().url().optional().nullable(),
    z.instanceof(File).optional()
      .refine(file => file ? file.size <= MAX_FILE_SIZE : true, `Max file size is 5MB.`)
      .refine(
        file => file ? file.type === '' || ACCEPTED_FILE_TYPES.includes(file.type) : true,
        ".pdf, .doc, and .docx files are accepted."
      ),
    z.literal(null),
    z.literal(undefined),
    z.any().refine(val => val === null || val === undefined || (typeof val === 'object' && val.length === 0), "File is required").optional(),
]).optional();


export const ApplicantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Full name is required.'),
  email: z.string().email('Invalid email address.'),
  secondaryEmail: z.string().email('Invalid secondary email address.').optional().or(z.literal('')),
  address: z.string().min(5, 'Physical address is required.'),
  gpa: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? 0 : (typeof val === 'string' ? parseFloat(val) : val)),
    z.number().min(0).max(5.0, 'GPA must be between 0 and 5.0.')
  ),
  major: z.string().min(1, 'Intended major is required.'),
  school: z.string().min(1, "School is required."),
  interests: z.string().min(1, 'Please list at least one interest.'),
  activities: z.string().min(1, 'Please list at least one activity.'),
  essay: z.string().min(50, 'Essay must be at least 50 characters long.'),
  qualificationStatement: z.string().min(50, 'Qualification statement must be at least 50 characters long.'),
  transcripts: fileSchema,
  resume: fileSchema,
  recommendationLetter1: fileSchema,
  recommendationLetter2: fileSchema,
  isBlind: z.boolean().optional(),
  firstChoiceSchool: z.string().optional(),
  firstChoiceAccepted: z.boolean().optional(),
  secondChoiceSchool: z.string().optional(),
  secondChoiceAccepted: z.boolean().optional(),
  thirdChoiceSchool: z.string().optional(),
  thirdChoiceAccepted: z.boolean().optional(),
  fourthChoiceSchool: z.string().optional(),
  fifthChoiceSchool: z.string().optional(),
  acceptanceLetter: fileSchema,
  satActScore: z.string().optional(),
}).transform(data => {
    return {
        ...data,
        transcripts: data.transcripts || null,
        resume: data.resume || null,
        acceptanceLetter: data.acceptanceLetter || null,
        recommendationLetter1: data.recommendationLetter1 || null,
        recommendationLetter2: data.recommendationLetter2 || null,
    }
});

export type Applicant = z.infer<typeof ApplicantSchema>;
