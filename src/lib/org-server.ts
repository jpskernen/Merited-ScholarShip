// src/lib/org-server.ts
//
// Server-only organization reads (Admin SDK). Client-safe types and helpers
// are in ./org.
import 'server-only';

import { getAdminAuth, getAdminDb } from '@/firebase/admin';
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

export async function getOrgOwnerUid(orgId: string): Promise<string | null> {
  const db = getAdminDb();
  const orgRef = db.collection('organizations').doc(orgId);
  const stored = (await orgRef.get()).data()?.ownerUid;
  if (typeof stored === 'string' && stored) return stored;

  const admins = await db.collection('users')
    .where('organizationId', '==', orgId)
    .where('role', '==', 'admin')
    .get();
  const withAge = await Promise.all(admins.docs.map(async (d) => {
    try {
      const created = new Date((await getAdminAuth().getUser(d.id)).metadata.creationTime).getTime();
      return { uid: d.id, at: Number.isFinite(created) ? created : Number.MAX_SAFE_INTEGER };
    } catch {
      return { uid: d.id, at: Number.MAX_SAFE_INTEGER };
    }
  }));
  const earliest = withAge.sort((a, b) => a.at - b.at)[0];
  if (!earliest) return null;

  await orgRef.set({ ownerUid: earliest.uid }, { merge: true });
  return earliest.uid;
}

export type PublicOrganization ={ id: string; name: string };

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
