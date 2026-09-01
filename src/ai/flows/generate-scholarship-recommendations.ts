// src/ai/flows/generate-scholarship-recommendations.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating scholarship recommendations for applicants.
 *
 * - generateScholarshipRecommendations - A function that takes applicant profile information and returns a list of recommended scholarships.
 * - ScholarshipRecommendationInput - The input type for the generateScholarshipRecommendations function.
 * - ScholarshipRecommendationOutput - The return type for the generateScholarshipRecommendations function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ScholarshipRecommendationInputSchema = z.object({
  gpa: z.number().describe("The applicant's GPA."),
  major: z.string().describe("The applicant's major."),
  interests: z.string().describe("The applicant's interests, separated by commas."),
  activities: z.string().describe("The applicant's activities, such as sports (e.g., soccer, wrestling) or clubs."),
  school: z.string().describe("The school the applicant attends."),
  essay: z.string().describe("The applicant's essay."),
  resume: z.string().describe("The applicant's resume as a data URI."),
  transcripts: z.string().describe('The applicant transcripts as a data URI.'),
});

export type ScholarshipRecommendationInput = z.infer<typeof ScholarshipRecommendationInputSchema>;

const ScholarshipRecommendationOutputSchema = z.object({
  scholarshipRecommendations: z.array(
    z.object({
      scholarshipName: z.string().describe('The name of the scholarship.'),
      scholarshipDescription: z.string().describe('A brief description of the scholarship.'),
      eligibilityCriteria: z.string().describe('The eligibility criteria for the scholarship.'),
      applicationDeadline: z.string().describe('The application deadline for the scholarship.'),
      amount: z.string().describe('The amount of the scholarship.'),
    })
  ).describe("A list of scholarship recommendations based on the applicant's profile information."),
});

export type ScholarshipRecommendationOutput = z.infer<typeof ScholarshipRecommendationOutputSchema>;

export async function generateScholarshipRecommendations(
  input: ScholarshipRecommendationInput
): Promise<ScholarshipRecommendationOutput> {
  return generateScholarshipRecommendationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'scholarshipRecommendationPrompt',
  input: {schema: ScholarshipRecommendationInputSchema},
  output: {schema: ScholarshipRecommendationOutputSchema},
  prompt: `You are an AI assistant that recommends scholarships to students based on their qualifications.

  Given the following applicant profile, generate a list of scholarship recommendations. Include the scholarship name, a brief description, eligibility criteria, application deadline and the amount of the scholarship. Pay special attention to matching based on GPA, activities, and school.

  Applicant GPA: {{{gpa}}}
  Applicant Major: {{{major}}}
  Applicant School: {{{school}}}
  Applicant Interests: {{{interests}}}
  Applicant Activities: {{{activities}}}
  Applicant Essay: {{{essay}}}
  Applicant Resume: {{media url=resume}}
  Applicant Transcripts: {{media url=transcripts}}

  Format the output as a JSON object that contains a list of scholarship recommendations.
  `,
});

const generateScholarshipRecommendationsFlow = ai.defineFlow(
  {
    name: 'generateScholarshipRecommendationsFlow',
    inputSchema: ScholarshipRecommendationInputSchema,
    outputSchema: ScholarshipRecommendationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
