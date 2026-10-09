'use server';

// Platform Admin actions (docs/07 §4). Limited to accounts with the
// platformAdmin claim. UI: src/app/admin/platform/page.tsx (runbook 2.1).
import { requirePlatformAdmin } from '@/lib/auth-server';
import { assignOrgAdminAs, createOrganizationAs, resendOrgAdminInviteAs } from '@/lib/platform-server';

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
