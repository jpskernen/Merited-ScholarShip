// src/lib/org.ts
//
// Organization (tenant) helpers that are safe to use in both client and server
// code. Design: docs/07-ARCHITECTURE-multi-tenant-compliance.md §3-4.
//
// Server-only reads (getOrgSettings) live in ./org-server so this file never
// pulls the Admin SDK into the browser bundle.

/** Self-service settings stored at organizations/{orgId}/config/settings. */
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
  // null = not yet agreed with the client (docs/07 Q3). Nothing is deleted
  // automatically while a value is null.
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

/** Defaults written when an organization is created. Mirrors the default rubric in src/types/scholarship.ts. */
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

/**
 * The organization a signed-in user belongs to, read from their user document.
 * `schoolId` is the legacy name for the same value. Returns null instead of
 * guessing: callers must not fall back to a hardcoded organization.
 */
export function orgIdOf(userData: { organizationId?: string | null; schoolId?: string | null } | null | undefined): string | null {
  return userData?.organizationId || userData?.schoolId || null;
}

/**
 * The organization new applicant accounts join, until per-organization signup
 * links exist (docs/08 runbook 2.5). Configured per environment, never hardcoded.
 */
export function getDefaultOrgId(): string {
  const orgId = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
  if (!orgId) {
    throw new Error('NEXT_PUBLIC_DEFAULT_ORG_ID is not set. Add it to .env.local (see .env.example).');
  }
  return orgId;
}
