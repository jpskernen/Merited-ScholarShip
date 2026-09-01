'use server';

/**
 * @fileOverview AI flow to analyze the fit between an applicant and a scholarship.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeFitInputSchema = z.object({
  applicantData: z.object({
    gpa: z.number(),
    major: z.string(),
    essay: z.string(),
    activities: z.string(),
    interests: z.string(),
  }),
  scholarshipCriteria: z.string(),
});

export type AnalyzeFitInput = z.infer<typeof AnalyzeFitInputSchema>;

const AnalyzeFitOutputSchema = z.object({
  fitScore: z.number().describe('A score from 0 to 100 representing how well the applicant matches the scholarship criteria.'),
  justification: z.string().describe('A concise explanation for the assigned fit score, highlighting strengths and weaknesses.'),
  recommendation: z.string().describe('A brief recommendation on whether to award, waitlist, or reject based strictly on criteria matching.'),
});

export type AnalyzeFitOutput = z.infer<typeof AnalyzeFitOutputSchema>;

export async function analyzeScholarshipFit(input: AnalyzeFitInput): Promise<AnalyzeFitOutput> {
  return analyzeScholarshipFitFlow(input);
}

const analyzeScholarshipFitFlow = ai.defineFlow(
  {
    name: 'analyzeScholarshipFitFlow',
    inputSchema: AnalyzeFitInputSchema,
    outputSchema: AnalyzeFitOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `You are a professional scholarship committee analyst. Your task is to evaluate an applicant's fit for a specific scholarship.

      ### Scholarship Criteria:
      {{{scholarshipCriteria}}}

      ### Applicant Profile:
      - GPA: {{{applicantData.gpa}}}
      - Intended Major: {{{applicantData.major}}}
      - Activities: {{{applicantData.activities}}}
      - Interests: {{{applicantData.interests}}}
      - Personal Statement excerpt: {{{applicantData.essay}}}

      Analyze the data objectively. Focus on how well the applicant's background and goals align with the scholarship's intent and specific requirements. 
      
      Provide:
      1. A Fit Score (0-100).
      2. A logical justification.
      3. A summary recommendation.`,
      input: input,
      output: { schema: AnalyzeFitOutputSchema },
    });

    if (!output) {
      throw new Error('AI failed to generate a fit analysis.');
    }

    return output;
  }
);
