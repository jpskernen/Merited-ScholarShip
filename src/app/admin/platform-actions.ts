'use server';


import { requirePlatformAdmin } from '@/lib/auth-server';
import { assignOrgAdminAs, createOrganizationAs, resendOrgAdminInviteAs } from '@/lib/platform-server';
import { resolveOrgSwitchRequestAs } from '@/lib/org-switch-server';
import { saveLegalContentAs, type LegalContent } from '@/lib/legal-server';

function failure(err: unknown) {
  console.error('Platform action failed:', err);
  return { success: false as const, error: err instanceof Error ? err.message : 'Something went wrong. Please try again.' };
}

export async function createOrganization(idToken: string, name: string) {
  try {
    const caller = await requirePlatformAdmin(idToken);
    return { success: true as const, ...(await createOrganizationAs(caller, name)) };
  } catch (err) {
    return failure(err);
  }
}

export async function assignOrgAdmin(idToken: string, orgId: string, email: string) {
  try {
    const caller = await requirePlatformAdmin(idToken);
    return { success: true as const, ...(await assignOrgAdminAs(caller, orgId, email)) };
  } catch (err) {
    return failure(err);
  }
}

export async function resendOrgAdminInvite(idToken: string, inviteId: string) {
  try {
    const caller = await requirePlatformAdmin(idToken);
    return { success: true as const, ...(await resendOrgAdminInviteAs(caller, inviteId)) };
  } catch (err) {
    return failure(err);
  }
}

export async function resolveOrgSwitchRequest(idToken: string, requestId: string, approve: boolean) {
  try {
    const caller = await requirePlatformAdmin(idToken);
    return { success: true as const, ...(await resolveOrgSwitchRequestAs(caller, requestId, approve)) };
  } catch (err) {
    return failure(err);
  }
}

export async function saveLegalContent(idToken: string, content: LegalContent) {
  try {
    const caller = await requirePlatformAdmin(idToken);
    await saveLegalContentAs(caller, content);
    return { success: true as const };
  } catch (err) {
    return failure(err);
  }
}
