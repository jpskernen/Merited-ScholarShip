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

export type PublicOrganization = { id: string; name: string };

export async function getActiveOrganization(orgId: string): Promise<PublicOrganization | null> {
  if (!orgId) return null;
  const snap = await getAdminDb().collection('organizations').doc(orgId).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  if (data.status && data.status !== 'active') return null;
  return { id: snap.id, name: data.name || orgId };
}


export async function getActiveOrganizations(): Promise<PublicOrganization[]> {
  const snap = await getAdminDb().collection('organizations').where('status', '==', 'active').get();
  return snap.docs
    .map((doc) => ({ id: doc.id, name: doc.data().name || doc.id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
