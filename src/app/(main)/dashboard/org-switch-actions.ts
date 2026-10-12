'use server';

import { requestOrgSwitchAs } from '@/lib/org-switch-server';

export async function requestOrgSwitch(idToken: string, requestedOrgId: string, reason: string) {
  try {
    return { success: true as const, ...(await requestOrgSwitchAs(idToken, requestedOrgId, reason)) };
  } catch (err) {
    console.error('Organization switch request failed:', err);
    return { success: false as const, error: err instanceof Error ? err.message : 'Something went wrong. Please try again.' };
  }
}
