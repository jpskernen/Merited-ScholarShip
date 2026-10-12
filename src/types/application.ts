// src/types/application.ts

import { z } from 'zod';
import { ProfileSchema } from './applicant';

export const APPLICATION_STATUSES = [
  'Draft',
  'Submitted',
  'In Review',
  'Awarded',
  'Not Awarded',
] as const;

/** Deterministic document id, so a student can never open two applications to the same scholarship. */
export function applicationId(studentId: string, scholarshipId: string) {
  return `${studentId}_${scholarshipId}`;
}


export const ProfileSnapshotSchema = ProfileSchema
  .pick({ gpa: true, major: true, school: true, interests: true })
  .partial()
  .extend({ capturedAt: z.string().optional() });

export type ProfileSnapshot = z.infer<typeof ProfileSnapshotSchema>;

export const ApplicationSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1, 'studentId is required.'),
  scholarshipId: z.string().min(1, 'scholarshipId is required.'),
  scholarshipName: z.string().optional().default(''),
  organizationId: z.string().optional(),


  promptResponses: z.array(z.object({
    promptId: z.string(),
    title: z.string(),
    answer: z.string(),
  })).optional(),


  essay: z.string().optional().nullable(),
  qualificationStatement: z.string().optional().nullable(),
  activities: z.string().optional().nullable(),
  essays: z.array(z.object({
    promptId: z.string(),
    fileUrl: z.string().url(),
    fileName: z.string(),
    uploadedAt: z.any().optional(),
  })).optional().default([]),
  documents: z.array(z.string().url()).optional().default([]),

  resume: z.string().url().optional().nullable(),

 
  profileSnapshot: ProfileSnapshotSchema.optional(),

  status: z.enum(APPLICATION_STATUSES).optional().default('Draft'),
  submissionDate: z.string().optional().nullable(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),

 
  recommenderName1: z.string().optional(),
  recommenderEmail1: z.string().optional(),
  recommenderTitle1: z.string().optional(),
  recommendationStatus1: z.enum(['Not Requested', 'Pending', 'Received']).optional().default('Not Requested'),
  recommendationLetter1: z.string().url().optional().nullable(),
  recommendationLetterText1: z.string().optional().nullable(),
  recommendationLastReminder1: z.string().optional().nullable(),
  recommenderName2: z.string().optional(), 
  recommenderEmail2: z.string().optional(),
  recommenderTitle2: z.string().optional(),
  recommendationStatus2: z.enum(['Not Requested', 'Pending', 'Received']).optional().default('Not Requested'),
  recommendationLetter2: z.string().url().optional().nullable(),
  recommendationLetterText2: z.string().optional().nullable(),
  recommendationLastReminder2: z.string().optional().nullable(),
});

export type Application = z.infer<typeof ApplicationSchema>;



export const LEGACY_SCHOLARSHIP_ID = 'general-portfolio';
