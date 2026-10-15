'use server';

// Reviewer and admin invitations. Every action that creates or re-sends an
// invite is limited to the caller's own organization's Org Admin; accepting
// is open to the invitee (the invite ID is the credential) and is checked in
// acceptInviteAs.
import { AuthError, requireOrgRole } from '@/lib/auth-server';
import { getOrgOwnerUid } from '@/lib/org-server';
import {
  acceptInviteAs,
  createInviteFor,
  resendInviteFor,
  revokeInviteFor,
  InviteError,
  StaffEligibilityError,
  type InviteKind,
} from '@/lib/invites-server';

function failure(err: unknown) {
  const expected = err instanceof AuthError || err instanceof InviteError || err instanceof StaffEligibilityError;
  if (!expected) console.error('Invite action failed:', err);
  return {
    success: false as const,
    error: expected ? (err as Error).message : 'The invitation could not be processed. Please try again.',
  };
}

async function requireMainAdminForAdminInvites(caller: { uid: string; orgId: string }, kind: InviteKind) {
  if (kind !== 'admin') return;
  const ownerUid = await getOrgOwnerUid(caller.orgId);
  if (ownerUid && ownerUid !== caller.uid) {
    throw new AuthError('Only the main administrator can manage administrator invitations.');
  }
}

export async function createInvite(idToken: string, kind: InviteKind, email: string) {
  try {
    const inviter = await requireOrgRole(idToken, ['org_admin']);
    await requireMainAdminForAdminInvites(inviter, kind);
    return { success: true as const, ...(await createInviteFor(inviter, kind, email)) };
  } catch (err) {
    return failure(err);
  }
}

export async function resendInvite(idToken: string, kind: InviteKind, inviteId: string) {
  try {
    const inviter = await requireOrgRole(idToken, ['org_admin']);
    await requireMainAdminForAdminInvites(inviter, kind);
    return { success: true as const, ...(await resendInviteFor(inviter, kind, inviteId)) };
  } catch (err) {
    return failure(err);
  }
}

export async function revokeInvite(idToken: string, kind: InviteKind, inviteId: string) {
  try {
    const caller = await requireOrgRole(idToken, ['org_admin']);
    await requireMainAdminForAdminInvites(caller, kind);
    return { success: true as const, ...(await revokeInviteFor(caller, kind, inviteId)) };
  } catch (err) {
    return failure(err);
  }
}

export async function acceptInvite(
  kind: InviteKind,
  inviteId: string,
  details: { name: string; password: string } | null,
  idToken?: string,
) {
  try {
    return await acceptInviteAs(kind, inviteId, details, idToken);
  } catch (err) {
    console.error('Invite acceptance failed:', err);
    return { success: false as const, code: 'other' as const, error: 'We could not activate your account. Please try again or contact your administrator.' };
  }
}
