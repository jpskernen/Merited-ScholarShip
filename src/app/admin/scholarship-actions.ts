'use server';

import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/firebase/admin';
import { AuthError, requireOrgRole } from '@/lib/auth-server';
import { changesScoring, validateRubric, type RubricCriterion } from '@/lib/rubric';
import { writeAudit } from '@/lib/audit';

const CriterionSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, 'Every criterion needs a label.'),
  description: z.string().optional(),
  weight: z.number(),
});

const ScholarshipInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Scholarship name is required.'),
  amount: z.string().min(1, 'Amount is required.'),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Deadline must be a valid date.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  reviewerIds: z.array(z.string()).optional(),
  rubric: z.array(CriterionSchema),
  prompts: z.array(z.object({
    id: z.string(),
    title: z.string().min(1, 'Prompt title required'),
    description: z.string().optional(),
  })).optional(),
});

export type ScholarshipInput = z.infer<typeof ScholarshipInputSchema>;

function failure(error: unknown) {
  if (!(error instanceof AuthError)) console.error('Scholarship action failed:', error);
  const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  return { success: false as const, error: message };
}

function asTags(tags: string | string[] | undefined): string[] {
  if (Array.isArray(tags)) return tags.map((tag) => tag.trim()).filter(Boolean);
  return (tags || '').split(',').map((tag) => tag.trim()).filter(Boolean);
}

async function hasReviews(scholarshipId: string): Promise<boolean> {
  const snapshot = await getAdminDb()
    .collectionGroup('reviews')
    .where('scholarshipId', '==', scholarshipId)
    .limit(1)
    .get();
  return !snapshot.empty;
}

export async function saveScholarship(idToken: string, input: ScholarshipInput) {
  try {
    const caller = await requireOrgRole(idToken, ['org_admin']);

    const parsed = ScholarshipInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues.map((i) => i.message).join(' ') };
    }
    const data = parsed.data;

    const rubricCheck = validateRubric(data.rubric as RubricCriterion[]);
    if (!rubricCheck.ok) return { success: false as const, error: rubricCheck.error };

    const db = getAdminDb();
    const fields: Record<string, unknown> = {
      name: data.name.trim(),
      amount: data.amount.trim(),
      deadline: data.deadline.trim(),
      description: data.description.trim(),
      tags: asTags(data.tags),
      rubric: data.rubric,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (data.reviewerIds) fields.reviewerIds = data.reviewerIds;
    if (data.prompts) fields.prompts = data.prompts;

    if (!data.id) {
      const ref = db.collection('programs').doc();
      await ref.set({
        ...fields,
        id: ref.id,
        organizationId: caller.orgId,
        schoolId: caller.orgId,
        reviewerIds: data.reviewerIds || [],
        createdAt: FieldValue.serverTimestamp(),
      });
      await writeAudit({
        organizationId: caller.orgId,
        action: 'Scholarship created',
        actorId: caller.uid,
        actorName: caller.email,
        targetId: ref.id,
        targetType: 'scholarship',
        subject: data.name,
        details: { criteria: data.rubric.length, reviewers: (data.reviewerIds || []).length },
      });
      return { success: true as const, id: ref.id };
    }

    const ref = db.collection('programs').doc(data.id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return { success: false as const, error: 'This scholarship no longer exists.' };

    const existing = snapshot.data()!;
    const existingOrg = existing.organizationId || existing.schoolId;
    if (existingOrg !== caller.orgId) {
      return { success: false as const, error: 'This scholarship belongs to another organization.' };
    }

    if (changesScoring(existing.rubric, data.rubric as RubricCriterion[])) {
      let locked: boolean;
      try {
        locked = await hasReviews(data.id);
      } catch (error) {
        console.error('Could not check for existing reviews:', error);
        return {
          success: false as const,
          error: 'The rubric could not be changed: whether scoring has already started could not be confirmed. Please try again.',
        };
      }
      if (locked) {
        return {
          success: false as const,
          error: 'Scoring has already started for this scholarship, so the criteria and weights can no longer be changed. Evaluations already filed were made against them. You can still reword a criterion’s description.',
        };
      }
    }

    await ref.set({ ...fields, organizationId: existingOrg }, { merge: true });
    await writeAudit({
      organizationId: existingOrg,
      action: 'Scholarship updated',
      actorId: caller.uid,
      actorName: caller.email,
      targetId: data.id,
      targetType: 'scholarship',
      subject: data.name,
      details: {
        rubricChanged: changesScoring(existing.rubric, data.rubric as RubricCriterion[]),
        reviewers: (data.reviewerIds || []).length,
      },
    });
    return { success: true as const, id: data.id };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteScholarship(idToken: string, scholarshipId: string) {
  try {
    const caller = await requireOrgRole(idToken, ['org_admin']);
    const db = getAdminDb();
    const ref = db.collection('programs').doc(scholarshipId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return { success: false as const, error: 'This scholarship no longer exists.' };

    const existing = snapshot.data()!;
    const existingOrg = existing.organizationId || existing.schoolId;
    if (existingOrg !== caller.orgId) {
      return { success: false as const, error: 'This scholarship belongs to another organization.' };
    }

    const orphans = await db.collection('applications')
      .where('scholarshipId', '==', scholarshipId)
      .count()
      .get()
      .then((result) => result.data().count)
      .catch(() => null);

    await ref.delete();

    await writeAudit({
      organizationId: existingOrg,
      action: 'Scholarship deleted',
      actorId: caller.uid,
      actorName: caller.email,
      targetId: scholarshipId,
      targetType: 'scholarship',
      subject: existing.name || null,
      details: { applicationsLeftBehind: orphans },
    });

    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function isRubricLocked(idToken: string, scholarshipId: string) {
  try {
    const caller = await requireOrgRole(idToken, ['org_admin']);
    const snapshot = await getAdminDb().collection('programs').doc(scholarshipId).get();
    if (!snapshot.exists) return { success: false as const, error: 'This scholarship no longer exists.' };
    const existingOrg = snapshot.data()!.organizationId || snapshot.data()!.schoolId;
    if (existingOrg !== caller.orgId) {
      return { success: false as const, error: 'This scholarship belongs to another organization.' };
    }
    return { success: true as const, locked: await hasReviews(scholarshipId) };
  } catch (error) {
    return failure(error);
  }
}
