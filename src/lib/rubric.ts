
export const MIN_SCORE = 1;
export const MAX_SCORE = 10;


export const NEUTRAL_SCORE = 5;

export type RubricCriterion = {
  id?: string;
  label: string;
  description?: string;
  weight: number;
};


export function criterionKey(criterion: RubricCriterion): string {
  return criterion.id || criterion.label;
}

export function rubricWeightTotal(rubric: RubricCriterion[] | undefined | null): number {
  return (rubric || []).reduce((total, criterion) => total + (Number(criterion.weight) || 0), 0);
}


export function weightedTotal(
  rubric: RubricCriterion[] | undefined | null,
  scores: Record<string, number>,
): number {
  let weighted = 0;
  let totalWeight = 0;

  (rubric || []).forEach((criterion) => {
    const weight = Number(criterion.weight) || 0;
    if (weight <= 0) return;
    const score = scores[criterionKey(criterion)] ?? NEUTRAL_SCORE;
    weighted += score * weight;
    totalWeight += weight;
  });

  if (totalWeight <= 0) return 0;
  return Number((weighted / totalWeight).toFixed(2));
}


export function withNeutralDefaults(
  rubric: RubricCriterion[] | undefined | null,
  scores: Record<string, number>,
): Record<string, number> {
  const filled = { ...scores };
  (rubric || []).forEach((criterion) => {
    const key = criterionKey(criterion);
    if (filled[key] === undefined) filled[key] = NEUTRAL_SCORE;
  });
  return filled;
}

export type RubricCheck = { ok: true } | { ok: false; error: string };


export function validateRubric(rubric: RubricCriterion[] | undefined | null): RubricCheck {
  if (!rubric || rubric.length === 0) {
    return { ok: false, error: 'Add at least one scoring criterion.' };
  }

  for (const criterion of rubric) {
    if (!criterion || typeof criterion.label !== 'string' || criterion.label.trim() === '') {
      return { ok: false, error: 'Every criterion needs a label.' };
    }
    const weight = Number(criterion.weight);
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
      return { ok: false, error: `"${criterion.label}" needs a weight between 0 and 100.` };
    }
  }

  const total = rubricWeightTotal(rubric);

  if (Math.abs(total - 100) > 0.01) {
    return { ok: false, error: `The weights must total 100%. They currently total ${Number(total.toFixed(2))}%.` };
  }

  return { ok: true };
}


export function scoringShapeOf(rubric: RubricCriterion[] | undefined | null): string {
  return JSON.stringify(
    (rubric || []).map((criterion) => [
      criterion.id || '',
      (criterion.label || '').trim(),
      Number(criterion.weight) || 0,
    ]),
  );
}

export function changesScoring(
  before: RubricCriterion[] | undefined | null,
  after: RubricCriterion[] | undefined | null,
): boolean {
  return scoringShapeOf(before) !== scoringShapeOf(after);
}
