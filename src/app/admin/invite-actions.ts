'use server';

// Reviewer and admin invitations. Every action that creates or re-sends an
// invite is limited to the caller's own organization's Org Admin; accepting
// is open to the invitee (the invite ID is the credential) and is checked in
// acceptInviteAs.
import { requireOrgRole } from '@/lib/auth-server';
import { acceptInviteAs, createInviteFor, resendInviteFor, type InviteKind } from '@/lib/invites-server';

function failure(err: unknown) {
  console.error('Invite action failed:', err);
  return { success: false as const, error: err instanceof Error ? err.message : 'Something went wrong. Please try again.' };
}

export async function createInvite(idToken: string, kind: InviteKind, email: string) {
  try {
    const inviter = await requireOrgRole(idToken, ['org_admin']);
    return { success: true as const, ...(await createInviteFor(inviter, kind, email)) };
  } catch (err) {
    return failure(err);
  }
}

export async function resendInvite(idToken: string, kind: InviteKind, inviteId: string) {
  try {
    const inviter = await requireOrgRole(idToken, ['org_admin']);
    return { success: true as const, ...(await resendInviteFor(inviter, kind, inviteId)) };
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
