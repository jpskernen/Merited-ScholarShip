'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/firebase/admin';
import { AuthError, requireOrgRole } from '@/lib/auth-server';
import { sendStatusUpdate } from '@/app/lib/notifications';
import { writeAudit } from '@/lib/audit';

const DECISIONS = ['Awarded', 'Not Awarded'] as const;
export type Decision = (typeof DECISIONS)[number];

const DECIDABLE = ['Submitted', 'In Review', 'Awarded', 'Not Awarded'];

const ROWS_PER_BATCH = 200;

export type DecisionTarget = {
  applicationId: string | null;
  studentId: string;
};

export type DecisionOutcome = {
  updated: number;
  skipped: { studentId: string; applicationId: string | null; reason: string }[];
  emailsSent: number;
  emailsFailed: number;
};

function failure(error: unknown) {
  if (!(error instanceof AuthError)) console.error('Decision action failed:', error);
  const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  return { success: false as const, error: message };
}

type Plan = {
  target: DecisionTarget;
  studentName: string | null;
  studentEmail: string | null;
  scholarshipName: string | null;
  alreadyEmailed: boolean;
};

export async function recordDecisions(
  idToken: string,
  input: { targets: DecisionTarget[]; status: Decision },
) {
  try {
    const caller = await requireOrgRole(idToken, ['org_admin']);

    if (!DECISIONS.includes(input.status)) {
      return { success: false as const, error: 'That is not a decision this page can record.' };
    }
    const targets = (input.targets || []).filter((t) => t && t.studentId);
    if (targets.length === 0) {
      return { success: false as const, error: 'No applications were selected.' };
    }

    const db = getAdminDb();
    const outcome: DecisionOutcome = { updated: 0, skipped: [], emailsSent: 0, emailsFailed: 0 };
    const plans: Plan[] = [];

    for (let start = 0; start < targets.length; start += ROWS_PER_BATCH) {
      const chunk = targets.slice(start, start + ROWS_PER_BATCH);
      const batch = db.batch();
      const chunkPlans: Plan[] = [];

      for (const target of chunk) {
        const studentRef = db.collection('users').doc(target.studentId);
        const [studentSnap, appSnap] = await Promise.all([
          studentRef.get(),
          target.applicationId ? db.collection('applications').doc(target.applicationId).get() : Promise.resolve(null),
        ]);

        const student = studentSnap.exists ? studentSnap.data()! : null;
        const application = appSnap && appSnap.exists ? appSnap.data()! : null;

        if (target.applicationId && !application) {
          outcome.skipped.push({ ...target, reason: 'the application no longer exists' });
          continue;
        }
        if (!target.applicationId && !student) {
          outcome.skipped.push({ ...target, reason: 'the student record no longer exists' });
          continue;
        }

        const recordOrg = application
          ? application.organizationId
          : (student?.organizationId || student?.schoolId);
        if (recordOrg !== caller.orgId) {
          outcome.skipped.push({ ...target, reason: 'it belongs to another organization' });
          continue;
        }

        const current = (application ? application.status : student?.status) || 'Draft';
        if (!DECIDABLE.includes(current)) {
          outcome.skipped.push({ ...target, reason: `it is still a ${String(current).toLowerCase()}` });
          continue;
        }
        if (current === input.status) {
          outcome.skipped.push({ ...target, reason: `it is already ${input.status}` });
          continue;
        }

        const stamp = {
          status: input.status,
          decidedAt: FieldValue.serverTimestamp(),
          decidedBy: caller.uid,
          updatedAt: FieldValue.serverTimestamp(),
        };

        if (target.applicationId) {
          batch.update(db.collection('applications').doc(target.applicationId), stamp);
          if (student?.legacyMirrorOf === target.applicationId) {
            batch.update(studentRef, { status: input.status, updatedAt: FieldValue.serverTimestamp() });
          }
        } else {
          batch.update(studentRef, stamp);
        }

        chunkPlans.push({
          target,
          studentName: student?.name ?? null,
          studentEmail: student?.email ?? null,
          scholarshipName: application?.scholarshipName ?? null,
          alreadyEmailed: (application ? application.decisionEmailedFor : student?.decisionEmailedFor) === input.status,
        });
      }

      if (chunkPlans.length > 0) {
        await batch.commit();
        outcome.updated += chunkPlans.length;
        plans.push(...chunkPlans);
      }
    }

    for (const plan of plans) {
      await writeAudit({
        organizationId: caller.orgId,
        action: 'Application status changed',
        actorId: caller.uid,
        actorName: caller.email,
        targetId: plan.target.applicationId || plan.target.studentId,
        targetType: 'application',
        subject: plan.studentName || plan.studentEmail,
        details: {
          status: input.status,
          scholarshipName: plan.scholarshipName,
          studentId: plan.target.studentId,
        },
      });

      if (plan.alreadyEmailed || !plan.studentEmail) continue;

      const sent = await sendStatusUpdate(
        plan.studentEmail,
        plan.studentName || 'Student',
        input.status,
        plan.scholarshipName || undefined,
      );

      if (sent.success) {
        outcome.emailsSent += 1;
        const marker = { decisionEmailedFor: input.status, decisionEmailedAt: FieldValue.serverTimestamp() };
        const ref = plan.target.applicationId
          ? db.collection('applications').doc(plan.target.applicationId)
          : db.collection('users').doc(plan.target.studentId);
        await ref.update(marker).catch((error) => console.error('Could not mark the decision email as sent:', error));
      } else {
        outcome.emailsFailed += 1;
      }
    }

    return { success: true as const, ...outcome };
  } catch (error) {
    return failure(error);
  }
}
