// src/lib/org-server.ts
//
// Server-only organization reads (Admin SDK). Client-safe types and helpers
// are in ./org.
import 'server-only';

import { getAdminDb } from '@/firebase/admin';
import { DEFAULT_ORG_SETTINGS, type OrgSettings } from './org';

/**
 * Settings for one organization, with any missing section filled from
 * DEFAULT_ORG_SETTINGS so callers never have to null-check a whole section.
 */
export async function getOrgSettings(orgId: string): Promise<OrgSettings> {
  const snap = await getAdminDb()
    .collection('organizations').doc(orgId)
    .collection('config').doc('settings')
    .get();
  const stored = (snap.exists ? snap.data() : {}) as Partial<OrgSettings>;

  return {
    branding: { ...DEFAULT_ORG_SETTINGS.branding, ...stored.branding },
    email: { ...DEFAULT_ORG_SETTINGS.email, ...stored.email },
    rubricTemplates: stored.rubricTemplates ?? DEFAULT_ORG_SETTINGS.rubricTemplates,
    retention: { ...DEFAULT_ORG_SETTINGS.retention, ...stored.retention },
    features: { ...DEFAULT_ORG_SETTINGS.features, ...stored.features },
  };
}
