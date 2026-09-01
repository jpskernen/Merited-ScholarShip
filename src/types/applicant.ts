
// src/types/applicant.ts
import { z } from 'zod';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per user request
const ACCEPTED_FILE_TYPES = ['application/pdf'];

const fileSchema = z.union([
    z.string().url().optional().nullable(),
    z.instanceof(File).optional()
      .refine(file => file ? file.size <= MAX_FILE_SIZE : true, `Max file size is 10MB.`)
      .refine(
        file => file ? ACCEPTED_FILE_TYPES.includes(file.type) : true,
        "Only PDF files are accepted."
      ),
    z.literal(null),
    z.literal(undefined),
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
  essay: z.string().optional().nullable(),
  qualificationStatement: z.string().optional().nullable(),
  essays: z.array(z.object({
    promptId: z.string(),
    fileUrl: z.string().url(),
    fileName: z.string(),
    uploadedAt: z.any().optional()
  })).optional().default([]),
  documents: z.array(z.string().url()).optional().default([]),
  transcripts: z.string().url().optional().nullable(),
  resume: z.string().url().optional().nullable(),
  status: z.enum(['Draft', 'Submitted', 'In Review', 'Awarded', 'Not Awarded']).optional(),
  submissionDate: z.string().optional(),
  updatedAt: z.any().optional(),
  schoolId: z.string().optional(),
  reviewerIds: z.array(z.string()).optional().default([]),
  // Recommender fields
  recommenderName1: z.string().optional(),
  recommenderEmail1: z.string().optional(),
  recommenderTitle1: z.string().optional(),
  recommendationStatus1: z.enum(['Not Requested', 'Pending', 'Received']).optional().default('Not Requested'),
  recommendationLetter1: z.string().url().optional().nullable(),
  recommenderName2: z.string().optional(),
  recommenderEmail2: z.string().optional(),
  recommenderTitle2: z.string().optional(),
  recommendationStatus2: z.enum(['Not Requested', 'Pending', 'Received']).optional().default('Not Requested'),
  recommendationLetter2: z.string().url().optional().nullable(),
});

export type Applicant = z.infer<typeof ApplicantSchema>;
