// src/types/application.ts
//
// One application per (student, scholarship) pair. A student applies to as many
// scholarships as they like and each application carries its own essay, its own
// recommenders and its own submission status — confirmed by the client on
// 2026-09-29.
//
// Shared profile details (name, email, address, GPA, school, major, interests)
// deliberately do NOT live here. They stay on users/{uid} so they're entered
// once and reused by every application. See ProfileSchema in ./applicant.
import { z } from 'zod';

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

export const ApplicationSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1, 'studentId is required.'),
  scholarshipId: z.string().min(1, 'scholarshipId is required.'),
  // Denormalised so lists (My Status, admin board) don't need a second read per row.
  scholarshipName: z.string().optional().default(''),
  organizationId: z.string().optional(),

  // Application-specific narrative.
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

  status: z.enum(APPLICATION_STATUSES).optional().default('Draft'),
  submissionDate: z.string().optional().nullable(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),

  // Recommenders are per-application: inviting the same teacher for two
  // scholarships creates two tokens and two letters. Kept as indexed fields
  // rather than an array so the existing 1/2 slot UI and the recommendation
  // token actions port across unchanged.
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

// NOTE: submitting with an empty essay is still allowed here, matching the
// current behaviour exactly (docs/09-E2E-BUG-HUNT-2026-09-30.md BUG-10).
// Tightening that is a separate, separately-approved change — don't fold it in
// here or the multi-scholarship work becomes impossible to review.

/** The legacy single-portfolio scholarship id, used for pre-2026-09-30 records. */
export const LEGACY_SCHOLARSHIP_ID = 'general-portfolio';
