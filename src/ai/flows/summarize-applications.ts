'use server';

/**
 * @fileOverview Provides a summary of a scholarship application, focusing on merit indicators.
 *
 * - summarizeApplication - A function that summarizes the application.
 * - SummarizeApplicationInput - The input type for the summarizeApplication function.
 * - SummarizeApplicationOutput - The return type for the summarizeApplication function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeApplicationInputSchema = z.object({
  resume: z.string().describe('The applicant resume or profile URI.'),
  essay: z.string().describe('The applicant essay or personal statement.'),
  gpa: z.number().describe('The applicant cumulative GPA.'),
});
export type SummarizeApplicationInput = z.infer<typeof SummarizeApplicationInputSchema>;

const SummarizeApplicationOutputSchema = z.object({
  summary: z.string().describe('A summary of the applicant credentials and merit statements.'),
});
export type SummarizeApplicationOutput = z.infer<typeof SummarizeApplicationOutputSchema>;

export async function summarizeApplication(input: SummarizeApplicationInput): Promise<SummarizeApplicationOutput> {
  return summarizeApplicationFlow(input);
}

const summarizeApplicationPrompt = ai.definePrompt({
  name: 'summarizeApplicationPrompt',
  input: {schema: SummarizeApplicationInputSchema},
  output: {schema: SummarizeApplicationOutputSchema},
  prompt: `You are a high-level scholarship committee briefing agent. 
  Summarize the candidate application based strictly on the provided resume, essay, and academic GPA.
  
  Do not mention transcripts. Focus on:
  1. Key Academic Achievements (GPA: {{{gpa}}})
  2. Professional/Extracurricular Highlights from Resume
  3. Narrative themes from the Essay

  Resume Content: {{{resume}}}
  Essay Content: {{{essay}}}

  Provide a concise, professional briefing for a reviewer.`,
});

const summarizeApplicationFlow = ai.defineFlow(
  {
    name: 'summarizeApplicationFlow',
    inputSchema: SummarizeApplicationInputSchema,
    outputSchema: SummarizeApplicationOutputSchema,
  },
  async input => {
    const {output} = await summarizeApplicationPrompt(input);
    return output!;
  }
);