'use server';

/**
 * @fileOverview AI flow to generate a professional invitation email for new reviewers or admins.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateEmailInputSchema = z.object({
  recipientEmail: z.string().email(),
  role: z.enum(['Reviewer', 'Admin']),
  temporaryPassword: z.string(),
  onboardingLink: z.string().url(),
});

export type GenerateEmailInput = z.infer<typeof GenerateEmailInputSchema>;

const GenerateEmailOutputSchema = z.object({
  subject: z.string().describe('A compelling subject line for the invitation email.'),
  body: z.string().describe('The full body of the invitation email, including the credentials and link.'),
});

export type GenerateEmailOutput = z.infer<typeof GenerateEmailOutputSchema>;

export async function generateInvitationEmail(input: GenerateEmailInput): Promise<GenerateEmailOutput> {
  return generateInvitationEmailFlow(input);
}

const generateInvitationEmailFlow = ai.defineFlow(
  {
    name: 'generateInvitationEmailFlow',
    inputSchema: GenerateEmailInputSchema,
    outputSchema: GenerateEmailOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `You are a professional coordinator for a high-profile scholarship foundation. 
      Write a professional invitation email to a new ${input.role}.
      
      The email must include:
      1. A warm welcome to the scholarship committee.
      2. Their login credentials (Email: ${input.recipientEmail}, Temp Password: ${input.temporaryPassword}).
      3. A clear call to action to click the onboarding link: ${input.onboardingLink}.
      4. A note that they should finalize their profile upon logging in.
      
      Keep the tone encouraging, professional, and secure.`,
      input: input,
      output: { schema: GenerateEmailOutputSchema },
    });

    if (!output) {
      throw new Error('AI failed to generate the invitation email.');
    }

    return output;
  }
);
