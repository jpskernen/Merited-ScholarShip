'use server';

/**
 * @fileOverview Provides a summary of a scholarship application.
 *
 * - summarizeApplication - A function that summarizes the application.
 * - SummarizeApplicationInput - The input type for the summarizeApplication function.
 * - SummarizeApplicationOutput - The return type for the summarizeApplication function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeApplicationInputSchema = z.object({
  transcript: z.string().describe('The applicant transcript.'),
  resume: z.string().describe('The applicant resume.'),
  essay: z.string().describe('The applicant essay.'),
  gpa: z.number().describe('The applicant GPA.'),
});
export type SummarizeApplicationInput = z.infer<typeof SummarizeApplicationInputSchema>;

const SummarizeApplicationOutputSchema = z.object({
  summary: z.string().describe('A summary of the application.'),
});
export type SummarizeApplicationOutput = z.infer<typeof SummarizeApplicationOutputSchema>;

export async function summarizeApplication(input: SummarizeApplicationInput): Promise<SummarizeApplicationOutput> {
  return summarizeApplicationFlow(input);
}

const summarizeApplicationPrompt = ai.definePrompt({
  name: 'summarizeApplicationPrompt',
  input: {schema: SummarizeApplicationInputSchema},
  output: {schema: SummarizeApplicationOutputSchema},
  prompt: `You are a scholarship application summarizer. Summarize the application based on the transcript, resume, essay, and GPA.

Transcript: {{{transcript}}}
Resume: {{{resume}}}
Essay: {{{essay}}}
GPA: {{{gpa}}}

Summary:`,
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
