import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/firebase/admin';

export type AuditAction =
  | 'Application submitted'
  | 'Recommendation requested'
  | 'Recommendation request cancelled'
  | 'Recommendation letter received'
  | 'Recommendation link rejected'
  | 'Application status changed'
  | 'Scholarship created'
  | 'Scholarship updated'
  | 'Scholarship deleted'
  | 'Organization created'
  | 'Staff invited'
  | 'Staff invitation resent'
  | 'Staff invitation accepted'
  | 'Staff invitation revoked'
  | 'Staff access removed'
  | 'Role granted'
  | 'Organization switch requested'
  | 'Organization switch approved'
  | 'Organization switch denied';

export type AuditEntry = {
  organizationId: string | null | undefined;
  action: AuditAction;
  actorId?: string | null;
  actorName?: string | null;
  targetId?: string | null;
  targetType?: 'application' | 'scholarship' | 'invite' | 'user' | 'organization' | 'recommendationToken';
  subject?: string | null;
  details?: Record<string, string | number | boolean | null | undefined>;
};

function clean(details: AuditEntry['details']) {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(details || {})) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await getAdminDb().collection('auditLog').add({
      organizationId: entry.organizationId ?? null,
      action: entry.action,
      adminId: entry.actorId ?? null,
      adminName: entry.actorName ?? null,
      targetId: entry.targetId ?? null,
      targetType: entry.targetType ?? null,
      affectedStudent: entry.subject ?? null,
      details: clean(entry.details),
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Audit write failed:', entry.action, error);
  }
}
