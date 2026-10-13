// src/lib/auth-server.ts
//
// Server-side identity and roles (docs/07 §3.2). A caller is identified only by
// a verified Firebase ID token, never by a user ID the browser passes in. Roles
// and organization travel on the token as custom claims, which only server
// code can set:
//
//   { orgId: string, role: 'org_admin' | 'reviewer' | 'applicant', platformAdmin?: true }
import 'server-only';

import { getAdminAuth } from '@/firebase/admin';

export type OrgRole = 'org_admin' | 'reviewer' | 'applicant';

export type Caller = {
  uid: string;
  email: string | null;
  orgId: string | null;
  role: OrgRole | null;
  platformAdmin: boolean;
};

/** Thrown for a missing, invalid or insufficient caller. Its message is safe to show to the user. */
export class AuthError extends Error {}

export async function requireUser(idToken: string | null | undefined): Promise<Caller> {
  if (!idToken) throw new AuthError('You must be signed in to do this.');
  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken, true);
  } catch {
    throw new AuthError('Your session has expired. Please sign in again.');
  }
  return {
    uid: decoded.uid,
    email: decoded.email ? decoded.email.toLowerCase() : null,
    orgId: typeof decoded.orgId === 'string' ? decoded.orgId : null,
    role: (['org_admin', 'reviewer', 'applicant'] as const).find((r) => r === decoded.role) ?? null,
    platformAdmin: decoded.platformAdmin === true,
  };
}

export async function requirePlatformAdmin(idToken: string | null | undefined): Promise<Caller> {
  const caller = await requireUser(idToken);
  if (!caller.platformAdmin) throw new AuthError('Only a platform administrator can do this.');
  return caller;
}

/** A caller with one of `roles` in their organization. Returns the caller with a non-null orgId. */
export async function requireOrgRole(
  idToken: string | null | undefined,
  roles: OrgRole[],
): Promise<Caller & { orgId: string }> {
  const caller = await requireUser(idToken);
  if (!caller.orgId) throw new AuthError('Your account is not linked to an organization.');
  if (!caller.role || !roles.includes(caller.role)) throw new AuthError('You do not have permission to do this.');
  return caller as Caller & { orgId: string };
}

/**
 * Sets a user's organization and role claims, keeping any unrelated claims.
 * Takes effect on the user's next token refresh (the app forces one after
 * role changes it makes itself).
 */
export async function setUserClaims(
  uid: string,
  claims: { orgId: string; role: OrgRole; platformAdmin?: boolean },
): Promise<void> {
  const auth = getAdminAuth();
  const existing = (await auth.getUser(uid)).customClaims ?? {};
  const next: Record<string, unknown> = { ...existing, orgId: claims.orgId, role: claims.role };
  if (claims.platformAdmin !== undefined) {
    if (claims.platformAdmin) next.platformAdmin = true;
    else delete next.platformAdmin;
  }
  await auth.setCustomUserClaims(uid, next);
}

/** The `users.role` value the UI and existing queries use for each claim role. */
export function profileRoleFor(role: OrgRole): 'admin' | 'reviewer' | 'applicant' {
  return role === 'org_admin' ? 'admin' : role;
}
