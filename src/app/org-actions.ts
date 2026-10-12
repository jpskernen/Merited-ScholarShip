'use server';

import { getAdminDb } from '@/firebase/admin';
import { getActiveOrganization, getActiveOrganizations, type PublicOrganization } from '@/lib/org-server';

export async function getPublicOrganization(orgId: string): Promise<PublicOrganization | null> {
  if (typeof orgId !== 'string' || !orgId.trim()) return null;
  return getActiveOrganization(orgId.trim());
}

/** All active organizations, for the public directory (/organizations) and the signup org picker. */
export async function getPublicOrganizations(): Promise<PublicOrganization[]> {
  return getActiveOrganizations();
}

export type PublicScholarship = {
  id: string;
  name: string;
  amount: string;
  deadline: string;
  description: string;
  tags: string[];
};

export async function getPublicScholarships(orgId: string): Promise<PublicScholarship[]> {
  const org = await getPublicOrganization(orgId);
  if (!org) return [];

  const snapshot = await getAdminDb()
    .collection('programs')
    .where('organizationId', '==', org.id)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name || 'Scholarship',
      amount: data.amount || '',
      deadline: data.deadline || '',
      description: data.description || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
    };
  });
}

export type PublicScholarshipWithOrg = PublicScholarship & {
  organizationId: string;
  organizationName: string;
};

/**
 * Every active organization's scholarships, for the homepage. Browsing is no
 * longer scoped to one hardcoded default org (docs/07 D7's original public
 * landing page) now that /organizations and /org/[orgId] let a visitor reach
 * any organization directly.
 */
export async function getAllPublicScholarships(): Promise<PublicScholarshipWithOrg[]> {
  const orgs = await getActiveOrganizations();
  const lists = await Promise.all(
    orgs.map(async (org) => {
      const scholarships = await getPublicScholarships(org.id);
      return scholarships.map((s) => ({ ...s, organizationId: org.id, organizationName: org.name }));
    }),
  );
  return lists.flat();
}
