// src/types/applicant.ts
import { z } from 'zod';

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
  resume: z.string().url().optional().nullable(),
  status: z.enum(['Draft', 'Submitted', 'In Review', 'Awarded', 'Not Awarded']).optional(),
  submissionDate: z.string().optional(),
  updatedAt: z.any().optional(),
  schoolId: z.string().optional(),
  organizationId: z.string().optional(),
  reviewerIds: z.array(z.string()).optional().default([]),
  // Recommender fields
  recommenderName1: z.string().optional(),
  recommenderEmail1: z.string().optional(),
  recommenderTitle1: z.string().optional(),
  recommendationStatus1: z.enum(['Not Requested', 'Pending', 'Received']).optional().default('Not Requested'),
  recommendationLetter1: z.string().url().optional().nullable(),
  recommendationLetterText1: z.string().optional().nullable(),
  recommenderName2: z.string().optional(),
  recommenderEmail2: z.string().optional(),
  recommenderTitle2: z.string().optional(),
  recommendationStatus2: z.enum(['Not Requested', 'Pending', 'Received']).optional().default('Not Requested'),
  recommendationLetter2: z.string().url().optional().nullable(),
  recommendationLetterText2: z.string().optional().nullable(),
});

export type Applicant = z.infer<typeof ApplicantSchema>;


export const ProfileSchema = ApplicantSchema.pick({
  name: true,
  email: true,
  secondaryEmail: true,
  address: true,
  gpa: true,
  major: true,
  school: true,
  interests: true,
  schoolId: true,
  organizationId: true,
});

export type Profile = z.infer<typeof ProfileSchema>;
