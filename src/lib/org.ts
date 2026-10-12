
export type OrgSettings = {
  branding: {
    displayName: string;
    logoPath: string | null;
    primaryColor: string | null;
  };
  email: {
    senderName: string | null;
    replyTo: string | null;
  };
  rubricTemplates: {
    id: string;
    name: string;
    criteria: { id: string; label: string; description?: string; weight: number }[];
  }[];

  retention: {
    draftInactiveMonths: number | null;
    decidedApplicationMonths: number | null;
    tokenDays: number | null;
    emailBodyDays: number | null;
  };
  features: {
    recommendationsRequired: boolean;
    maxRecommenders: number;
    aiFitAnalysis: boolean;
  };
};


export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  branding: { displayName: '', logoPath: null, primaryColor: null },
  email: { senderName: null, replyTo: null },
  rubricTemplates: [
    {
      id: 'default',
      name: 'Standard',
      criteria: [
        { id: 'academic', label: 'Academic Achievement', description: 'Consider GPA and course difficulty', weight: 30 },
        { id: 'essay', label: 'Essay Quality', description: 'Evaluate clarity and authenticity', weight: 25 },
        { id: 'financial', label: 'Financial Need', description: 'Based on submitted financial information', weight: 20 },
        { id: 'community', label: 'Community Service', description: 'Volunteer work and extracurriculars', weight: 15 },
        { id: 'recommendation', label: 'Recommendation Strength', description: 'Quality of recommendation letters', weight: 10 },
      ],
    },
  ],
  retention: { draftInactiveMonths: null, decidedApplicationMonths: null, tokenDays: 30, emailBodyDays: null },
  features: { recommendationsRequired: true, maxRecommenders: 2, aiFitAnalysis: false },
};


export function orgIdOf(userData: { organizationId?: string | null; schoolId?: string | null } | null | undefined): string | null {
  return userData?.organizationId || userData?.schoolId || null;
}


export function getDefaultOrgId(): string {
  const orgId = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
  if (!orgId) {
    throw new Error('NEXT_PUBLIC_DEFAULT_ORG_ID is not set. Add it to .env.local (see .env.example).');
  }
  return orgId;
}
