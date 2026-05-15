import { config } from 'dotenv';
config();

import '@/ai/flows/generate-scholarship-recommendations.ts';
import '@/ai/flows/summarize-applications.ts';
import '@/ai/flows/analyze-scholarship-fit.ts';
import '@/ai/flows/generate-invitation-email.ts';
